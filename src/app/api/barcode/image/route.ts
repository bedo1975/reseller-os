import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import bwip from 'bwip-js'

/**
 * GET /api/barcode/image?code=XXX
 * Returns the barcode image (PNG) for the given code.
 *
 * Used by the prepare-order dialog to display barcodes as images (instead of plain text)
 * so the preparer must scan them with a real scanner — preventing manual typing shortcuts.
 *
 * Query params:
 *   - code: the barcode value (required)
 *   - format: 'ean13' (default, only if 13 digits) | 'code128' (fallback for non-numeric barcodes)
 *   - width: bar width in pixels (default 2)
 *   - height: bar height in pixels (default 50)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    if (!code) {
      return NextResponse.json({ error: 'Paramètre "code" requis' }, { status: 400 })
    }

    const format = searchParams.get('format') || 'ean13'
    const bcid = format === 'code128' ? 'code128' : 'ean13'
    const scaleX = parseInt(searchParams.get('width') || '2', 10) || 2
    const scaleY = parseInt(searchParams.get('height') || '50', 10) || 50

    // For EAN-13, the barcode MUST be 13 digits. Fall back to code128 otherwise.
    const isEan13 = /^\d{13}$/.test(code)
    const effectiveBcid = bcid === 'ean13' && !isEan13 ? 'code128' : bcid

    // IMPORTANT: do NOT include the human-readable text under the barcode.
    // This forces the preparer to scan the barcode (laser/camera) rather than
    // reading the digits and typing them manually — prevents cheating the verification step.
    const pngBuffer = await bwip.toBuffer({
      bcid: effectiveBcid,
      text: code,
      scale: scaleX,
      height: scaleY,
      includetext: false,
      paddingwidth: 8,
      paddingheight: 4,
    })

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/barcode/image error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
