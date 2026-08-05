import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * DELETE /api/admin/reviews/[id]
 * Auth — soft-delete a product review (set active=false).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const review = await db.productReview.findUnique({ where: { id } })
    if (!review) {
      return NextResponse.json({ error: 'Avis introuvable' }, { status: 404 })
    }

    await db.productReview.update({
      where: { id },
      data: { active: false },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/admin/reviews/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
