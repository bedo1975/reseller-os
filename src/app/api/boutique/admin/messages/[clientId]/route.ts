import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * DELETE /api/boutique/admin/messages/[clientId]
 * Admin — deletes all messages in a conversation (by clientId).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    await requireAdmin()
    const { clientId } = await params

    const result = await db.boutiqueMessage.deleteMany({
      where: { clientId },
    })

    return NextResponse.json({ ok: true, deleted: result.count })
  } catch (error) {
    console.error('DELETE /api/boutique/admin/messages/[clientId] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
