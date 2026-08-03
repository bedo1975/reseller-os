import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — returns shipping methods
// - Public: returns only active methods (for the storefront checkout)
// - Admin (with ?all=true): returns ALL methods (active + inactive) for the admin UI
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const wantAll = url.searchParams.get('all') === 'true'

    // If ?all=true, require admin
    let isAdmin = false
    if (wantAll) {
      try {
        await requireAuth()
        isAdmin = true
      } catch {
        // Not admin — fall back to active-only
      }
    }

    const methods = await db.shippingMethod.findMany({
      where: wantAll && isAdmin ? {} : { active: true },
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
    await requireAuth()
    const body = await req.json()
    const { code, label, price, delay, carrierCode, active, order } = body

    if (!code || !label) {
      return NextResponse.json({ error: 'Code et libellé requis' }, { status: 400 })
    }

    const method = await db.shippingMethod.create({
      data: {
        code: code.trim(),
        label: label.trim(),
        price: parseFloat(price) || 0,
        delay: delay?.trim() || '',
        carrierCode: carrierCode || null,
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
