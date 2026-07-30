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
    const forwarded = req.headers.get('x-forwarded-for')
    const ipAddress = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
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

    // ── Geo-IP via ipapi.co (free, no API key, 1000 req/day) ──
    let country = null
    let countryCode = null
    let city = null
    let region = null

    if (ipAddress && ipAddress !== '127.0.0.1' && ipAddress !== '::1' && !ipAddress.startsWith('192.168')) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ipAddress}/json/`, {
          signal: AbortSignal.timeout(3000),
          headers: { 'User-Agent': 'Junashop/1.0' },
        })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          if (geo && !geo.error) {
            country = geo.country_name || null
            countryCode = geo.country_code || null
            city = geo.city || null
            region = geo.region || null
          }
        }
      } catch {
        // Geo-IP failed (rate limit, timeout) — silently skip
      }
    }

    // ── Save visitor tracking (only on first visit or if new session) ──
    if (isFirstVisit) {
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
