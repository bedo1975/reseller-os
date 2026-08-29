import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

// GET — list all auctions (admin)
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || 'all'

    const auctions = await db.auction.findMany({
      where: status !== 'all' ? { status } : {},
      include: {
        stockItem: { select: { sku: true, brand: true, title: true, category: true, photos: true, suggestedPrice: true, quantity: true, status: true } },
        bids: { orderBy: { amount: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Count bids for each auction
    const auctionsWithCounts = await Promise.all(
      auctions.map(async (a) => ({
        ...a,
        bidCount: await db.bid.count({ where: { auctionId: a.id } }),
      }))
    )

    return NextResponse.json({ auctions: auctionsWithCounts })
  } catch (error) {
    console.error('GET /api/boutique/admin/auctions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — create a new auction
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { stockItemId, startPrice, reservePrice, startsAt, endsAt, increments } = body

    if (!stockItemId || !startPrice || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'Article, prix de départ, dates de début et de fin requis' }, { status: 400 })
    }

    // Verify the stock item exists and is available
    const item = await db.stockItem.findUnique({ where: { id: stockItemId } })
    if (!item) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Parse photos for the main photo snapshot
    let mainPhoto: string | null = null
    try {
      const photos = JSON.parse(item.photos || '[]')
      if (Array.isArray(photos) && photos.length > 0) {
        mainPhoto = photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]
      }
    } catch {}

    const auction = await db.auction.create({
      data: {
        stockItemId,
        sku: item.sku,
        brand: item.brand,
        title: item.title,
        category: item.category,
        mainPhoto,
        startPrice: parseFloat(startPrice),
        currentPrice: parseFloat(startPrice),
        reservePrice: reservePrice ? parseFloat(reservePrice) : null,
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        status: 'scheduled',
        increments: increments || null,
      },
    })

    return NextResponse.json(auction)
  } catch (error) {
    console.error('POST /api/boutique/admin/auctions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH — update an auction
export async function PATCH(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { id, status, startsAt, endsAt, startPrice, reservePrice, increments } = body

    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const data: any = {}
    if (status) data.status = status
    if (startsAt) data.startsAt = new Date(startsAt)
    if (endsAt) data.endsAt = new Date(endsAt)
    if (startPrice) {
      data.startPrice = parseFloat(startPrice)
      // Only update currentPrice if no bids yet
      data.currentPrice = parseFloat(startPrice)
    }
    if (reservePrice !== undefined) data.reservePrice = reservePrice ? parseFloat(reservePrice) : null
    if (increments !== undefined) data.increments = increments || null

    const auction = await db.auction.update({ where: { id }, data })
    return NextResponse.json(auction)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/auctions error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
