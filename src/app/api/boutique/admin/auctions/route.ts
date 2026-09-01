import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

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

// POST — create a new auction (single item or lot)
export async function POST(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { stockItemId, startPrice, reservePrice, startsAt, endsAt, increments, lotItems } = body

    if (!stockItemId || !startPrice || !startsAt || !endsAt) {
      return NextResponse.json({ error: 'Article, prix de départ, dates de début et de fin requis' }, { status: 400 })
    }

    // Verify the main stock item exists
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

    // If lotItems provided, validate them
    let lotItemsJson: string | null = null
    const allItemIds = [stockItemId]
    if (lotItems && Array.isArray(lotItems) && lotItems.length > 0) {
      const lotData = []
      for (const li of lotItems) {
        const lotItem = await db.stockItem.findUnique({ where: { id: li.stockItemId } })
        if (!lotItem) {
          return NextResponse.json({ error: `Article du lot introuvable: ${li.stockItemId}` }, { status: 404 })
        }
        lotData.push({
          stockItemId: lotItem.id,
          sku: lotItem.sku,
          brand: lotItem.brand,
          title: lotItem.title,
        })
        allItemIds.push(lotItem.id)
      }
      lotItemsJson = JSON.stringify(lotData)
    }

    // Create the auction
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
        lotItems: lotItemsJson,
      },
    })

    // Pass all items (main + lot) to RÉSERVÉ status
    // If an item has quantity > 1, only decrement by 1 (keep it buyable with remaining stock)
    for (const id of allItemIds) {
      const si = await db.stockItem.findUnique({ where: { id }, select: { quantity: true, status: true } })
      if (!si) continue
      if ((si.quantity || 0) > 1) {
        // Multiple in stock — decrement by 1, keep PUBLIE
        await db.stockItem.update({
          where: { id },
          data: { quantity: { decrement: 1 } },
        })
      } else {
        // Only 1 left → pass to RÉSERVÉ (not buyable on the boutique)
        await db.stockItem.update({
          where: { id },
          data: { status: 'RESERVE' },
        })
      }
    }

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

// DELETE — cancel an auction and restore stock
export async function DELETE(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID requis' }, { status: 400 })
    }

    const auction = await db.auction.findUnique({ where: { id } })
    if (!auction) {
      return NextResponse.json({ error: 'Enchère introuvable' }, { status: 404 })
    }
    if (auction.status === 'won' || auction.status === 'archived') {
      return NextResponse.json({ error: 'Impossible de supprimer une enchère terminée' }, { status: 400 })
    }

    // Restore stock for all items (main + lot)
    const allItemIds = [auction.stockItemId]
    if (auction.lotItems) {
      try {
        const lot = JSON.parse(auction.lotItems)
        for (const li of lot) allItemIds.push(li.stockItemId)
      } catch {}
    }

    for (const itemId of allItemIds) {
      const si = await db.stockItem.findUnique({ where: { id: itemId }, select: { quantity: true, status: true } })
      if (!si) continue
      if (si.status === 'RESERVE') {
        // Was reserved → restore to PUBLIE
        await db.stockItem.update({ where: { id: itemId }, data: { status: 'PUBLIE' } })
      } else {
        // Was decremented → increment back
        await db.stockItem.update({ where: { id: itemId }, data: { quantity: { increment: 1 } } })
      }
    }

    // Delete the auction + its bids
    await db.bid.deleteMany({ where: { auctionId: id } })
    await db.auction.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/auctions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
