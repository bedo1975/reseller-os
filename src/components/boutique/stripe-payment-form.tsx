'use client'

import { useState, useEffect } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2, Lock, CreditCard, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

let stripePromise: Promise<Stripe | null> | null = null

function getStripe(publishableKey: string): Promise<Stripe | null> {
  if (!stripePromise && publishableKey) {
    stripePromise = loadStripe(publishableKey)
  }
  return stripePromise || Promise.resolve(null)
}

// ── Inner form ───────────────────────────────────────────────────────────

function CheckoutForm({
  onSuccess,
  onError,
}: {
  onSuccess: (paymentIntentId: string) => void
  onError: (message: string) => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    setMessage(null)

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {},
      redirect: 'if_required',
    })

    if (error) {
      const errMsg = error.message || 'Une erreur est survenue lors du paiement.'
      setMessage(errMsg)
      onError(errMsg)
      setProcessing(false)
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      setMessage(null)
      onSuccess(paymentIntent.id)
    } else if (paymentIntent) {
      setMessage(`Statut: ${paymentIntent.status}. Si une fenêtre s'ouvre, suivez les instructions.`)
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-gray-200 p-4 bg-white">
        <PaymentElement
          options={{
            layout: { type: 'tabs', defaultCollapsed: false },
          }}
        />
      </div>

      {message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

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

      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <Lock className="h-3 w-3" />
        <span>Paiement sécurisé par Stripe · Vos données bancaires sont chiffrées</span>
      </div>
    </form>
  )
}

// ── Outer component ──────────────────────────────────────────────────────

interface StripePaymentFormProps {
  publishableKey: string
  amount: number
  orderId: string
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

  useEffect(() => {
    if (!publishableKey) {
      setError('Clé publique Stripe manquante. Configurez-la dans Boutique Admin → Paiements.')
      setLoading(false)
      return
    }
    getStripe(publishableKey).then(s => {
      setStripe(s)
      if (!s) setError('Impossible de charger Stripe. Vérifiez la clé publique.')
    })
  }, [publishableKey])

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

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#007bff',
        colorBackground: '#ffffff',
        colorText: '#1a1a1a',
        colorDanger: '#dc2626',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        borderRadius: '8px',
      },
    },
  }

  // Detect if we're using test keys (pk_test_) — if so, we hide Stripe's
  // "test mode" warning banner that appears at the top of the Payment Element.
  // In production with live keys (pk_live_), the banner doesn't appear.
  const isTestMode = publishableKey.startsWith('pk_test_')

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

      <div className="relative">
        <Elements stripe={stripe} options={options}>
          <CheckoutForm
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

        {/* In test mode, Stripe shows a yellow "test mode" banner at the top
            of the Payment Element. We overlay a div to hide it from customers.
            In production (pk_live_), the banner doesn't appear — the overlay
            is not rendered. */}
        {isTestMode && (
          <div
            className="absolute top-0 left-0 right-0 h-[40px] bg-white z-20 pointer-events-none rounded-t-lg"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
