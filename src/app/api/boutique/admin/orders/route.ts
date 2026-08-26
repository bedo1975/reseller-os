import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list all boutique orders (authenticated staff)
export async function GET() {
  try {
    await requireAuth()
    const orders = await db.boutiqueOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: true },
    })
    return NextResponse.json({
      orders: orders.map(o => ({
        id: o.id,
        orderId: o.orderId,
        clientId: o.clientId,
        clientName: o.client ? `${o.client.firstName} ${o.client.lastName}` : (() => {
          try { const c = JSON.parse(o.customerSnapshot); return `${c.firstName} ${c.lastName}` } catch { return 'Invité' }
        })(),
        clientEmail: o.client?.email || (() => { try { return JSON.parse(o.customerSnapshot).email || '' } catch { return '' } })(),
        items: JSON.parse(o.items),
        shippingMethod: o.shippingMethod,
        shippingCost: o.shippingCost,
        paymentMethod: o.paymentMethod,
        platform: o.platform || 'boutique',
        subtotal: o.subtotal,
        total: o.total,
        couponCode: o.couponCode,
        discountAmount: o.discountAmount,
        status: o.status,
        invoiceNumbers: JSON.parse(o.invoiceNumbers),
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/orders error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ orders: [] }, { status: 500 })
  }
}
