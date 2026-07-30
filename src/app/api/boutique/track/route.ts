import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/track
 * Public — tracks a visitor + page view.
 *
 * Body: {
 *   visitorId: string,       // unique ID from localStorage
 *   path: string,            // current page path
 *   pageType: string,        // home | product | category | checkout | other
 *   productSku?: string,
 *   category?: string,
 *   duration?: number,       // seconds spent on page (for unload events)
 *   isFirstVisit?: boolean,
 * }
 *
 * Server-side enrichment:
 * - IP address → geo-IP (country, city) via free ipapi.co API (no key)
 * - User-Agent → device, browser, OS parsing
 * - Referrer → source normalization (google, facebook, direct, etc.)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { visitorId, path, pageType, productSku, category, duration, isFirstVisit } = body

    if (!visitorId || !path) {
      return NextResponse.json({ ok: true }) // silent fail
    }

    // ── Extract request metadata ──
    // Behind nginx/proxy: x-forwarded-for contains the real client IP
    // Format: "client_ip, proxy1_ip, proxy2_ip" — we want the first one
    const forwarded = req.headers.get('x-forwarded-for')
    const xRealIp = req.headers.get('x-real-ip')
    const cfConnectingIp = req.headers.get('cf-connecting-ip')
    let ipAddress = null

    if (forwarded) {
      // x-forwarded-for: "client, proxy1, proxy2" → take the first (client)
      ipAddress = forwarded.split(',')[0].trim()
    } else if (xRealIp) {
      ipAddress = xRealIp.trim()
    } else if (cfConnectingIp) {
      ipAddress = cfConnectingIp.trim()
    }

    // Filter out local/private IPs
    const isLocalIp = !ipAddress
      || ipAddress === '127.0.0.1'
      || ipAddress === '::1'
      || ipAddress.startsWith('192.168.')
      || ipAddress.startsWith('10.')
      || ipAddress.startsWith('172.16.')
      || ipAddress.startsWith('::ffff:127.')

    const userAgent = req.headers.get('user-agent') || null
    const language = req.headers.get('accept-language')?.split(',')[0] || null
    const referrer = body.referrer || req.headers.get('referer') || null

    // ── Parse referrer source ──
    let referrerSource = 'direct'
    let referrerDomain = null
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

    // ── Parse User-Agent (simple regex, no dependency) ──
    let device = 'desktop'
    let browser = 'unknown'
    let os = 'unknown'

    if (userAgent) {
      // Device
      if (/iPad|Tablet/i.test(userAgent)) device = 'tablet'
      else if (/Mobile|Android|iPhone/i.test(userAgent)) device = 'mobile'

      // Browser
      if (/Edg\//i.test(userAgent)) browser = 'edge'
      else if (/Chrome\//i.test(userAgent)) browser = 'chrome'
      else if (/Firefox\//i.test(userAgent)) browser = 'firefox'
      else if (/Safari\//i.test(userAgent)) browser = 'safari'

      // OS
      if (/Windows/i.test(userAgent)) os = 'windows'
      else if (/Mac OS/i.test(userAgent)) os = 'macos'
      else if (/Android/i.test(userAgent)) os = 'android'
      else if (/iPhone|iPad|iPod/i.test(userAgent)) os = 'ios'
      else if (/Linux/i.test(userAgent)) os = 'linux'
    }

    // ── Geo-IP via multiple providers (free, no API key) ──
    // Try ip-api.com first (45 req/min, reliable), then ipapi.co as fallback
    let country = null
    let countryCode = null
    let city = null
    let region = null

    if (!isLocalIp && ipAddress) {
      // Provider 1: ip-api.com (JSON, free, 45 req/min)
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,country,countryCode,regionName,city`, {
          signal: AbortSignal.timeout(3000),
        })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo && geo.status === 'success') {
            country = geo.country || null
            countryCode = geo.countryCode || null
            city = geo.city || null
            region = geo.regionName || null
          }
        }
      } catch {
        // Provider 2: ipapi.co fallback
        try {
          const geoRes2 = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
            signal: AbortSignal.timeout(3000),
            headers: { 'User-Agent': 'Junashop/1.0' },
          })
          if (geoRes2.ok) {
            const geo2 = await geoRes2.json()
            if (geo2 && !geo2.error) {
              country = geo2.country_name || country
              countryCode = geo2.country_code || countryCode
              city = geo2.city || city
              region = geo2.region || region
            }
          }
        } catch {
          // Both providers failed — silently skip geo
        }
      }
    }

    // ── Save visitor tracking (on first visit, or if no tracking record exists for this visitorId) ──
    // We check if a record already exists for this visitorId to avoid duplicates.
    // The IP + geo data are stored on the FIRST tracking record for each visitorId.
    if (isFirstVisit) {
      // Double-check: only create if no record exists yet for this visitorId
      const existing = await db.visitorTracking.findFirst({
        where: { visitorId },
        select: { id: true },
      })
      if (!existing) {
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
      }
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
    return NextResponse.json({ ok: true }) // always return ok to not break the client
  }
}
