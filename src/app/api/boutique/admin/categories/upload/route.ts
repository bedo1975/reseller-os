import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'boutique-categories')

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
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

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const hash = crypto.randomBytes(6).toString('hex')
    const slug = formData.get('slug')?.toString().toLowerCase() || 'cat'
    const filename = `cat-${slug}-${hash}.${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const publicPath = `/api/uploads/boutique-categories/${filename}`
    return NextResponse.json({ path: publicPath, filename })
  } catch (error) {
    console.error('POST /api/boutique/admin/categories/upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
