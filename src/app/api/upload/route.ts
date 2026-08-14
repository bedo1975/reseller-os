import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'stock')

/**
 * Photo compression config (same as photo-sessions/[id]/photos/route.ts).
 * - Resize to max 1200×1200 (preserves aspect ratio, no crop)
 * - Convert to WebP (quality 82)
 */
const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const WEBP_QUALITY = 82

/**
 * POST /api/upload
 * Manual photo upload from the Stock form (handleFiles in stock-module.tsx).
 * Accepts a multipart/form-data with one or more files (field name 'files' or 'file').
 *
 * Each image is:
 *   - resized to max 1200×1200 (preserving aspect ratio)
 *   - converted to WebP (quality 82)
 *   - written to public/uploads/stock/stock-<timestamp>-<hash>.webp
 *
 * Returns: { urls: ['/uploads/stock/stock-xxx.webp', ...] }
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }

    const formData = await req.formData()
    let files = formData.getAll('files')

    if (files.length === 0) {
      const single = formData.get('file')
      if (single instanceof File) {
        files = [single]
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
    }

    const urls: string[] = []

    for (const file of files) {
      if (!(file instanceof File)) continue
      if (!file.type.startsWith('image/')) {
        return NextResponse.json({ error: `Le fichier ${file.name} n'est pas une image` }, { status: 400 })
      }

      // Always .webp now (we convert everything to WebP)
      const hash = crypto.randomBytes(8).toString('hex')
      const filename = `stock-${Date.now()}-${hash}.webp`
      const filePath = path.join(UPLOAD_DIR, filename)
      const buffer = Buffer.from(await file.arrayBuffer())

      // Compress + convert to WebP. Fallback to raw write if sharp fails.
      try {
        await sharp(buffer)
          .resize(MAX_WIDTH, MAX_HEIGHT, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({ quality: WEBP_QUALITY })
          .toFile(filePath)
      } catch (sharpErr) {
        console.error('Sharp compression failed, falling back to raw write:', sharpErr)
        fs.writeFileSync(filePath, buffer)
      }

      urls.push(`/uploads/stock/${filename}`)
    }

    return NextResponse.json({ urls })
  } catch (error) {
    console.error('POST /api/upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/upload?path=/uploads/stock/xxx.webp
 * Deletes a single uploaded file from disk.
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
    }

    // Security: only allow deleting files within uploads/
    if (!filePath.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
    }

    const fullPath = path.join(process.cwd(), 'public', filePath)

    // Security: ensure path is within uploads/
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    const resolved = path.resolve(fullPath)
    if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
    }

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
