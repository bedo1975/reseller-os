import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/stock/by-barcode/[code]
 * Auth required — returns the StockItem matching the given barcode.
 * Returns 404 if no item matches.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    await requireAuth()
    const { code } = await params
    const decodedCode = decodeURIComponent(code).trim()

    if (!decodedCode) {
      return NextResponse.json({ error: 'Code-barres requis' }, { status: 400 })
    }

    const item = await db.stockItem.findFirst({
      where: { barcode: decodedCode },
      include: { supplier: true, sales: { orderBy: { saleDate: 'desc' } } },
    })

    if (!item) {
      return NextResponse.json({ found: false }, { status: 404 })
    }

    return NextResponse.json({ found: true, item })
  } catch (error) {
    console.error('GET /api/stock/by-barcode/[code] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
