import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// PATCH: update enabled state, interval, or name
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existing = await db.savedSearch.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    const data: any = {}
    if (typeof body.enabled === 'boolean') data.enabled = body.enabled
    if (typeof body.intervalHours === 'number') {
      data.intervalHours = Math.min(Math.max(body.intervalHours, 1), 168)
    }
    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim()
    }
    if (typeof body.searchParams === 'object') {
      data.searchParams = JSON.stringify(body.searchParams)
    }

    const updated = await db.savedSearch.update({
      where: { id },
      data,
    })

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      searchParams: JSON.parse(updated.searchParams),
      intervalHours: updated.intervalHours,
      lastScannedAt: updated.lastScannedAt,
      enabled: updated.enabled,
      pendingAlerts: updated.pendingAlerts,
    })
  } catch (error) {
    console.error('PATCH /api/vinted/saved-searches/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: remove a saved search and its alerts
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.savedSearch.findFirst({
      where: { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
    }

    // Alerts cascade-delete thanks to onDelete: Cascade on SavedSearch
    await db.savedSearch.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/vinted/saved-searches/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
