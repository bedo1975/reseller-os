import maxmind from 'maxmind'
import path from 'path'
import fs from 'fs'

let lookupCache: any = null

/**
 * Returns the MaxMind GeoLite2-City lookup instance.
 * The .mmdb file is loaded once and cached for the lifetime of the process.
 *
 * Path: /home/z/my-project/data/GeoLite2-City.mmdb
 */
function getLookup(): any {
  if (lookupCache) return lookupCache

  const dbPath = path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb')
  if (!fs.existsSync(dbPath)) {
    console.warn('[geoip] GeoLite2-City.mmdb not found at', dbPath)
    return null
  }

  try {
    lookupCache = maxmind.openSync(dbPath, {
      // Watch for file changes (auto-reload if the file is updated)
      watchForUpdates: true,
    })
    console.log('[geoip] GeoLite2-City.mmdb loaded successfully')
    return lookupCache
  } catch (err) {
    console.error('[geoip] Failed to load GeoLite2-City.mmdb:', err)
    return null
  }
}

export interface GeoIpResult {
  country: string | null
  countryCode: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
}

// Mapping ISO country codes → French names (for display)
const COUNTRY_FR: Record<string, string> = {
  FR: 'France', BE: 'Belgique', CH: 'Suisse', DE: 'Allemagne',
  ES: 'Espagne', IT: 'Italie', GB: 'Royaume-Uni', PT: 'Portugal',
  NL: 'Pays-Bas', LU: 'Luxembourg', US: 'États-Unis', CA: 'Canada',
  AD: 'Andorre', MC: 'Monaco', AT: 'Autriche', IE: 'Irlande',
  DK: 'Danemark', SE: 'Suède', NO: 'Norvège', FI: 'Finlande',
  PL: 'Pologne', CZ: 'Tchéquie', SK: 'Slovaquie', HU: 'Hongrie',
  RO: 'Roumanie', BG: 'Bulgarie', GR: 'Grèce', TR: 'Turquie',
  RU: 'Russie', UA: 'Ukraine', BR: 'Brésil', MX: 'Mexique',
  AR: 'Argentine', CL: 'Chili', JP: 'Japon', CN: 'Chine',
  IN: 'Inde', KR: 'Corée du Sud', AU: 'Australie', NZ: 'Nouvelle-Zélande',
  ZA: 'Afrique du Sud', MA: 'Maroc', DZ: 'Algérie', TN: 'Tunisie',
  SN: 'Sénégal', CI: 'Côte d\'Ivoire', CM: 'Cameroun', ML: 'Mali',
}

/**
 * Look up the geographic location of an IP address using the local MaxMind GeoLite2 database.
 * Returns null if the IP is not found or the database is not available.
 *
 * This is a LOCAL lookup (no external API call) — it's instant, free, and unlimited.
 */
export function lookupGeoIp(ip: string): GeoIpResult | null {
  const lookup = getLookup()
  if (!lookup) return null

  // Clean IPv6-mapped IPv4 (::ffff:1.2.3.4 → 1.2.3.4)
  const cleanIp = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip

  try {
    const result = lookup.get(cleanIp)
    if (!result) return null

    const countryCode = result?.country?.iso_code || null
    const country = countryCode ? (COUNTRY_FR[countryCode] || result?.country?.names?.en || countryCode) : null
    const city = result?.city?.names?.en || null
    const region = result?.subdivisions?.[0]?.names?.en || null
    const latitude = result?.location?.latitude || null
    const longitude = result?.location?.longitude || null

    return { country, countryCode, city, region, latitude, longitude }
  } catch (err) {
    console.error('[geoip] Lookup error for', cleanIp, ':', err)
    return null
  }
}
