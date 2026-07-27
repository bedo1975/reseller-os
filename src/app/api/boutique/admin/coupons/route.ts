import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — admin: all coupons (including inactive)
export async function GET() {
  try {
    await requireAdmin()
    const coupons = await db.coupon.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ coupons })
  } catch (error) {
    console.error('GET /api/boutique/admin/coupons error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ coupons: [] }, { status: 500 })
  }
}

// POST — admin: create new coupon
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const {
      code,
      name,
      description,
      type,
      value,
      minAmount,
      startsAt,
      expiresAt,
      maxUses,
      maxUsesPerClient,
      active,
    } = body

    if (!code || !name) {
      return NextResponse.json({ error: 'Code et nom requis' }, { status: 400 })
    }

    const valueNum = parseFloat(value)
    if (isNaN(valueNum) || valueNum <= 0) {
      return NextResponse.json({ error: 'Valeur de réduction invalide' }, { status: 400 })
    }

    if (type === 'percent' && valueNum > 100) {
      return NextResponse.json({ error: 'Le pourcentage ne peut pas dépasser 100%' }, { status: 400 })
    }

    // Check code uniqueness
    const existing = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } })
    if (existing) {
      return NextResponse.json({ error: 'Ce code coupon existe déjà' }, { status: 400 })
    }

    const coupon = await db.coupon.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description?.trim() || null,
        type: type === 'fixed' ? 'fixed' : 'percent',
        value: valueNum,
        minAmount: parseFloat(minAmount) || 0,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerClient: maxUsesPerClient ? parseInt(maxUsesPerClient) : null,
        active: active !== false,
      },
    })
    return NextResponse.json(coupon)
  } catch (error) {
    console.error('POST /api/boutique/admin/coupons error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
