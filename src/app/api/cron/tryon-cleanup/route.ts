import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Cron endpoint: deletes old virtual try-on photos (auto-cleanup).
 *
 * Called by external cron every 5 minutes:
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-domain.fr/api/cron/tryon-cleanup
 *
 * Deletes all files in public/uploads/tryon-temp/ that are older than 15 minutes.
 * This ensures client photos are not stored permanently on the server.
 */
const TRYON_TEMP_DIR = path.join(process.cwd(), 'public', 'uploads', 'tryon-temp')
const MAX_AGE_MINUTES = 15

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const cronSecret = process.env.CRON_SECRET
    const authHeader = req.headers.get('authorization')
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!fs.existsSync(TRYON_TEMP_DIR)) {
      return NextResponse.json({ deleted: 0, message: 'No temp directory' })
    }

    const now = Date.now()
    const maxAgeMs = MAX_AGE_MINUTES * 60 * 1000
    let deletedCount = 0
    let errors = 0

    const files = fs.readdirSync(TRYON_TEMP_DIR)
    for (const file of files) {
      const fullPath = path.join(TRYON_TEMP_DIR, file)
      try {
        const stats = fs.statSync(fullPath)
        const fileAge = now - stats.mtimeMs
        if (fileAge > maxAgeMs) {
          fs.unlinkSync(fullPath)
          deletedCount++
        }
      } catch (e) {
        // File may have been deleted between readdir and stat — skip
        errors++
      }
    }

    console.log(`[cron/tryon-cleanup] Deleted ${deletedCount} file(s), ${errors} error(s)`)
    return NextResponse.json({
      deleted: deletedCount,
      errors,
      maxAgeMinutes: MAX_AGE_MINUTES,
    })
  } catch (error) {
    console.error('POST /api/cron/tryon-cleanup error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
