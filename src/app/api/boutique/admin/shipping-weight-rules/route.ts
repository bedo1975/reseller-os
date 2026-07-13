import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list weight rules for a shipping method
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const shippingMethodId = searchParams.get('shippingMethodId')
    if (!shippingMethodId) {
      return NextResponse.json({ rules: [] })
    }
    const rules = await db.shippingWeightRule.findMany({
      where: { shippingMethodId },
      orderBy: { weightMin: 'asc' },
    })
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('GET /api/boutique/admin/shipping-weight-rules error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ rules: [] }, { status: 500 })
  }
}

// POST — create weight rule
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { shippingMethodId, weightMin, weightMax, price } = body

    if (!shippingMethodId || weightMin == null || weightMax == null || price == null) {
      return NextResponse.json({ error: 'Tous les champs requis' }, { status: 400 })
    }

    const rule = await db.shippingWeightRule.create({
      data: {
        shippingMethodId,
        weightMin: parseFloat(weightMin),
        weightMax: parseFloat(weightMax),
        price: parseFloat(price),
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('POST /api/boutique/admin/shipping-weight-rules error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
