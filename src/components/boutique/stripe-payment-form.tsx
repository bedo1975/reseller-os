'use client'

import { useState, useEffect } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

// Cache the Stripe instance
let stripePromise: Promise<Stripe | null> | null = null

function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise || Promise.resolve(null)
}

// ── Inner form (uses Stripe Elements hooks) ──────────────────────────────

function CheckoutForm({
  clientSecret,
  onSuccess,
  onError,
}: {
  clientSecret: string
  onSuccess: (paymentIntentId: string) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setMessage(null)

    // Confirm the payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // Don't use return_url here — we handle the result in this component
        // instead of redirecting (better UX for single-page checkout)
      },
      redirect: 'if_required',
    })

    if (error) {
      // Show error to customer (e.g. card declined)
      const errMsg = error.message || 'Une erreur est survenue lors du paiement.'
      setMessage(errMsg)
      onError(errMsg)
      setProcessing(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment succeeded!
      setMessage(null)
      onSuccess(paymentIntent.id)
      // Don't set processing to false — the parent will redirect
    } else if (paymentIntent) {
      // Payment requires action (e.g. 3D Secure)
      setMessage(`Statut du paiement: ${paymentIntent.status}. Si une fenêtre s'ouvre, suivez les instructions.`)
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Stripe Payment Element (card number, expiry, CVC) */}
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <PaymentElement
          options={{
            layout: {
              type: 'tabs',
              defaultCollapsed: false,
            },
          }}
        />
      </div>

      {/* Error/success message */}
      {message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="submit"
        disabled={!stripe || processing}
        className="w-full h-12 bg-[#635BFF] hover:bg-[#5851ED] text-white"
      >
        {processing ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Traitement du paiement…
          </>
        ) : (
          <>
            <Lock className="h-5 w-5 mr-2" />
            Payer maintenant
          </>
        )}
      </Button>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <Lock className="h-3 w-3" />
        <span>Paiement sécurisé par Stripe · Vos données bancaires sont chiffrées</span>
      </div>
    </form>
  )
}

// ── Outer component (handles PaymentIntent creation + Stripe loading) ────

interface StripePaymentFormProps {
  publishableKey: string
  amount: number            // total in EUR (e.g. 49.90)
  orderId: string           // our internal order ID (CMD-...)
  customerEmail: string
  onPaymentSuccess: (paymentIntentId: string) => void
  onPaymentError?: (message: string) => void
}

export function StripePaymentForm({
  publishableKey,
  amount,
  orderId,
  customerEmail,
  onPaymentSuccess,
  onPaymentError,
}: StripePaymentFormProps) {
  const [stripe, setStripe] = useState<Stripe | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load Stripe.js with the publishable key
  useEffect(() => {
    if (!publishableKey) {
      setError('Clé publique Stripe manquante. Configurez-la dans Boutique Admin → Paiements.')
      setLoading(false)
      return
    }
    getStripe(publishableKey).then(s => {
      setStripe(s)
      if (!s) {
        setError('Impossible de charger Stripe. Vérifiez la clé publique.')
      }
    })
  }, [publishableKey])

  // Create a PaymentIntent when Stripe is loaded
  useEffect(() => {
    if (!stripe || !amount || !orderId) return

    setLoading(true)
    setError(null)

    fetch('/api/stripe/create-payment-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId, customerEmail }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError(data.error || 'Erreur lors de la création du paiement')
        }
      })
      .catch(() => setError('Erreur réseau'))
      .finally(() => setLoading(false))
  }, [stripe, amount, orderId, customerEmail])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#635BFF]" />
        <p className="text-sm text-gray-500">Préparation du paiement sécurisé…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Erreur Stripe</p>
            <p className="text-xs mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!stripe || !clientSecret) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        Impossible d'initialiser le paiement Stripe.
      </div>
    )
  }

  // Stripe Elements appearance config
  const appearance = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#007bff',
      colorBackground: '#ffffff',
      colorText: '#1a1a1a',
      colorDanger: '#dc2626',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      borderRadius: '8px',
    },
  }

  const options = {
    clientSecret,
    appearance,
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center h-8 w-8 rounded bg-[#635BFF] text-white text-xs font-bold">
          S
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Paiement par carte bancaire</p>
          <p className="text-xs text-gray-500">Visa, Mastercard, Amex · Sécurisé par Stripe</p>
        </div>
      </div>

      <Elements stripe={stripe} options={options}>
        <CheckoutForm
          clientSecret={clientSecret}
          onSuccess={(piId) => {
            toast.success('Paiement réussi !')
            onPaymentSuccess(piId)
          }}
          onError={(msg) => {
            toast.error(msg)
            onPaymentError?.(msg)
          }}
        />
      </Elements>
    </div>
  )
}
