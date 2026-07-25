'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Lock, ShoppingBag, ChevronRight, AlertCircle, MapPin } from 'lucide-react'
import { toast } from 'sonner'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import dynamic from 'next/dynamic'
import { Suspense } from 'react'
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
    // Load shipping methods from API
    fetch('/api/boutique/admin/shipping')
      .then(r => r.json())
      .then(data => {
        const methods = data.methods || []
        setShippingOptions(methods.map((m: any) => ({
          code: m.code,
          label: m.label,
          price: m.price,
          delay: m.delay,
        })))
        if (methods.length > 0 && !shippingMethod) setShippingMethod(methods[0].code)
      })
      .catch(() => {})

    // Load payment methods from API
    fetch('/api/boutique/payments')
      .then(r => r.json())
      .then(data => {
        const methods = data.methods || []
        setPaymentOptions(methods)
        if (methods.length > 0 && !paymentMethod) setPaymentMethod(methods[0].code)
      })
      .catch(() => {})

    try {
      const c = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
      setCart(c)
      if (c.length === 0) {
        router.push('/boutique/panier')
        return
      }
    } catch {
      router.push('/boutique/panier')
      return
    }
    setLoaded(true)
  }, [router])

  const subtotal = cart.reduce((s, i) => s + (i.price || 0) * i.qty, 0)
  const rawShipping = shippingOptions.find(s => s.code === shippingMethod)?.price || 0
  // Apply free shipping if enabled and subtotal >= threshold
  const freeShipEnabled = settings.freeShippingEnabled === true
  const freeShipThreshold = settings.freeShippingThreshold || 50
  const shipping = (freeShipEnabled && subtotal >= freeShipThreshold) ? 0 : rawShipping
  const total = subtotal + shipping

  // Auto-calculate shipping based on weight when shipping method or cart changes
  useEffect(() => {
    if (!shippingMethod || cart.length === 0) return
    fetch('/api/boutique/shipping-calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shippingMethodCode: shippingMethod,
        items: cart.map(i => ({ sku: i.sku, qty: i.qty })),
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.shippingCost != null) {
          // Update the shipping option price dynamically
          setShippingOptions(prev => prev.map(opt =>
            opt.code === shippingMethod ? { ...opt, price: data.shippingCost } : opt
          ))
        }
      })
      .catch(() => {})
  }, [shippingMethod, cart])

  // Whether the currently selected shipping method is a "point relais" one.
  const isRelayShipping = useMemo(() => {
    return !!shippingMethod && /relay/i.test(shippingMethod)
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

    setSubmitting(true)
    try {
      const res = await fetch('/api/boutique/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: form,
          items: cart.map(i => ({ sku: i.sku, qty: i.qty, price: i.price })),
          shippingMethodCode: shippingMethod,
          shippingCost: shipping, // send the calculated shipping cost from frontend
          paymentMethodCode: paymentMethod,
          notes: form.notes,
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

      // Clear cart
      localStorage.removeItem('boutique_cart')
      window.dispatchEvent(new Event('cart-updated'))

      // Store order info for confirmation page
      sessionStorage.setItem('last_order', JSON.stringify(data))

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

            <div className="border-t border-gray-200 pt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{subtotal.toFixed(2)} €</span>
              </div>
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
                disabled={submitting}
                className="w-full mt-5 h-11 bg-[#007bff] hover:bg-[#0056b3]"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Traitement...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Confirmer la commande
                  </span>
                )}
              </Button>
            )}

            <p className="text-xs text-gray-400 text-center mt-3">
              En validant, vous acceptez nos{' '}
              <Link href="/boutique/cgv" className="text-[#007bff] hover:underline">CGV</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
