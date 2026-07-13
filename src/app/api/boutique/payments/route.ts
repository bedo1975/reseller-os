import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/payments
 * Public — returns active payment methods for the storefront.
 */
export async function GET() {
  try {
    const methods = await db.paymentMethod.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    // If empty, return defaults (so the checkout isn't broken)
    if (methods.length === 0) {
      return NextResponse.json({
        methods: [
          { id: 'default-cb', code: 'cb_demo', label: 'Carte bancaire (démo)', description: 'Paiement simulé par carte', icon: '💳', provider: 'demo', active: true },
          { id: 'default-paypal', code: 'paypal_demo', label: 'PayPal (démo)', description: 'Paiement simulé PayPal', icon: '🅿️', provider: 'demo', active: true },
          { id: 'default-virement', code: 'virement', label: 'Virement bancaire', description: 'Virement sous 3 jours ouvrés', icon: '🏦', provider: 'manual', active: true },
        ],
      })
    }
    return NextResponse.json({ methods })
  } catch (error) {
    console.error('GET /api/boutique/payments error:', error)
    return NextResponse.json({ methods: [] }, { status: 500 })
  }
}
