import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Fichier .db requis' }, { status: 400 })
    }

    if (!file.name.endsWith('.db')) {
      return NextResponse.json({ error: 'Le fichier doit être un .db SQLite' }, { status: 400 })
    }

    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 100 Mo)' }, { status: 400 })
    }

    const dbPath = path.resolve(process.cwd(), 'db/custom.db')
    const backupDir = path.resolve(process.cwd(), 'backups')

    if (fs.existsSync(dbPath)) {
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true })
      }
      const safetyBackup = path.join(backupDir, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.db`)
      fs.copyFileSync(dbPath, safetyBackup)
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(dbPath, buffer)

    return NextResponse.json({
      success: true,
      message: 'Base restaurée avec succès. Redémarrez le serveur pour appliquer les changements.',
      size: buffer.length,
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    console.error('POST /api/maintenance/restore error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
