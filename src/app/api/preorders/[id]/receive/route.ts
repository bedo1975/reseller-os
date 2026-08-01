import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/preorders/[id]/receive
 * Auth — mark a validated pre-order as "received" and add all its articles to stock.
 *
 * For each article in the pre-order:
 * - If the article already has a stockItemId (created via "Créer l'article"):
 *   → update the existing StockItem: set quantity, status = "A_CONTROLER", purchaseCost = 0
 * - If the article has no stockItemId:
 *   → create a new StockItem with quantity, status = "A_CONTROLER", purchaseCost = 0
 *
 * purchaseCost is always 0 to avoid double counting (the pre-order Purchase already
 * accounts for the cost in the ACHATS register).
 *
 * After processing, the pre-order's stock items are ready to be checked/controlled.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Admin can receive any pre-order; staff only their own
    const existing = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
      include: { supplier: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }
    if (existing.status !== 'validated') {
      return NextResponse.json({
        error: 'Seules les pré-commandes validées peuvent être marquées comme reçues',
      }, { status: 400 })
    }

    const items = JSON.parse(existing.items) as any[]
    if (items.length === 0) {
      return NextResponse.json({ error: 'Aucun article dans cette pré-commande' }, { status: 400 })
    }

    // Fetch the admin user (for StockItem.userId)
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const stockUserId = adminUser?.id || user.id

    const createdItems: any[] = []
    const updatedItems: any[] = []

    for (const item of items) {
      const qty = Number(item.quantity) || 1
      const designation = item.designation || 'Article'
      const size = item.size || null
      const color = item.color || null
      const condition = item.condition || null
      const description = item.description || null

      if (item.stockItemId) {
        // Update existing StockItem (created via "Créer l'article")
        const updated = await db.stockItem.update({
          where: { id: item.stockItemId },
          data: {
            quantity: qty,
            status: 'A_CONTROLER',
            purchaseCost: 0,  // keep 0 to avoid double counting
            purchaseDate: existing.orderDate,
            supplierId: existing.supplierId || null,
            size: size || undefined,
            color: color || undefined,
            condition: condition || undefined,
            description: description || undefined,
            preOrderId: existing.id,  // mark as coming from this pre-order → excluded from ACHATS register
          },
        })
        updatedItems.push(updated)
      } else {
        // Create a new StockItem
        const sku = `ART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
        const created = await db.stockItem.create({
          data: {
            sku,
            title: designation,
            brand: designation.split(' ')[0] || 'Article',
            category: 'vetements',
            size,
            color,
            condition: condition || 'bon',
            purchaseCost: 0,  // 0 to avoid double counting
            purchaseDate: existing.orderDate,
            supplierId: existing.supplierId || null,
            quantity: qty,
            description,
            photos: JSON.stringify([]),  // required field — empty array
            platforms: JSON.stringify([]),  // required field — empty array
            status: 'A_CONTROLER',
            userId: stockUserId,
            preOrderId: existing.id,  // mark as coming from this pre-order → excluded from ACHATS register
          },
        })
        createdItems.push(created)
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Commande reçue. ${createdItems.length} article(s) créé(s), ${updatedItems.length} article(s) mis à jour dans le stock (statut: À contrôler).`,
      createdCount: createdItems.length,
      updatedCount: updatedItems.length,
    })
  } catch (error) {
    console.error('POST /api/preorders/[id]/receive error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    // Return the actual error message to help diagnose issues
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: errorMsg }, { status: 500 })
  }
}
