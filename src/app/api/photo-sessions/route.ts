import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()

    const sessions = await db.photoSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        name: s.name,
        notes: s.notes,
        photos: JSON.parse(s.photos),
        attachedStockId: s.attachedStockId,
        attachedAt: s.attachedAt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/photo-sessions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const { name, notes } = body as { name: string; notes?: string }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
    }

    const session = await db.photoSession.create({
      data: {
        userId: user.id,
        name: name.trim(),
        notes: notes?.trim() || null,
        photos: '[]',
      },
    })

    return NextResponse.json({
      id: session.id,
      name: session.name,
      notes: session.notes,
      photos: [],
      attachedStockId: null,
      attachedAt: null,
      createdAt: session.createdAt,
    })
  } catch (error) {
    console.error('POST /api/photo-sessions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
