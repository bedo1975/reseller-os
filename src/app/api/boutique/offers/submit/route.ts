import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/boutique/offers/submit
 * Public — a client (logged-in or guest) submits an offer for a product.
 *
 * Body: { sku, clientEmail, clientName?, offeredPrice, originalPrice }
 *
 * Validates:
 * - The stock item exists, is PUBLIE, stockType=boutique, and makeOfferEnabled=true
 * - The offered price is positive and below the original price
 * - The email is valid
 *
 * Returns the created Offer (with status "pending").
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sku, clientEmail, clientName, offeredPrice, originalPrice } = body

    if (!sku || !clientEmail || !offeredPrice || !originalPrice) {
      return NextResponse.json({ error: 'Champs requis: sku, clientEmail, offeredPrice, originalPrice' }, { status: 400 })
    }

    // Validate email
    const email = String(clientEmail).trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Adresse email invalide' }, { status: 400 })
    }

    // Validate prices
    const offered = parseFloat(offeredPrice)
    const original = parseFloat(originalPrice)
    if (Number.isNaN(offered) || Number.isNaN(original) || offered <= 0 || original <= 0) {
      return NextResponse.json({ error: 'Prix invalide' }, { status: 400 })
    }
    if (offered >= original) {
      return NextResponse.json({ error: 'L\'offre doit être inférieure au prix original' }, { status: 400 })
    }
    // Sanity: don't accept offers below 10% of the original price (anti-abuse)
    if (offered < original * 0.1) {
      return NextResponse.json({ error: 'Offre trop basse (minimum 10% du prix original)' }, { status: 400 })
    }

    // Find the stock item
    const item = await db.stockItem.findFirst({
      where: { sku, status: 'PUBLIE', stockType: 'boutique', makeOfferEnabled: true },
    })
    if (!item) {
      return NextResponse.json({ error: 'Article introuvable ou offre non disponible' }, { status: 404 })
    }

    // Try to match a BoutiqueClient by email
    const matchedClient = await db.boutiqueClient.findFirst({ where: { email } })

    const discountAmount = original - offered

    const offer = await db.offer.create({
      data: {
        stockItemId: item.id,
        sku: item.sku,
        brand: item.brand,
        title: item.title,
        clientId: matchedClient?.id || null,
        clientEmail: email,
        clientName: clientName || matchedClient ? `${matchedClient?.firstName} ${matchedClient?.lastName}`.trim() : null,
        originalPrice: original,
        offeredPrice: offered,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        status: 'pending',
      },
    })

    return NextResponse.json({ ok: true, offerId: offer.id })
  } catch (error) {
    console.error('POST /api/boutique/offers/submit error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
