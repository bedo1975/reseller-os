import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

// POST /api/stripe/create-payment-intent
// Public — creates a Stripe PaymentIntent for the checkout.
//
// Body: {
//   amount: number,        // total in EUR (e.g. 49.90)
//   orderId: string,       // our internal order ID (CMD-...)
//   customerEmail: string,
// }
//
// Returns: { clientSecret: string, paymentIntentId: string }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { amount, orderId, customerEmail } = body

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Montant invalide' }, { status: 400 })
    }

    // Get Stripe secret key from settings
    const settings = await getBoutiqueSettings()
    const secretKey = settings.stripeSecretKey

    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe non configuré. L\'admin doit configurer la clé secrète dans Boutique Admin → Paiements.' },
        { status: 503 },
      )
    }

    // Dynamically import Stripe (only when needed — avoids loading if not configured)
    const Stripe = (await import('stripe')).default
    const stripe = new Stripe(secretKey, {
      apiVersion: '2025-08-27.basil' as any,
      typescript: true,
    })

    // Convert EUR amount to cents (Stripe requires the smallest currency unit)
    const amountInCents = Math.round(parseFloat(amount) * 100)

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'eur',
      automatic_payment_methods: { enabled: true },
      receipt_email: customerEmail,
      metadata: {
        orderId: orderId || '',
        source: 'junashop_boutique',
      },
      description: `Commande ${orderId || ''} — Junashop`,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    })
  } catch (error: any) {
    console.error('POST /api/stripe/create-payment-intent error:', error)
    return NextResponse.json(
      { error: error?.message || 'Erreur lors de la création du paiement Stripe' },
      { status: 500 },
    )
  }
}
