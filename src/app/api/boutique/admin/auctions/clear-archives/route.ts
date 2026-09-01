import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/boutique/admin/auctions/clear-archives
 * Admin — permanently deletes all archived auctions (and their bids).
 */
export async function POST() {
  try {
    await requireAuth()

    // Find all archived auctions
    const archived = await db.auction.findMany({
      where: { status: 'archived' },
      select: { id: true },
    })

    if (archived.length === 0) {
      return NextResponse.json({ ok: true, message: 'Aucune enchère archivée à supprimer' })
    }

    // Delete bids for these auctions
    const auctionIds = archived.map(a => a.id)
    await db.bid.deleteMany({ where: { auctionId: { in: auctionIds } } })

    // Delete the auctions
    const result = await db.auction.deleteMany({ where: { id: { in: auctionIds } } })

    return NextResponse.json({ ok: true, count: result.count, message: `${result.count} enchère(s) archivée(s) supprimée(s)` })
  } catch (error) {
    console.error('POST /api/boutique/admin/auctions/clear-archives error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
