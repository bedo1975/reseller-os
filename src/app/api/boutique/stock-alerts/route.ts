import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/stock-alerts
 * Public — visitor subscribes to a "back in stock" alert for a product.
 *
 * Body:
 *  - email: visitor's email (required, validated)
 *  - sku: product SKU (required)
 *
 * Behavior:
 *  - Looks up the StockItem by SKU (must be PUBLIE).
 *  - Captures a snapshot (brand, title, photo) so the email can render even
 *    if the product info changes later.
 *  - Deduplicates: if (email, sku, status='pending') already exists, returns
 *    success without creating a duplicate (idempotent).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const emailRaw: string = (body?.email || '').toString().trim().toLowerCase()
    const sku: string = (body?.sku || '').toString().trim()

    if (!emailRaw || !sku) {
      return NextResponse.json({ error: 'Email et SKU requis' }, { status: 400 })
    }

    // Basic email format check (RFC-lite, sufficient for our purposes)
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
    if (!emailOk) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }

    // Look up the published product
    const item = await db.stockItem.findFirst({
      where: { sku, status: 'PUBLIE' },
      select: {
        id: true,
        sku: true,
        brand: true,
        title: true,
        photos: true,
        quantity: true,
      },
    })

    if (!item) {
      return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })
    }

    // Deduplicate: if a pending alert already exists for (email, sku), do nothing
    const existing = await db.stockAlert.findFirst({
      where: { email: emailRaw, productSku: sku, status: 'pending' },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({
        ok: true,
        message: 'Vous êtes déjà inscrit(e) pour cette alerte.',
        deduplicated: true,
      })
    }

    // Snapshot the first photo as absolute URL (we can't know the site URL here reliably,
    // so we store the /api/uploads/... form; the email builder will turn it into an absolute URL)
    let photo: string | null = null
    try {
      const photos: string[] = JSON.parse(item.photos)
      if (Array.isArray(photos) && photos.length > 0) {
        const first = photos[0]
        photo = first.startsWith('/uploads/') ? `/api${first}` : first
      }
    } catch {}

    await db.stockAlert.create({
      data: {
        email: emailRaw,
        stockItemId: item.id,
        productSku: item.sku,
        productBrand: item.brand,
        productTitle: item.title,
        productPhoto: photo,
        status: 'pending',
      },
    })

    console.log(`[stock-alerts] New subscription: ${emailRaw} for SKU ${sku}`)

    return NextResponse.json({
      ok: true,
      message: 'Merci ! Nous vous enverrons un email dès que cet article sera de retour en stock.',
    })
  } catch (error) {
    console.error('POST /api/boutique/stock-alerts error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
