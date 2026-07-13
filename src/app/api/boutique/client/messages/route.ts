import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireClient } from '@/lib/boutique-client-auth'
import { notifyNewClientMessage } from '@/lib/email'

// GET — list client's messages (conversation with admin)
export async function GET() {
  try {
    const client = await requireClient()
    const messages = await db.boutiqueMessage.findMany({
      where: { clientId: client.id },
      orderBy: { createdAt: 'asc' },
    })

    // Mark admin messages as read when client views them
    await db.boutiqueMessage.updateMany({
      where: { clientId: client.id, fromClient: false, read: false },
      data: { read: true },
    })

    return NextResponse.json({
      messages: messages.map(m => ({
        id: m.id,
        fromClient: m.fromClient,
        subject: m.subject,
        body: m.body,
        read: m.read,
        createdAt: m.createdAt,
      })),
    })
  } catch (error) {
    console.error('GET /api/boutique/client/messages error:', error)
    if (error instanceof Error && error.message === 'UNAUTHORIZED_CLIENT') {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// POST — send a new message to admin
export async function POST(req: NextRequest) {
  try {
    const client = await requireClient()
    const body = await req.json()
    const { subject, body: messageBody } = body

    if (!subject?.trim() || !messageBody?.trim()) {
      return NextResponse.json({ error: 'Sujet et message requis' }, { status: 400 })
    }

    const message = await db.boutiqueMessage.create({
      data: {
        clientId: client.id,
        fromClient: true,
        subject: subject.trim(),
        body: messageBody.trim(),
      },
    })

    // Notify admin by email
    await notifyNewClientMessage(client.id, subject.trim(), messageBody.trim())

    return NextResponse.json({
      id: message.id,
      fromClient: message.fromClient,
      subject: message.subject,
      body: message.body,
      read: message.read,
      createdAt: message.createdAt,
    })
  } catch (error) {
    console.error('POST /api/boutique/client/messages error:', error)
    if (error instanceof Error && error.message === 'UNAUTHORIZED_CLIENT') {
      return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
