'use client'

import { useState, useEffect, useRef } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import { CheckoutElementsProvider, useCheckoutElements, PaymentElement } from '@stripe/react-stripe-js/checkout'
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

// ── Inner form using Checkout Elements ───────────────────────────────────

function CheckoutForm({
  onSuccess,
  onError,
}: {
  onSuccess: (sessionId: string) => void
  onError: (message: string) => void
}) {
  const checkout = useCheckoutElements()
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!checkout) return

    setProcessing(true)
    setMessage(null)

    try {
      // Confirm the payment using Checkout Sessions API
      const result = await checkout.confirm()

      if (result.type === 'success') {
        setMessage(null)
        // session.id is available on the checkout object
        onSuccess(checkout.session?.id || '')
      } else if (result.type === 'error') {
        const errMsg = result.error?.message || 'Une erreur est survenue lors du paiement.'
        setMessage(errMsg)
        onError(errMsg)
        setProcessing(false)
      } else if (result.type === 'action_required') {
        // 3D Secure or other authentication
        setMessage('Authentification requise. Suivez les instructions pour compléter le paiement.')
        // The checkout.confirm() handles the redirect automatically
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Erreur lors de la confirmation du paiement.'
      setMessage(errMsg)
      onError(errMsg)
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {message && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!checkout || processing}
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
  onPaymentSuccess: (sessionId: string) => void
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
      if (!s) {
        setError('Impossible de charger Stripe. Vérifiez la clé publique.')
      }
    })
  }, [publishableKey])

  // Create a Checkout Session when Stripe is loaded
  useEffect(() => {
    if (!stripe || !amount || !orderId) return

    setLoading(true)
    setError(null)

    fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, orderId, customerEmail }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret)
        } else {
          setError(data.error || 'Erreur lors de la création de la session de paiement')
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

      <CheckoutElementsProvider stripe={stripe} options={{ clientSecret }}>
        <CheckoutForm
          onSuccess={(sid) => {
            toast.success('Paiement réussi !')
            onPaymentSuccess(sid)
          }}
          onError={(msg) => {
            toast.error(msg)
            onPaymentError?.(msg)
          }}
        />
      </CheckoutElementsProvider>
    </div>
  )
}
