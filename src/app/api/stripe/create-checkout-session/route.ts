import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

/**
 * POST /api/stripe/create-checkout-session
 * Public — creates a Stripe Checkout Session (ui_mode: 'embedded').
 *
 * Stripe recommends Checkout Sessions over Payment Intents.
 * Uses embedded UI mode + Payment Element via @stripe/react-stripe-js/checkout.
 *
 * Body: { amount: number, orderId: string, customerEmail: string }
 * Returns: { clientSecret: string, sessionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, orderId, customerEmail } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    const settings = await getBoutiqueSettings()
    const secretKey = settings.stripeSecretKey

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe non configuré. L\'admin doit configurer la clé secrète dans Boutique Admin → Paiements.' },
        { status: 503 },
      )
    }

    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil' as any,
      typescript: true,
    })

    const amountInCents = Math.round(parseFloat(amount) * 100)

    // Create a Checkout Session with embedded UI mode
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: customerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountInCents,
            product_data: {
              name: `Commande ${orderId || 'Junashop'}`,
              description: 'Commande boutique Junashop',
            },
          },
        },
      ],
      redirect_on_completion: 'never',
      metadata: {
        orderId: orderId || '',
        source: 'junashop_boutique',
      },
    })

    return NextResponse.json({
      clientSecret: session.client_secret,
      sessionId: session.id,
    })
  } catch (error: any) {
    console.error('POST /api/stripe/create-checkout-session error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la création de la session Stripe' },
      { status: 500 },
    )
  }
}
