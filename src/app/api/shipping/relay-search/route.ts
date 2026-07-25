import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, city?: string, carrier?: string }
// Returns: { relays: RelayPoint[] }
//
// Uses Nominatim (free OpenStreetMap geocoding API, no key required) to get the real
// lat/lng of the given postal code + city, then generates mock relay points around it.
//
// Supports two carriers:
// - "mondial_relay" → Mondial Relay points (TODO: replace with real SOAP API)
// - "chronopost" → Chronopost Pickup points (TODO: replace with real REST API)
//
// When the user has API credentials, replace the mock with real API calls.
// Mondial Relay: SOAP WSDL at https://api.mondialrelay.com/Web_Services.asmx
// Chronopost: REST API at https://api.chronopost.com (requires compte marché)

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

// Geocode a postal code + city using Nominatim (free, no API key)
async function geocode(postalCode: string, city?: string): Promise<{ lat: number; lng: number; cityName: string } | null> {
  const query = city
    ? `${encodeURIComponent(city + ' ' + postalCode)}, France`
    : `${postalCode}, France`
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=fr&limit=1`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Junashop/1.0' }, // Nominatim requires a User-Agent
    })
    const data = await res.json()
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat)
      const lng = parseFloat(data[0].lon)
      // Extract city name from the Nominatim display_name
      const displayName = data[0].display_name || ''
      const parts = displayName.split(',')
      let cityName = city || ''
      if (!cityName) {
        // Try to find the city name (usually 2nd or 3rd element in French addresses)
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

const RELAY_NAMES_MR = [
  'Tabac Presse', 'Bureau de Poste', 'Carrefour Express', 'Relais Tabac du Marché',
  'Point Relais Proxi', 'Magasin Presse Tabac', 'Commerçant Point Relais',
  'Bureautique & Tabac', 'Relais Fleuriste', 'Supérette Point Relais',
  'Pharmacie Point Relais', 'Tabac Le Central', 'Maison de la Presse',
  'Relais Service Express', 'Boutique Tabac Presse',
]

const RELAY_NAMES_CHRONO = [
  'Pickup Chrono', 'Relais Chronopost', 'Point Pickup Express', 'Tabac Pickup',
  'Commerçant Pickup', 'Pickup Relais Proxi', 'Relais Chrono Express',
  'Boutique Pickup', 'Point Chrono Service', 'Pickup Tabac Presse',
  'Relais Express Pickup', 'Commerçant Chrono Relais',
]

const STREET_NAMES = [
  'rue de la République', 'avenue Jean Jaurès', 'rue du Commerce',
  'boulevard Voltaire', 'rue Victor Hugo', 'avenue de la Gare',
  'rue Pasteur', 'place du Marché', 'rue Gambetta', 'avenue Charles de Gaulle',
  'rue des Écoles', 'boulevard Maréchal Foch', 'rue de la Poste',
  'avenue de la Liberté', 'rue Saint-Michel', 'rue des Tilleuls',
  'chemin Rural', 'route de la Gare', 'impasse du Parc', 'rue du Stade',
]

const HOURS = [
  'Lun-Ven: 9h-19h, Sam: 9h-12h',
  'Lun-Sam: 8h30-20h',
  'Lun-Ven: 10h-12h, 14h-19h',
  'Lun-Ven: 6h-22h, Sam: 7h-22h, Dim: 9h-13h',
]

// Reverse geocode: get the real city name from lat/lng using Nominatim
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&accept-language=fr`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Junashop/1.0' },
    })
    const data = await res.json()
    if (data?.address) {
      // Try village, town, city, municipality in order
      const addr = data.address
      return addr.village || addr.town || addr.city || addr.municipality || addr.county || ''
    }
  } catch (e) {
    console.error('[relay-search] reverse geocode error:', e)
  }
  return ''
}

// Generate mock relay points around a real lat/lng
async function generateMockRelays(lat: number, lng: number, postalCode: string, cityName: string, carrier: string = 'mondial_relay'): Promise<RelayPoint[]> {
  const count = 8
  const relays: RelayPoint[] = []
  const relayNames = carrier === 'chronopost' ? RELAY_NAMES_CHRONO : RELAY_NAMES_MR
  const idPrefix = carrier === 'chronopost' ? 'CHR' : 'MR'
  const namePrefix = carrier === 'chronopost' ? 'Pickup' : 'Relais'

  for (let i = 0; i < count; i++) {
    // Random offset: ±0.03° lat (≈±3km), ±0.04° lng (≈±3km)
    const latOffset = (Math.random() - 0.5) * 0.06
    const lngOffset = (Math.random() - 0.5) * 0.08
    const rLat = lat + latOffset
    const rLng = lng + lngOffset

    // Calculate rough distance
    const latDiff = latOffset * 111
    const lngDiff = lngOffset * 111 * Math.cos(lat * Math.PI / 180)
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

    // Reverse geocode each point to get the real city name
    const realCityName = await reverseGeocode(rLat, rLng)

    const name = relayNames[Math.floor(Math.random() * relayNames.length)]
    const streetNum = Math.floor(Math.random() * 80) + 1
    const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)]
    const hours = HOURS[Math.floor(Math.random() * HOURS.length)]

    relays.push({
      id: `${idPrefix}-${postalCode}-${String(i + 1).padStart(3, '0')}`,
      name: `${namePrefix} ${name}`,
      address: `${streetNum} ${street}`,
      postalCode,
      city: realCityName || cityName,
      lat: rLat,
      lng: rLng,
      distance: parseFloat(distance.toFixed(2)),
      hours,
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

    // Determine which carrier to use (default: mondial_relay)
    const carrierCode = carrier || 'mondial_relay'

    // TODO: Replace with real API calls when credentials are available
    // if (carrierCode === 'mondial_relay' && settings.mondialRelayEnseigne && settings.mondialRelayApiKey) {
    //   return await searchMondialRelayAPI(postalCode, settings)
    // }
    // if (carrierCode === 'chronopost' && settings.chronopostApiKey) {
    //   return await searchChronopostAPI(postalCode, settings)
    // }

    // Geocode the real location using Nominatim (free, no API key)
    const geo = await geocode(postalCode, city)

    if (geo) {
      // Use real coordinates + real city name
      const relays = await generateMockRelays(geo.lat, geo.lng, postalCode, geo.cityName, carrierCode)
      return NextResponse.json({ relays })
    }

    // Fallback: if geocoding fails, use approximate center of France
    const relays = await generateMockRelays(46.6034, 1.8883, postalCode, city || `Commune ${postalCode}`, carrierCode)
    return NextResponse.json({ relays })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
