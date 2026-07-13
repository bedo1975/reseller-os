import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Verify ownership
    const existingSale = await db.sale.findUnique({ where: { id } })
    if (!existingSale || existingSale.userId !== user.id) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
    }

    const allowed = [
      'saleDate', 'platform', 'customerName', 'customerContact',
      'salePrice', 'shippingCost', 'platformFees', 'platformFixedFees',
      'carrier', 'trackingNumber', 'parcelStatus', 'notes',
    ]
    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }

    // Convertit les chaînes en nombres pour les champs Float
    if ('salePrice' in updateData) updateData.salePrice = parseFloat(updateData.salePrice as string)
    if ('shippingCost' in updateData) updateData.shippingCost = parseFloat(updateData.shippingCost as string) || 0
    if ('platformFees' in updateData) updateData.platformFees = parseFloat(updateData.platformFees as string) || 0
    if ('platformFixedFees' in updateData) updateData.platformFixedFees = parseFloat(updateData.platformFixedFees as string) || 0

    // Recalculer profit & marge si les montants changent
    const priceChanged = 'salePrice' in updateData || 'shippingCost' in updateData ||
                         'platformFees' in updateData || 'platformFixedFees' in updateData

    if (priceChanged) {
      const current = await db.sale.findUnique({ where: { id }, include: { stockItem: true } })
      if (current) {
        const price = 'salePrice' in updateData ? parseFloat(updateData.salePrice as string) : current.salePrice
        const shipping = 'shippingCost' in updateData ? parseFloat(updateData.shippingCost as string) : current.shippingCost
        const fees = 'platformFees' in updateData ? parseFloat(updateData.platformFees as string) : current.platformFees
        const fixedFees = 'platformFixedFees' in updateData ? parseFloat(updateData.platformFixedFees as string) : (current.platformFixedFees || 0)
        const totalFees = (fees || 0) + (fixedFees || 0)
        const profit = price - current.stockItem.purchaseCost - shipping - totalFees
        updateData.profit = parseFloat(profit.toFixed(2))
        updateData.margin = parseFloat(((profit / price) * 100).toFixed(1))
      }
    }

    if ('saleDate' in updateData) updateData.saleDate = new Date(updateData.saleDate as string)

    const sale = await db.sale.update({
      where: { id },
      data: updateData,
      include: { stockItem: true },
    })

    return NextResponse.json(sale)
  } catch (error) {
    console.error('PATCH /api/sales/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const sale = await db.sale.findUnique({ where: { id } })
    if (!sale || sale.userId !== user.id) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
    }
    await db.stockItem.update({
      where: { id: sale.stockItemId },
      data: { status: 'PUBLIE' },
    })
    await db.sale.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sales/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
