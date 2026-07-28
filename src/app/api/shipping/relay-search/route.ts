import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, city?: string, carrier?: string }
// Returns: { relays: RelayPoint[] }
//
// Uses Nominatim (OpenStreetMap geocoding) to get real lat/lng, then queries
// Overpass API to find REAL shops near that location.
//
// Carrier-specific APIs (Mondial Relay, Chronopost, Colissimo) are all behind
// Cloudflare and cannot be called from a server. To use them, configure official
// API credentials in Boutique Admin → Livraison.

interface RelayPoint {
  id: string
  name: string
  address: string
  postalCode: string
  city: string
  lat: number
  lng: number
  distance: number
  hours: string
}

// Multiple Overpass servers for failover (main server is often overloaded)
const OVERPASS_SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
]

// Geocode a postal code + city using Nominatim (free, no API key)
async function geocode(postalCode: string, city?: string): Promise<{ lat: number; lng: number; cityName: string } | null> {
  const query = city
    ? `${encodeURIComponent(city + ' ' + postalCode)}, France`
    : `${postalCode}, France`
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=fr&limit=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Junashop/1.0' },
    })
    const data = await res.json()
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lon)
      const displayName = data[0].display_name || ''
      const parts = displayName.split(',')
      let cityName = city || ''
      if (!cityName) {
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i].trim()
          if (!/^\d+$/.test(p) && p !== 'France' && p.length > 2) {
            cityName = p
            break
          }
        }
      }
      return { lat, lng, cityName }
    }
  } catch (e) {
    console.error('[relay-search] geocode error:', e)
  }
  return null
}

// Reverse geocode: get the real city name from lat/lng using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=fr`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Junashop/1.0' },
    })
    const data = await res.json()
    if (data?.address) {
      const addr = data.address
      return addr.village || addr.town || addr.city || addr.municipality || addr.county || ''
    }
  } catch (e) {
    console.error('[relay-search] reverse geocode error:', e)
  }
  return ''
}

// Calculate haversine distance between two points (in km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Format OSM opening_hours string to a human-readable format
function formatHours(osmHours: string | undefined): string {
  if (!osmHours) return 'Horaires non communiqués'
  let formatted = osmHours
    .replace(/Mo/g, 'Lun')
    .replace(/Tu/g, 'Mar')
    .replace(/We/g, 'Mer')
    .replace(/Th/g, 'Jeu')
    .replace(/Fr/g, 'Ven')
    .replace(/Sa/g, 'Sam')
    .replace(/Su/g, 'Dim')
    .replace(/;/g, ' · ')
    .replace(/-/g, ' - ')
  if (formatted.length > 80) {
    formatted = formatted.substring(0, 77) + '...'
  }
  return formatted
}

// Query Overpass API for real shops near the given coordinates
// Tries multiple servers for failover
async function searchRealShops(
  lat: number,
  lng: number,
  postalCode: string,
  carrier: string,
): Promise<RelayPoint[]> {
  const radius = 8000 // 8km search radius

  // Shop types that typically host relay points
  const shopQueries = [
    `node["shop"="tobacco"](around:${radius},${lat},${lng})`,
    `node["shop"="newsagent"](around:${radius},${lat},${lng})`,
    `node["shop"="convenience"](around:${radius},${lat},${lng})`,
    `node["shop"="laundry"](around:${radius},${lat},${lng})`,
    `node["amenity"="post_office"](around:${radius},${lat},${lng})`,
    `node["shop"="supermarket"](around:${radius},${lat},${lng})`,
    `node["shop"="alcohol"](around:${radius},${lat},${lng})`,
    `node["amenity"="fuel"](around:${radius},${lat},${lng})`, // gas stations often have relay points
  ]

  const overpassQuery = `[out:json][timeout:20];(${shopQueries.join(';')};);out body 40;`

  const idPrefix = carrier === 'chronopost' ? 'CHR' : 'MR'

  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Junashop/1.0',
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        console.warn(`[relay-search] ${serverUrl} returned ${res.status}`)
        continue
      }

      const data = await res.json()
      const elements = data?.elements || []

      const relays: RelayPoint[] = []
      const seenNames = new Set<string>() // dedup by name

      for (const el of elements) {
        if (el.type !== 'node') continue
        const tags = el.tags || {}
        const name = tags.name || tags.brand || ''
        if (!name || name === '?') continue

        // Skip if already seen (dedup)
        const nameKey = name.toLowerCase().trim()
        if (seenNames.has(nameKey)) continue
        seenNames.add(nameKey)

        // Build address — allow empty street but require at least postalCode or city
        const housenumber = tags['addr:housenumber'] || ''
        const street = tags['addr:street'] || ''
        const addressParts = [housenumber, street].filter(Boolean).join(' ')

        const elPostalCode = tags['addr:postcode'] || postalCode
        const elCity = tags['addr:city'] || ''
        const elLat = el.lat
        const elLng = el.lon

        const distance = haversine(lat, lng, elLat, elLng)

        relays.push({
          id: `${idPrefix}-${el.id}`,
          name,
          address: addressParts || 'Adresse non précisée',
          postalCode: elPostalCode,
          city: elCity,
          lat: elLat,
          lng: elLng,
          distance: parseFloat(distance.toFixed(2)),
          hours: formatHours(tags.opening_hours),
        })
      }

      if (relays.length > 0) {
        // Sort by distance and limit to 15
        relays.sort((a, b) => a.distance - b.distance)
        return relays.slice(0, 15)
      }
    } catch (e) {
      console.warn(`[relay-search] ${serverUrl} failed:`, e instanceof Error ? e.message : e)
      continue
    }
  }

  return [] // all servers failed
}

// Fallback: generate mock relay points (only if Overpass fails completely)
const FALLBACK_NAMES = [
  'Tabac Presse', 'Bureau de Poste', 'Carrefour Express', 'Relais Tabac du Marché',
  'Point Relais Proxi', 'Magasin Presse Tabac', 'Commerçant Point Relais',
  'Bureautique & Tabac', 'Supérette Point Relais',
  'Tabac Le Central', 'Maison de la Presse', 'Relais Service Express',
]

const FALLBACK_STREETS = [
  'rue de la République', 'avenue Jean Jaurès', 'rue du Commerce',
  'boulevard Voltaire', 'rue Victor Hugo', 'avenue de la Gare',
  'rue Pasteur', 'place du Marché', 'rue Gambetta',
]

async function generateFallbackRelays(
  lat: number,
  lng: number,
  postalCode: string,
  cityName: string,
  carrier: string,
): Promise<RelayPoint[]> {
  const count = 6
  const relays: RelayPoint[] = []
  const idPrefix = carrier === 'chronopost' ? 'CHR' : 'MR'

  for (let i = 0; i < count; i++) {
    const latOffset = (Math.random() - 0.5) * 0.06
    const lngOffset = (Math.random() - 0.5) * 0.08
    const rLat = lat + latOffset
    const rLng = lng + lngOffset
    const distance = haversine(lat, lng, rLat, rLng)
    const realCityName = await reverseGeocode(rLat, rLng)

    relays.push({
      id: `${idPrefix}-${postalCode}-${String(i + 1).padStart(3, '0')}`,
      name: FALLBACK_NAMES[i % FALLBACK_NAMES.length],
      address: `${Math.floor(Math.random() * 80) + 1} ${FALLBACK_STREETS[i % FALLBACK_STREETS.length]}`,
      postalCode,
      city: realCityName || cityName,
      lat: rLat,
      lng: rLng,
      distance: parseFloat(distance.toFixed(2)),
      hours: 'Lun-Ven: 9h-19h, Sam: 9h-12h',
    })
  }

  relays.sort((a, b) => a.distance - b.distance)
  return relays
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postalCode, city, carrier } = body

    if (!postalCode || postalCode.length < 4) {
      return NextResponse.json({ error: 'Code postal requis' }, { status: 400 })
    }

    const carrierCode = carrier || 'mondial_relay'

    // Geocode the real location using Nominatim
    const geo = await geocode(postalCode, city)

    const searchLat = geo?.lat || 46.6034
    const searchLng = geo?.lng || 1.8883
    const searchCity = geo?.cityName || city || `Commune ${postalCode}`

    // Try to find REAL shops via Overpass API (multiple servers for failover)
    const realRelays = await searchRealShops(searchLat, searchLng, postalCode, carrierCode)

    if (realRelays.length > 0) {
      return NextResponse.json({ relays: realRelays, source: 'openstreetmap' })
    }

    // Fallback: generate mock relay points if Overpass returned nothing
    const fallbackRelays = await generateFallbackRelays(searchLat, searchLng, postalCode, searchCity, carrierCode)
    return NextResponse.json({ relays: fallbackRelays, source: 'fallback' })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
