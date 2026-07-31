import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/staff/messages
 * Auth — returns inbox messages for the current user + "all staff" messages.
 */
export async function GET() {
  try {
    const user = await requireAuth()

    const messages = await db.staffMessage.findMany({
      where: {
        OR: [
          { recipientId: user.id },
          { recipientId: 'all' },
          { senderId: user.id },
        ],
      },
      include: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        recipient: { select: { id: true, name: true, email: true, role: true } },
        replies: {
          include: {
            sender: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Separate inbox (received) and sent
    const inbox = messages.filter(m => m.recipientId === user.id || (m.recipientId === 'all' && m.senderId !== user.id))
    const sent = messages.filter(m => m.senderId === user.id)
    const unreadCount = inbox.filter(m => !m.isRead).length

    return NextResponse.json({ inbox, sent, unreadCount })
  } catch (error) {
    console.error('GET /api/staff/messages error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST /api/staff/messages
 * Auth — send a new message to a staff member or all staff.
 *
 * Body: { recipientId: string (or "all"), subject: string, body: string, parentId?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { recipientId, subject, body: messageBody, parentId } = body

    if (!subject || !messageBody) {
      return NextResponse.json({ error: 'Sujet et message requis' }, { status: 400 })
    }
    if (!recipientId) {
      return NextResponse.json({ error: 'Destinataire requis' }, { status: 400 })
    }

    // If recipientId is not "all", check the user exists
    if (recipientId !== 'all') {
      const recipient = await db.user.findUnique({ where: { id: recipientId } })
      if (!recipient) {
        return NextResponse.json({ error: 'Destinataire introuvable' }, { status: 404 })
      }
    }

    const message = await db.staffMessage.create({
      data: {
        senderId: user.id,
        recipientId,
        subject: subject.trim(),
        body: messageBody.trim(),
        parentId: parentId || null,
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('POST /api/staff/messages error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
