import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/offers/by-token?token=XXX
 * Public — returns the offer details for a given cart token.
 * Used by the cart page to apply the reduced price when the client
 * clicks the "Accéder à mon panier" link from the acceptance email.
 *
 * Returns: { id, status, sku, brand, title, category, originalPrice, offeredPrice, cartExpiresAt }
 *
 * If the offer is not found, expired, or not accepted → returns 404.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'Token requis' }, { status: 400 })
    }

    const offer = await db.offer.findFirst({
      where: { cartToken: token },
      include: {
        stockItem: {
          select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true, status: true },
        },
      },
    })

    if (!offer) {
      return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
    }
    if (offer.status !== 'accepted') {
      return NextResponse.json({ error: `Offre ${offer.status}` }, { status: 404 })
    }

    // Check expiration
    if (offer.cartExpiresAt && new Date(offer.cartExpiresAt) < new Date()) {
      // Auto-expire the offer
      await db.offer.update({
        where: { id: offer.id },
        data: { status: 'expired' },
      })
      return NextResponse.json({ error: 'Offre expirée', status: 'expired' }, { status: 410 })
    }

    // Check the stock item is still available
    if (!offer.stockItem || offer.stockItem.status === 'VENDU' || (offer.stockItem.quantity ?? 0) <= 0) {
      return NextResponse.json({ error: 'Article plus disponible' }, { status: 404 })
    }

    return NextResponse.json({
      id: offer.id,
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
  } catch (error) {
    console.error('GET /api/boutique/offers/by-token error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
