import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireClient } from '@/lib/boutique-client-auth'

// GET — list client's orders
export async function GET() {
  try {
    const client = await requireClient()
    const orders = await db.boutiqueOrder.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' },
    })

    // Fetch tracking info from associated Sales
    const ordersWithTracking = await Promise.all(orders.map(async (o) => {
      const invoiceNumbers = JSON.parse(o.invoiceNumbers) as string[]
      let trackingNumber: string | null = null
      let carrier: string | null = null

      if (invoiceNumbers.length > 0) {
        const sale = await db.sale.findFirst({
          where: { invoiceNumber: { in: invoiceNumbers } },
          select: { trackingNumber: true, carrier: true },
        })
        if (sale) {
          trackingNumber = sale.trackingNumber
          carrier = sale.carrier
        }
      }

      return {
        id: o.id,
        orderId: o.orderId,
        items: JSON.parse(o.items),
        shippingMethod: o.shippingMethod,
        shippingCost: o.shippingCost,
        paymentMethod: o.paymentMethod,
        subtotal: o.subtotal,
        total: o.total,
        status: o.status,
        invoiceNumbers,
        trackingNumber,
        carrier,
        createdAt: o.createdAt,
      }
    }))

    return NextResponse.json({ orders: ordersWithTracking })
  } catch (error) {
    console.error('GET /api/boutique/client/orders error:', error)
    if (error instanceof Error && error.message === 'UNAUTHORIZED_CLIENT') {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
