import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — get one saved search with all its snapshots (history)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const search = await db.productTrendSearch.findFirst({
      where: { id, userId: user.id },
      include: {
        snapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 50,
        },
      },
    })

    if (!search) {
      return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
    }

    return NextResponse.json({ search })
  } catch (error) {
    console.error('GET /api/product-trends/saved/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH — update a saved search
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existing = await db.productTrendSearch.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
    }

    const data: any = {}
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.keyword === 'string') data.keyword = body.keyword.trim()
    if (body.category !== undefined) data.category = body.category || null
    if (typeof body.platform === 'string') data.platform = body.platform
    if (typeof body.country === 'string') data.country = body.country
    if (typeof body.period === 'string') data.period = body.period
    if (body.priceMin !== undefined) data.priceMin = body.priceMin ? parseFloat(body.priceMin) : null
    if (body.priceMax !== undefined) data.priceMax = body.priceMax ? parseFloat(body.priceMax) : null

    const search = await db.productTrendSearch.update({ where: { id }, data })
    return NextResponse.json(search)
  } catch (error) {
    console.error('PATCH /api/product-trends/saved/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — delete a saved search (snapshots cascade-deleted)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.productTrendSearch.findFirst({ where: { id, userId: user.id } })
    if (!existing) {
      return NextResponse.json({ error: 'Recherche introuvable' }, { status: 404 })
    }

    await db.productTrendSearch.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/product-trends/saved/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
