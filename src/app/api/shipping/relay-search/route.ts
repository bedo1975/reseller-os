import { NextRequest, NextResponse } from 'next/server'

// POST /api/shipping/relay-search
// Body: { postalCode: string, carrier?: string }
// Returns: { relays: RelayPoint[] }
//
// TODO: Replace mock data with real Mondial Relay API call when credentials are available.
// The Mondial Relay API uses SOAP (WSDL at https://api.mondialrelay.com/Web_Services.asmx)
// Required fields: Enseigne (merchant code), Security key, Country code (FR), Postal code, search radius
// Store credentials in BoutiqueSettings.mondialRelayEnseigne + mondialRelayApiKey

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

// Rough lat/lng mapping for major French postal code areas
function postalCodeToLatLng(pc: string): { lat: number; lng: number } {
  const dept = pc.substring(0, 2)
  const map: Record<string, { lat: number; lng: number }> = {
    '75': { lat: 48.8566, lng: 2.3522 }, // Paris
    '77': { lat: 48.6, lng: 2.6 },       // Seine-et-Marne
    '78': { lat: 48.8, lng: 2.1 },       // Yvelines
    '91': { lat: 48.5, lng: 2.4 },       // Essonne
    '92': { lat: 48.85, lng: 2.25 },      // Hauts-de-Seine
    '93': { lat: 48.9, lng: 2.45 },      // Seine-Saint-Denis
    '94': { lat: 48.8, lng: 2.45 },      // Val-de-Marne
    '95': { lat: 49.0, lng: 2.2 },       // Val-d'Oise
    '69': { lat: 45.764, lng: 4.8357 },  // Lyon
    '13': { lat: 43.2965, lng: 5.3698 },  // Marseille
    '31': { lat: 43.6047, lng: 1.4442 },  // Toulouse
    '06': { lat: 43.7102, lng: 7.262 },   // Nice
    '44': { lat: 47.2184, lng: -1.5536 }, // Nantes
    '67': { lat: 48.5846, lng: 7.7335 },  // Strasbourg
    '33': { lat: 44.8378, lng: -0.5792 }, // Bordeaux
    '59': { lat: 50.6292, lng: 3.0573 },  // Lille
    '35': { lat: 48.1173, lng: -1.6778 }, // Rennes
    '38': { lat: 45.1885, lng: 5.7245 },  // Grenoble
    '42': { lat: 45.4439, lng: 4.3893 },  // Saint-Étienne
    '34': { lat: 43.6117, lng: 3.8772 },  // Montpellier
  }
  return map[dept] || { lat: 46.6034, lng: 1.8883 } // center of France fallback
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
  'avenue de la Liberté', 'rue Saint-Michel',
]

const CITIES: Record<string, string[]> = {
  '75': ['Paris'], '69': ['Lyon'], '13': ['Marseille'], '31': ['Toulouse'],
  '06': ['Nice'], '44': ['Nantes'], '67': ['Strasbourg'], '33': ['Bordeaux'],
  '59': ['Lille'], '35': ['Rennes'], '38': ['Grenoble'], '42': ['Saint-Étienne'],
  '34': ['Montpellier'], '30': ['Nîmes'], '17': ['La Rochelle'], '33': ['Bordeaux', 'Mérignac'],
  '83': ['Toulon'], '06': ['Nice', 'Cannes'], '74': ['Annecy'], '73': ['Chambéry'],
  '01': ['Bourg-en-Bresse'], '21': ['Dijon'], '25': ['Besançon'], '22': ['Saint-Brieuc'],
  '29': ['Brest', 'Quimper'], '56': ['Vannes', 'Lorient'], '50': ['Saint-Lô', 'Cherbourg'],
  '61': ['Alençon'], '14': ['Caen'], '27': ['Évreux'], '76': ['Rouen', 'Le Havre'],
  '80': ['Amiens'], '60': ['Beauvais', 'Compiègne'], '02': ['Saint-Quentin', 'Laon'],
  '51': ['Reims', 'Châlons-en-Champagne'], '08': ['Charleville-Mézières'],
  '55': ['Bar-le-Duc'], '52': ['Chaumont'], '10': ['Troyes'], '89': ['Auxerre', 'Sens'],
  '58': ['Nevers'], '18': ['Bourges'], '36': ['Châteauroux'], '37': ['Tours'],
  '41': ['Blois'], '45': ['Orléans'], '28': ['Chartres'], '78': ['Versailles'],
  '91': ['Évry', 'Corbeil-Essonnes'], '95': ['Cergy', 'Argenteuil'],
  '77': ['Meaux', 'Melun'], '93': ['Bobigny', 'Montreuil'], '94': ['Créteil', 'Nogent-sur-Marne'],
  '92': ['Nanterre', 'Boulogne-Billancourt'], '60': ['Beauvais'],
  '62': ['Arras', 'Calais', 'Boulogne-sur-Mer'], '59': ['Lille', 'Roubaix', 'Tourcoing'],
  '57': ['Metz'], '54': ['Nancy'], '55': ['Bar-le-Duc'], '88': ['Épinal'],
  '67': ['Strasbourg', 'Haguenau'], '68': ['Mulhouse', 'Colmar'], '90': ['Belfort'],
  '70': ['Vesoul'], '39': ['Lons-le-Saunier', 'Dole'], '25': ['Besançon', 'Montbéliard'],
  '21': ['Dijon', 'Beaune'], '71': ['Mâcon', 'Chalon-sur-Saône'], '58': ['Nevers'],
  '03': ['Moulins', 'Vichy'], '63': ['Clermont-Ferrand', 'Riom'], '15': ['Aurillac'],
  '43': ['Le Puy-en-Velay'], '07': ['Aubenas', 'Privas'], '26': ['Valence', 'Montélimar'],
  '38': ['Grenoble', 'Voiron'], '73': ['Chambéry', 'Annecy'], '74': ['Annecy', 'Thonon-les-Bains'],
  '05': ['Gap', 'Briançon'], '04': ['Digne-les-Bains', 'Manosque'], '06': ['Nice', 'Grasse'],
  '83': ['Toulon', 'Draguignan'], '13': ['Marseille', 'Aubagne', 'Istres'],
  '84': ['Avignon', 'Orange'], '30': ['Nîmes', 'Alès'], '48': ['Mende'],
  '12': ['Rodez', 'Millau'], '46': ['Cahors'], '82': ['Montauban'],
  '32': ['Auch'], '65': ['Tarbes', 'Lourdes'], '64': ['Bayonne', 'Pau'],
  '40': ['Mont-de-Marsan', 'Dax'], '24': ['Périgueux', 'Bergerac'],
  '19': ['Brive-la-Gaillarde', 'Tulle'], '23': ['Guéret'], '87': ['Limoges'],
  '16': ['Angoulême', 'Cognac'], '79': ['Niort', 'Bressuire'], '86': ['Poitiers', 'Châtellerault'],
  '37': ['Tours', 'Loches'], '41': ['Blois', 'Vendôme'], '49': ['Angers', 'Cholet'],
  '53': ['Laval'], '72': ['Le Mans'], '85': ['La Roche-sur-Yon', 'Les Sables-d\'Olonne'],
  '44': ['Nantes', 'Saint-Nazaire'], '29': ['Brest', 'Quimper'],
  '22': ['Saint-Brieuc', 'Lannion'], '56': ['Vannes', 'Lorient', 'Lannion'],
  '35': ['Rennes', 'Saint-Malo', 'Redon'], '18': ['Bourges', 'Vierzon'],
  '36': ['Châteauroux'], '41': ['Blois'],
}

function generateMockRelays(postalCode: string): RelayPoint[] {
  const center = postalCodeToLatLng(postalCode)
  const dept = postalCode.substring(0, 2)
  const cities = CITIES[dept] || [`Commune ${postalCode}`]
  const count = 8
  const relays: RelayPoint[] = []

  for (let i = 0; i < count; i++) {
    // Random offset (±0.04° ≈ ±3km)
    const latOffset = (Math.random() - 0.5) * 0.08
    const lngOffset = (Math.random() - 0.5) * 0.08
    const lat = center.lat + latOffset
    const lng = center.lng + lngOffset

    // Calculate rough distance (haversine formula, simplified)
    const latDiff = latOffset * 111 // 1° lat ≈ 111km
    const lngDiff = lngOffset * 111 * Math.cos(center.lat * Math.PI / 180)
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff)

    const name = RELAY_NAMES[Math.floor(Math.random() * RELAY_NAMES.length)]
    const streetNum = Math.floor(Math.random() * 80) + 1
    const street = STREET_NAMES[Math.floor(Math.random() * STREET_NAMES.length)]
    const city = cities[Math.floor(Math.random() * cities.length)]
    const hours = ['Lun-Ven: 9h-19h, Sam: 9h-12h', 'Lun-Sam: 8h30-20h', 'Lun-Ven: 10h-12h, 14h-19h', 'Lun-Ven: 6h-22h, Sam: 7h-22h, Dim: 9h-13h'][Math.floor(Math.random() * 4)]

    relays.push({
      id: `MR-${dept}-${String(i + 1).padStart(3, '0')}`,
      name: `Relais ${name}`,
      address: `${streetNum} ${street}`,
      postalCode,
      city,
      lat,
      lng,
      distance: parseFloat(distance.toFixed(2)),
      hours,
    })
  }

  // Sort by distance
  relays.sort((a, b) => a.distance - b.distance)
  return relays
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { postalCode } = body

    if (!postalCode || postalCode.length < 4) {
      return NextResponse.json({ error: 'Code postal requis' }, { status: 400 })
    }

    // TODO: Replace with real Mondial Relay API call when credentials are available
    // const settings = await getBoutiqueSettings()
    // if (settings.mondialRelayEnseigne && settings.mondialRelayApiKey) {
    //   return await searchMondialRelayAPI(postalCode, settings)
    // }

    // Mock data for now
    const relays = generateMockRelays(postalCode)

    return NextResponse.json({ relays })
  } catch (error) {
    console.error('POST /api/shipping/relay-search error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
