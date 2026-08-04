import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/stock/[id]/unlink-lot
 * Auth — dissolve a lot: restore stock to source items + delete the lot item.
 *
 * Only works on items where isLot=true.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const lotItem = await db.stockItem.findFirst({
      where: user.role === 'admin' ? { id, isLot: true } : { id, isLot: true, userId: user.id },
    })
    if (!lotItem) {
      return NextResponse.json({ error: 'Lot introuvable' }, { status: 404 })
    }
    if (!lotItem.isLot) {
      return NextResponse.json({ error: 'Cet article n\'est pas un lot' }, { status: 400 })
    }

    // Parse lotItems JSON
    let lotItems: any[] = []
    try { lotItems = JSON.parse(lotItem.lotItems || '[]') } catch {}

    // Restore stock to source items + delete the lot in a transaction
    await db.$transaction(async (tx) => {
      for (const li of lotItems) {
        if (!li.stockItemId) continue
        const qty = li.quantity || 1
        // Restore the quantity
        const sourceItem = await tx.stockItem.findUnique({ where: { id: li.stockItemId } })
        if (sourceItem) {
          await tx.stockItem.update({
            where: { id: li.stockItemId },
            data: {
              quantity: { increment: qty },
              // If the source was marked VENDU (because stock reached 0), restore to its previous status
              ...(sourceItem.status === 'VENDU' ? { status: 'PUBLIE' } : {}),
            },
          })
        }
      }
      // Delete the lot item
      await tx.stockItem.delete({ where: { id } })
    })

    return NextResponse.json({ ok: true, message: 'Lot dissocié. Stock restauré.' })
  } catch (error) {
    console.error('POST /api/stock/[id]/unlink-lot error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: errorMsg }, { status: 500 })
  }
}
