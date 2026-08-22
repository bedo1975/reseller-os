import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/boutique/admin/price-calculator
 * Admin — returns the price calculator settings. Creates with defaults if missing.
 */
export async function GET() {
  try {
    await requireAuth()
    let config = await db.priceCalculator.findUnique({ where: { id: 'default' } })
    if (!config) {
      config = await db.priceCalculator.create({ data: { id: 'default' } })
    }
    return NextResponse.json(config)
  } catch (error) {
    console.error('GET /api/boutique/admin/price-calculator error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/boutique/admin/price-calculator
 * Admin — updates the price calculator settings.
 *
 * Body: { taxRate, bankFeeFixed, bankFeePercent, minMargin }
 */
export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const { taxRate, bankFeeFixed, bankFeePercent, minMargin } = body

    const data: any = {}
    if (typeof taxRate === 'number') data.taxRate = Math.max(0, Math.min(100, taxRate))
    if (typeof bankFeeFixed === 'number') data.bankFeeFixed = Math.max(0, bankFeeFixed)
    if (typeof bankFeePercent === 'number') data.bankFeePercent = Math.max(0, Math.min(100, bankFeePercent))
    if (typeof minMargin === 'number') data.minMargin = Math.max(0, Math.min(500, minMargin))

    const config = await db.priceCalculator.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })

    return NextResponse.json(config)
  } catch (error) {
    console.error('PUT /api/boutique/admin/price-calculator error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
