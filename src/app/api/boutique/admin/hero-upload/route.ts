import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const HERO_DIR = path.join(process.cwd(), 'public', 'uploads', 'boutique-hero')

// Hero image compression: max 1920×1080 (full-width banner), WebP quality 82.
const MAX_WIDTH = 1920
const MAX_HEIGHT = 1080
const WEBP_QUALITY = 82

export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    if (!fs.existsSync(HERO_DIR)) {
      fs.mkdirSync(HERO_DIR, { recursive: true })
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
    const filename = `hero-${hash}.webp`
    const filePath = path.join(HERO_DIR, filename)
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

    const publicPath = `/api/uploads/boutique-hero/${filename}`
    return NextResponse.json({ path: publicPath, filename })
  } catch (error) {
    console.error('POST /api/boutique/admin/hero-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
