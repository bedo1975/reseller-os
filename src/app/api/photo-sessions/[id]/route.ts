import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = path.join(process.cwd(), 'public', 'uploads', 'sessions')

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const session = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    return NextResponse.json({
      id: session.id,
      name: session.name,
      notes: session.notes,
      photos: JSON.parse(session.photos),
      attachedStockId: session.attachedStockId,
      attachedAt: session.attachedAt,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    })
  } catch (error) {
    console.error('GET /api/photo-sessions/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    const existing = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    const data: any = {}
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim()
    if (typeof body.notes === 'string') data.notes = body.notes.trim() || null

    const updated = await db.photoSession.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      notes: updated.notes,
      photos: JSON.parse(updated.photos),
      attachedStockId: updated.attachedStockId,
      attachedAt: updated.attachedAt,
    })
  } catch (error) {
    console.error('PATCH /api/photo-sessions/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    // Delete the photo files from disk
    const sessionDir = path.join(SESSIONS_DIR, id)
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true })
      }
    } catch (err) {
      console.error('Failed to delete session files:', err)
    }

    await db.photoSession.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/photo-sessions/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
