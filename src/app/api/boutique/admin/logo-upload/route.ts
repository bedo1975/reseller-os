import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const LOGO_DIR = path.join(process.cwd(), 'public', 'uploads', 'boutique-logo')

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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const hash = crypto.randomBytes(6).toString('hex')
    const filename = `logo-${hash}.${ext}`
    const filePath = path.join(LOGO_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const publicPath = `/api/uploads/-logo/${filename}`
    return NextResponse.json({ path: publicPath, filename })
  } catch (error) {
    console.error('POST /api/boutique/admin/logo-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
