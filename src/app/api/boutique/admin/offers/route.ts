import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/boutique/admin/offers
 * Admin — lists all Make an Offer submissions, optionally filtered by status.
 */
export async function GET(req: Request) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'

    const offers = await db.offer.findMany({
      where: status !== 'all' ? { status } : {},
      include: { stockItem: { select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ offers })
  } catch (error) {
    console.error('GET /api/boutique/admin/offers error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
