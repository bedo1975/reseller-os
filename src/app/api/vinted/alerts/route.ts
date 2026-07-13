import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET: list all unread alerts for the current user (across all their saved searches)
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const onlyUnread = searchParams.get('unread') === '1'
    const savedSearchId = searchParams.get('savedSearchId')

    const where: any = {
      savedSearch: { userId: user.id },
    }
    if (onlyUnread) where.read = false
    if (savedSearchId) where.savedSearchId = savedSearchId

    const alerts = await db.vintedAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        savedSearch: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      alerts: alerts.map((a) => ({
        id: a.id,
        savedSearchId: a.savedSearchId,
        savedSearchName: a.savedSearch.name,
        item: JSON.parse(a.itemData),
        read: a.read,
        createdAt: a.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/vinted/alerts error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: mark alerts as read
// Body: { alertIds?: string[], all?: boolean, savedSearchId?: string }
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()

    const where: any = {
      savedSearch: { userId: user.id },
      read: false,
    }
    if (body.alertIds && Array.isArray(body.alertIds)) {
      where.id = { in: body.alertIds }
    } else if (body.savedSearchId) {
      where.savedSearchId = body.savedSearchId
    }

    const updated = await db.vintedAlert.updateMany({
      where,
      data: { read: true },
    })

    // Reset pendingAlerts counter on saved searches that had alerts marked as read
    if (body.savedSearchId) {
      await db.savedSearch.update({
        where: { id: body.savedSearchId },
        data: { pendingAlerts: 0 },
      })
    } else if (body.alertIds) {
      // Find affected saved searches and recompute pendingAlerts
      const alerts = await db.vintedAlert.findMany({
        where: { id: { in: body.alertIds } },
        select: { savedSearchId: true },
        distinct: ['savedSearchId'],
      })
      for (const a of alerts) {
        const unreadCount = await db.vintedAlert.count({
          where: { savedSearchId: a.savedSearchId, read: false },
        })
        await db.savedSearch.update({
          where: { id: a.savedSearchId },
          data: { pendingAlerts: unreadCount },
        })
      }
    }

    return NextResponse.json({ updated: updated.count })
  } catch (error) {
    console.error('PATCH /api/vinted/alerts error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE: delete alerts (e.g. clear all read alerts)
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const onlyRead = searchParams.get('read') === '1'
    const savedSearchId = searchParams.get('savedSearchId')

    const where: any = {
      savedSearch: { userId: user.id },
    }
    if (onlyRead) where.read = true
    if (savedSearchId) where.savedSearchId = savedSearchId

    const deleted = await db.vintedAlert.deleteMany({ where })

    return NextResponse.json({ deleted: deleted.count })
  } catch (error) {
    console.error('DELETE /api/vinted/alerts error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
