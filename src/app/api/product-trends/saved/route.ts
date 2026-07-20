import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list user's saved searches
export async function GET() {
  try {
    const user = await requireAuth()
    const searches = await db.productTrendSearch.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1,
        },
      },
    })
    return NextResponse.json({ searches })
  } catch (error) {
    console.error('GET /api/product-trends/saved error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — save a new search
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name, keyword, category, platform, country, period, priceMin, priceMax, captureSnapshot, snapshotData } = body

    if (!name || !keyword) {
      return NextResponse.json({ error: 'Nom et mot-clé requis' }, { status: 400 })
    }

    const search = await db.productTrendSearch.create({
      data: {
        userId: user.id,
        name: name.trim(),
        keyword: keyword.trim(),
        category: category || null,
        platform: platform || 'all',
        country: country || 'fr',
        period: period || '30d',
        priceMin: priceMin ? parseFloat(priceMin) : null,
        priceMax: priceMax ? parseFloat(priceMax) : null,
      },
    })

    // Optional: capture an initial snapshot
    if (captureSnapshot && snapshotData) {
      await db.productTrendSnapshot.create({
        data: {
          searchId: search.id,
          totalResults: snapshotData.totalResults || 0,
          avgPrice: snapshotData.avgPrice || 0,
          minPrice: snapshotData.minPrice || null,
          maxPrice: snapshotData.maxPrice || null,
          medianPrice: snapshotData.medianPrice || null,
          topScore: snapshotData.topScore || 0,
          topItems: JSON.stringify((snapshotData.topItems || []).slice(0, 10)),
        },
      })
    }

    return NextResponse.json(search)
  } catch (error) {
    console.error('POST /api/product-trends/saved error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
