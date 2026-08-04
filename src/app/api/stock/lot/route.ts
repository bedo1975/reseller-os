import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'

/**
 * POST /api/stock/lot
 * Auth — create a "lot" stock item composed of multiple existing stock items.
 *
 * Body: {
 *   name: string,           // nom du lot (ex: "Lot été 2026")
 *   lotPrice: number,       // prix de vente du lot (éditable, peut différer de la somme)
 *   items: [{ stockItemId, quantity }],  // articles à inclure dans le lot
 *   photos?: string,        // JSON array (optional, shared from first item)
 *   description?: string,
 *   status?: string,        // default: A_PHOTOGRAPHIER
 * }
 *
 * Actions:
 * 1. For each item: decrement its quantity by the lot quantity
 * 2. Create a new StockItem with isLot=true, lotItems=JSON, suggestedPrice=lotPrice
 * 3. Return the created lot item
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const { name, lotPrice, items, description, status } = body

    if (!name || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Nom du lot et au moins un article requis' }, { status: 400 })
    }

    // Validate all items exist and have enough stock
    const itemIds = items.map((i: any) => i.stockItemId)
    const stockItems = await db.stockItem.findMany({
      where: { id: { in: itemIds } },
    })

    if (stockItems.length !== itemIds.length) {
      return NextResponse.json({ error: 'Un ou plusieurs articles introuvables' }, { status: 400 })
    }

    // Check stock availability + build lotItems JSON
    const lotItemsData: any[] = []
    for (const item of items) {
      const stockItem = stockItems.find(s => s.id === item.stockItemId)
      if (!stockItem) continue
      const qty = parseInt(item.quantity) || 1
      if (stockItem.quantity < qty) {
        return NextResponse.json({
          error: `Stock insuffisant pour ${stockItem.brand} ${stockItem.title || ''} (disponible: ${stockItem.quantity}, demandé: ${qty})`,
        }, { status: 400 })
      }
      const unitPrice = stockItem.suggestedPrice ? parseFloat(stockItem.suggestedPrice.toString()) : 0
      // Parse first photo
      let firstPhoto: string | null = null
      try {
        const itemPhotos = JSON.parse(stockItem.photos || '[]')
        if (Array.isArray(itemPhotos) && itemPhotos.length > 0) {
          firstPhoto = itemPhotos[0]
        }
      } catch {}
      lotItemsData.push({
        stockItemId: stockItem.id,
        sku: stockItem.sku,
        brand: stockItem.brand,
        title: stockItem.title,
        size: stockItem.size,
        color: stockItem.color,
        quantity: qty,
        unitPrice,
        photo: firstPhoto,
      })
    }

    // Auto-generate description with item names
    const itemNames = lotItemsData.map(li => {
      const parts = [li.brand]
      if (li.title) parts.push(li.title)
      if (li.size) parts.push(`Taille ${li.size}`)
      if (li.color) parts.push(li.color)
      if (li.quantity > 1) parts.push(`×${li.quantity}`)
      return parts.join(' ')
    })
    const autoDescription = `Lot composé de ${lotItemsData.length} article(s) :\n${itemNames.join('\n')}`

    // Use admin userId for the lot item
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    const lotUserId = adminUser?.id || user.id

    // Generate SKU
    const sku = `LOT-${Date.now().toString(36).toUpperCase()}`

    // Collect all first-photos from lot items for the gallery
    const allLotPhotos = lotItemsData.map(li => li.photo).filter(Boolean)
    const photos = JSON.stringify(allLotPhotos)

    // Create the lot item + decrement source items in a transaction
    const result = await db.$transaction(async (tx) => {
      // Decrement each source item
      for (const item of items) {
        const stockItem = stockItems.find(s => s.id === item.stockItemId)
        if (!stockItem) continue
        const qty = parseInt(item.quantity) || 1
        await tx.stockItem.update({
          where: { id: stockItem.id },
          data: {
            quantity: { decrement: qty },
            // If stock reaches 0, mark as VENDU
            ...(stockItem.quantity - qty <= 0 ? { status: 'VENDU' } : {}),
          },
        })
      }

      // Create the lot item
      const lotItem = await tx.stockItem.create({
        data: {
          sku,
          title: name,
          brand: 'LOT',
          category: 'vetements',
          condition: 'bon',
          purchaseCost: 0, // lot cost = sum of item costs (for accounting, keep 0 to avoid double counting)
          purchaseDate: new Date(),
          quantity: 1,
          suggestedPrice: parseFloat(lotPrice) || 0,
          description: description || autoDescription,
          photos,
          status: status || 'A_PHOTOGRAPHIER',
          isLot: true,
          lotItems: JSON.stringify(lotItemsData),
          userId: lotUserId,
        },
      })

      return lotItem
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/stock/lot error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const errorMsg = error instanceof Error ? error.message : 'Erreur inconnue'
    return NextResponse.json({ error: 'Erreur serveur', details: errorMsg }, { status: 500 })
  }
}
