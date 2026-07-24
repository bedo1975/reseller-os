'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ShoppingCart, ChevronRight, Check, Package, Truck, Shield, RefreshCw, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

const CONDITION_LABELS: Record<string, string> = {
  'neuf': 'Neuf avec étiquette',
  'tres-bon': 'Très bon état',
  'bon': 'Bon état',
  'correct': 'État correct',
}

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  accessoires: 'Accessoires',
  luxe: 'Luxe',
  maison: 'Maison',
}

interface Product {
  sku: string
  title?: string | null
  brand: string
  category: string
  size?: string | null
  color?: string | null
  condition?: string | null
  price: number | null
  description?: string | null
  photos: string[]
  mainPhoto?: string | null
  measurements?: string | null
  weight?: number
  quantity?: number
  createdAt: string
}

export default function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = use(params)
  const router = useRouter()
  const settings = useBoutiqueSettings()
  const { data, loading } = useFetch<{ product: Product }>(`/api/boutique/products/${sku}`)
  const [activePhoto, setActivePhoto] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [adding, setAdding] = useState(false)

  const product = data?.product

  useEffect(() => {
    setActivePhoto(0)
  }, [sku])

  const addToCart = () => {
    if (!product) return
    setAdding(true)
    try {
      const cart = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
      const existing = cart.find((i: any) => i.sku === product.sku)
      if (existing) {
        existing.qty += 1
      } else {
        cart.push({
          sku: product.sku,
          brand: product.brand,
          category: product.category,
          size: product.size,
          color: product.color,
          price: product.price,
          mainPhoto: product.mainPhoto,
          qty: 1,
        })
      }
      localStorage.setItem('boutique_cart', JSON.stringify(cart))
      window.dispatchEvent(new Event('cart-updated'))
      toast.success('Ajouté au panier')
      setTimeout(() => setAdding(false), 800)
    } catch {
      toast.error('Erreur')
      setAdding(false)
    }
  }

  const buyNow = () => {
    addToCart()
    setTimeout(() => router.push('/boutique/panier'), 500)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Produit introuvable</h1>
        <p className="text-gray-500 mb-6">Ce produit n'est plus disponible ou n'existe pas.</p>
        <Link href="/boutique">
          <Button>Retour à la boutique</Button>
        </Link>
      </div>
    )
  }

  const photos = product.photos.length > 0 ? product.photos : ['/placeholder.jpg']

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/boutique" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/boutique/categorie/${product.category}`} className="hover:text-[#007bff]">
          {CATEGORY_LABELS[product.category] || product.category}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900 truncate">
          {product.title && `${product.title} · `}
          {product.brand}
          {product.size && ` · ${product.size}`}
        </span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Gallery */}
        <div className="flex gap-3">
          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="flex flex-col gap-2 w-16 shrink-0">
              {photos.map((p, i) => (
                <button
                  key={i}
                  onClick={() => setActivePhoto(i)}
                  className={`aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                    i === activePhoto ? 'border-[#007bff]' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Main image */}
          <div className="flex-1">
            <div
              className="aspect-square bg-gray-50 rounded-lg overflow-hidden relative cursor-zoom-in"
              onMouseEnter={() => setZoomed(true)}
              onMouseLeave={() => setZoomed(false)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const x = ((e.clientX - rect.left) / rect.width) * 100
                const y = ((e.clientY - rect.top) / rect.height) * 100
                e.currentTarget.style.setProperty('--zoom-x', `${x}%`)
                e.currentTarget.style.setProperty('--zoom-y', `${y}%`)
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photos[activePhoto]}
                alt={product.title || `${product.brand} ${product.category}`}
                className="w-full h-full object-cover transition-transform duration-200"
                style={zoomed ? {
                  transform: 'scale(2)',
                  transformOrigin: 'var(--zoom-x) var(--zoom-y)',
                } : undefined}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">Survolez pour zoomer</p>
          </div>
        </div>

        {/* Info */}
        <div>
          <p className="text-xs text-[#007bff] font-semibold uppercase tracking-wider mb-2">
            {product.brand}
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mb-3">
            {product.title || (CATEGORY_LABELS[product.category] || product.category)}
            {product.size && ` · Taille ${product.size}`}
          </h1>

          {product.price != null && (
            <p className="text-3xl font-bold text-[#007bff] mb-6">
              {product.price.toFixed(2)} €
            </p>
          )}

          {/* Attributes */}
          <div className="space-y-2 mb-6 pb-6 border-b border-gray-200">
            {product.condition && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">État</span>
                <span className="font-medium text-gray-900">{CONDITION_LABELS[product.condition] || product.condition}</span>
              </div>
            )}
            {product.color && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Couleur</span>
                <span className="font-medium text-gray-900">{product.color}</span>
              </div>
            )}
            {product.size && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Taille</span>
                <span className="font-medium text-gray-900">{product.size}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Référence</span>
              <span className="font-mono text-xs text-gray-700">{product.sku}</span>
            </div>
            {product.quantity != null && product.quantity > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Disponibilité</span>
                <span className="font-medium text-green-600">
                  {product.quantity > 1 ? `${product.quantity} en stock` : 'Dernier exemplaire !'}
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase mb-2">Description</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {product.description}
              </p>
            </div>
          )}

          {/* Actions */}
          {settings.boutiqueClosed === true ? (
            <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-4 py-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span className="whitespace-pre-wrap">
                {settings.boutiqueClosedMessage || 'La boutique est temporairement fermée. Revenez bientôt !'}
              </span>
            </div>
          ) : (
            <div className="flex gap-3 mb-6">
              <Button
                onClick={addToCart}
                disabled={adding}
                className="flex-1 h-12 bg-white border-2 border-[#007bff] text-[#007bff] hover:bg-blue-50"
              >
                {adding ? <><Check className="h-5 w-5 mr-2" /> Ajouté !</> : <><ShoppingCart className="h-5 w-5 mr-2" /> Ajouter au panier</>}
              </Button>
              <Button
                onClick={buyNow}
                className="flex-1 h-12 bg-[#007bff] hover:bg-[#0056b3]"
              >
                Acheter maintenant
              </Button>
            </div>
          )}

          {/* Reassurance */}
          <div className="space-y-3 pt-6 border-t border-gray-200">
            <div className="flex items-center gap-3 text-sm">
              <Truck className="h-5 w-5 text-[#007bff] shrink-0" />
              <span className="text-gray-700">Expédition sous 48h · Livraison 3-5 jours</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <RefreshCw className="h-5 w-5 text-[#007bff] shrink-0" />
              <span className="text-gray-700">Retour gratuit sous 14 jours</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Shield className="h-5 w-5 text-[#007bff] shrink-0" />
              <span className="text-gray-700">Paiement sécurisé</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
