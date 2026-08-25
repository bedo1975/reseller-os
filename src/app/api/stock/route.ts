import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const brand = searchParams.get('brand')
    const platform = searchParams.get('platform')
    const stockType = searchParams.get('stockType')
    const search = searchParams.get('search')

    // All authenticated users can see all stock items (permission-based visibility is handled in the UI)
    const items = await db.stockItem.findMany({
      where: {
        AND: [
          status ? { status } : {},
          brand ? { brand } : {},
          platform ? { platform } : {},
          stockType ? { stockType } : {},
          search ? {
            OR: [
              { sku: { contains: search } },
              { brand: { contains: search } },
              { color: { contains: search } },
              { barcode: { contains: search } },
            ]
          } : {},
        ],
      },
      include: { supplier: true, sales: { orderBy: { saleDate: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/stock error:', error)
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
      sku, title, brand, url, category, subcategory, size, color, condition, grade,
      purchaseCost, purchaseDate, supplierId, lotReference, lotOrigin, lotCurrent,
      purchaseInvoiceNumber, supplierOrderNumber, purchasePaymentMethod,
      warehouse, rack, shelf, bin, weight, quantity,
      description, suggestedPrice, salePrice, saleActive, photos, barcode, measurements,
      status, platform, salePlatform, platforms, stockType,
    } = body

    if (!sku || !brand) {
      return NextResponse.json({ error: 'SKU et marque requis' }, { status: 400 })
    }

    const item = await db.stockItem.create({
      data: {
        sku,
        title: title || null,
        brand,
        url: url || null,
        category: category || 'vetements',
        subcategory: subcategory || null,
        size: size || null,
        color: color || null,
        condition: condition || 'bon',
        grade: grade || null,
        purchaseCost: parseFloat(purchaseCost) || 0,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        supplierId: supplierId || null,
        lotReference: lotReference || null,
        lotOrigin: lotOrigin || null,
        lotCurrent: lotCurrent || null,
        purchaseInvoiceNumber: purchaseInvoiceNumber || null,
        supplierOrderNumber: supplierOrderNumber || null,
        purchasePaymentMethod: purchasePaymentMethod || null,
        warehouse: warehouse || null,
        rack: rack || null,
        shelf: shelf || null,
        bin: bin || null,
        weight: weight ? parseFloat(weight) : null,
        quantity: (() => {
          const parsed = parseInt(String(quantity))
          return Number.isNaN(parsed) ? 1 : Math.max(0, parsed)
        })(),
        description: description || null,
        suggestedPrice: suggestedPrice ? parseFloat(suggestedPrice) : null,
        salePrice: salePrice ? parseFloat(salePrice) : null,
        saleActive: saleActive === true,
        photos: photos || JSON.stringify([]),
        barcode: barcode || null,
        measurements: measurements || null,
        status: status || 'A_PHOTOGRAPHIER',
        platform: platform || null,
        salePlatform: salePlatform || null,
        platforms: platforms || JSON.stringify([]),
        // stockType: "boutique" (default) or "plateforme" (not visible on online store)
        stockType: stockType === 'plateforme' ? 'plateforme' : 'boutique',
        userId: user.id,
      },
      include: { supplier: true },
    })

    // Invalidate sitemap if the new item is published to the boutique
    // (only boutique-type items appear on the storefront)
    if (item.stockType === 'boutique' && item.status === 'PUBLIE' && item.suggestedPrice && item.suggestedPrice > 0) {
      try {
        revalidatePath('/sitemap.xml')
        revalidatePath('/')
      } catch (e) {
        console.error('[sitemap] revalidatePath failed:', e)
      }
    }

    return NextResponse.json(item)
  } catch (error: any) {
    console.error('POST /api/stock error:', error)
    console.error('Full error meta:', JSON.stringify(error?.meta, null, 2))
    console.error('User ID:', user?.id)
    console.error('Supplier ID received:', body?.supplierId)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error?.code === 'P2003' ? 'Contrainte de clé étrangère violée (supplierId ou userId invalide)' : error?.message,
      meta: error?.meta,
    }, { status: 500 })
  }
}
