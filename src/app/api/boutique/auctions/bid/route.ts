import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/auctions/bid
 * Public — a client (guest or logged-in) places a bid on the active auction.
 *
 * Body: { auctionId, bidderEmail, bidderName?, amount }
 *
 * Validates:
 * - The auction is active and hasn't ended
 * - The bid amount is higher than the current price + minimum increment
 * - The email is valid
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { auctionId, bidderEmail, bidderName, amount } = body

    if (!auctionId || !bidderEmail || !amount) {
      return NextResponse.json({ error: 'Champs requis: auctionId, bidderEmail, amount' }, { status: 400 })
    }

    // Validate email
    const email = String(bidderEmail).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }

    const bidAmount = parseFloat(amount)
    if (Number.isNaN(bidAmount) || bidAmount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    // Find the auction
    const auction = await db.auction.findUnique({ where: { id: auctionId } })
    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }

    // Check status
    if (auction.status !== 'active') {
      return NextResponse.json({ error: 'Cette enchère n\'est pas active' }, { status: 400 })
    }

    // Check dates
    const now = new Date()
    if (now < auction.startsAt) {
      return NextResponse.json({ error: 'L\'enchère n\'a pas encore commencé' }, { status: 400 })
    }
    if (now >= auction.endsAt) {
      return NextResponse.json({ error: 'L\'enchère est terminée' }, { status: 400 })
    }

    // Check the bid is higher than current price
    if (bidAmount <= auction.currentPrice) {
      return NextResponse.json({
        error: `Votre enchère doit être supérieure au prix actuel (${auction.currentPrice.toFixed(2)} €)`,
      }, { status: 400 })
    }

    // Try to match a BoutiqueClient by email
    const matchedClient = await db.boutiqueClient.findFirst({ where: { email } })

    // Get the client IP for audit
    const forwarded = req.headers.get('x-forwarded-for')
    const xRealIp = req.headers.get('x-real-ip')
    let ipAddress: string | null = null
    if (xRealIp) ipAddress = xRealIp.trim()
    else if (forwarded) {
      const ips = forwarded.split(',').map(s => s.trim())
      ipAddress = ips[0] || null
    }

    // Create the bid
    const bid = await db.bid.create({
      data: {
        auctionId,
        clientId: matchedClient?.id || null,
        bidderEmail: email,
        bidderName: bidderName || (matchedClient ? `${matchedClient.firstName} ${matchedClient.lastName}`.trim() : null),
        amount: bidAmount,
        ipAddress,
      },
    })

    // Update the auction's current price
    await db.auction.update({
      where: { id: auctionId },
      data: { currentPrice: bidAmount },
    })

    // Anti-snipe: if the bid is placed in the last 2 minutes, extend the end by 2 minutes
    const twoMinutes = 2 * 60 * 1000
    if (auction.endsAt.getTime() - now.getTime() < twoMinutes) {
      const newEndsAt = new Date(now.getTime() + twoMinutes)
      await db.auction.update({ where: { id: auctionId }, data: { endsAt: newEndsAt } })
    }

    return NextResponse.json({ ok: true, bidId: bid.id, newPrice: bidAmount })
  } catch (error) {
    console.error('POST /api/boutique/auctions/bid error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
