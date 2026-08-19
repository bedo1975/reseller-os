import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'size-guide')

// Image for size guide: max 400×600 (portrait), WebP quality 85.
const MAX_WIDTH = 400
const MAX_HEIGHT = 600
const WEBP_QUALITY = 85

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Doit être une image' }, { status: 400 })
    }

    const hash = crypto.randomBytes(6).toString('hex')
    const filename = `sizeguide-${hash}.webp`
    const filePath = path.join(UPLOAD_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())

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

    const publicPath = `/api/uploads/size-guide/${filename}`
    return NextResponse.json({ path: publicPath, filename })
  } catch (error) {
    console.error('POST /api/boutique/admin/size-guide/upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
