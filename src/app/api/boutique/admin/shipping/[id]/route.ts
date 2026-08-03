import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()

    const data: any = {}
    if (typeof body.code === 'string') data.code = body.code
    if (typeof body.label === 'string') data.label = body.label
    if (typeof body.price === 'number' || typeof body.price === 'string') data.price = parseFloat(body.price)
    if (typeof body.delay === 'string') data.delay = body.delay
    if (typeof body.active === 'boolean') data.active = body.active
    if (typeof body.order === 'number') data.order = body.order
    if (body.carrierCode !== undefined) data.carrierCode = body.carrierCode || null

    const method = await db.shippingMethod.update({ where: { id }, data })
    return NextResponse.json(method)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/shipping/[id] error:', error)
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
    await requireAuth()
    const { id } = await params
    await db.shippingMethod.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/shipping/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
