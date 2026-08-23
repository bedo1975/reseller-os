import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * GET /api/stock/by-barcode/[code]
 * Auth required — returns all StockItems matching the given barcode.
 * If multiple items share the same barcode (e.g. variants), all are returned
 * so the caller can let the user choose which one to select.
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

    const items = await db.stockItem.findMany({
      where: { barcode: decodedCode },
      include: { supplier: true, sales: { orderBy: { saleDate: 'desc' } } },
    })

    if (items.length === 0) {
      return NextResponse.json({ found: false }, { status: 404 })
    }

    // If only one item matches, return it directly (backward compat)
    if (items.length === 1) {
      return NextResponse.json({ found: true, item: items[0] })
    }

    // Multiple items match — return all so the caller can let the user choose
    return NextResponse.json({ found: true, item: items[0], items })
  } catch (error) {
    console.error('GET /api/stock/by-barcode/[code] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
