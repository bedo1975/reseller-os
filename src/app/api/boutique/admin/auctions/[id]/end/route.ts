import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyAuctionWon } from '@/lib/email'
import { randomBytes } from 'crypto'

/**
 * POST /api/boutique/admin/auctions/[id]/end
 * Admin — manually ends an auction. Determines the winner (if any) and:
 * - Won: marks items as VENDU, sends winner email with cart link
 * - No winner / reserve not met: restores items to PUBLIE or increments stock back
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

    // Collect all item IDs (main + lot)
    const allItemIds = [auction.stockItemId]
    if (auction.lotItems) {
      try {
        const lot = JSON.parse(auction.lotItems)
        for (const li of lot) allItemIds.push(li.stockItemId)
      } catch {}
    }

    const winningBid = auction.bids[0]
    const reserveMet = !auction.reservePrice || (winningBid && winningBid.amount >= auction.reservePrice)

    if (!winningBid || !reserveMet) {
      // ── No winner — restore stock ──
      for (const itemId of allItemIds) {
        const si = await db.stockItem.findUnique({ where: { id: itemId }, select: { quantity: true, status: true } })
        if (!si) continue
        if (si.status === 'RESERVE') {
          await db.stockItem.update({ where: { id: itemId }, data: { status: 'PUBLIE' } })
        } else {
          // Was decremented → increment back
          await db.stockItem.update({ where: { id: itemId }, data: { quantity: { increment: 1 } } })
        }
      }

      const reason = !winningBid ? 'Aucune enchère reçue' : 'Prix de réserve non atteint'
      await db.auction.update({ where: { id }, data: { status: 'ended' } })
      return NextResponse.json({ ok: true, message: `Enchère terminée — ${reason}. Articles remis en stock.` })
    }

    // ── Won — generate cart + send email ──
    const bs = await getBoutiqueSettings()
    const durationHours = bs.makeOfferCartDurationHours || 24
    const cartToken = randomBytes(16).toString('hex')
    const cartExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

    // Mark the winning bid
    await db.bid.update({ where: { id: winningBid.id }, data: { isWinning: true } })

    // Update the auction
    await db.auction.update({
      where: { id },
      data: {
        status: 'won',
        winnerEmail: winningBid.bidderEmail,
        winnerBidId: winningBid.id,
        cartToken,
        cartExpiresAt,
      },
    })

    // Mark all items as VENDU (they were either RÉSERVÉ or decremented — now fully sold)
    for (const itemId of allItemIds) {
      const si = await db.stockItem.findUnique({ where: { id: itemId }, select: { quantity: true, status: true } })
      if (!si) continue
      if (si.status === 'RESERVE') {
        // Was reserved (only 1 left) → mark as VENDU
        await db.stockItem.update({
          where: { id: itemId },
          data: { status: 'VENDU', quantity: 0, soldCount: { increment: 1 } },
        })
      } else {
        // Was decremented (multiple in stock) → just increment soldCount
        await db.stockItem.update({
          where: { id: itemId },
          data: { soldCount: { increment: 1 } },
        })
      }
    }

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

    return NextResponse.json({ ok: true, winner: winningBid.bidderEmail, amount: winningBid.amount })
  } catch (error) {
    console.error('POST /api/boutique/admin/auctions/[id]/end error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
