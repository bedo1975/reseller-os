import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const TRYON_TEMP_DIR = path.join(process.cwd(), 'public', 'uploads', 'tryon-temp')

/**
 * POST /api/boutique/try-on/upload
 * Public — a boutique client uploads their photo for virtual try-on.
 *
 * Body (multipart/form-data):
 *   - photo: File (the client's photo)
 *
 * Returns: { photoPath: "/uploads/tryon-temp/xxx.jpg", photoUrl: "/api/uploads/tryon-temp/xxx.jpg" }
 *
 * The photo is:
 *   - Resized to max 1024×1024 (preserves aspect ratio, no crop)
 *   - Converted to JPEG (quality 92) — IDM-VTON needs JPG/PNG (not WebP)
 *   - Saved with a unique filename in public/uploads/tryon-temp/
 *   - Auto-deleted after 15 minutes by a cron job
 *
 * No auth required — this is a public boutique endpoint.
 * Rate limiting: TODO (will be added later per user's request)
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('photo')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Aucune photo reçue' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 })
    }

    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image trop lourde (max 10 MB)' }, { status: 400 })
    }

    // Ensure directory exists
    if (!fs.existsSync(TRYON_TEMP_DIR)) {
      fs.mkdirSync(TRYON_TEMP_DIR, { recursive: true })
    }

    // Generate a unique filename
    const randomId = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now()
    const filename = `tryon-${timestamp}-${randomId}.jpg`
    const fullPath = path.join(TRYON_TEMP_DIR, filename)

    // Read the file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Resize to max 1024×1024 and convert to JPEG
    // (IDM-VTON expects portrait orientation around 768×1024 for best results,
    // but we don't force the aspect ratio — the user picks the right photo)
    await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toFile(fullPath)

    const photoPath = `/uploads/tryon-temp/${filename}`

    return NextResponse.json({
      photoPath,
      photoUrl: `/api${photoPath}`,
    })
  } catch (error) {
    console.error('POST /api/boutique/try-on/upload error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
