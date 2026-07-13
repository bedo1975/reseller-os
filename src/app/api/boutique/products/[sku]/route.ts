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

    const item = await db.stockItem.findFirst({
      where: { sku, status: 'PUBLIE' },
      select: {
        id: true,
        sku: true,
        brand: true,
        category: true,
        subcategory: true,
        size: true,
        color: true,
        condition: true,
        suggestedPrice: true,
        description: true,
        photos: true,
        measurements: true,
        weight: true,
        quantity: true,
        createdAt: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    let photos: string[] = []
    try { photos = JSON.parse(item.photos) } catch {}

    const product = {
      id: item.id,
      sku: item.sku,
      brand: item.brand,
      category: item.category,
      subcategory: item.subcategory,
      size: item.size,
      color: item.color,
      condition: item.condition,
      price: item.suggestedPrice ? parseFloat(item.suggestedPrice.toString()) : null,
      description: item.description,
      photos: photos.map(p => p.startsWith('/uploads/') ? `/api${p}` : p),
      mainPhoto: photos[0] ? (photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]) : null,
      measurements: item.measurements,
      weight: item.weight || 0,
      quantity: item.quantity || 1,
      createdAt: item.createdAt,
    }

    return NextResponse.json({ product })
  } catch (error) {
    console.error('GET /api/boutique/products/[sku] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
