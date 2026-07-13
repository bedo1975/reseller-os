import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import QRCode from 'qrcode'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const item = await db.stockItem.findFirst({
      where: { id, userId: user.id },
      select: { sku: true, barcode: true, brand: true },
    })

    if (!item) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // Le QR code contient le SKU (ou le code-barres s'il existe)
    const code = item.barcode || item.sku

    // Génère le QR code en PNG
    const pngBuffer = await QRCode.toBuffer(code, {
      type: 'png',
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })

    return new NextResponse(pngBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `inline; filename="qr-${item.sku}.png"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/stock/[id]/qrcode error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
