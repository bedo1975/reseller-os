import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/boutique/admin/stock-alerts
 * Admin — list all stock alert subscriptions.
 *
 * Query params:
 *  - status: 'pending' | 'notified' | 'all' (default: 'all')
 *  - search: filter by email, brand or SKU
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'
    const search = searchParams.get('search') || ''

    const where: any = {}
    if (status === 'pending' || status === 'notified' || status === 'cancelled') {
      where.status = status
    }
    if (search) {
      where.OR = [
        { email: { contains: search } },
        { productSku: { contains: search } },
        { productBrand: { contains: search } },
        { productTitle: { contains: search } },
      ]
    }

    const alerts = await db.stockAlert.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const stats = {
      total: await db.stockAlert.count(),
      pending: await db.stockAlert.count({ where: { status: 'pending' } }),
      notified: await db.stockAlert.count({ where: { status: 'notified' } }),
      uniqueEmails: await db.stockAlert.findMany({
        where: { status: 'pending' },
        distinct: ['email'],
        select: { email: true },
      }).then(r => r.length),
    }

    return NextResponse.json({ alerts, stats })
  } catch (error) {
    console.error('GET /api/boutique/admin/stock-alerts error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/boutique/admin/stock-alerts?id=xxx
 * Admin — delete a stock alert subscription (cancels it).
 */
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth()
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    await db.stockAlert.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/stock-alerts error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
