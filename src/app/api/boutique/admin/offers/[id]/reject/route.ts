import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyOfferRejected } from '@/lib/email'

/**
 * POST /api/boutique/admin/offers/[id]/reject
 * Admin — rejects a pending offer with a reason.
 *
 * Body: { reason: string }
 *
 * Actions:
 * 1. Sets the offer status to "rejected"
 * 2. Stores the rejection reason
 * 3. Sends the "offer rejected" email to the client with the reason
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const reason = String(body.reason || '').trim()

    if (!reason) {
      return NextResponse.json({ error: 'Le motif du refus est requis' }, { status: 400 })
    }

    const offer = await db.offer.findUnique({ where: { id } })
    if (!offer) {
      return NextResponse.json({ error: 'Offre introuvable' }, { status: 404 })
    }
    if (offer.status !== 'pending') {
      return NextResponse.json({ error: `Cette offre est déjà ${offer.status}` }, { status: 400 })
    }

    const updated = await db.offer.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: reason,
      },
    })

    // Send the rejection email (best-effort)
    try {
      await notifyOfferRejected({
        clientEmail: offer.clientEmail,
        clientFirstName: offer.clientName?.split(' ')[0] || 'Client',
        sku: offer.sku,
        brand: offer.brand,
        offeredPrice: offer.offeredPrice,
        reason,
      })
      await db.offer.update({ where: { id }, data: { rejectedEmailSent: true } })
    } catch (emailErr) {
      console.error('[offers/reject] Failed to send email:', emailErr)
    }

    return NextResponse.json({ ok: true, offer: updated })
  } catch (error) {
    console.error('POST /api/boutique/admin/offers/[id]/reject error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
