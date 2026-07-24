import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { notifyOrderStatusChange } from '@/lib/email'

// PATCH — update order status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
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

    const order = await db.boutiqueOrder.update({ where: { id }, data })

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
        await notifyOrderStatusChange(clientEmail, clientFirstName, order.orderId, status)
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
    await requireAdmin()
    const { id } = await params

    // Before deleting the order, restore the StockItems to PUBLIE
    const order = await db.boutiqueOrder.findUnique({ where: { id } })
    if (order) {
      const invoiceNumbers = JSON.parse(order.invoiceNumbers) as string[]
      for (const invNum of invoiceNumbers) {
        // Find the sale, get the stockItemId, then delete the sale and restore the item
        const sale = await db.sale.findFirst({ where: { invoiceNumber: invNum } })
        if (sale) {
          await db.stockItem.update({
            where: { id: sale.stockItemId },
            data: { status: 'PUBLIE', platform: null },
          })
          await db.sale.delete({ where: { id: sale.id } })
        }
      }
      // Decrement invoice counter
      const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
      if (adminUser) {
        const settings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
        if (settings) {
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
