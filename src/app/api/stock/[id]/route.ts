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
    const existing = await db.stockItem.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowed = [
      'sku', 'brand', 'category', 'subcategory', 'size', 'color', 'condition',
      'purchaseCost', 'purchaseDate', 'supplierId', 'lotReference', 'lotOrigin', 'lotCurrent',
      'purchaseInvoiceNumber', 'purchasePaymentMethod',
      'warehouse', 'rack', 'shelf', 'bin', 'weight', 'quantity',
      'description', 'suggestedPrice', 'photos', 'barcode', 'measurements',
      'status', 'platform', 'salePlatform', 'platforms',
    ]
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    if ('purchaseCost' in updateData) updateData.purchaseCost = parseFloat(updateData.purchaseCost as string)
    if ('suggestedPrice' in updateData && updateData.suggestedPrice) {
      updateData.suggestedPrice = parseFloat(updateData.suggestedPrice as string)
    }
    if ('weight' in updateData) {
      const w = updateData.weight
      if (w === '' || w === null || w === undefined) {
        updateData.weight = null
      } else {
        updateData.weight = parseFloat(String(w))
      }
    }
    if ('quantity' in updateData) {
      const q = updateData.quantity
      if (q === '' || q === null || q === undefined) {
        updateData.quantity = 1
      } else {
        updateData.quantity = parseInt(String(q)) || 1
      }
    }
    if ('purchaseDate' in updateData) updateData.purchaseDate = new Date(updateData.purchaseDate as string)
    if ('supplierId' in updateData && !updateData.supplierId) updateData.supplierId = null
    if ('platform' in updateData && !updateData.platform) updateData.platform = null
    if ('salePlatform' in updateData && !updateData.salePlatform) updateData.salePlatform = null

    const item = await db.stockItem.update({
      where: { id },
      data: updateData,
      include: { supplier: true, sale: true },
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('PATCH /api/stock/[id] error:', error)
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

    const existing = await db.stockItem.findUnique({ where: { id } })
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    await db.stockItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/stock/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
