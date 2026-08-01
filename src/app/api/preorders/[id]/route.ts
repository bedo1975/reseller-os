import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/preorders/[id]
 * Auth — get a single pre-order.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Admin sees any pre-order; staff sees only their own
    const where = user.role === 'admin' ? { id } : { id, userId: user.id }
    const preorder = await db.preOrder.findFirst({
      where,
      include: { supplier: true },
    })
    if (!preorder) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }
    return NextResponse.json(preorder)
  } catch (error) {
    console.error('GET /api/preorders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH /api/preorders/[id]
 * Auth — update a pre-order (name, supplier, date, items, shipping, notes, orderNumber, invoiceNumber).
 *
 * Only works on pending or validated pre-orders (not cancelled).
 * subtotal + total are recomputed from items.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Admin can edit any pre-order; staff only their own
    const existing = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }
    if (existing.status === 'cancelled') {
      return NextResponse.json({ error: 'Impossible de modifier une pré-commande annulée' }, { status: 400 })
    }

    const data: any = {}
    if (typeof body.name === 'string') data.name = body.name.trim()
    if (typeof body.supplierId === 'string') data.supplierId = body.supplierId || null
    if (typeof body.supplierName === 'string') data.supplierName = body.supplierName || null
    if (typeof body.orderDate === 'string') data.orderDate = new Date(body.orderDate)
    if (typeof body.notes === 'string') data.notes = body.notes || null
    if (typeof body.orderNumber === 'string') data.orderNumber = body.orderNumber || null
    if (typeof body.invoiceNumber === 'string') data.invoiceNumber = body.invoiceNumber || null
    if (typeof body.status === 'string') {
      if (!['pending', 'validated', 'cancelled'].includes(body.status)) {
        return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
      }
      data.status = body.status
    }

    // If items are provided, recompute subtotal + total
    if (Array.isArray(body.items)) {
      data.items = JSON.stringify(body.items)
      const subtotal = body.items.reduce((sum: number, it: any) => {
        return sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)
      }, 0)
      data.subtotal = subtotal
      const shipping = typeof body.shippingCost === 'number' ? body.shippingCost : existing.shippingCost
      data.shippingCost = shipping
      data.total = subtotal + shipping
    } else if (typeof body.shippingCost === 'number') {
      data.shippingCost = body.shippingCost
      data.total = existing.subtotal + body.shippingCost
    }

    const updated = await db.preOrder.update({
      where: { id },
      data,
      include: { supplier: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/preorders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/preorders/[id]
 * Auth — delete a pre-order (only if pending).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Admin can delete any pre-order; staff only their own
    const existing = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }
    if (existing.status === 'validated') {
      return NextResponse.json({
        error: 'Impossible de supprimer une pré-commande validée. Annulez-la à la place.',
      }, { status: 400 })
    }

    await db.preOrder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/preorders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
