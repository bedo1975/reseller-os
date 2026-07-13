import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'

/**
 * Attach a photo session to a stock item.
 * Adds all session photos to the stock item's photos array.
 * Marks the session as "attached" (but keeps it for reference).
 *
 * Body: { stockId: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()
    const { stockId } = body as { stockId: string }

    if (!stockId) {
      return NextResponse.json({ error: 'stockId requis' }, { status: 400 })
    }

    const session = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })
    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    const stockItem = await db.stockItem.findFirst({
      where: { id: stockId, userId: user.id },
    })
    if (!stockItem) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Parse session photos
    let sessionPhotos: Array<{ id: string; path: string; filename: string; createdAt: string }> = []
    try { sessionPhotos = JSON.parse(session.photos) } catch {}

    if (sessionPhotos.length === 0) {
      return NextResponse.json({ error: 'La session ne contient aucune photo' }, { status: 400 })
    }

    // Parse existing stock item photos
    let stockPhotos: string[] = []
    try { stockPhotos = JSON.parse(stockItem.photos) } catch {}

    // Add session photo paths to stock item (avoid duplicates)
    const newPaths = sessionPhotos.map((p) => p.path)
    const mergedPhotos = [...new Set([...stockPhotos, ...newPaths])]

    await db.stockItem.update({
      where: { id: stockId },
      data: { photos: JSON.stringify(mergedPhotos) },
    })

    // Mark session as attached
    await db.photoSession.update({
      where: { id },
      data: {
        attachedStockId: stockId,
        attachedAt: new Date(),
      },
    })

    return NextResponse.json({
      ok: true,
      stockId,
      addedPhotos: newPaths.length,
      totalPhotos: mergedPhotos.length,
    })
  } catch (error) {
    console.error('POST /api/photo-sessions/[id]/attach error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
