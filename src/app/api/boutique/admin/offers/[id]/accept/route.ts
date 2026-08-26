import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyOfferAccepted } from '@/lib/email'
import { randomBytes } from 'crypto'

/**
 * POST /api/boutique/admin/offers/[id]/accept
 * Admin — accepts a pending offer.
 *
 * Body: { durationHours?: number }  // override the default cart duration
 *
 * Actions:
 * 1. Sets the offer status to "accepted"
 * 2. Generates a unique cartToken (for the reduced-price cart)
 * 3. Sets cartExpiresAt = now + durationHours
 * 4. Sends the "offer accepted" email to the client with the cart link
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const bs = await getBoutiqueSettings()
    const durationHours = body.durationHours || bs.makeOfferCartDurationHours || 24

    const offer = await db.offer.findUnique({
      where: { id },
      include: { stockItem: true },
    })
    if (!offer) {
      return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
    }
    if (offer.status !== 'pending') {
      return NextResponse.json({ error: `Cette offre est déjà ${offer.status}` }, { status: 400 })
    }

    // Generate a unique cart token (32 hex chars = 128 bits)
    const cartToken = randomBytes(16).toString('hex')
    const cartExpiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000)

    const updated = await db.offer.update({
      where: { id },
      data: {
        status: 'accepted',
        cartToken,
        cartExpiresAt,
      },
    })

    // Build the cart URL for the client
    const siteUrl = bs.shareSiteUrl || ''
    const cartUrl = siteUrl
      ? `${siteUrl.replace(/\/+$/, '')}/panier?offer=${cartToken}`
      : `/panier?offer=${cartToken}`

    // Send the acceptance email (best-effort)
    try {
      await notifyOfferAccepted({
        clientEmail: offer.clientEmail,
        clientFirstName: offer.clientName?.split(' ')[0] || 'Client',
        offerId: offer.id,
        sku: offer.sku,
        brand: offer.brand,
        originalPrice: offer.originalPrice,
        offeredPrice: offer.offeredPrice,
        discountAmount: offer.discountAmount,
        cartUrl,
        cartExpiresAt,
      })
      await db.offer.update({ where: { id }, data: { acceptedEmailSent: true } })
    } catch (emailErr) {
      console.error('[offers/accept] Failed to send email:', emailErr)
    }

    return NextResponse.json({ ok: true, offer: updated, cartUrl })
  } catch (error) {
    console.error('POST /api/boutique/admin/offers/[id]/accept error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
