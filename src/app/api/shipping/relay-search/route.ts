import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, city?: string, carrier?: string }
// Returns: { relays: RelayPoint[] }
//
// Uses Nominatim (free OpenStreetMap geocoding API, no key required) to get the real
// lat/lng of the given postal code + city, then generates mock relay points around it.
//
// TODO: Replace mock relay data with real Mondial Relay API call when credentials are available.
// The Mondial Relay API uses SOAP (WSDL at https://api.mondialrelay.com/Web_Services.asmx)
// Required fields: Enseigne (merchant code), Security key, Country code (FR), Postal code, search radius

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

const RELAY_NAMES = [
  'Tabac Presse', 'Bureau de Poste', 'Carrefour Express', 'Relais Tabac du Marché',
  'Point Relais Proxi', 'Magasin Presse Tabac', 'Commerçant Point Relais',
  'Bureautique & Tabac', 'Relais Fleuriste', 'Supérette Point Relais',
  'Pharmacie Point Relais', 'Tabac Le Central', 'Maison de la Presse',
  'Relais Service Express', 'Boutique Tabac Presse',
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

// Generate mock relay points around a real lat/lng
function generateMockRelays(lat: number, lng: number, postalCode: string, cityName: string): RelayPoint[] {
  const count = 8
  const relays: RelayPoint[] = []

  // Nearby city name variations
  const nearbyCities = [
    cityName,
    `${cityName} Centre`,
    `${cityName} Sud`,
    `${cityName} Nord`,
  ]

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

    const name = RELAY_NAMES[Math.floor(Math.random() * RELAY_NAMES.length)]
    const streetNum = Math.floor(Math.random() * 80) + 1
    const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)]
    const city = nearbyCities[Math.floor(Math.random() * nearbyCities.length)]
    const hours = HOURS[Math.floor(Math.random() * HOURS.length)]

    relays.push({
      id: `MR-${postalCode}-${String(i + 1).padStart(3, '0')}`,
      name: `Relais ${name}`,
      address: `${streetNum} ${street}`,
      postalCode,
      city,
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
    const { postalCode, city } = body

    if (!postalCode || postalCode.length < 4) {
      return NextResponse.json({ error: 'Code postal requis' }, { status: 400 })
    }

    // TODO: Replace with real Mondial Relay API call when credentials are available
    // const settings = await getBoutiqueSettings()
    // if (settings.mondialRelayEnseigne && settings.mondialRelayApiKey) {
    //   return await searchMondialRelayAPI(postalCode, settings)
    // }

    // Geocode the real location using Nominatim (free, no API key)
    const geo = await geocode(postalCode, city)

    if (geo) {
      // Use real coordinates + real city name
      const relays = generateMockRelays(geo.lat, geo.lng, postalCode, geo.cityName)
      return NextResponse.json({ relays })
    }

    // Fallback: if geocoding fails, use approximate center of France
    const relays = generateMockRelays(46.6034, 1.8883, postalCode, city || `Commune ${postalCode}`)
    return NextResponse.json({ relays })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
