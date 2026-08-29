import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/boutique/admin/auctions/[id]/archive
 * Admin — archives an ended/won auction (moves it out of the active list).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const auction = await db.auction.findUnique({ where: { id } })
    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }
    if (auction.status === 'scheduled' || auction.status === 'active') {
      return NextResponse.json({ error: 'Impossible d\'archiver une enchère en cours' }, { status: 400 })
    }

    await db.auction.update({ where: { id }, data: { status: 'archived' } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('POST /api/boutique/admin/auctions/[id]/archive error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
