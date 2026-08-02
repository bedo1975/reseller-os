import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { revalidatePath } from 'next/cache'

// Helper: check if a stock item is "visible on the boutique"
function isBoutiqueVisible(item: { status: string; suggestedPrice: number | null }): boolean {
  return item.status === 'PUBLIE' && !!item.suggestedPrice && item.suggestedPrice > 0
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Verify ownership — admin can edit any stock item, staff only their own
    const existing = await db.stockItem.findUnique({ where: { id } })
    if (!existing || (user.role !== 'admin' && existing.userId !== user.id)) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const wasVisible = isBoutiqueVisible(existing)

    const updateData: Record<string, unknown> = {}
    const allowed = [
      'sku', 'title', 'brand', 'category', 'subcategory', 'size', 'color', 'condition',
      'purchaseCost', 'purchaseDate', 'supplierId', 'lotReference', 'lotOrigin', 'lotCurrent',
      'purchaseInvoiceNumber', 'purchasePaymentMethod',
      'warehouse', 'rack', 'shelf', 'bin', 'weight', 'quantity',
      'description', 'suggestedPrice', 'salePrice', 'saleActive', 'photos', 'barcode', 'measurements',
      'status', 'platform', 'salePlatform', 'platforms',
      'invoicePath', 'invoiceName',
    ]
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }
    // Handle purchaseCost: allow empty string → 0, otherwise parse
    if ('purchaseCost' in updateData) {
      const pc = updateData.purchaseCost
      if (pc === '' || pc === null || pc === undefined) {
        updateData.purchaseCost = 0
      } else {
        const parsed = parseFloat(String(pc))
        updateData.purchaseCost = Number.isNaN(parsed) ? 0 : parsed
      }
    }
    if ('suggestedPrice' in updateData) {
      const sp = updateData.suggestedPrice
      if (sp === '' || sp === null || sp === undefined) {
        updateData.suggestedPrice = null
      } else {
        const parsed = parseFloat(String(sp))
        updateData.suggestedPrice = Number.isNaN(parsed) ? null : parsed
      }
    }
    if ('salePrice' in updateData) {
      if (updateData.salePrice === '' || updateData.salePrice === null) {
        updateData.salePrice = null
      } else {
        updateData.salePrice = parseFloat(String(updateData.salePrice))
      }
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
        // Allow quantity = 0 (out of stock). Use Number.isNaN check instead of || 1
        // because `0 || 1` evaluates to `1` (0 is falsy).
        const parsed = parseInt(String(q))
        updateData.quantity = Number.isNaN(parsed) ? 1 : Math.max(0, parsed)
      }
    }
    if ('purchaseDate' in updateData) updateData.purchaseDate = new Date(updateData.purchaseDate as string)
    if ('supplierId' in updateData && !updateData.supplierId) updateData.supplierId = null
    if ('platform' in updateData && !updateData.platform) updateData.platform = null
    if ('salePlatform' in updateData && !updateData.salePlatform) updateData.salePlatform = null

    const item = await db.stockItem.update({
      where: { id },
      data: updateData,
      include: { supplier: true, sales: { orderBy: { saleDate: 'desc' } } },
    })

    // Invalidate sitemap if boutique visibility changed
    const isVisibleNow = isBoutiqueVisible(item)
    if (wasVisible !== isVisibleNow) {
      try {
        revalidatePath('/sitemap.xml')
        revalidatePath('/boutique')
      } catch (e) {
        console.error('[sitemap] revalidatePath failed:', e)
      }
    }

    return NextResponse.json(item)
  } catch (error) {
    console.error('PATCH /api/stock/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: errorMsg }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.stockItem.findUnique({
      where: { id },
      include: { sales: true },
    })
    if (!existing || (user.role !== 'admin' && existing.userId !== user.id)) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    // If the item is sold (linked to any Sale), block deletion to preserve accounting integrity.
    // The user should "annuler la vente" first if they really want to delete the article.
    if (existing.sales && existing.sales.length > 0) {
      const firstSale = existing.sales[0]
      return NextResponse.json(
        {
          error: `Impossible de supprimer : cet article est lié à ${existing.sales.length} vente(s) (SKU: ${existing.sku}, dernier prix de vente: ${firstSale.salePrice.toFixed(2)} €, date: ${new Date(firstSale.saleDate).toLocaleDateString('fr-FR')}). Annulez d'abord les ventes dans le module Ventes pour pouvoir supprimer cet article.`,
          code: 'HAS_SALE',
          saleId: firstSale.id,
        },
        { status: 409 }
      )
    }

    const wasVisible = isBoutiqueVisible(existing)

    // Use a transaction to clean up related data before deleting the stock item
    await db.$transaction(async (tx) => {
      // Detach PhotoSessions (soft link — just null out the attachedStockId)
      await tx.photoSession.updateMany({
        where: { attachedStockId: id },
        data: { attachedStockId: null, attachedAt: null },
      })
      // Now safe to delete the stock item (no more FK references)
      await tx.stockItem.delete({ where: { id } })
    })

    // Invalidate sitemap if a published item was removed
    if (wasVisible) {
      try {
        revalidatePath('/sitemap.xml')
        revalidatePath('/boutique')
      } catch (e) {
        console.error('[sitemap] revalidatePath failed:', e)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/stock/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    // Foreign key constraint violation (P2003) — fallback message
    if ((error as any)?.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Impossible de supprimer : cet article est référencé par d\'autres enregistrements (ventes, etc.). Supprimez d\'abord ces références.',
          code: 'FOREIGN_KEY_VIOLATION',
        },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
