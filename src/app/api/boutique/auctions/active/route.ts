import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

/**
 * GET /api/boutique/auctions/active
 * Public — returns the currently active auction (or the most recent scheduled/active one).
 * Used by the /enchere page on the boutique.
 */
export async function GET() {
  try {
    const now = new Date()

    // Find active auctions (startsAt <= now AND endsAt > now AND status = active)
    // Also auto-activate scheduled auctions whose startsAt has passed
    const scheduled = await db.auction.findMany({
      where: { status: 'scheduled', startsAt: { lte: now } },
    })
    for (const a of scheduled) {
      await db.auction.update({ where: { id: a.id }, data: { status: 'active' } })
    }

    // Find the active auction
    const auction = await db.auction.findFirst({
      where: {
        status: 'active',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      include: {
        bids: {
          orderBy: { amount: 'desc' },
          take: 10,
          select: { id: true, amount: true, bidderName: true, createdAt: true },
        },
        stockItem: {
          select: {
            sku: true, brand: true, title: true, category: true,
            size: true, color: true, condition: true, grade: true,
            description: true, photos: true, quantity: true,
          },
        },
      },
      orderBy: { endsAt: 'asc' },
    })

    if (!auction) {
      return NextResponse.json({ auction: null })
    }

    // Get the auction increments (or fall back to global config)
    const bs = await getBoutiqueSettings()
    let increments: number[] = [0.5, 1, 2, 5]
    const incrementsSource = auction.increments || bs.auctionIncrements
    try {
      const parsed = JSON.parse(incrementsSource || '[0.5,1,2,5]')
      if (Array.isArray(parsed) && parsed.length > 0) {
        increments = parsed.map((v: any) => Number(v)).filter((v: number) => !Number.isNaN(v) && v > 0)
      }
    } catch {}

    // Parse photos
    let photos: string[] = []
    try {
      const raw = auction.stockItem.photos || auction.mainPhoto
      if (auction.stockItem?.photos) {
        photos = JSON.parse(auction.stockItem.photos)
        photos = photos.map((p: string) => p.startsWith('/uploads/') ? `/api${p}` : p)
      }
    } catch {}
    if (photos.length === 0 && auction.mainPhoto) {
      photos = [auction.mainPhoto]
    }

    // Count total bids
    const bidCount = await db.bid.count({ where: { auctionId: auction.id } })

    return NextResponse.json({
      auction: {
        id: auction.id,
        sku: auction.sku,
        brand: auction.brand,
        title: auction.title,
        category: auction.category,
        mainPhoto: auction.mainPhoto,
        startPrice: auction.startPrice,
        currentPrice: auction.currentPrice,
        reservePrice: auction.reservePrice,
        startsAt: auction.startsAt,
        endsAt: auction.endsAt,
        increments,
        bidCount,
        bids: auction.bids.map(b => ({
          amount: b.amount,
          name: b.bidderName || 'Anonyme',
          time: b.createdAt,
        })),
        stockItem: auction.stockItem ? {
          ...auction.stockItem,
          photos,
        } : null,
      },
    })
  } catch (error) {
    console.error('GET /api/boutique/auctions/active error:', error)
    return NextResponse.json({ auction: null }, { status: 500 })
  }
}
