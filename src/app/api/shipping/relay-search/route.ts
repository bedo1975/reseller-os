import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, city?: string, carrier?: string }
// Returns: { relays: RelayPoint[], source: string }
//
// Uses suivi-de-colis.org which embeds REAL carrier-specific relay data
// (Mondial Relay, Chronopost, Colissimo, UPS, DHL) in its HTML pages.
//
// URL pattern: https://suivi-de-colis.org/{carrier}/{department-slug}/{city-slug}
// The department is deduced from the postal code (first 2 digits = department number).

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

const CARRIER_SLUGS: Record<string, string> = {
  mondial_relay: 'mondial-relay',
  chronopost: 'chronopost',
  colissimo: 'colissimo',
  ups: 'ups',
  dhl: 'dhl',
}

// ── Table de mapping : numéro de département → slug nom ──
// Déduit depuis les 2 premiers chiffres du code postal
const DEPARTMENT_SLUGS: Record<string, string> = {
  '01': 'ain', '02': 'aisne', '03': 'allier', '04': 'alpes-de-haute-provence',
  '05': 'hautes-alpes', '06': 'alpes-maritimes', '07': 'ardeche', '08': 'ardennes',
  '09': 'ariege', '10': 'aube', '11': 'aude', '12': 'aveyron',
  '13': 'bouches-du-rhone', '14': 'calvados', '15': 'cantal', '16': 'charente',
  '17': 'charente-maritime', '18': 'cher', '19': 'correze',
  '2A': 'corse-du-sud', '2B': 'haute-corse',
  '21': 'cote-d-or', '22': 'cotes-d-armor', '23': 'creuse', '24': 'dordogne',
  '25': 'doubs', '26': 'drome', '27': 'eure', '28': 'eure-et-loir',
  '29': 'finistere', '30': 'gard', '31': 'haute-garonne', '32': 'gers',
  '33': 'gironde', '34': 'herault', '35': 'ille-et-vilaine', '36': 'indre',
  '37': 'indre-et-loire', '38': 'isere', '39': 'jura', '40': 'landes',
  '41': 'loir-et-cher', '42': 'loire', '43': 'haute-loire', '44': 'loire-atlantique',
  '45': 'loiret', '46': 'lot', '47': 'lot-et-garonne', '48': 'lozere',
  '49': 'maine-et-loire', '50': 'manche', '51': 'marne', '52': 'haute-marne',
  '53': 'mayenne', '54': 'meurthe-et-moselle', '55': 'meuse', '56': 'morbihan',
  '57': 'moselle', '58': 'nievre', '59': 'nord', '60': 'oise',
  '61': 'orne', '62': 'pas-de-calais', '63': 'puy-de-dome', '64': 'pyrenees-atlantiques',
  '65': 'hautes-pyrenees', '66': 'pyrenees-orientales', '67': 'bas-rhin', '68': 'haut-rhin',
  '69': 'rhone', '70': 'haute-saone', '71': 'saone-et-loire', '72': 'sarthe',
  '73': 'savoie', '74': 'haute-savoie', '75': 'paris', '76': 'seine-maritime',
  '77': 'seine-et-marne', '78': 'yvelines', '79': 'deux-sevres', '80': 'somme',
  '81': 'tarn', '82': 'tarn-et-garonne', '83': 'var', '84': 'vaucluse',
  '85': 'vendee', '86': 'vienne', '87': 'haute-vienne', '88': 'vosges',
  '89': 'yonne', '90': 'territoire-de-belfort', '91': 'essonne', '92': 'hauts-de-seine',
  '93': 'seine-saint-denis', '94': 'val-de-marne', '95': 'val-d-oise',
  '971': 'guadeloupe', '972': 'martinique', '973': 'guyane', '974': 'la-reunion', '976': 'mayotte',
}

// Déduit le slug du département depuis le code postal
function getDepartmentSlug(postalCode: string): string | null {
  const cp = postalCode.trim()
  if (cp.length < 5) return null

  // Cas spécial : Corse (20000-20999 = 2A, 20600-20999 parfois 2B)
  // Pour simplifier, on utilise "corse-du-sud" pour 20000-20199 et "haute-corse" pour le reste
  if (cp.startsWith('20')) {
    const num = parseInt(cp)
    if (num >= 20000 && num < 20190) return 'corse-du-sud'
    return 'haute-corse'
  }

  // DOM : 971-976 (les 3 premiers chiffres)
  if (cp.startsWith('971')) return 'guadeloupe'
  if (cp.startsWith('972')) return 'martinique'
  if (cp.startsWith('973')) return 'guyane'
  if (cp.startsWith('974')) return 'la-reunion'
  if (cp.startsWith('976')) return 'mayotte'

  // Métropole : les 2 premiers chiffres
  const deptCode = cp.substring(0, 2)
  return DEPARTMENT_SLUGS[deptCode] || null
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Geocode a postal code + city using Nominatim (for lat/lng only)
async function geocode(postalCode: string, city?: string): Promise<{ lat: number; lng: number; cityName: string } | null> {
  // Strategy: try multiple queries to get the most precise location
  // 1. city + postal code (most precise if city is provided and correct)
  // 2. postal code only (fallback — gives the center of the postal code area)
  const queries = city
    ? [
        `${encodeURIComponent(city + ' ' + postalCode)}, France`,
        `${postalCode}, France`,
      ]
    : [`${postalCode}, France`]

  for (const query of queries) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&countrycodes=fr&limit=1`
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Junashop/1.0' } })
      const data = await res.json()
      if (data && data.length > 0) {
        const addr = data[0].address || {}
        const cityName = city || addr.village || addr.town || addr.city || addr.municipality || ''
        const lat = parseFloat(data[0].lat)
        const lng = parseFloat(data[0].lon)
        // Sanity check: coordinates should be in metropolitan France (or DOM)
        // Mainland: lat 41-51, lng -5 to 10
        // DOM: various (Guadeloupe ~16/-61, Reunion ~-21/55, etc.)
        const isMainland = lat >= 41 && lat <= 51 && lng >= -5 && lng <= 10
        const isDOM = (lat >= 14 && lat <= 18 && lng >= -62 && lng <= -60) || // Guadeloupe/Martinique
                      (lat >= 2 && lat <= 6 && lng >= -54 && lng <= -51) ||     // Guyane
                      (lat >= -22 && lat <= -20 && lng >= 55 && lng <= 56) ||   // Reunion
                      (lat >= -13 && lat <= -12 && lng >= 45 && lng <= 46)      // Mayotte
        if (isMainland || isDOM) {
          return { lat, lng, cityName }
        }
      }
    } catch (e) {
      console.error('[relay-search] geocode error:', e)
    }
  }
  return null
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
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

  const deptSlug = getDepartmentSlug(postalCode)
  if (!deptSlug) {
    console.warn(`[relay-search] could not determine department for postal code ${postalCode}`)
    return []
  }

  // Get the city name — use the one from the form, or geocode
  let cityName = city || ''
  if (!cityName) {
    const geo = await geocode(postalCode)
    cityName = geo?.cityName || ''
  }
  if (!cityName) return []

  const citySlug = slugify(cityName)
  if (!citySlug) return []

  const url = `https://suivi-de-colis.org/${carrierSlug}/${deptSlug}/${citySlug}`

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
    const relays: RelayPoint[] = []
    const seenIds = new Set<string>()
    const latMatches = [...html.matchAll(/"latitude"\s*:\s*"([\d.]+)"/g)]

    for (const match of latMatches) {
      const start = match.index!
      let braceCount = 0
      let objStart = start
      for (let i = start; i >= Math.max(0, start - 3000); i--) {
        if (html[i] === '}') braceCount++
        else if (html[i] === '{') {
          if (braceCount === 0) { objStart = i; break }
          braceCount--
        }
      }
      braceCount = 0
      let objEnd = start
      for (let i = objStart; i < Math.min(html.length, objStart + 3000); i++) {
        if (html[i] === '{') braceCount++
        else if (html[i] === '}') {
          braceCount--
          if (braceCount === 0) { objEnd = i + 1; break }
        }
      }

      try {
        const obj = JSON.parse(html.slice(objStart, objEnd))
        if (!obj.label || !obj.latitude) continue

        const id = obj.code || obj.slug || `${carrier}-${obj.label}`
        if (seenIds.has(id)) continue
        seenIds.add(id)

        const rLat = parseFloat(obj.latitude)
        const rLng = parseFloat(obj.longitude)
        relays.push({
          id: `${carrier}-${id}`,
          name: obj.label,
          address: obj.adresse || 'Adresse non précisée',
          postalCode: obj.code_postal || postalCode,
          city: obj.commune || '',
          lat: rLat, lng: rLng,
          distance: parseFloat(haversine(searchLat, searchLng, rLat, rLng).toFixed(2)),
          hours: obj.depot_hours || 'Horaires non communiqués',
        })
      } catch {}
    }

    relays.sort((a, b) => a.distance - b.distance)
    return relays
  } catch (e) {
    console.error('[relay-search] suivi-de-colis error:', e)
    return []
  }
}

// Fallback: OpenStreetMap Overpass API
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
    let searchLat = geo?.lat || 46.6034
    let searchLng = geo?.lng || 1.8883
    const geocodeSuccess = !!geo

    // 1. Try suivi-de-colis.org (REAL carrier-specific relay points)
    const carrierRelays = await searchSuiviDeColis(
      carrierCode, postalCode, city, searchLat, searchLng,
    )

    if (carrierRelays.length > 0) {
      // If geocoding failed or seems wrong, recalculate distances using
      // the centroid of the found relay points (much more reliable)
      if (!geocodeSuccess) {
        const avgLat = carrierRelays.reduce((s, r) => s + r.lat, 0) / carrierRelays.length
        const avgLng = carrierRelays.reduce((s, r) => s + r.lng, 0) / carrierRelays.length
        searchLat = avgLat
        searchLng = avgLng
        for (const r of carrierRelays) {
          r.distance = parseFloat(haversine(searchLat, searchLng, r.lat, r.lng).toFixed(2))
        }
        carrierRelays.sort((a, b) => a.distance - b.distance)
      }

      return NextResponse.json({
        relays: carrierRelays,
        source: 'suivi-de-colis.org',
        searchLocation: { lat: searchLat, lng: searchLng, city: geo?.cityName || city || '' },
      })
    }

    // 2. Fallback: OpenStreetMap (generic shops, not carrier-specific)
    const osmRelays = await searchOpenStreetMap(searchLat, searchLng, postalCode, carrierCode)
    if (osmRelays.length > 0) {
      // Recalculate distances if geocoding failed
      if (!geocodeSuccess) {
        const avgLat = osmRelays.reduce((s, r) => s + r.lat, 0) / osmRelays.length
        const avgLng = osmRelays.reduce((s, r) => s + r.lng, 0) / osmRelays.length
        searchLat = avgLat
        searchLng = avgLng
        for (const r of osmRelays) {
          r.distance = parseFloat(haversine(searchLat, searchLng, r.lat, r.lng).toFixed(2))
        }
        osmRelays.sort((a, b) => a.distance - b.distance)
      }

      return NextResponse.json({
        relays: osmRelays,
        source: 'openstreetmap',
        searchLocation: { lat: searchLat, lng: searchLng, city: geo?.cityName || city || '' },
      })
    }

    // 3. Last resort: empty with a message
    return NextResponse.json({
      relays: [],
      source: 'none',
      message: `Aucun point relais trouvé pour le code postal ${postalCode}. Essayez une ville voisine.`,
      searchLocation: geocodeSuccess ? { lat: searchLat, lng: searchLng, city: geo?.cityName || city || '' } : null,
    })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
