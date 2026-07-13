import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function GET(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const requestedName = searchParams.get('name')

    const dbPath = path.resolve(process.cwd(), 'db/custom.db')
    const backupDir = path.resolve(process.cwd(), 'backups')

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    let backupPath: string
    let backupName: string
    let isExisting = false

    if (requestedName) {
      backupName = requestedName
      backupPath = path.join(backupDir, requestedName)
      if (!fs.existsSync(backupPath)) {
        return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 })
      }
      isExisting = true
    } else {
      const now = new Date()
      const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
      backupName = `backup-${ts}.db`
      backupPath = path.join(backupDir, backupName)

      if (!fs.existsSync(dbPath)) {
        return NextResponse.json({ error: 'Base de données introuvable' }, { status: 404 })
      }

      fs.copyFileSync(dbPath, backupPath)
    }

    const buffer = fs.readFileSync(backupPath)
    const size = buffer.length

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${backupName}"`,
        'Content-Length': String(size),
        'Cache-Control': 'no-store',
        'X-Backup-Name': backupName,
        'X-Backup-Size': String(size),
        'X-Backup-Existing': String(isExisting),
      },
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    console.error('GET /api/maintenance/backup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    if (!name) {
      return NextResponse.json({ error: 'Nom de sauvegarde requis' }, { status: 400 })
    }

    if (!name.endsWith('.db') || name.includes('..') || name.includes('/') || name.includes('\\')) {
      return NextResponse.json({ error: 'Nom invalide' }, { status: 400 })
    }

    const backupDir = path.resolve(process.cwd(), 'backups')
    const backupPath = path.join(backupDir, name)

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json({ error: 'Sauvegarde introuvable' }, { status: 404 })
    }

    fs.unlinkSync(backupPath)
    return NextResponse.json({ success: true, message: `Sauvegarde ${name} supprimée` })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    console.error('DELETE /api/maintenance/backup error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
