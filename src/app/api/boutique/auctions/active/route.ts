import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyAuctionWon } from '@/lib/email'
import { randomBytes } from 'crypto'

/**
 * GET /api/boutique/auctions/active[?id=XXX]
 * Public — returns the currently active auction(s).
 * Used by the /enchere page on the boutique.
 *
 * If ?id=XXX is provided, returns the details of that specific auction.
 * Otherwise, returns the single active auction (or a list if multiple).
 *
 * Also auto-processes expired auctions:
 * - Activates scheduled auctions whose startsAt has passed
 * - Ends active auctions whose endsAt has passed (determines winner, sends email, updates stock)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const requestedId = searchParams.get('id')
    const now = new Date()

    // 1. Auto-activate scheduled auctions whose startsAt has passed
    const scheduled = await db.auction.findMany({
      where: { status: 'scheduled', startsAt: { lte: now } },
    })
    for (const a of scheduled) {
      await db.auction.update({ where: { id: a.id }, data: { status: 'active' } })
    }

    // 2. Auto-end active auctions whose endsAt has passed
    const expired = await db.auction.findMany({
      where: { status: 'active', endsAt: { lte: now } },
      include: { bids: { orderBy: { amount: 'desc' }, take: 1 } },
    })

    for (const auction of expired) {
      const winningBid = auction.bids[0]
      const reserveMet = !auction.reservePrice || (winningBid && winningBid.amount >= auction.reservePrice)

      // Collect all item IDs (main + lot)
      const allItemIds = [auction.stockItemId]
      if (auction.lotItems) {
        try {
          const lot = JSON.parse(auction.lotItems)
          for (const li of lot) allItemIds.push(li.stockItemId)
        } catch {}
      }

      if (!winningBid || !reserveMet) {
        // No winner — restore stock
        for (const itemId of allItemIds) {
          const si = await db.stockItem.findUnique({ where: { id: itemId }, select: { quantity: true, status: true } })
          if (!si) continue
          if (si.status === 'RESERVE') {
            await db.stockItem.update({ where: { id: itemId }, data: { status: 'PUBLIE' } })
          } else {
            await db.stockItem.update({ where: { id: itemId }, data: { quantity: { increment: 1 } } })
          }
        }
        await db.auction.update({ where: { id: auction.id }, data: { status: 'ended' } })
      } else {
        // Won — generate cart + send email + mark items as sold
        const bs = await getBoutiqueSettings()
        const durationHours = bs.makeOfferCartDurationHours || 24
        const cartToken = randomBytes(16).toString('hex')
        const cartExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

        await db.bid.update({ where: { id: winningBid.id }, data: { isWinning: true } })

        await db.auction.update({
          where: { id: auction.id },
          data: {
            status: 'won',
            winnerEmail: winningBid.bidderEmail,
            winnerBidId: winningBid.id,
            cartToken,
            cartExpiresAt,
          },
        })

        // Mark items as sold
        for (const itemId of allItemIds) {
          const si = await db.stockItem.findUnique({ where: { id: itemId }, select: { quantity: true, status: true } })
          if (!si) continue
          if (si.status === 'RESERVE') {
            await db.stockItem.update({
              where: { id: itemId },
              data: { status: 'VENDU', quantity: 0, soldCount: { increment: 1 } },
            })
          } else {
            await db.stockItem.update({
              where: { id: itemId },
              data: { soldCount: { increment: 1 } },
            })
          }
        }

        // Send winner email (best-effort)
        const siteUrl = bs.shareSiteUrl || ''
        const cartUrl = siteUrl
          ? `${siteUrl.replace(/\/+$/, '')}/panier?offer=${cartToken}`
          : `/panier?offer=${cartToken}`
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
          await db.auction.update({ where: { id: auction.id }, data: { winnerEmailSent: true } })
        } catch (emailErr) {
          console.error('[auctions/active] Auto-end: failed to send winner email:', emailErr)
        }
      }
    }

    // Find ALL active auctions (or a specific one if ?id= is provided)
    const whereClause = requestedId
      ? { id: requestedId, status: 'active' }
      : { status: 'active', startsAt: { lte: now }, endsAt: { gt: now } }
    const activeAuctions = await db.auction.findMany({
      where: whereClause,
      include: {
        bids: { orderBy: { amount: 'desc' }, take: 10, select: { id: true, amount: true, bidderName: true, createdAt: true } },
        stockItem: { select: { sku: true, brand: true, title: true, category: true, size: true, color: true, condition: true, grade: true, description: true, photos: true, quantity: true } },
      },
      orderBy: { endsAt: 'asc' },
    })

    // If no active auctions, return null
    if (activeAuctions.length === 0) {
      return NextResponse.json({ auction: null, auctions: [] })
    }

    // If multiple active auctions, return the list (the frontend will show a selection page)
    if (activeAuctions.length > 1) {
      const auctionList = activeAuctions.map(a => ({
        id: a.id,
        sku: a.sku,
        brand: a.brand,
        title: a.title,
        mainPhoto: a.mainPhoto,
        startPrice: a.startPrice,
        currentPrice: a.currentPrice,
        endsAt: a.endsAt,
        bidCount: 0,
        lotItems: a.lotItems ? (() => { try {
          const lotIds = JSON.parse(a.lotItems) as { stockItemId: string; sku: string; brand: string; title: string | null }[]
          return lotIds.map(li => ({ sku: li.sku, brand: li.brand, title: li.title, mainPhoto: null }))
        } catch { return null } })() : null,
      }))
      // Fill bid counts
      for (const al of auctionList) {
        al.bidCount = await db.bid.count({ where: { auctionId: al.id } })
      }
      return NextResponse.json({ auction: null, auctions: auctionList })
    }

    // Single active auction — return full details
    const auction = activeAuctions[0]

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

    // Parse lotItems + fetch their photos
    let lotItems: { sku: string; brand: string; title: string | null; mainPhoto: string | null; size: string | null; color: string | null }[] | null = null
    if (auction.lotItems) {
      try {
        const lotIds = JSON.parse(auction.lotItems) as { stockItemId: string; sku: string; brand: string; title: string | null }[]
        const lotStockItems = await db.stockItem.findMany({
          where: { id: { in: lotIds.map(li => li.stockItemId) } },
          select: { id: true, sku: true, photos: true, size: true, color: true },
        })
        lotItems = lotIds.map(li => {
          const si = lotStockItems.find(s => s.id === li.stockItemId)
          let liPhoto: string | null = null
          if (si?.photos) {
            try {
              const liPhotos = JSON.parse(si.photos)
              if (Array.isArray(liPhotos) && liPhotos.length > 0) {
                liPhoto = liPhotos[0].startsWith('/uploads/') ? `/api${liPhotos[0]}` : liPhotos[0]
              }
            } catch {}
          }
          return {
            sku: li.sku,
            brand: li.brand,
            title: li.title,
            mainPhoto: liPhoto,
            size: si?.size || null,
            color: si?.color || null,
          }
        })
      } catch {}
    }

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
        lotItems,
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
