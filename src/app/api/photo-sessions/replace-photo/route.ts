import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const formData = await req.formData()
    const file = formData.get('photo') as File | null
    const photoPath = formData.get('path') as string | null

    if (!file || !photoPath) {
      return NextResponse.json({ error: 'Fichier et chemin requis' }, { status: 400 })
    }

    // Normalize the path — strip leading slash, ensure it's under public/
    const cleanPath = photoPath.replace(/^\//, '')
    if (cleanPath.includes('..')) {
      return NextResponse.json({ error: 'Chemin invalide' }, { status: 400 })
    }

    const fullPath = path.join(process.cwd(), 'public', cleanPath)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Photo introuvable sur le disque' }, { status: 404 })
    }

    // Overwrite the original file with the new image
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(fullPath, buffer)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('POST /api/photo-sessions/replace-photo error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}