import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { notifyAdminReply } from '@/lib/email'

// GET — list all messages grouped by client (admin inbox)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const clientId = searchParams.get('clientId')

    if (clientId) {
      // Return conversation with a specific client
      const messages = await db.boutiqueMessage.findMany({
        where: { clientId },
        orderBy: { createdAt: 'asc' },
      })
      return NextResponse.json({
        messages: messages.map(m => ({
          id: m.id,
          clientId: m.clientId,
          fromClient: m.fromClient,
          subject: m.subject,
          body: m.body,
          read: m.read,
          createdAt: m.createdAt,
        })),
      })
    }

    // Return inbox: latest message per client + unread count
    const allMessages = await db.boutiqueMessage.findMany({
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true, firstName: true, lastName: true, email: true } } },
    })

    // Group by clientId
    const conversations = new Map<string, {
      clientId: string
      clientName: string
      clientEmail: string
      lastMessage: string
      lastDate: string
      unreadCount: number
    }>()

    for (const m of allMessages) {
      const cid = m.clientId
      if (!conversations.has(cid)) {
        conversations.set(cid, {
          clientId: cid,
          clientName: m.client ? `${m.client.firstName} ${m.client.lastName}` : 'Inconnu',
          clientEmail: m.client?.email || '',
          lastMessage: m.body.slice(0, 80),
          lastDate: m.createdAt,
          unreadCount: 0,
        })
      }
      const conv = conversations.get(cid)!
      if (m.fromClient && !m.read) {
        conv.unreadCount++
      }
    }

    return NextResponse.json({
      conversations: Array.from(conversations.values()),
    })
  } catch (error) {
    console.error('GET /api/boutique/admin/messages error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ conversations: [] }, { status: 500 })
  }
}

// POST — admin sends a message to a client
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const { clientId, subject, body: messageBody } = body

    if (!clientId || !subject?.trim() || !messageBody?.trim()) {
      return NextResponse.json({ error: 'Client, sujet et message requis' }, { status: 400 })
    }

    const message = await db.boutiqueMessage.create({
      data: {
        clientId,
        fromClient: false,  // admin → client
        subject: subject.trim(),
        body: messageBody.trim(),
        read: false,
      },
    })

    // Notify client by email
    await notifyAdminReply(clientId, subject.trim(), messageBody.trim())

    return NextResponse.json({
      id: message.id,
      clientId: message.clientId,
      fromClient: message.fromClient,
      subject: message.subject,
      body: message.body,
      read: message.read,
      createdAt: message.createdAt,
    })
  } catch (error) {
    console.error('POST /api/boutique/admin/messages error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
