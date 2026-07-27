import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function GET() {
  try {
    const user = await requireAuth()
    const sales = await db.sale.findMany({
      where: { userId: user.id },
      include: { stockItem: { include: { supplier: true } } },
      orderBy: { saleDate: 'desc' },
    })
    return NextResponse.json(sales)
  } catch (error) {
    console.error('GET /api/sales error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const {
      stockItemId, saleDate, platform, paymentMethod, customerName, customerContact,
      salePrice, shippingCost, platformFees, platformFixedFees,
      carrier, trackingNumber, parcelStatus, notes,
    } = body

    if (!stockItemId || !salePrice || !platform) {
      return NextResponse.json({ error: 'Article, prix et plateforme requis' }, { status: 400 })
    }

    const item = await db.stockItem.findUnique({ where: { id: stockItemId } })
    if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    if (item.userId !== user.id) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const price = parseFloat(salePrice)
    const shipping = parseFloat(shippingCost) || 0
    const fees = parseFloat(platformFees) || 0
    const fixedFees = parseFloat(platformFixedFees) || 0
    const totalFees = fees + fixedFees
    const profit = price - item.purchaseCost - shipping - totalFees
    const margin = price > 0 ? (profit / price) * 100 : 0

    const sale = await db.sale.create({
      data: {
        stockItemId,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        platform,
        paymentMethod: paymentMethod || null,
        customerName,
        customerContact,
        salePrice: price,
        shippingCost: shipping,
        platformFees: fees,
        platformFixedFees: fixedFees,
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(1)),
        carrier,
        trackingNumber,
        parcelStatus: parcelStatus || 'A_PREPARER',
        notes,
        userId: user.id,
      },
      include: { stockItem: true },
    })

    // Génère le numéro de facture séquentiel et l'attache à la vente
    try {
      const { generateInvoiceNumber } = await import('@/lib/invoice')
      const { number: invoiceNumber } = await generateInvoiceNumber(user.id)
      await db.sale.update({
        where: { id: sale.id },
        data: { invoiceNumber },
      })
    } catch (invoiceErr) {
      console.error('Invoice number generation failed:', invoiceErr)
    }

    // Quand l'article est vendu : on garde uniquement la plateforme de vente effective
    // platform = plateforme de vente, platforms = [] (vide, plus aucune publication active)
    // Décrémente la quantité ; passe à VENDU seulement si plus de stock dispo.
    const newQty = (item.quantity || 1) - 1
    const newSoldCount = (item.soldCount || 0) + 1
    const newStatus = newQty <= 0 ? 'VENDU' : 'PUBLIE'
    await db.stockItem.update({
      where: { id: stockItemId },
      data: {
        quantity: Math.max(0, newQty),
        soldCount: newSoldCount,
        status: newStatus,
        // On ne touche à platform/platforms que si l'article est totalement vendu
        ...(newQty <= 0 ? { platform, platforms: JSON.stringify([]) } : {}),
      },
    })

    return NextResponse.json(sale)
  } catch (error) {
    console.error('POST /api/sales error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
