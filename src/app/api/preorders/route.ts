import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/preorders
 * Auth — list all pre-orders for the current user.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    // Admin sees all pre-orders; staff sees only their own
    const where = user.role === 'admin' ? {} : { userId: user.id }
    const preorders = await db.preOrder.findMany({
      where,
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(preorders)
  } catch (error) {
    console.error('GET /api/preorders error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Generate a unique reference like "PC-2026-001"
 */
async function generateReference(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.preOrder.count({
    where: { reference: { startsWith: `PC-${year}-` } },
  })
  return `PC-${year}-${String(count + 1).padStart(3, '0')}`
}

/**
 * POST /api/preorders
 * Auth — create a new pre-order.
 *
 * Body: {
 *   name: string,
 *   supplierId?: string,
 *   supplierName?: string,
 *   orderDate?: string (ISO),
 *   items: [{ designation, url, description, size, color, condition, quantity, unitPrice, stockItemId? }],
 *   shippingCost?: number,
 *   notes?: string,
 * }
 *
 * subtotal + total are computed server-side from items.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name, supplierId, supplierName, orderDate, paymentMethod, items, shippingCost, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Le nom de la pré-commande est requis' }, { status: 400 })
    }

    const parsedItems = Array.isArray(items) ? items : []
    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'Au moins un article est requis' }, { status: 400 })
    }

    // Compute subtotal from items
    const subtotal = parsedItems.reduce((sum: number, it: any) => {
      const qty = Number(it.quantity) || 0
      const price = Number(it.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const shipping = Number(shippingCost) || 0
    const total = subtotal + shipping

    const reference = await generateReference()

    // Attach the pre-order to the admin (not the current user) so that:
    // 1. The accounting API (which filters by adminUser.id) can find the Purchase created on validation
    // 2. Admins can see all pre-orders regardless of who created them
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const preorderUserId = adminUser?.id || user.id

    const preorder = await db.preOrder.create({
      data: {
        reference,
        name: name.trim(),
        supplierId: supplierId || null,
        supplierName: supplierName || null,
        orderDate: orderDate ? new Date(orderDate) : new Date(),
        items: JSON.stringify(parsedItems),
        subtotal,
        shippingCost: shipping,
        total,
        paymentMethod: paymentMethod || null,
        notes: notes || null,
        status: 'pending',
        userId: preorderUserId,
      },
      include: { supplier: true },
    })

    return NextResponse.json(preorder)
  } catch (error) {
    console.error('POST /api/preorders error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
