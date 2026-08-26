import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { notifyOrderReady } from '@/lib/email'

/**
 * POST /api/boutique/admin/orders/[id]/mark-ready
 * Admin — marks an order as "ready_to_ship" (prête pour l'expédition) after the
 * preparation has been validated (all items scanned + verified by the preparer).
 *
 * Sends a notification email to the client using the same template system as other emails
 * (templateOrderReady from BoutiqueSettings).
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const order = await db.boutiqueOrder.findUnique({
      where: { id },
      include: { client: true },
    })
    if (!order) {
      return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })
    }

    // Allow the transition from any non-cancelled status, but typically
    // the order should be in 'preparation' status when the preparer starts.
    if (order.status === 'cancelled') {
      return NextResponse.json({ error: 'Impossible de marquer une commande annulée comme prête' }, { status: 400 })
    }
    if (order.status === 'ready_to_ship') {
      // Already ready — no-op, return success to avoid duplicate email
      return NextResponse.json({ ok: true, alreadyReady: true })
    }

    // Update the order status
    const updated = await db.boutiqueOrder.update({
      where: { id },
      data: { status: 'ready_to_ship' },
    })

    // Resolve client email + firstName (prefer BoutiqueClient, fallback to snapshot)
    let clientEmail: string | null = null
    let clientFirstName = 'Client'
    if (order.client) {
      clientEmail = order.client.email
      clientFirstName = order.client.firstName || 'Client'
    } else {
      try {
        const snapshot = JSON.parse(order.customerSnapshot)
        clientEmail = snapshot.email || null
        clientFirstName = snapshot.firstName || 'Client'
      } catch {}
    }

    // Send the notification email (best-effort — does not block the response)
    if (clientEmail) {
      try {
        await notifyOrderReady({
          clientEmail,
          clientFirstName,
          orderId: order.orderId,
        })
      } catch (emailErr) {
        console.error('[mark-ready] Failed to send notification email:', emailErr)
      }
    }

    return NextResponse.json({ ok: true, order: updated })
  } catch (error) {
    console.error('POST /api/boutique/admin/orders/[id]/mark-ready error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
