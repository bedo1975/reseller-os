import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { applyWatermark } from '@/lib/watermark'
import { padToSquareIfNeeded } from '@/lib/image-padding'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'stock')

const MAX_WIDTH = 1200
const MAX_HEIGHT = 1200
const WEBP_QUALITY = 82

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

      const hash = crypto.randomBytes(8).toString('hex')
      const filename = `stock-${Date.now()}-${hash}.webp`
      const filePath = path.join(UPLOAD_DIR, filename)
      const buffer = Buffer.from(await file.arrayBuffer())

      try {
        const compressed = await sharp(buffer)
          .resize(MAX_WIDTH, MAX_HEIGHT, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: WEBP_QUALITY })
          .toBuffer()

        const padded = await padToSquareIfNeeded(compressed)
        const watermarked = await applyWatermark(padded)
        fs.writeFileSync(filePath, watermarked)
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

export async function DELETE(req: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(req.url)
    const filePath = searchParams.get('path')

    if (!filePath) {
      return NextResponse.json({ error: 'Chemin manquant' }, { status: 400 })
    }

    if (!filePath.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'Chemin non autorisé' }, { status: 403 })
    }

    const fullPath = path.join(process.cwd(), 'public', filePath)

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
