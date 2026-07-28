import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, city?: string, carrier?: string }
// Returns: { relays: RelayPoint[], source: string }
//
// Uses suivi-de-colis.org which embeds REAL carrier-specific relay data
// (Mondial Relay, Chronopost, Colissimo, UPS, DHL) in its HTML pages.
// The site is NOT behind Cloudflare and can be scraped from a server.
//
// URL pattern: https://suivi-de-colis.org/{carrier}/{department}/{city-slug}
// - carrier: "mondial-relay" | "chronopost" | "colissimo" | "ups" | "dhl"
// - department: lowercase name (e.g. "gard") — obtained via Nominatim reverse geocoding
// - city-slug: lowercase city name with hyphens (e.g. "junas")
//
// Fallback: OpenStreetMap Overpass API (generic shops, not carrier-specific)

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

// Map our carrier codes to suivi-de-colis.org URL slugs
const CARRIER_SLUGS: Record<string, string> = {
  mondial_relay: 'mondial-relay',
  chronopost: 'chronopost',
  colissimo: 'colissimo',
  ups: 'ups',
  dhl: 'dhl',
}

// Geocode a postal code + city using Nominatim
// Returns: { lat, lng, cityName, departmentSlug, citySlug }
async function geocode(postalCode: string, city?: string): Promise<{
  lat: number
  lng: number
  cityName: string
  departmentSlug: string
  citySlug: string
} | null> {
  const query = city
    ? `${encodeURIComponent(city + ' ' + postalCode)}, France`
    : `${postalCode}, France`
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=fr&limit=1&addressdetails=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Junashop/1.0' },
    })
    const data = await res.json()
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lon)
      const addr = data[0].address || {}

      // Try to get the city name
      let cityName = city || addr.village || addr.town || addr.city || addr.municipality || ''

      // Try to get the department name (Nominatim gives county = department in France)
      const department = addr.county || addr.state_district || ''
      // Slugify: lowercase, remove accents, replace spaces/special chars with hyphens
      const slugify = (s: string) => s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')

      const departmentSlug = slugify(department)
      const citySlug = slugify(cityName)

      return { lat, lng, cityName, departmentSlug, citySlug }
    }
  } catch (e) {
    console.error('[relay-search] geocode error:', e)
  }
  return null
}

// Calculate haversine distance (km)
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Scrape suivi-de-colis.org for real carrier-specific relay points
async function searchSuiviDeColis(
  carrier: string,
  postalCode: string,
  city: string | undefined,
  searchLat: number,
  searchLng: number,
): Promise<RelayPoint[]> {
  const carrierSlug = CARRIER_SLUGS[carrier]
  if (!carrierSlug) return []

  const geo = await geocode(postalCode, city)
  if (!geo || !geo.departmentSlug || !geo.citySlug) {
    return []
  }

  // Build URL: https://suivi-de-colis.org/{carrier}/{department}/{city}
  const url = `https://suivi-de-colis.org/${carrierSlug}/${geo.departmentSlug}/${geo.citySlug}`

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      console.warn(`[relay-search] suivi-de-colis returned ${res.status} for ${url}`)
      return []
    }

    const html = await res.text()

    // Extract JSON objects containing "latitude" from the HTML
    // The site embeds relay data as JSON objects in script tags
    const relays: RelayPoint[] = []
    const seenIds = new Set<string>()
    const latMatches = [...html.matchAll(/"latitude"\s*:\s*"([\d.]+)"/g)]

    for (const match of latMatches) {
      const latStr = match[1]
      const start = match.index!
      // Find the enclosing JSON object by scanning backwards for '{'
      let braceCount = 0
      let objStart = start
      for (let i = start; i >= Math.max(0, start - 3000); i--) {
        if (html[i] === '}') braceCount++
        else if (html[i] === '{') {
          if (braceCount === 0) { objStart = i; break }
          braceCount--
        }
      }
      // Find the closing '}'
      braceCount = 0
      let objEnd = start
      for (let i = objStart; i < Math.min(html.length, objStart + 3000); i++) {
        if (html[i] === '{') braceCount++
        else if (html[i] === '}') {
          braceCount--
          if (braceCount === 0) { objEnd = i + 1; break }
        }
      }

      const jsonStr = html.slice(objStart, objEnd)
      try {
        const obj = JSON.parse(jsonStr)
        if (!obj.label || !obj.latitude) continue

        const id = obj.code || obj.slug || `${carrier}-${obj.label}-${obj.code_postal}`
        if (seenIds.has(id)) continue
        seenIds.add(id)

        const rLat = parseFloat(obj.latitude)
        const rLng = parseFloat(obj.longitude)
        const distance = haversine(searchLat, searchLng, rLat, rLng)

        relays.push({
          id: `${carrier}-${id}`,
          name: obj.label,
          address: obj.adresse || 'Adresse non précisée',
          postalCode: obj.code_postal || postalCode,
          city: obj.commune || '',
          lat: rLat,
          lng: rLng,
          distance: parseFloat(distance.toFixed(2)),
          hours: obj.depot_hours || 'Horaires non communiqués',
        })
      } catch {
        // JSON parse failed, skip
      }
    }

    // Sort by distance
    relays.sort((a, b) => a.distance - b.distance)
    return relays
  } catch (e) {
    console.error('[relay-search] suivi-de-colis error:', e)
    return []
  }
}

// Fallback: OpenStreetMap Overpass API (generic shops, not carrier-specific)
const OVERPASS_SERVERS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
]

function formatHours(osmHours: string | undefined): string {
  if (!osmHours) return 'Horaires non communiqués'
  return osmHours
    .replace(/Mo/g, 'Lun').replace(/Tu/g, 'Mar').replace(/We/g, 'Mer')
    .replace(/Th/g, 'Jeu').replace(/Fr/g, 'Ven').replace(/Sa/g, 'Sam')
    .replace(/Su/g, 'Dim').replace(/;/g, ' · ').replace(/-/g, ' - ').slice(0, 80)
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=fr`,
      { headers: { 'User-Agent': 'Junashop/1.0' } },
    )
    const data = await res.json()
    const addr = data?.address || {}
    return addr.village || addr.town || addr.city || addr.municipality || ''
  } catch { return '' }
}

async function searchOpenStreetMap(
  lat: number, lng: number, postalCode: string, carrier: string,
): Promise<RelayPoint[]> {
  const radius = 8000
  const shopQueries = [
    `node["shop"="tobacco"](around:${radius},${lat},${lng})`,
    `node["shop"="newsagent"](around:${radius},${lat},${lng})`,
    `node["shop"="convenience"](around:${radius},${lat},${lng})`,
    `node["shop"="laundry"](around:${radius},${lat},${lng})`,
    `node["amenity"="post_office"](around:${radius},${lat},${lng})`,
    `node["shop"="supermarket"](around:${radius},${lat},${lng})`,
  ]
  const query = `[out:json][timeout:20];(${shopQueries.join(';')};);out body 40;`
  const idPrefix = carrier === 'chronopost' ? 'CHR' : 'MR'

  for (const serverUrl of OVERPASS_SERVERS) {
    try {
      const res = await fetch(serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Junashop/1.0' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const relays: RelayPoint[] = []
      const seenNames = new Set<string>()

      for (const el of data?.elements || []) {
        if (el.type !== 'node') continue
        const tags = el.tags || {}
        const name = tags.name || tags.brand || ''
        if (!name) continue
        const nameKey = name.toLowerCase().trim()
        if (seenNames.has(nameKey)) continue
        seenNames.add(nameKey)

        const addr = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
        relays.push({
          id: `${idPrefix}-${el.id}`,
          name,
          address: addr || 'Adresse non précisée',
          postalCode: tags['addr:postcode'] || postalCode,
          city: tags['addr:city'] || await reverseGeocode(el.lat, el.lon),
          lat: el.lat, lng: el.lon,
          distance: parseFloat(haversine(lat, lng, el.lat, el.lon).toFixed(2)),
          hours: formatHours(tags.opening_hours),
        })
      }
      if (relays.length > 0) {
        relays.sort((a, b) => a.distance - b.distance)
        return relays.slice(0, 15)
      }
    } catch { continue }
  }
  return []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postalCode, city, carrier } = body

    if (!postalCode || postalCode.length < 4) {
      return NextResponse.json({ error: 'Code postal requis' }, { status: 400 })
    }

    const carrierCode = carrier || 'mondial_relay'

    // Get coordinates for distance calculation
    const geo = await geocode(postalCode, city)
    const searchLat = geo?.lat || 46.6034
    const searchLng = geo?.lng || 1.8883

    // 1. Try suivi-de-colis.org (REAL carrier-specific relay points)
    const carrierRelays = await searchSuiviDeColis(
      carrierCode, postalCode, city, searchLat, searchLng,
    )

    if (carrierRelays.length > 0) {
      return NextResponse.json({ relays: carrierRelays, source: 'suivi-de-colis.org' })
    }

    // 2. Fallback: OpenStreetMap (generic shops, not carrier-specific)
    const osmRelays = await searchOpenStreetMap(searchLat, searchLng, postalCode, carrierCode)
    if (osmRelays.length > 0) {
      return NextResponse.json({ relays: osmRelays, source: 'openstreetmap' })
    }

    // 3. Last resort: empty
    return NextResponse.json({ relays: [], source: 'none' })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
