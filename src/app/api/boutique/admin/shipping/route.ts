import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — public (returns active shipping methods for the storefront)
export async function GET() {
  try {
    const methods = await db.shippingMethod.findMany({
      where: { active: true },
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ methods })
  } catch (error) {
    console.error('GET /api/boutique/admin/shipping error:', error)
    return NextResponse.json({ methods: [] }, { status: 500 })
  }
}

// POST — admin only (create new shipping method)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { code, label, price, delay, active, order } = body

    if (!code || !label) {
      return NextResponse.json({ error: 'Code et libellé requis' }, { status: 400 })
    }

    const method = await db.shippingMethod.create({
      data: {
        code: code.trim(),
        label: label.trim(),
        price: parseFloat(price) || 0,
        delay: delay?.trim() || '',
        active: active !== false,
        order: parseInt(order) || 0,
      },
    })

    return NextResponse.json(method)
  } catch (error) {
    console.error('POST /api/boutique/admin/shipping error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
