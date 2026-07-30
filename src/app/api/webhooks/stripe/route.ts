import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

// POST /api/webhooks/stripe
// Receives Stripe webhook events (payment succeeded, failed, etc.)
// Must be registered in Stripe Dashboard → Developers → Webhooks
// URL: https://yourdomain.com/api/webhooks/stripe
// Events: payment_intent.succeeded, payment_intent.payment_failed

export async function POST(req: NextRequest) {
  try {
    const settings = await getBoutiqueSettings()
    const secretKey = settings.stripeSecretKey
    const webhookSecret = settings.stripeWebhookSecret // optional but recommended

    if (!secretKey) {
      return NextResponse.json({ error: 'Stripe non configuré' }, { status: 503 })
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil' as any,
    })

    const body = await req.text()
    const signature = req.headers.get('stripe-signature')

    let event

    if (webhookSecret && signature) {
      // Verify the webhook signature (recommended for security)
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        return NextResponse.json({ error: `Signature invalide: ${err.message}` }, { status: 400 })
      }
    } else {
      // No webhook secret configured — parse the body directly (less secure, OK for dev)
      event = JSON.parse(body)
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object
        console.log(`[stripe] Payment succeeded: ${paymentIntent.id} for order ${paymentIntent.metadata?.orderId}`)

        // Mark the order as paid if we can find it
        const orderId = paymentIntent.metadata?.orderId
        if (orderId) {
          try {
            const order = await db.boutiqueOrder.findFirst({
              where: { orderId },
            })
            if (order && order.status === 'pending') {
              await db.boutiqueOrder.update({
                where: { id: order.id },
                data: {
                  status: 'paid',
                  notes: (order.notes || '') + `\n[Stripe] Paiement confirmé — PI: ${paymentIntent.id}`,
                },
              })
              console.log(`[stripe] Order ${orderId} marked as paid`)
            }
          } catch (e) {
            console.error('[stripe] Failed to update order status:', e)
          }
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object
        console.log(`[stripe] Payment failed: ${paymentIntent.id} for order ${paymentIntent.metadata?.orderId}`)
        break
      }

      case 'checkout.session.completed': {
        const session = event.data.object
        console.log(`[stripe] Checkout session completed: ${session.id}`)
        const orderId = session.metadata?.orderId
        if (orderId) {
          try {
            const order = await db.boutiqueOrder.findFirst({ where: { orderId } })
            if (order && order.status === 'pending') {
              await db.boutiqueOrder.update({
                where: { id: order.id },
                data: {
                  status: 'paid',
                  notes: (order.notes || '') + `\n[Stripe] Paiement confirmé — Session: ${session.id}`,
                },
              })
              console.log(`[stripe] Order ${orderId} marked as paid (checkout session)`)
            }
          } catch (e) {
            console.error('[stripe] Failed to update order status:', e)
          }
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object
        console.log(`[stripe] Checkout session expired: ${session.id}`)
        break
      }

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('POST /api/webhooks/stripe error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur serveur' },
      { status: 500 },
    )
  }
}
