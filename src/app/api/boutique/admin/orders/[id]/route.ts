import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { notifyOrderStatusChange } from '@/lib/email'

/**
 * Restaure le stock d'une commande annulée ou supprimée :
 * - pour chaque Sale liée à la commande, décrémente soldCount de la qty,
 *   réincrémente quantity de la qty, et repasse en PUBLIE si quantity > 0
 * - supprime les Sales (la commande n'existe plus ou est annulée)
 *
 * Important : on lit les items AVANT de supprimer les Sales (sinon on perd le lien stockItem).
 */
async function restoreStockForOrder(orderId: string, opts: { deleteSales: boolean }) {
  const order = await db.boutiqueOrder.findUnique({ where: { id: orderId } })
  if (!order) return

  const invoiceNumbers = JSON.parse(order.invoiceNumbers) as string[]
  const items = JSON.parse(order.items) as Array<{ sku: string; qty: number }>

  // Pour chaque facture de la commande, on remet le stock correspondant
  for (const invNum of invoiceNumbers) {
    const sale = await db.sale.findFirst({ where: { invoiceNumber: invNum } })
    if (!sale) continue

    const stockItem = await db.stockItem.findUnique({
      where: { id: sale.stockItemId },
      select: { id: true, sku: true, quantity: true, soldCount: true, status: true, platform: true },
    })
    if (!stockItem) {
      if (opts.deleteSales) await db.sale.delete({ where: { id: sale.id } })
      continue
    }

    // Retrouve la quantité commandée pour cet article (par SKU)
    const orderedQty = items.find(i => i.sku === stockItem.sku)?.qty || 1

    const newQty = stockItem.quantity + orderedQty
    const newSoldCount = Math.max(0, stockItem.soldCount - orderedQty)
    const wasFullySold = stockItem.status === 'VENDU'

    await db.stockItem.update({
      where: { id: stockItem.id },
      data: {
        quantity: newQty,
        soldCount: newSoldCount,
        // Repasse en PUBLIE si l'article était VENDU (quantity était 0)
        ...(wasFullySold ? { status: 'PUBLIE', platform: null, platforms: JSON.stringify([]) } : {}),
      },
    })

    if (opts.deleteSales) {
      await db.sale.delete({ where: { id: sale.id } })
    }
  }
}

// PATCH — update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json()
    const { status, notes, trackingNumber, carrier } = body

    const data: any = {}
    if (typeof status === 'string') {
      const ALLOWED_STATUSES = ['pending', 'paid', 'preparation', 'shipped', 'delivered', 'cancelled']
      if (!ALLOWED_STATUSES.includes(status)) {
        return NextResponse.json({ error: `Statut invalide. Valeurs autorisées : ${ALLOWED_STATUSES.join(', ')}` }, { status: 400 })
      }
      data.status = status
    }
    if (typeof notes === 'string') data.notes = notes

    // Récupère l'ordre AVANT update pour vérifier l'ancien statut
    const previousOrder = await db.boutiqueOrder.findUnique({ where: { id } })

    const order = await db.boutiqueOrder.update({ where: { id }, data })

    // ── Restauration du stock si la commande passe à "cancelled" ──
    // On restaure le stock ET on supprime les Sales (sinon la compta reste fausse).
    // Re-lier les Sales à l'ordre est plus complexe ; on choisit de supprimer les Sales
    // et décrémenter le compteur de factures.
    if (status === 'cancelled' && previousOrder && previousOrder.status !== 'cancelled') {
      await restoreStockForOrder(id, { deleteSales: true })

      // Décrémente le compteur de factures pour ne pas laisser de trous
      const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
      if (adminUser) {
        const settings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
        if (settings) {
          const invoiceNumbers = JSON.parse(order.invoiceNumbers) as string[]
          await db.invoiceSettings.update({
            where: { id: settings.id },
            data: { invoiceCounter: { decrement: invoiceNumbers.length } },
          })
        }
      }
    }

    // If status = shipped and tracking provided, update the Sales with tracking info
    if (status === 'shipped' && trackingNumber) {
      const invoiceNumbers = JSON.parse(order.invoiceNumbers) as string[]
      for (const invNum of invoiceNumbers) {
        await db.sale.updateMany({
          where: { invoiceNumber: invNum },
          data: {
            trackingNumber,
            carrier: carrier || null,
            parcelStatus: 'EN_TRANSIT',
          },
        })
      }
    }

    // Notify client by email on status change
    if (typeof status === 'string') {
      let clientEmail: string | null = null
      let clientFirstName: string | null = null
      if (order.clientId) {
        const client = await db.boutiqueClient.findUnique({ where: { id: order.clientId }, select: { email: true, firstName: true } })
        clientEmail = client?.email || null
        clientFirstName = client?.firstName || 'Client'
      } else {
        // Try to get email from customerSnapshot
        try {
          const snapshot = JSON.parse(order.customerSnapshot)
          clientEmail = snapshot.email || null
          clientFirstName = snapshot.firstName || 'Client'
        } catch {}
      }
      if (clientEmail && clientFirstName) {
        await notifyOrderStatusChange(clientEmail, clientFirstName, order.orderId, status, trackingNumber, carrier)
      }
    }

    return NextResponse.json(order)
  } catch (error) {
    console.error('PATCH /api/boutique/admin/orders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — delete order
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params

    // Récupère l'ordre avant suppression
    const order = await db.boutiqueOrder.findUnique({ where: { id } })
    if (order) {
      // Restaure le stock + supprime les Sales
      await restoreStockForOrder(id, { deleteSales: true })

      // Décrémente le compteur de factures
      const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
      if (adminUser) {
        const settings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
        if (settings) {
          const invoiceNumbers = JSON.parse(order.invoiceNumbers) as string[]
          await db.invoiceSettings.update({
            where: { id: settings.id },
            data: { invoiceCounter: { decrement: invoiceNumbers.length } },
          })
        }
      }
    }

    await db.boutiqueOrder.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/orders/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
