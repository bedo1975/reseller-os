import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const data: any = {}
    if (typeof body.carrierCode === 'string') data.carrierCode = body.carrierCode.trim()
    if (typeof body.label === 'string') data.label = body.label.trim()
    if (body.weightMin !== undefined) data.weightMin = parseFloat(body.weightMin) || 0
    if (body.weightMax !== undefined) data.weightMax = parseFloat(body.weightMax) || 0
    if (body.price !== undefined) data.price = parseFloat(body.price) || 0
    if (typeof body.active === 'boolean') data.active = body.active

    const rule = await db.carrierPricingRule.update({ where: { id }, data })
    return NextResponse.json(rule)
  } catch (error) {
    console.error('PATCH /api/carrier-pricing/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    await db.carrierPricingRule.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/carrier-pricing/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
