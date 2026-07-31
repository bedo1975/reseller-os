import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * PATCH /api/staff/messages/[id]/read
 * Mark a message as read.
 */
export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const message = await db.staffMessage.findUnique({ where: { id } })
    if (!message) {
      return NextResponse.json({ error: 'Message introuvable' }, { status: 404 })
    }

    // Only the recipient can mark as read
    if (message.recipientId !== user.id && message.recipientId !== 'all') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    await db.staffMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PATCH /api/staff/messages/[id]/read error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
