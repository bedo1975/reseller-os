import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — admin: all payment methods (including inactive)
export async function GET() {
  try {
    await requireAdmin()
    const methods = await db.paymentMethod.findMany({
      orderBy: { order: 'asc' },
    })
    return NextResponse.json({ methods })
  } catch (error) {
    console.error('GET /api/boutique/admin/payments error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ methods: [] }, { status: 500 })
  }
}

// POST — admin: create new payment method
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { code, label, description, icon, provider, active, order } = body

    if (!code || !label) {
      return NextResponse.json({ error: 'Code et libellé requis' }, { status: 400 })
    }

    const method = await db.paymentMethod.create({
      data: {
        code: code.trim(),
        label: label.trim(),
        description: description?.trim() || null,
        icon: icon?.trim() || null,
        provider: provider || 'demo',
        active: active !== false,
        order: parseInt(order) || 0,
      },
    })
    return NextResponse.json(method)
  } catch (error) {
    console.error('POST /api/boutique/admin/payments error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
