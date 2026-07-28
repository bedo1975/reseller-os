import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, requireAuth } from '@/lib/session'

// GET — list all carrier pricing rules (auth required)
export async function GET() {
  try {
    await requireAuth()
    const rules = await db.carrierPricingRule.findMany({
      orderBy: [{ carrierCode: 'asc' }, { weightMin: 'asc' }],
    })
    return NextResponse.json(rules)
  } catch (error) {
    console.error('GET /api/carrier-pricing error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — create a new carrier pricing rule (admin)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { carrierCode, label, weightMin, weightMax, price, active } = body

    if (!carrierCode || !label) {
      return NextResponse.json({ error: 'Transporteur et libellé requis' }, { status: 400 })
    }

    const rule = await db.carrierPricingRule.create({
      data: {
        carrierCode: carrierCode.trim(),
        label: label.trim(),
        weightMin: parseFloat(weightMin) || 0,
        weightMax: parseFloat(weightMax) || 0,
        price: parseFloat(price) || 0,
        active: active !== false,
      },
    })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('POST /api/carrier-pricing error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
