import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/coupons/validate
 * Public — validate a coupon code entered by the customer on the checkout page.
 *
 * Body: { code: string, subtotal: number, clientId?: string }
 *
 * Returns:
 *  - 200 { valid: true, coupon: {...}, discountAmount }
 *  - 400 { valid: false, error }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { code, subtotal, clientId } = body

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ valid: false, error: 'Code manquant' }, { status: 400 })
    }

    const subtotalNum = parseFloat(subtotal)
    if (isNaN(subtotalNum) || subtotalNum < 0) {
      return NextResponse.json({ valid: false, error: 'Sous-total invalide' }, { status: 400 })
    }

    const coupon = await db.coupon.findUnique({
      where: { code: code.trim().toUpperCase() },
    })

    if (!coupon) {
      return NextResponse.json({ valid: false, error: 'Code coupon introuvable' }, { status: 400 })
    }

    if (!coupon.active) {
      return NextResponse.json({ valid: false, error: 'Ce coupon est désactivé' }, { status: 400 })
    }

    const now = new Date()
    if (coupon.startsAt && now < coupon.startsAt) {
      return NextResponse.json({ valid: false, error: 'Ce coupon n\'est pas encore valide' }, { status: 400 })
    }
    if (coupon.expiresAt && now > coupon.expiresAt) {
      return NextResponse.json({ valid: false, error: 'Ce coupon a expiré' }, { status: 400 })
    }

    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return NextResponse.json({ valid: false, error: 'Ce coupon a atteint sa limite d\'utilisation' }, { status: 400 })
    }

    if (subtotalNum < coupon.minAmount) {
      return NextResponse.json(
        { valid: false, error: `Montant minimum de ${coupon.minAmount.toFixed(2)} € requis pour ce coupon` },
        { status: 400 },
      )
    }

    // Compute discount
    let discountAmount = 0
    if (coupon.type === 'percent') {
      discountAmount = (subtotalNum * coupon.value) / 100
    } else {
      discountAmount = coupon.value
    }
    // Cap discount at subtotal (no negative totals)
    if (discountAmount > subtotalNum) discountAmount = subtotalNum

    return NextResponse.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        name: coupon.name,
        type: coupon.type,
        value: coupon.value,
        minAmount: coupon.minAmount,
      },
      discountAmount: Math.round(discountAmount * 100) / 100,
    })
  } catch (error) {
    console.error('POST /api/boutique/coupons/validate error:', error)
    return NextResponse.json({ valid: false, error: 'Erreur serveur' }, { status: 500 })
  }
}
