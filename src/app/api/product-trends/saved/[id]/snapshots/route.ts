import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// POST /api/product-trends/saved/[id]/snapshots — capture a new snapshot for a saved search
// Body: { totalResults, avgPrice, minPrice, maxPrice, medianPrice, topScore, topItems }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    const search = await db.productTrendSearch.findFirst({ where: { id, userId: user.id } })
    if (!search) {
      return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
    }

    const snapshot = await db.productTrendSnapshot.create({
      data: {
        searchId: id,
        totalResults: body.totalResults || 0,
        avgPrice: body.avgPrice || 0,
        minPrice: body.minPrice || null,
        maxPrice: body.maxPrice || null,
        medianPrice: body.medianPrice || null,
        topScore: body.topScore || 0,
        topItems: JSON.stringify((body.topItems || []).slice(0, 10)),
      },
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('POST /api/product-trends/saved/[id]/snapshots error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
