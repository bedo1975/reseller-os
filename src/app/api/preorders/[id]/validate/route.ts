import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/preorders/[id]/validate
 * Auth — validate a pre-order (convert it to a real order).
 *
 * This means the supplier order has been accepted and placed.
 * Actions performed:
 * 1. Set pre-order status to "validated" + validatedAt timestamp
 * 2. Create a Purchase entry (for the ACHATS accounting tab) with:
 *    - designation = pre-order name + reference
 *    - amount = pre-order total
 *    - supplierId / supplierName
 *    - category = "precommande"
 *    - invoiceNumber = pre-order invoiceNumber (if set)
 *    - notes = link back to pre-order reference
 * 3. Link the Purchase to the pre-order (purchaseId field)
 *
 * Body (optional): { orderNumber?, invoiceNumber? }
 * — allows the user to set the supplier order/invoice numbers at validation time.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    // Fetch the pre-order — allow admin to validate any pre-order (not just their own)
    // This fixes the case where a staff member creates the pre-order and the admin validates it (or vice versa).
    const existing = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
      include: { supplier: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }
    if (existing.status === 'validated') {
      return NextResponse.json({ error: 'Cette pré-commande est déjà validée' }, { status: 400 })
    }
    if (existing.status === 'cancelled') {
      return NextResponse.json({ error: 'Impossible de valider une pré-commande annulée' }, { status: 400 })
    }

    // Update order/invoice numbers if provided
    const orderNumber = typeof body.orderNumber === 'string' ? body.orderNumber.trim() || null : existing.orderNumber
    const invoiceNumber = typeof body.invoiceNumber === 'string' ? body.invoiceNumber.trim() || null : existing.invoiceNumber

    // Build a designation string for the Purchase entry
    const items = JSON.parse(existing.items) as any[]
    const itemsSummary = items.length > 0
      ? items.slice(0, 3).map((it: any) => it.designation || it.title || 'Article').join(', ') + (items.length > 3 ? ` (+${items.length - 3} autres)` : '')
      : 'Articles'

    const designation = `Pré-commande ${existing.reference} — ${existing.name} (${itemsSummary})`

    // The accounting API (ACHATS tab) filters purchases by adminUser.id, so we
    // must attach the Purchase to the admin (not the staff member who clicked validate).
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const purchaseUserId = adminUser?.id || user.id

    // Create the Purchase entry (appears in Fiscalité → ACHATS)
    const purchase = await db.purchase.create({
      data: {
        date: new Date(),
        designation,
        category: 'precommande',  // nouvelle catégorie pour les pré-commandes
        supplierId: existing.supplierId || null,
        supplierName: existing.supplier?.name || existing.supplierName || null,
        amount: existing.total,
        orderNumber: orderNumber || null,
        invoiceNumber: invoiceNumber || null,
        paymentMethod: existing.paymentMethod || null,
        notes: `Pré-commande ${existing.reference}`,
        userId: purchaseUserId,
      },
    })

    // Mark the pre-order as validated + link the purchase
    const updated = await db.preOrder.update({
      where: { id },
      data: {
        status: 'validated',
        validatedAt: new Date(),
        orderNumber,
        invoiceNumber,
        purchaseId: purchase.id,
      },
      include: { supplier: true },
    })

    return NextResponse.json({
      preorder: updated,
      purchase,
      message: 'Pré-commande validée. Une entrée a été créée dans Fiscalité → ACHATS.',
    })
  } catch (error) {
    console.error('POST /api/preorders/[id]/validate error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
