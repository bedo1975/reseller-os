import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { applyWatermark } from '@/lib/watermark'

const SESSIONS_DIR = path.join(process.cwd(), 'public', 'uploads', 'sessions')

/**
 * Photo compression config.
 * - Resize to max 1200×1200 (preserves aspect ratio, no crop)
 * - Convert to WebP (quality 82 — good balance between visual quality and file size)
 * - Resulting files are typically 5-10× smaller than the original JPEGs from a phone camera.
 */
const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const WEBP_QUALITY = 82

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const session = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const formData = await req.formData()
    const files = formData.getAll('photos')
    if (files.length === 0) {
      return NextResponse.json({ error: 'Aucune photo reçue' }, { status: 400 })
    }

    // Ensure session directory exists
    const sessionDir = path.join(SESSIONS_DIR, id)
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true })
    }

    // Parse existing photos
    let photos: Array<{ id: string; path: string; filename: string; createdAt: string }> = []
    try { photos = JSON.parse(session.photos) } catch {}

    const addedPhotos: Array<{ id: string; path: string; filename: string; createdAt: string }> = []

    for (const file of files) {
      if (!(file instanceof File)) continue

      // Validate it's an image
      if (!file.type.startsWith('image/')) {
        continue
      }

      // Generate unique filename — always .webp now (we convert everything to WebP)
      const hash = crypto.randomBytes(8).toString('hex')
      const filename = `${Date.now()}-${hash}.webp`

      const filePath = path.join(sessionDir, filename)
      const buffer = Buffer.from(await file.arrayBuffer())

      // Compress + convert to WebP using sharp.
      // - resize with fit: 'inside' preserves aspect ratio without cropping
      // - withoutEnlargement ensures we never upscale a small image
      // - quality 82 is visually indistinguishable from the original for product photos
      try {
        // Step 1: resize + convert to WebP (produces a Buffer).
        const compressed = await sharp(buffer)
          .resize(MAX_WIDTH, MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer()

        // Step 2: apply watermark (if enabled in admin).
        const watermarked = await applyWatermark(compressed)

        // Step 3: write to disk.
        fs.writeFileSync(filePath, watermarked)
      } catch (sharpErr) {
        console.error('Sharp compression failed, falling back to raw write:', sharpErr)
        // Fallback: write the original file as-is (rare, only if sharp fails on an unusual format)
        fs.writeFileSync(filePath, buffer)
      }

      const photoObj = {
        id: crypto.randomBytes(8).toString('hex'),
        path: `/uploads/sessions/${id}/${filename}`,
        filename,
        createdAt: new Date().toISOString(),
      }
      photos.push(photoObj)
      addedPhotos.push(photoObj)
    }

    await db.photoSession.update({
      where: { id },
      data: { photos: JSON.stringify(photos) },
    })

    return NextResponse.json({
      added: addedPhotos.length,
      photos,
    })
  } catch (error) {
    console.error('POST /api/photo-sessions/[id]/photos error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Delete a single photo (by photo id in query string)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const { searchParams } = new URL(req.url)
    const photoId = searchParams.get('photoId')
    if (!photoId) {
      return NextResponse.json({ error: 'photoId requis' }, { status: 400 })
    }

    const session = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    let photos: Array<{ id: string; path: string; filename: string; createdAt: string }> = []
    try { photos = JSON.parse(session.photos) } catch {}

    const photo = photos.find((p) => p.id === photoId)
    if (!photo) {
      return NextResponse.json({ error: 'Photo introuvable' }, { status: 404 })
    }

    // Delete file from disk
    const filePath = path.join(process.cwd(), 'public', photo.path)
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch (err) {
      console.error('Failed to delete photo file:', err)
    }

    // Remove from array
    const updatedPhotos = photos.filter((p) => p.id !== photoId)
    await db.photoSession.update({
      where: { id },
      data: { photos: JSON.stringify(updatedPhotos) },
    })

    return NextResponse.json({ ok: true, photos: updatedPhotos })
  } catch (error) {
    console.error('DELETE /api/photo-sessions/[id]/photos error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
