import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const data: any = {}

    if (typeof body.code === 'string') {
      const code = body.code.trim().toUpperCase()
      // Check uniqueness (excluding current)
      const existing = await db.coupon.findFirst({
        where: { code, NOT: { id } },
      })
      if (existing) {
        return NextResponse.json({ error: 'Ce code coupon existe déjà' }, { status: 400 })
      }
      data.code = code
    }
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.description === 'string') data.description = body.description.trim() || null
    if (typeof body.type === 'string') data.type = body.type === 'fixed' ? 'fixed' : 'percent'

    if (typeof body.value === 'number' || typeof body.value === 'string') {
      const valueNum = parseFloat(body.value as string)
      if (!isNaN(valueNum) && valueNum > 0) {
        if (data.type === 'percent' && valueNum > 100) {
          return NextResponse.json({ error: 'Le pourcentage ne peut pas dépasser 100%' }, { status: 400 })
        }
        data.value = valueNum
      }
    }

    if (typeof body.minAmount === 'number' || typeof body.minAmount === 'string') {
      const minNum = parseFloat(body.minAmount as string)
      if (!isNaN(minNum) && minNum >= 0) data.minAmount = minNum
    }

    if (body.startsAt !== undefined) {
      data.startsAt = body.startsAt ? new Date(body.startsAt) : null
    }
    if (body.expiresAt !== undefined) {
      data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null
    }
    if (body.maxUses !== undefined) {
      data.maxUses = body.maxUses ? parseInt(body.maxUses) : null
    }
    if (body.maxUsesPerClient !== undefined) {
      data.maxUsesPerClient = body.maxUsesPerClient ? parseInt(body.maxUsesPerClient) : null
    }
    if (typeof body.active === 'boolean') data.active = body.active

    const coupon = await db.coupon.update({ where: { id }, data })
    return NextResponse.json(coupon)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/coupons/[id] error:', error)
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
    await db.coupon.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/coupons/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
