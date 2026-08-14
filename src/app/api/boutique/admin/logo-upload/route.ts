import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads', 'boutique-logo')

// Logo compression: max 400×400 (logos are small), WebP quality 90 (higher than
// photos because logos often have text that needs to stay crisp).
const MAX_WIDTH = 400
const MAX_HEIGHT = 400
const WEBP_QUALITY = 90

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    if (!fs.existsSync(LOGO_DIR)) {
      fs.mkdirSync(LOGO_DIR, { recursive: true })
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
    const filename = `logo-${hash}.webp`
    const filePath = path.join(LOGO_DIR, filename)
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

    const publicPath = `/api/uploads/boutique-logo/${filename}`
    return NextResponse.json({ path: publicPath, filename })
  } catch (error) {
    console.error('POST /api/boutique/admin/logo-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
