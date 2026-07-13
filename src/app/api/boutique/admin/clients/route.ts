import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

// GET — list all boutique clients (admin)
export async function GET() {
  try {
    await requireAdmin()
    const clients = await db.boutiqueClient.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true, messages: true } },
      },
    })
    return NextResponse.json({
      clients: clients.map(c => ({
        id: c.id,
        email: c.email,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        address: c.address,
        postalCode: c.postalCode,
        city: c.city,
        country: c.country,
        newsletter: c.newsletter,
        lastVisitAt: c.lastVisitAt,
        createdAt: c.createdAt,
        ordersCount: c._count.orders,
        messagesCount: c._count.messages,
      })),
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/clients error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ clients: [] }, { status: 500 })
  }
}
