'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Trash2, Plus, Minus, ShoppingCart, ArrowRight, Package, AlertCircle, Tag } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

interface CartItem {
  sku: string
  brand: string
  category: string
  size?: string | null
  color?: string | null
  price: number | null
  mainPhoto?: string | null
  qty: number
  maxQty?: number // stock quantity available
  offerPrice?: number | null  // prix réduit si une offre a été acceptée (Make an Offer)
}

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  accessoires: 'Accessoires',
  luxe: 'Luxe',
  maison: 'Maison',
}

export default function CartPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CartPage />
    </Suspense>
  )
}

function CartPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const settings = useBoutiqueSettings()
  const [cart, setCart] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [offerApplied, setOfferApplied] = useState<{ sku: string; offeredPrice: number; brand: string } | null>(null)
  const [offerError, setOfferError] = useState<string | null>(null)

  useEffect(() => {
    // Load cart from localStorage
    let c: CartItem[] = []
    try {
      c = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
    } catch {
      c = []
    }

    // Check for Make an Offer token in the URL (?offer=TOKEN)
    const offerToken = searchParams.get('offer')
    if (offerToken) {
      // Fetch the offer by token (public endpoint)
      fetch(`/api/boutique/offers/by-token?token=${encodeURIComponent(offerToken)}`)
        .then(r => {
          if (!r.ok) throw new Error('not found')
          return r.json()
        })
        .then(data => {
          if (!data || data.status !== 'accepted') {
            setOfferError('Cette offre n\'est plus valide ou a expiré.')
            setCart(c)
            setLoaded(true)
            return
          }
          // Check expiration
          if (data.cartExpiresAt && new Date(data.cartExpiresAt) < new Date()) {
            setOfferError('Le délai de cette offre a expiré. L\'article est disponible à son prix original.')
            setCart(c)
            setLoaded(true)
            return
          }
          // Apply the offered price to the matching item in the cart
          const updatedCart = c.map(item => {
            if (item.sku === data.sku) {
              return { ...item, offerPrice: data.offeredPrice, qty: 1 }
            }
            return item
          })
          // If the item is not in the cart yet, add it
          if (!updatedCart.find(i => i.sku === data.sku)) {
            updatedCart.push({
              sku: data.sku,
              brand: data.brand,
              category: data.category || 'vetements',
              price: data.originalPrice,
              offerPrice: data.offeredPrice,
              qty: 1,
              mainPhoto: null,
            })
          }
          setCart(updatedCart)
          localStorage.setItem('boutique_cart', JSON.stringify(updatedCart))
          window.dispatchEvent(new Event('cart-updated'))
          setOfferApplied({ sku: data.sku, offeredPrice: data.offeredPrice, brand: data.brand })
          setLoaded(true)
        })
        .catch(() => {
          setOfferError('Offre introuvable. Le lien n\'est peut-être plus valide.')
          setCart(c)
          setLoaded(true)
        })
    } else {
      setCart(c)
      setLoaded(true)
    }
  }, [searchParams])

  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart)
    localStorage.setItem('boutique_cart', JSON.stringify(newCart))
    window.dispatchEvent(new Event('cart-updated'))
  }

  const updateQty = (sku: string, delta: number) => {
    const newCart = cart.map(i => {
      if (i.sku === sku) {
        const newQty = Math.max(1, i.qty + delta)
        // Respect stock quantity: don't exceed maxQty if known
        const max = i.maxQty && i.maxQty > 0 ? i.maxQty : 99
        return { ...i, qty: Math.min(newQty, max) }
      }
      return i
    })
    saveCart(newCart)
  }

  const removeItem = (sku: string) => {
    const newCart = cart.filter(i => i.sku !== sku)
    saveCart(newCart)
  }

  const clearCart = () => {
    if (!confirm('Vider le panier ?')) return
    saveCart([])
  }

  const subtotal = cart.reduce((s, i) => s + ((i.offerPrice ?? i.price) || 0) * i.qty, 0)
  const freeShipEnabled = settings.freeShippingEnabled === true
  const freeShipThreshold = settings.freeShippingThreshold || 50
  const isFreeShipping = freeShipEnabled && subtotal >= freeShipThreshold && subtotal > 0
  const shipping = isFreeShipping ? 0 : 3.50
  const total = subtotal + shipping

  if (!loaded) return null

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Votre panier est vide</h1>
        <p className="text-gray-500 mb-6">Découvrez nos articles et ajoutez-les à votre panier.</p>
        <Link href="/">
          <Button className="bg-[#007bff] hover:bg-[#0056b3]">
            Continuer mes achats
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Mon panier ({cart.length})</h1>

      {/* Make an Offer — success banner */}
      {offerApplied && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm flex items-start gap-2">
          <Tag className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600" />
          <span>
            Votre offre a été acceptée ! <strong>{offerApplied.brand}</strong> est à <strong>{offerApplied.offeredPrice.toFixed(2)} €</strong> dans votre panier.
            Profitez-en, ce prix est valable pour une durée limitée.
          </span>
        </div>
      )}

      {/* Make an Offer — error banner */}
      {offerError && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{offerError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {cart.map(item => (
            <div key={item.sku} className="flex gap-4 bg-white border border-gray-200 rounded-lg p-3">
              {/* Image */}
              <Link href={`/produit/${item.sku}`} className="shrink-0">
                <div className="w-24 h-24 bg-gray-50 rounded-md overflow-hidden">
                  {item.mainPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.mainPhoto} alt={item.brand} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-300">
                      <Package className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase font-medium">{item.brand}</p>
                <Link
                  href={`/produit/${item.sku}`}
                  className="text-sm font-medium text-gray-900 hover:text-[#007bff] line-clamp-1"
                >
                  {CATEGORY_LABELS[item.category] || item.category}
                  {item.size && ` · Taille ${item.size}`}
                </Link>
                {item.color && <p className="text-xs text-gray-500 mt-0.5">{item.color}</p>}
                <p className="text-sm font-bold text-[#007bff] mt-1">
                  {item.offerPrice != null ? (
                    <span className="flex items-center gap-2">
                      <span className="text-amber-600">{item.offerPrice.toFixed(2)} €</span>
                      {item.price != null && (
                        <span className="text-xs text-gray-400 line-through">{item.price.toFixed(2)} €</span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        <Tag className="h-2.5 w-2.5" /> Offre
                      </span>
                    </span>
                  ) : (
                    item.price != null ? `${item.price.toFixed(2)} €` : '—'
                  )}
                </p>

                {/* Qty controls */}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-gray-300 rounded-md">
                    <button
                      onClick={() => updateQty(item.sku, -1)}
                      className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={item.qty <= 1}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-3 text-sm font-medium">{item.qty}</span>
                    <button
                      onClick={() => updateQty(item.sku, 1)}
                      className="p-1.5 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      disabled={item.maxQty != null && item.qty >= item.maxQty}
                      title={item.maxQty != null && item.qty >= item.maxQty ? `Stock maximum: ${item.maxQty}` : ''}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  {item.maxQty != null && item.qty >= item.maxQty && (
                    <span className="text-[10px] text-amber-600 font-medium">Stock max atteint</span>
                  )}
                  <button
                    onClick={() => removeItem(item.sku)}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Retirer
                  </button>
                </div>
              </div>

              {/* Total item */}
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">
                  {((item.offerPrice ?? item.price) || 0) * item.qty !== 0
                    ? `${(((item.offerPrice ?? item.price) || 0) * item.qty).toFixed(2)} €`
                    : '—'}
                </p>
              </div>
            </div>
          ))}

          <div className="flex justify-between items-center pt-3">
            <button
              onClick={clearCart}
              className="text-xs text-gray-500 hover:text-red-600"
            >
              Vider le panier
            </button>
            <Link href="/" className="text-sm text-[#007bff] hover:underline">
              ← Continuer mes achats
            </Link>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-lg p-5 sticky top-28">
            <h2 className="font-semibold text-gray-900 mb-4">Récapitulatif</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sous-total</span>
                <span className="font-medium">{subtotal.toFixed(2)} €</span>
              </div>
              <p className="text-xs text-gray-400 pt-1">
                Les frais de livraison seront calculés lors de la sélection du mode de livraison.
              </p>
            </div>

            <div className="border-t border-gray-200 mt-4 pt-4 flex justify-between items-baseline">
              <span className="font-semibold text-gray-900">Sous-total</span>
              <span className="text-xl font-bold text-[#007bff]">{subtotal.toFixed(2)} €</span>
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
                onClick={() => router.push('/checkout')}
                className="w-full mt-5 h-11 bg-[#007bff] hover:bg-[#0056b3]"
              >
                Passer la commande
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full mt-2 h-10 text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => {
                if (confirm('Vider le panier et retourner à l\'accueil ?')) {
                  localStorage.removeItem('boutique_cart')
                  window.dispatchEvent(new Event('cart-updated'))
                  router.push('/')
                }
              }}
            >
              Annuler la commande
            </Button>

            <p className="text-xs text-gray-400 text-center mt-3">
              Paiement sécurisé ·{' '}
              <Link href="/retractation" className="text-[#007bff] hover:underline">Droit de rétractation 14j</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
