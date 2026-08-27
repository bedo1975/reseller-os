import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/products/[sku]
 * Public — returns a single product by SKU for the storefront.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sku: string }> },
) {
  try {
    const { sku } = await params

    // Allow quantity = 0 products to be visible (shown as "Non disponible" on the product page)
    // Only boutique-type items appear on the storefront (excludes "plateforme" stock)
    const item = await db.stockItem.findFirst({
      where: { sku, status: 'PUBLIE', stockType: 'boutique' },
      select: {
        id: true,
        sku: true,
        title: true,
        brand: true,
        category: true,
        subcategory: true,
        size: true,
        color: true,
        condition: true,
        grade: true,
        makeOfferEnabled: true,
        suggestedPrice: true,
        salePrice: true,
        saleActive: true,
        description: true,
        photos: true,
        measurements: true,
        weight: true,
        quantity: true,
        createdAt: true,
        isLot: true,
        lotItems: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    let photos: string[] = []
    try { photos = JSON.parse(item.photos) } catch {}

    const basePrice = item.suggestedPrice ? parseFloat(item.suggestedPrice.toString()) : null
    const isOnSale = item.saleActive && item.salePrice != null
    const effectivePrice = isOnSale ? parseFloat(item.salePrice!.toString()) : basePrice

    const product = {
      id: item.id,
      sku: item.sku,
      title: item.title,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      size: item.size,
      color: item.color,
      condition: item.condition,
      grade: item.grade,
      makeOfferEnabled: item.makeOfferEnabled,
      price: effectivePrice,
      originalPrice: isOnSale ? basePrice : null,
      saleActive: isOnSale,
      description: item.description,
      photos: photos.map(p => p.startsWith('/uploads/') ? `/api${p}` : p),
      mainPhoto: photos[0] ? (photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]) : null,
      measurements: item.measurements,
      weight: item.weight || 0,
      quantity: item.quantity ?? 1,
      createdAt: item.createdAt,
      isLot: item.isLot || false,
      lotItems: (() => {
        if (!item.lotItems) return null
        try {
          const parsed = JSON.parse(item.lotItems)
          return parsed.map((li: any) => ({
            ...li,
            photo: li.photo ? (li.photo.startsWith('/uploads/') ? `/api${li.photo}` : li.photo) : null,
          }))
        } catch { return null }
      })(),
    }

    // Fetch variants: other published boutique items with the same title + brand (but different SKU).
    // Items created via the multi-variant form share the same title and brand, so this
    // is the most reliable way to detect variants regardless of SKU format.
    // We filter on stockType: 'boutique' so a sibling variant marked as "plateforme"
    // (marketplace-only) does NOT appear as a clickable variant on the boutique product page.
    let variants: any[] = []
    if (item.title) {
      const siblingItems = await db.stockItem.findMany({
        where: {
          title: item.title,
          brand: item.brand,
          status: 'PUBLIE',
          stockType: 'boutique',
          sku: { not: item.sku },
          suggestedPrice: { gt: 0 },
        },
        select: {
          sku: true,
          size: true,
          color: true,
          quantity: true,
        },
        orderBy: { size: 'asc' },
      })
      variants = siblingItems.map(s => ({
        sku: s.sku,
        size: s.size,
        color: s.color,
        quantity: s.quantity ?? 1,
        inStock: (s.quantity ?? 1) > 0,
      }))
    }

    return NextResponse.json({ product, variants })
  } catch (error) {
    console.error('GET /api/boutique/products/[sku] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
