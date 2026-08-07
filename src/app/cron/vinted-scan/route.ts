import { NextRequest, NextResponse } from 'next/server'

/**
 * Lightweight endpoint that triggers the Vinted scan via internal HTTP call.
 * Intended to be called by an external cron job (Linux crontab, PM2, etc.) every hour.
 *
 * The actual scan logic lives in /api/vinted/scan (POST, requires CRON_SECRET).
 * This wrapper just forwards the request so the cron URL is clean:
 *   curl -X POST https://your-domain.fr/api/cron/vinted-scan
 *
 * Configure CRON_SECRET in .env:
 *   CRON_SECRET="some-random-long-string"
 *
 * Then add to crontab:
 *   0 * * * * curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.fr/api/cron/vinted-scan
 */
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured in .env' },
      { status: 500 },
    )
  }

  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Determine base URL (for internal fetch)
  const url = new URL(req.url)
  const baseUrl = `${url.protocol}/${url.host}`

  try {
    const scanRes = await fetch(`${baseUrl}/api/vinted/scan`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(60_000), // 1 min max
    })
    const data = await scanRes.json()
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[cron/vinted-scan] error:', err?.message)
    return NextResponse.json(
      { error: 'Scan failed', message: err?.message },
      { status: 500 },
    )
  }
}
