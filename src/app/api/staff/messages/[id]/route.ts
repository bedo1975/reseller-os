import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * DELETE /api/staff/messages/[id]
 * Delete a message (sender or recipient can delete their copy).
 */
export async function DELETE(
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

    // Only sender or recipient can delete
    if (message.senderId !== user.id && message.recipientId !== user.id && message.recipientId !== 'all') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
    }

    // Delete replies first (if any)
    await db.staffMessage.deleteMany({ where: { parentId: id } })
    await db.staffMessage.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/staff/messages/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
