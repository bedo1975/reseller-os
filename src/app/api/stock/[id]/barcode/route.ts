import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import bwip from 'bwip-js'

/**
 * GET /api/stock/[id]/barcode
 * Returns the barcode image (PNG) for the given stock item.
 *
 * Query params:
 *   - format: 'ean13' (default) | 'code128' (fallback if barcode is not numeric)
 *   - width: bar width in pixels (default 2)
 *   - height: bar height in pixels (default 60)
 *
 * The barcode is rendered server-side with bwip-js and returned as a PNG buffer.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const item = await db.stockItem.findFirst({
      where: { id, userId: user.id },
      select: { barcode: true, sku: true, brand: true, title: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }
    if (!item.barcode) {
      return NextResponse.json({ error: 'Aucun code-barres sur cet article' }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'ean13'
    const bcid = format === 'code128' ? 'code128' : 'ean13'
    const scaleX = parseInt(searchParams.get('width') || '2', 10) || 2
    const scaleY = parseInt(searchParams.get('height') || '60', 10) || 60

    // For EAN-13, the barcode MUST be 13 digits. If it's not, fall back to code128.
    const isEan13 = /^\d{13}$/.test(item.barcode)
    const effectiveBcid = bcid === 'ean13' && !isEan13 ? 'code128' : bcid

    const pngBuffer = await bwip.toBuffer({
      bcid: effectiveBcid,
      text: item.barcode,
      scale: scaleX,
      height: scaleY,
      includetext: true,
      textxalign: 'center',
      paddingwidth: 10,
      paddingheight: 5,
    })

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="barcode-${item.sku}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/stock/[id]/barcode error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
