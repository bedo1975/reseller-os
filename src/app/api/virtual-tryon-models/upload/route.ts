import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const MODELS_DIR = path.join(process.cwd(), 'public', 'uploads', 'models')

/**
 * POST /api/virtual-tryon-models/upload
 * Admin — upload an image for a virtual try-on model.
 *
 * Body (multipart/form-data):
 *   - image: File (the model/mannequin photo)
 *
 * Returns: { imageUrl: "/uploads/models/xxx.jpg" }
 *
 * The image is:
 *   - Resized to max 1024×1024 (preserves aspect ratio, no crop)
 *   - Converted to JPEG (quality 92) — IDM-VTON needs JPG/PNG (not WebP)
 *   - Saved with a unique filename in public/uploads/models/
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    const formData = await req.formData()
    const file = formData.get('image')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Aucune image reçue' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 })
    }

    // Max 10 MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image trop lourde (max 10 MB)' }, { status: 400 })
    }

    // Ensure directory exists
    if (!fs.existsSync(MODELS_DIR)) {
      fs.mkdirSync(MODELS_DIR, { recursive: true })
    }

    // Generate a unique filename
    const randomId = crypto.randomBytes(8).toString('hex')
    const timestamp = Date.now()
    const filename = `model-${timestamp}-${randomId}.jpg`
    const fullPath = path.join(MODELS_DIR, filename)

    // Read the file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Resize to max 1024×1024 and convert to JPEG
    // (IDM-VTON expects portrait orientation around 768×1024 for best results,
    // but we don't force the aspect ratio — the user picks the right photo)
    await sharp(buffer)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toFile(fullPath)

    const imageUrl = `/uploads/models/${filename}`

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('POST /api/virtual-tryon-models/upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
