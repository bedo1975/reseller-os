import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'stock-videos')
const MAX_SIZE = 30 * 1024 * 1024 // 30 Mo
const ALLOWED_TYPES = ['video/mp4', 'video/webm']
const ALLOWED_EXT = ['.mp4', '.webm', '.m4v']

export async function POST(req: NextRequest) {
  try {
    await requireAuth()

    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }

    const formData = await req.formData()
    const file = formData.get('file') ?? formData.get('video')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 })
    }

    // .mov iPhone (HEVC) — illisible sur Chrome/Android : on refuse avec un message clair
    if (file.type === 'video/quicktime' || /\.mov$/i.test(file.name)) {
      return NextResponse.json({
        error: 'Format .mov non supporté. Sur iPhone : Réglages → Caméra → Formats → « Plus compatible », puis refilmez (vous obtiendrez du MP4).',
      }, { status: 400 })
    }

    const ext = path.extname(file.name).toLowerCase()
    const typeOk = (file.type && ALLOWED_TYPES.includes(file.type)) || ALLOWED_EXT.includes(ext)
    if (!typeOk) {
      return NextResponse.json({ error: 'Format vidéo non supporté. Utilisez MP4 ou WebM.' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({
        error: `Vidéo trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum 30 Mo — visez 10-20 secondes.`,
      }, { status: 400 })
    }

    const hash = crypto.randomBytes(8).toString('hex')
    const filename = `vid-${Date.now()}-${hash}${ext || '.mp4'}`
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer)

       return NextResponse.json({ url: `/api/uploads/stock-videos/${filename}` })
  } catch (error) {
    console.error('POST /api/stock/video-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}