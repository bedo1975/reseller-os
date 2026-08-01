import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/boutique/products
 * Public endpoint (no auth) — returns all PUBLIE stock items for the storefront.
 *
 * Query params:
 *   - category: filter by category (vetements, chaussures, etc.)
 *   - brand: filter by brand (exact match)
 *   - search: search in brand + sku
 *   - sort: 'newest' | 'price-asc' | 'price-desc' | 'brand'
 *   - limit: max items (default 100)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const subcat = searchParams.get('subcat') || searchParams.get('subcategory')
    const brand = searchParams.get('brand')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'newest'
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200)

    const where: any = {
      status: 'PUBLIE',
      // Allow quantity = 0 (out-of-stock products are shown with "Indisponible" badge)
      // Only items with a price
      suggestedPrice: { gt: 0 },
    }
    if (category) where.category = category
    if (subcat) where.subcategory = subcat
    if (brand) where.brand = brand
    if (search) {
      where.OR = [
        { brand: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { color: { contains: search, mode: 'insensitive' } },
      ]
    }

    let orderBy: any = { createdAt: 'desc' }
    if (sort === 'price-asc') orderBy = { suggestedPrice: 'asc' }
    else if (sort === 'price-desc') orderBy = { suggestedPrice: 'desc' }
    else if (sort === 'brand') orderBy = { brand: 'asc' }

    const items = await db.stockItem.findMany({
      where,
      orderBy,
      take: limit,
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
        suggestedPrice: true,
        salePrice: true,
        saleActive: true,
        description: true,
        photos: true,
        weight: true,
        quantity: true,
        createdAt: true,
      },
    })

    // Format for the storefront
    const products = items.map(item => {
      let photos: string[] = []
      try { photos = JSON.parse(item.photos) } catch {}
      const basePrice = item.suggestedPrice ? parseFloat(item.suggestedPrice.toString()) : null
      const isOnSale = item.saleActive && item.salePrice != null
      const effectivePrice = isOnSale ? parseFloat(item.salePrice!.toString()) : basePrice
      return {
        id: item.id,
        sku: item.sku,
        title: item.title,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        size: item.size,
        color: item.color,
        condition: item.condition,
        price: effectivePrice,
        originalPrice: isOnSale ? basePrice : null,
        saleActive: isOnSale,
        description: item.description,
        photos: photos.map(p => p.startsWith('/uploads/') ? `/api${p}` : p),
        mainPhoto: photos[0] ? (photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]) : null,
        weight: item.weight || 0,
        quantity: item.quantity ?? 1,
        createdAt: item.createdAt,
      }
    })

    return NextResponse.json({ products, count: products.length })
  } catch (error) {
    console.error('GET /api/boutique/products error:', error)
    return NextResponse.json({ error: 'Erreur serveur', products: [], count: 0 }, { status: 500 })
  }
}
