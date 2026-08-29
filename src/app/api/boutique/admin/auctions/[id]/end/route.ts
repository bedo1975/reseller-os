import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyAuctionWon } from '@/lib/email'
import { randomBytes } from 'crypto'

/**
 * POST /api/boutique/admin/auctions/[id]/end
 * Admin — manually ends an auction, determines the winner, and sends the notification email.
 * This is also called automatically by the cron job when an auction's endsAt has passed.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const auction = await db.auction.findUnique({
      where: { id },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    })
    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }
    if (auction.status === 'won' || auction.status === 'archived') {
      return NextResponse.json({ error: 'Cette enchère est déjà terminée' }, { status: 400 })
    }

    // Check if there's a winning bid (highest bid)
    const winningBid = auction.bids[0]
    if (!winningBid) {
      // No bids — mark as ended without a winner
      await db.auction.update({ where: { id }, data: { status: 'ended' } })
      return NextResponse.json({ ok: true, message: 'Enchère terminée — aucune enchère reçue' })
    }

    // Check reserve price
    if (auction.reservePrice && winningBid.amount < auction.reservePrice) {
      // Reserve not met — mark as ended, no winner
      await db.auction.update({ where: { id }, data: { status: 'ended' } })
      return NextResponse.json({ ok: true, message: 'Enchère terminée — prix de réserve non atteint' })
    }

    // Generate cart token for the winner (same as Make an Offer)
    const bs = await getBoutiqueSettings()
    const durationHours = bs.makeOfferCartDurationHours || 24
    const cartToken = randomBytes(16).toString('hex')
    const cartExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

    // Mark the winning bid
    await db.bid.update({ where: { id: winningBid.id }, data: { isWinning: true } })

    // Update the auction
    const updated = await db.auction.update({
      where: { id },
      data: {
        status: 'won',
        winnerEmail: winningBid.bidderEmail,
        winnerBidId: winningBid.id,
        cartToken,
        cartExpiresAt,
      },
    })

    // Build the cart URL
    const siteUrl = bs.shareSiteUrl || ''
    const cartUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, '')}/panier?offer=${cartToken}`
      : `/panier?offer=${cartToken}`

    // Send the notification email (best-effort)
    try {
      await notifyAuctionWon({
        clientEmail: winningBid.bidderEmail,
        clientFirstName: winningBid.bidderName?.split(' ')[0] || 'Client',
        sku: auction.sku,
        brand: auction.brand,
        title: auction.title,
        winningBid: winningBid.amount,
        cartUrl,
        cartExpiresAt,
        endsAt: auction.endsAt,
      })
      await db.auction.update({ where: { id }, data: { winnerEmailSent: true } })
    } catch (emailErr) {
      console.error('[auctions/end] Failed to send winner email:', emailErr)
    }

    return NextResponse.json({ ok: true, auction: updated, winner: winningBid })
  } catch (error) {
    console.error('POST /api/boutique/admin/auctions/[id]/end error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
