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
          select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true, status: true, size: true, color: true },
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

      // Parse photos for the main item
      let mainPhoto: string | null = null
      let mainPhotos: string[] = []
      if (auction.stockItem?.photos) {
        try {
          mainPhotos = JSON.parse(auction.stockItem.photos)
          mainPhotos = mainPhotos.map((p: string) => p.startsWith('/uploads/') ? `/api${p}` : p)
          if (mainPhotos.length > 0) mainPhoto = mainPhotos[0]
        } catch {}
      }
      if (!mainPhoto && auction.mainPhoto) mainPhoto = auction.mainPhoto

      // Fetch lot items with full details (photos, size, color, category)
      let lotItemsDetailed: any[] | null = null
      if (auction.lotItems) {
        try {
          const lotIds = JSON.parse(auction.lotItems) as { stockItemId: string; sku: string; brand: string; title: string | null }[]
          const lotStockItems = await db.stockItem.findMany({
            where: { id: { in: lotIds.map(li => li.stockItemId) } },
            select: { id: true, sku: true, brand: true, title: true, category: true, size: true, color: true, photos: true },
          })
          lotItemsDetailed = lotIds.map(li => {
            const si = lotStockItems.find(s => s.id === li.stockItemId)
            let photos: string[] = []
            if (si?.photos) {
              try {
                photos = JSON.parse(si.photos).map((p: string) => p.startsWith('/uploads/') ? `/api${p}` : p)
              } catch {}
            }
            return {
              sku: li.sku,
              brand: li.brand,
              title: li.title,
              category: si?.category || 'vetements',
              size: si?.size || null,
              color: si?.color || null,
              mainPhoto: photos[0] || null,
            }
          })
        } catch {}
      }

      return NextResponse.json({
        id: auction.id,
        source: 'auction',
        status: auction.status,
        sku: auction.sku,
        brand: auction.brand,
        title: auction.title,
        category: auction.stockItem?.category || 'vetements',
        size: auction.stockItem?.size || null,
        color: auction.stockItem?.color || null,
        mainPhoto,
        photos: mainPhotos,
        originalPrice: auction.startPrice,
        offeredPrice: auction.currentPrice,
        discountAmount: 0,
        cartExpiresAt: auction.cartExpiresAt,
        lotItems: lotItemsDetailed,
      })
    }

    // Not found in either table
    return NextResponse.json({ error: 'Offre ou enchère introuvable' }, { status: 404 })
  } catch (error) {
    console.error('GET /api/boutique/offers/by-token error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
