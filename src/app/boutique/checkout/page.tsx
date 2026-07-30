'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Lock, ShoppingBag, ChevronRight, AlertCircle, MapPin, TicketPercent, X, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { StripePaymentForm } from '@/components/boutique/stripe-payment-form'
import type { RelayPoint } from '@/components/boutique/relay-map'

// Leaflet must be rendered client-side only (it accesses window at import time).
const RelayMapInner = dynamic(
  () => import('@/components/boutique/relay-map').then(m => ({ default: m.RelayMap })),
  { ssr: false, loading: () => <Skeleton className="h-[400px] w-full rounded-lg" /> }
)

// Wrap in Suspense to handle react-leaflet's internal suspense
function RelayMap(props: React.ComponentProps<typeof RelayMapInner>) {
  return (
    <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-lg" />}>
      <RelayMapInner {...props} />
    </Suspense>
  )
}

interface CartItem {
  sku: string
  brand: string
  category: string
  size?: string | null
  color?: string | null
  price: number | null
  mainPhoto?: string | null
  qty: number
}

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  accessoires: 'Accessoires',
  luxe: 'Luxe',
  maison: 'Maison',
}

interface ShippingOption {
  code: string
  label: string
  price: number
  delay: string
  carrierCode?: string | null
}

interface PaymentOption {
  id: string
  code: string
  label: string
  description: string | null
  icon: string | null
  provider: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const settings = useBoutiqueSettings()
  const [cart, setCart] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
  const [paymentOptions, setPaymentOptions] = useState<PaymentOption[]>([])
  const [shippingMethod, setShippingMethod] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')
  const [selectedRelay, setSelectedRelay] = useState<RelayPoint | null>(null)

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState<{
    id: string
    code: string
    name: string
    type: string
    value: number
    discountAmount: number
  } | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponLoading, setCouponLoading] = useState(false)

  // Stripe payment state
  const [stripeOrder, setStripeOrder] = useState<{ orderId: string; amount: number } | null>(null)
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    postalCode: '',
    city: '',
    country: 'France',
    notes: '',
  })

  useEffect(() => {
    // Load cart FIRST so we can calculate shipping with the right items
    try {
      const c = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
      setCart(c)
      if (c.length === 0) {
        router.push('/boutique/panier')
        return
      }

      // Now load shipping methods AND pre-calculate prices based on cart weight
      fetch('/api/boutique/admin/shipping')
        .then(r => r.json())
        .then(async data => {
          const methods = data.methods || []
          // Pre-calculate shipping cost for ALL methods at once (based on cart weight)
          const calculatedOptions = await Promise.all(methods.map(async (m: any) => {
            try {
              const calcRes = await fetch('/api/boutique/shipping-calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  shippingMethodCode: m.code,
                  items: c.map((i: any) => ({ sku: i.sku, qty: i.qty })),
                }),
              })
              const calcData = await calcRes.json()
              return {
                code: m.code,
                label: m.label,
                price: calcData.shippingCost != null ? calcData.shippingCost : m.price,
                delay: m.delay,
                carrierCode: m.carrierCode || null,
              }
            } catch {
              return { code: m.code, label: m.label, price: m.price, delay: m.delay, carrierCode: m.carrierCode || null }
            }
          }))
          setShippingOptions(calculatedOptions)
          if (calculatedOptions.length > 0 && !shippingMethod) setShippingMethod(calculatedOptions[0].code)
        })
        .catch(() => {})
    } catch {
      router.push('/boutique/panier')
      return
    }
    setLoaded(true)

    // Load payment methods from API
    fetch('/api/boutique/payments')
      .then(r => r.json())
      .then(data => {
        const methods = data.methods || []
        setPaymentOptions(methods)
        if (methods.length > 0 && !paymentMethod) setPaymentMethod(methods[0].code)
      })
      .catch(() => {})
  }, [router])

  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0)
  const discountAmount = appliedCoupon?.discountAmount || 0
  const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)
  const rawShipping = shippingOptions.find(s => s.code === shippingMethod)?.price || 0
  // Apply free shipping if enabled and subtotal (after discount) >= threshold
  const freeShipEnabled = settings.freeShippingEnabled === true
  const freeShipThreshold = settings.freeShippingThreshold || 50
  const shipping = (freeShipEnabled && subtotalAfterDiscount >= freeShipThreshold) ? 0 : rawShipping
  const total = subtotalAfterDiscount + shipping

  // Apply coupon: call validate endpoint
  const applyCoupon = async () => {
    const code = couponInput.trim().toUpperCase()
    if (!code) {
      toast.error('Saisissez un code coupon')
      return
    }
    setCouponLoading(true)
    setCouponError(null)
    try {
      const res = await fetch('/api/boutique/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal }),
      })
      const data = await res.json()
      if (!res.ok || !data.valid) {
        setAppliedCoupon(null)
        setCouponError(data.error || 'Coupon invalide')
        return
      }
      setAppliedCoupon({
        id: data.coupon.id,
        code: data.coupon.code,
        name: data.coupon.name,
        type: data.coupon.type,
        value: data.coupon.value,
        discountAmount: data.discountAmount,
      })
      setCouponInput('')
      toast.success(`Coupon ${data.coupon.code} appliqué : -${data.discountAmount.toFixed(2)} €`)
    } catch {
      setCouponError('Erreur réseau')
    } finally {
      setCouponLoading(false)
    }
  }

  const removeCoupon = () => {
    setAppliedCoupon(null)
    setCouponError(null)
  }

  // Re-validate coupon when subtotal changes (items added/removed from cart)
  useEffect(() => {
    if (!appliedCoupon) return
    // Silent re-validation to recompute discount based on new subtotal
    fetch('/api/boutique/coupons/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: appliedCoupon.code, subtotal }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          setAppliedCoupon(prev => prev ? { ...prev, discountAmount: data.discountAmount } : null)
        } else {
          setAppliedCoupon(null)
          setCouponError(data.error || 'Coupon devenu invalide')
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal])

  // Note: shipping prices are pre-calculated for all methods when they are loaded (see useEffect above).
  // No need to recalculate when switching methods — the price is already correct.

  // Whether the currently selected shipping method is a "point relais" one.
  const isRelayShipping = useMemo(() => {
    return !!shippingMethod && /relay|pickup|point_relay|chronopost_relay/i.test(shippingMethod)
  }, [shippingMethod])

  // Reset the selected relay when the customer switches away from a relay method.
  useEffect(() => {
    if (!isRelayShipping && selectedRelay) {
      setSelectedRelay(null)
    }
  }, [isRelayShipping, selectedRelay])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const validateForm = () => {
    if (!form.firstName.trim()) return 'Prénom requis'
    if (!form.lastName.trim()) return 'Nom requis'
    if (!form.email.trim() || !form.email.includes('@')) return 'Email valide requis'
    if (!form.address.trim()) return 'Adresse requise'
    if (!form.postalCode.trim()) return 'Code postal requis'
    if (!form.city.trim()) return 'Ville requise'
    if (!shippingMethod) return 'Veuillez sélectionner un mode de livraison'
    if (!paymentMethod) return 'Veuillez sélectionner un mode de paiement'
    if (isRelayShipping && !selectedRelay) return 'Veuillez sélectionner un point relais'
    return null
  }

  const submitOrder = async () => {
    const error = validateForm()
    if (error) {
      toast.error(error)
      return
    }

    // Check if Stripe is selected and configured
    const selectedPayment = paymentOptions.find(p => p.code === paymentMethod)
    const isStripePayment = selectedPayment?.provider === 'stripe'

    if (isStripePayment && !settings.stripePublicKey) {
      toast.error('Stripe n\'est pas configuré. L\'admin doit configurer les clés API dans Boutique Admin → Paiements.')
      return
    }

    // ── Stripe flow: show the payment form FIRST (no order created yet) ──
    // The order will be created only AFTER the payment succeeds.
    // This prevents stock from being decremented if the customer doesn't pay.
    if (isStripePayment) {
      // Generate a temporary orderId for the PaymentIntent metadata
      const tempOrderId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      setStripeOrder({ orderId: tempOrderId, amount: total })
      // Scroll to the Stripe form
      setTimeout(() => {
        document.getElementById('stripe-payment-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
      return
    }

    // ── Non-Stripe flow: create the order immediately ──
    setSubmitting(true)
    try {
      const res = await fetch('/api/boutique/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: cart.map(i => ({ sku: i.sku, qty: i.qty, price: i.price })),
          shippingMethodCode: shippingMethod,
          shippingCost: shipping,
          paymentMethodCode: paymentMethod,
          notes: form.notes,
          couponCode: appliedCoupon?.code || undefined,
          discountAmount: discountAmount,
          relayId: isRelayShipping && selectedRelay ? selectedRelay.id : undefined,
          relayName: isRelayShipping && selectedRelay ? selectedRelay.name : undefined,
          relayAddress: isRelayShipping && selectedRelay ? JSON.stringify({
            address: selectedRelay.address,
            postalCode: selectedRelay.postalCode,
            city: selectedRelay.city,
            lat: selectedRelay.lat,
            lng: selectedRelay.lng,
          }) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la commande')
        setSubmitting(false)
        return
      }

      // Clear cart and redirect
      localStorage.removeItem('boutique_cart')
      window.dispatchEvent(new Event('cart-updated'))
      sessionStorage.setItem('last_order', JSON.stringify(data))
      router.push('/boutique/confirmation')
    } catch {
      toast.error('Erreur réseau')
      setSubmitting(false)
    }
  }

  // ── Create the order AFTER Stripe payment succeeds ──
  const createOrderAfterStripePayment = async (paymentIntentId: string) => {
    if (!stripeOrder) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/boutique/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: cart.map(i => ({ sku: i.sku, qty: i.qty, price: i.price })),
          shippingMethodCode: shippingMethod,
          shippingCost: shipping,
          paymentMethodCode: paymentMethod,
          notes: form.notes,
          couponCode: appliedCoupon?.code || undefined,
          discountAmount: discountAmount,
          relayId: isRelayShipping && selectedRelay ? selectedRelay.id : undefined,
          relayName: isRelayShipping && selectedRelay ? selectedRelay.name : undefined,
          relayAddress: isRelayShipping && selectedRelay ? JSON.stringify({
            address: selectedRelay.address,
            postalCode: selectedRelay.postalCode,
            city: selectedRelay.city,
            lat: selectedRelay.lat,
            lng: selectedRelay.lng,
          }) : undefined,
          // Mark as paid directly since Stripe payment already succeeded
          paidImmediately: true,
          paymentIntentId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la création de la commande')
        setSubmitting(false)
        return
      }

      // Clear cart and redirect
      localStorage.removeItem('boutique_cart')
      window.dispatchEvent(new Event('cart-updated'))
      sessionStorage.setItem('last_order', JSON.stringify({
        ...data,
        paymentIntentId,
      }))
      router.push('/boutique/confirmation')
    } catch {
      toast.error('Erreur réseau')
      setSubmitting(false)
    }
  }

  if (!loaded) return null

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/boutique" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/boutique/panier" className="hover:text-[#007bff]">Panier</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Commande</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <ShoppingBag className="h-6 w-6 text-[#007bff]" />
        Finaliser ma commande
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Coordonnées */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Vos coordonnées</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom *</Label>
                <Input id="firstName" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom *</Label>
                <Input id="lastName" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={e => set('email', e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
              </div>
            </div>
          </div>

          {/* Adresse */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Adresse de livraison</h2>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address">Adresse *</Label>
                <Input id="address" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 rue de la Paix" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="postalCode">Code postal *</Label>
                  <Input id="postalCode" value={form.postalCode} onChange={e => set('postalCode', e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="city">Ville *</Label>
                  <Input id="city" value={form.city} onChange={e => set('city', e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country">Pays</Label>
                  <Input id="country" value={form.country} onChange={e => set('country', e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (optionnel)</Label>
                <Textarea id="notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Instructions de livraison, etc." />
              </div>
            </div>
          </div>

          {/* Shipping method */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Mode de livraison</h2>
            <div className="space-y-2">
              {shippingOptions.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Chargement des modes de livraison...</p>
              ) : (
                shippingOptions.map(opt => (
                  <label
                    key={opt.code}
                    className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                      shippingMethod === opt.code ? 'border-[#007bff] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="shipping"
                      value={opt.code}
                      checked={shippingMethod === opt.code}
                      onChange={e => setShippingMethod(e.target.value)}
                      className="accent-[#007bff]"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900 flex items-center gap-2">
                        {opt.label}
                        {/relay/i.test(opt.code) && <MapPin className="h-3.5 w-3.5 text-[#007bff]" />}
                      </p>
                      {opt.delay && <p className="text-xs text-gray-500">{opt.delay}</p>}
                    </div>
                    <span className="font-medium text-sm">
                      {opt.price === 0 ? 'Gratuit' : `${opt.price.toFixed(2)} €`}
                    </span>
                  </label>
                ))
              )}
            </div>

            {/* Relay point picker — only shown for relay-type shipping methods */}
            {isRelayShipping && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="mb-3">
                  <h3 className="font-medium text-sm text-gray-900 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#007bff]" />
                    Choisissez votre point relais
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Sélectionnez un point relais près de chez vous. Le code postal est pré-rempli depuis votre adresse.
                  </p>
                </div>
                <RelayMap
                  postalCode={form.postalCode}
                  city={form.city}
                  carrier={shippingOptions.find(s => s.code === shippingMethod)?.carrierCode || undefined}
                  onSelect={(relay) => setSelectedRelay(relay)}
                  selectedRelayId={selectedRelay?.id}
                />
                {isRelayShipping && !selectedRelay && (
                  <p className="mt-2 text-xs text-amber-700 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    La sélection d'un point relais est obligatoire pour confirmer la commande.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Payment method */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Mode de paiement</h2>
            <div className="space-y-2">
              {paymentOptions.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Chargement des modes de paiement...</p>
              ) : (
                paymentOptions.map(opt => (
                  <label
                    key={opt.code}
                    className={`flex items-center gap-3 p-3 border rounded-md cursor-pointer transition-colors ${
                      paymentMethod === opt.code ? 'border-[#007bff] bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={opt.code}
                      checked={paymentMethod === opt.code}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="accent-[#007bff]"
                    />
                    <span className="text-2xl">{opt.icon || '💳'}</span>
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{opt.label}</p>
                      {opt.description && <p className="text-xs text-gray-500">{opt.description}</p>}
                      {opt.provider === 'demo' && (
                        <span className="inline-block mt-1 text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium uppercase">Mode démo</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-5 sticky top-28">
            <h2 className="font-semibold text-gray-900 mb-4">Ma commande</h2>

            {/* Items */}
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {cart.map(item => (
                <div key={item.sku} className="flex gap-3 text-sm">
                  <div className="w-12 h-12 bg-gray-50 rounded-md overflow-hidden shrink-0">
                    {item.mainPhoto && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.mainPhoto} alt={item.brand} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 uppercase">{item.brand}</p>
                    <p className="text-sm text-gray-900 truncate">
                      {CATEGORY_LABELS[item.category] || item.category}
                      {item.size && ` · ${item.size}`}
                    </p>
                    <p className="text-xs text-gray-500">Quantité : {item.qty}</p>
                  </div>
                  <span className="text-sm font-medium">
                    {item.price != null ? `${(item.price * item.qty).toFixed(2)} €` : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Coupon input */}
            <div className="border-t border-gray-200 pt-4 mb-3">
              {appliedCoupon ? (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <TicketPercent className="h-4 w-4 text-green-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-green-800">
                      Coupon <code className="font-mono">{appliedCoupon.code}</code> appliqué
                    </p>
                    <p className="text-[11px] text-green-700">
                      {appliedCoupon.type === 'percent'
                        ? `-${appliedCoupon.value}% (${appliedCoupon.name})`
                        : `-${appliedCoupon.value.toFixed(2)} € (${appliedCoupon.name})`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeCoupon}
                    className="text-green-700 hover:text-green-900"
                    aria-label="Retirer le coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Label className="text-xs text-gray-600 flex items-center gap-1.5 mb-1.5">
                    <TicketPercent className="h-3.5 w-3.5" />
                    Code promo
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null) }}
                      placeholder="SUMMER25"
                      className="font-mono text-sm h-9"
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon() } }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={applyCoupon}
                      disabled={couponLoading || !couponInput.trim()}
                      className="h-9"
                    >
                      {couponLoading ? '...' : 'Appliquer'}
                    </Button>
                  </div>
                  {couponError && (
                    <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {couponError}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{subtotal.toFixed(2)} €</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="flex items-center gap-1">
                    <TicketPercent className="h-3.5 w-3.5" />
                    Remise {appliedCoupon?.code}
                  </span>
                  <span className="font-medium">−{discountAmount.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Livraison</span>
                <span className="font-medium">{shipping === 0 ? 'Gratuite' : `${shipping.toFixed(2)} €`}</span>
              </div>
            </div>

            <div className="border-t border-gray-200 mt-4 pt-4 flex justify-between items-baseline">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="text-xl font-bold text-[#007bff]">{total.toFixed(2)} €</span>
            </div>

            {settings.boutiqueClosed === true ? (
              <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span className="whitespace-pre-wrap">
                  {settings.boutiqueClosedMessage || 'La boutique est temporairement fermée. Revenez bientôt !'}
                </span>
              </div>
            ) : (
              <Button
                onClick={submitOrder}
                disabled={submitting || !!stripeOrder}
                className="w-full mt-5 h-11 bg-[#007bff] hover:bg-[#0056b3]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Traitement...
                  </span>
                ) : stripeOrder ? (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    En attente de paiement…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    {paymentOptions.find(p => p.code === paymentMethod)?.provider === 'stripe'
                      ? 'Procéder au paiement'
                      : 'Confirmer la commande'}
                  </span>
                )}
              </Button>
            )}

            {/* Stripe payment form (shown when Stripe is selected — BEFORE order creation) */}
            {stripeOrder && settings.stripePublicKey && (
              <div id="stripe-payment-section" className="mt-6 p-4 rounded-lg border-2 border-[#635BFF] bg-[#635BFF]/5">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-[#635BFF]" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Paiement sécurisé · {stripeOrder.amount.toFixed(2)} €
                    </p>
                    <p className="text-xs text-gray-500">
                      Saisissez vos informations bancaires pour finaliser la commande.
                    </p>
                  </div>
                </div>
                <StripePaymentForm
                  publishableKey={settings.stripePublicKey}
                  amount={stripeOrder.amount}
                  orderId={stripeOrder.orderId}
                  customerEmail={form.email}
                  onPaymentSuccess={(piId) => {
                    // Payment succeeded — NOW create the order (stock will be decremented)
                    createOrderAfterStripePayment(piId)
                  }}
                  onPaymentError={(msg) => {
                    toast.error('Paiement échoué: ' + msg)
                  }}
                />
                <p className="text-xs text-gray-400 text-center mt-3">
                  Le panier sera validé définitivement après confirmation du paiement.
                </p>
              </div>
            )}

            <p className="text-xs text-gray-400 text-center mt-3">
              En validant, vous acceptez nos{' '}
              <Link href="/boutique/cgv" className="text-[#007bff] hover:underline">CGV</Link>
              {' '}·{' '}
              <Link href="/boutique/retractation" className="text-[#007bff] hover:underline">Droit de rétractation</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
