import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/track
 * Public — tracks a visitor + page view.
 *
 * Server-side enrichment:
 * - IP address → geo-IP (country, city) via ipinfo.io (HTTPS, free, 50k/month)
 * - User-Agent → device, browser, OS parsing
 * - Referrer → source normalization (google, facebook, direct, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { visitorId, path, pageType, productSku, category, duration, isFirstVisit } = body

    if (!visitorId || !path) {
      return NextResponse.json({ ok: true })
    }

    // ── Extract real client IP ──
    // Behind nginx: X-Real-IP is set to $remote_addr (the real client IP)
    // X-Forwarded-For is "client_ip, proxy1_ip, ..." but can contain local IPs
    // if nginx proxies to localhost.
    // Strategy: try x-real-ip first, then parse x-forwarded-for for the first
    // non-local IP, then cf-connecting-ip.
    const forwarded = req.headers.get('x-forwarded-for')
    const xRealIp = req.headers.get('x-real-ip')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')

    // Helper: is this IP local/private?
    const isPrivateIp = (ip: string): boolean => {
      const clean = ip.startsWith('::ffff:') ? ip.replace('::ffff:', '') : ip
      return clean === '127.0.0.1'
        || clean === '::1'
        || clean.startsWith('192.168.')
        || clean.startsWith('10.')
        || clean.startsWith('172.16.')
        || clean.startsWith('172.17.')
        || clean.startsWith('172.18.')
        || clean.startsWith('172.19.')
        || clean.startsWith('172.2')
        || clean.startsWith('172.3')
        || clean.startsWith('::ffff:127.')
        || clean.startsWith('::ffff:192.168.')
        || clean.startsWith('::ffff:10.')
    }

    let ipAddress: string | null = null

    // 1. Try X-Real-IP (set by nginx to $remote_addr)
    if (xRealIp && !isPrivateIp(xRealIp.trim())) {
      ipAddress = xRealIp.trim()
    }

    // 2. Try X-Forwarded-For — find the first non-local IP in the chain
    if (!ipAddress && forwarded) {
      const ips = forwarded.split(',').map(s => s.trim())
      for (const ip of ips) {
        if (!isPrivateIp(ip)) {
          ipAddress = ip
          break
        }
      }
    }

    // 3. Try Cloudflare header
    if (!ipAddress && cfConnectingIp && !isPrivateIp(cfConnectingIp.trim())) {
      ipAddress = cfConnectingIp.trim()
    }

    // Clean up IPv6-mapped IPv4
    if (ipAddress && ipAddress.startsWith('::ffff:')) {
      ipAddress = ipAddress.replace('::ffff:', '')
    }

    const isLocalIp = !ipAddress || isPrivateIp(ipAddress)

    const userAgent = req.headers.get('user-agent') || null
    const language = req.headers.get('accept-language')?.split(',')[0] || null
    const referrer = body.referrer || req.headers.get('referer') || null

    // ── Parse referrer source ──
    let referrerSource = 'direct'
    let referrerDomain: string | null = null
    if (referrer) {
      try {
        const url = new URL(referrer)
        referrerDomain = url.hostname.replace(/^www\./, '')
        if (referrerDomain.includes('google')) referrerSource = 'google'
        else if (referrerDomain.includes('facebook')) referrerSource = 'facebook'
        else if (referrerDomain.includes('instagram')) referrerSource = 'instagram'
        else if (referrerDomain.includes('twitter') || referrerDomain.includes('x.com')) referrerSource = 'twitter'
        else if (referrerDomain.includes('leboncoin')) referrerSource = 'leboncoin'
        else if (referrerDomain.includes('vinted')) referrerSource = 'vinted'
        else if (referrerDomain.includes('bing')) referrerSource = 'bing'
        else if (referrerDomain.includes('yahoo')) referrerSource = 'yahoo'
        else referrerSource = 'other'
      } catch {
        referrerSource = 'other'
      }
    }

    // ── Parse User-Agent ──
    let device = 'desktop'
    let browser = 'unknown'
    let os = 'unknown'

    if (userAgent) {
      if (/iPad|Tablet/i.test(userAgent)) device = 'tablet'
      else if (/Mobile|Android|iPhone/i.test(userAgent)) device = 'mobile'

      if (/Edg/i.test(userAgent)) browser = 'edge'
      else if (/Chrome/i.test(userAgent)) browser = 'chrome'
      else if (/Firefox/i.test(userAgent)) browser = 'firefox'
      else if (/Safari/i.test(userAgent)) browser = 'safari'

      if (/Windows/i.test(userAgent)) os = 'windows'
      else if (/Mac OS/i.test(userAgent)) os = 'macos'
      else if (/Android/i.test(userAgent)) os = 'android'
      else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'ios'
      else if (/Linux/i.test(userAgent)) os = 'linux'
    }

    // ── Geo-IP via ipinfo.io (HTTPS, free, 50k req/month, no API key) ──
    let country: string | null = null
    let countryCode: string | null = null
    let city: string | null = null
    let region: string | null = null

    if (!isLocalIp && ipAddress) {
      try {
        const geoRes = await fetch(`https://ipinfo.io/${ipAddress}/json`, {
          signal: AbortSignal.timeout(5000),
        })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo && !geo.error && geo.country) {
            country = geo.country_name || null
            countryCode = geo.country || null
            city = geo.city || null
            region = geo.region || null
            // If country_name is missing, use a mapping from country code
            if (!country && countryCode) {
              const countryMap: Record<string, string> = {
                FR: 'France', BE: 'Belgique', CH: 'Suisse', DE: 'Allemagne',
                ES: 'Espagne', IT: 'Italie', GB: 'Royaume-Uni', PT: 'Portugal',
                NL: 'Pays-Bas', LU: 'Luxembourg', US: 'États-Unis', CA: 'Canada',
              }
              country = countryMap[countryCode] || countryCode
            }
          }
        }
      } catch {
        // Geo-IP failed — IP is still stored, just without geo data
      }
    }

    // ── Save/update visitor tracking ──
    // We ALWAYS check if a tracking record exists for this visitorId.
    // If not, we create one (regardless of isFirstVisit from the client —
    // the client might have cleared localStorage, or it's a new session).
    // If it exists but has no IP (created when geo failed), we update it.
    const existing = await db.visitorTracking.findFirst({
      where: { visitorId },
      select: { id: true, ipAddress: true, city: true },
    })

    if (!existing) {
      // New visitor — create tracking record with IP + geo
      await db.visitorTracking.create({
        data: {
          visitorId,
          ipAddress,
          country,
          countryCode,
          city,
          region,
          userAgent,
          referrer,
          referrerSource,
          referrerDomain,
          language,
          device,
          browser,
          os,
          isFirstVisit: true,
        },
      })
    } else if (!existing.ipAddress && ipAddress) {
      // Existing visitor but no IP stored yet — update with IP + geo
      await db.visitorTracking.update({
        where: { id: existing.id },
        data: {
          ipAddress,
          country,
          countryCode,
          city,
          region,
          userAgent,
          referrer,
          referrerSource,
          referrerDomain,
          language,
          device,
          browser,
          os,
        },
      })
    }

    // ── Save page view ──
    await db.pageView.create({
      data: {
        visitorId,
        path: path.slice(0, 500),
        pageType: pageType || 'other',
        productSku: productSku || null,
        category: category || null,
        referrer: referrer || null,
        duration: duration ? parseInt(duration) : null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/boutique/track error:', error)
    return NextResponse.json({ ok: true })
  }
}
