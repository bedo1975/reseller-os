import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

// GET — client detail with orders and messages
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    const client = await db.boutiqueClient.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { createdAt: 'desc' } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!client) {
      return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
    }
    return NextResponse.json({
      id: client.id,
      email: client.email,
      firstName: client.firstName,
      lastName: client.lastName,
      phone: client.phone,
      address: client.address,
      postalCode: client.postalCode,
      city: client.city,
      country: client.country,
      newsletter: client.newsletter,
      lastVisitAt: client.lastVisitAt,
      createdAt: client.createdAt,
      orders: client.orders.map(o => ({
        id: o.id,
        orderId: o.orderId,
        total: o.total,
        status: o.status,
        items: JSON.parse(o.items),
        createdAt: o.createdAt,
      })),
      messages: client.messages.map(m => ({
        id: m.id,
        fromClient: m.fromClient,
        subject: m.subject,
        body: m.body,
        read: m.read,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/clients/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE — delete client
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAuth()
    const { id } = await params
    await db.boutiqueClient.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/clients/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
