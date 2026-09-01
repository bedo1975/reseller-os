import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/offers/by-token?token=XXX
 * Public — returns the offer OR auction details for a given cart token.
 * Used by the cart page to apply the reduced price when the client
 * clicks the "Accéder à mon panier" link from the acceptance email.
 *
 * Searches in both Offer (Make an Offer) and Auction (enchère) tables.
 *
 * Returns: { id, status, sku, brand, title, category, originalPrice, offeredPrice, discountAmount, cartExpiresAt, source }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }

    // 1. Try Offer table (Make an Offer)
    const offer = await db.offer.findFirst({
      where: { cartToken: token },
      include: {
        stockItem: {
          select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true, status: true },
        },
      },
    })

    if (offer) {
      if (offer.status !== 'accepted') {
        return NextResponse.json({ error: `Offre ${offer.status}` }, { status: 404 })
      }
      if (offer.cartExpiresAt && new Date(offer.cartExpiresAt) < new Date()) {
        await db.offer.update({ where: { id: offer.id }, data: { status: 'expired' } })
        return NextResponse.json({ error: 'Offre expirée', status: 'expired' }, { status: 410 })
      }
      if (!offer.stockItem || offer.stockItem.status === 'VENDU' || (offer.stockItem.quantity ?? 0) <= 0) {
        return NextResponse.json({ error: 'Article plus disponible' }, { status: 404 })
      }
      return NextResponse.json({
        id: offer.id,
        source: 'offer',
        status: offer.status,
        sku: offer.sku,
        brand: offer.brand,
        title: offer.title,
        category: offer.stockItem?.category || 'vetements',
        originalPrice: offer.originalPrice,
        offeredPrice: offer.offeredPrice,
        discountAmount: offer.discountAmount,
        cartExpiresAt: offer.cartExpiresAt,
      })
    }

    // 2. Try Auction table (enchère)
    const auction = await db.auction.findFirst({
      where: { cartToken: token },
      include: {
        stockItem: {
          select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true, status: true },
        },
      },
    })

    if (auction) {
      if (auction.status !== 'won') {
        return NextResponse.json({ error: `Enchère ${auction.status}` }, { status: 404 })
      }
      if (auction.cartExpiresAt && new Date(auction.cartExpiresAt) < new Date()) {
        await db.auction.update({ where: { id: auction.id }, data: { status: 'ended' } })
        return NextResponse.json({ error: 'Enchère expirée', status: 'expired' }, { status: 410 })
      }
      // For auctions, the stock item might be VENDU (marked sold when the auction ended).
      // That's OK — the winner can still checkout at the winning price.
      return NextResponse.json({
        id: auction.id,
        source: 'auction',
        status: auction.status,
        sku: auction.sku,
        brand: auction.brand,
        title: auction.title,
        category: auction.stockItem?.category || 'vetements',
        originalPrice: auction.startPrice,
        offeredPrice: auction.currentPrice,  // winning bid amount
        discountAmount: 0,  // not applicable for auctions
        cartExpiresAt: auction.cartExpiresAt,
        // If it's a lot, include the lot items so the cart can add them all
        lotItems: auction.lotItems ? (() => { try { return JSON.parse(auction.lotItems) } catch { return null } })() : null,
      })
    }

    // Not found in either table
    return NextResponse.json({ error: 'Offre ou enchère introuvable' }, { status: 404 })
  } catch (error) {
    console.error('GET /api/boutique/offers/by-token error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
