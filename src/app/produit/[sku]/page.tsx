'use client'

import { useState, useEffect } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFetch } from '@/hooks/use-fetch'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ShoppingCart, ChevronRight, Check, Package, Truck, Shield, RefreshCw, AlertCircle, Share2, BellRing, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ShareModal } from '@/components/boutique/share-modal'
import { ReviewsSection } from '@/components/boutique/reviews-section'

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
  grade?: string | null
  price: number | null
  originalPrice?: number | null
  saleActive?: boolean
  description?: string | null
  photos: string[]
  mainPhoto?: string | null
  measurements?: string | null
  weight?: number
  quantity?: number
  createdAt: string
  isLot?: boolean
  lotItems?: { brand: string; title?: string | null; size?: string | null; color?: string | null; quantity: number; unitPrice: number; photo?: string | null }[]
}

// Grade → couleur + libellé (Grade A = vert, B = jaune, C = orange)
const GRADE_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  A: { label: 'Grade A', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  B: { label: 'Grade B', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-400' },
  C: { label: 'Grade C', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
}

// Detect if the description is HTML (contains tags) or plain text.
// Plain text (e.g. "T-shirt en coton, lavable à 30°") is rendered with whitespace-pre-wrap.
// HTML (e.g. "<p>T-shirt <strong>en coton</strong></p>") is rendered with dangerouslySetInnerHTML.
function isDescriptionHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s)
}

export default function ProductPage({ params }: { params: Promise<{ sku: string }> }) {
  const { sku } = use(params)
  const router = useRouter()
  const settings = useBoutiqueSettings()
  const { data, loading } = useFetch<{ product: Product; variants?: { sku: string; size: string | null; color: string | null; quantity: number; inStock: boolean }[] }>(`/api/boutique/products/${sku}`)
  const [activePhoto, setActivePhoto] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [alertOpen, setAlertOpen] = useState(false)
  const [alertEmail, setAlertEmail] = useState('')
  const [alertSubmitting, setAlertSubmitting] = useState(false)
  const [alertDone, setAlertDone] = useState(false)

  const product = data?.product
  const variants = data?.variants || []
  const hasVariants = variants.length > 0

  // Collect unique sizes and colors from variants + current product
  const allVariantOptions = [
    { sku: product?.sku || '', size: product?.size || null, color: product?.color || null, quantity: product?.quantity || 0, inStock: (product?.quantity ?? 0) > 0 },
    ...variants,
  ]
  const uniqueSizes = Array.from(new Set(allVariantOptions.map(v => v.size).filter(Boolean)))
  const uniqueColors = Array.from(new Set(allVariantOptions.map(v => v.color).filter(Boolean)))

  useEffect(() => {
    setActivePhoto(0)
  }, [sku])

  const addToCart = () => {
    if (!product) return
    setAdding(true)
    try {
      const cart = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
      const maxQty = product.quantity || 1
      const existing = cart.find((i: any) => i.sku === product.sku)
      if (existing) {
        // Don't exceed stock quantity
        existing.qty = Math.min(existing.qty + 1, maxQty)
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
          maxQty: maxQty,
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
    setTimeout(() => router.push('/panier'), 500)
  }

  const submitAlert = async () => {
    if (!product) return
    const email = alertEmail.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide')
      return
    }
    setAlertSubmitting(true)
    try {
      const res = await fetch('/api/boutique/stock-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sku: product.sku }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data?.error || 'Erreur')
        return
      }
      setAlertDone(true)
      toast.success(data?.message || 'Merci ! Nous vous alerterons dès le retour en stock.')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setAlertSubmitting(false)
    }
  }

  const resetAlertModal = () => {
    setAlertOpen(false)
    // Slight delay so the modal closing animation doesn't show the form flipping back to "done"
    setTimeout(() => {
      setAlertDone(false)
      setAlertEmail('')
    }, 250)
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
        <Link href="/">
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
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={`/categorie/${product.category}`} className="hover:text-[#007bff]">
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

          {/* Badge Grade (cliquable vers la page explicative) */}
          {product.grade && GRADE_CONFIG[product.grade] && (
            <Link
              href="/grade"
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${GRADE_CONFIG[product.grade].bg} ${GRADE_CONFIG[product.grade].text} ${GRADE_CONFIG[product.grade].border} hover:opacity-80 transition-opacity mb-4`}
              title="En savoir plus sur nos grades"
            >
              <span className={`inline-block w-2 h-2 rounded-full ${GRADE_CONFIG[product.grade].dot}`} />
              {GRADE_CONFIG[product.grade].label}
            </Link>
          )}

          {product.price != null && (
            <div className="mb-6">
              {product.saleActive && product.originalPrice ? (
                <div className="flex items-center gap-3">
                  <p className="text-3xl font-bold text-red-600">
                    {product.price.toFixed(2)} €
                  </p>
                  <p className="text-xl text-gray-400 line-through">
                    {product.originalPrice.toFixed(2)} €
                  </p>
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase">
                    Promo
                  </span>
                </div>
              ) : (
                <p className="text-3xl font-bold text-[#007bff]">
                  {product.price.toFixed(2)} €
                </p>
              )}
            </div>
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
            {product.quantity != null && product.quantity > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Disponibilité</span>
                <span className="font-medium text-green-600">
                  {product.quantity > 1 ? `${product.quantity} en stock` : 'Dernier exemplaire !'}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Disponibilité</span>
                <span className="font-medium text-red-600">Non disponible actuellement</span>
              </div>
            )}

            {/* Variantes disponibles */}
            {hasVariants && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm font-semibold text-gray-700">Disponible en plusieurs déclinaisons :</p>
                {uniqueSizes.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500 mb-1 block">Tailles</span>
                    <div className="flex flex-wrap gap-2">
                      {uniqueSizes.map(s => {
                        const matching = allVariantOptions.find(v => v.size === s)
                        const inStock = matching?.inStock
                        return (
                          <Link
                            key={s}
                            href={`/produit/${matching?.sku || product.sku}`}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                              matching?.sku === product.sku
                                ? 'border-[#007bff] bg-blue-50 text-[#007bff]'
                                : inStock
                                ? 'border-gray-300 hover:border-[#007bff] hover:bg-blue-50 text-gray-700'
                                : 'border-gray-200 text-gray-400 line-through cursor-not-allowed'
                            }`}
                          >
                            {s}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
                {uniqueColors.length > 0 && (
                  <div>
                    <span className="text-xs text-gray-500 mb-1 block">Couleurs</span>
                    <div className="flex flex-wrap gap-2">
                      {uniqueColors.map(c => {
                        const matching = allVariantOptions.find(v => v.color === c)
                        const inStock = matching?.inStock
                        return (
                          <Link
                            key={c}
                            href={`/produit/${matching?.sku || product.sku}`}
                            className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${
                              matching?.sku === product.sku
                                ? 'border-[#007bff] bg-blue-50 text-[#007bff]'
                                : inStock
                                ? 'border-gray-300 hover:border-[#007bff] hover:bg-blue-50 text-gray-700'
                                : 'border-gray-200 text-gray-400 line-through cursor-not-allowed'
                            }`}
                          >
                            {c}
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase mb-2">Description</h2>
              {isDescriptionHtml(product.description) ? (
                <div
                  className="description-content text-sm text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: product.description }}
                />
              ) : (
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>
          )}

          {/* Contenu du lot */}
          {product.isLot && product.lotItems && product.lotItems.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase mb-3">Contenu du lot ({product.lotItems.length} articles)</h2>
              <div className="space-y-3">
                {product.lotItems.map((li: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50">
                    {/* Photo */}
                    <div className="h-14 w-14 rounded-md overflow-hidden bg-gray-200 shrink-0">
                      {li.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={li.photo} alt={li.brand} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-300">
                          <Package className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {li.brand} {li.title || ''}
                        {li.quantity > 1 && <span className="text-gray-500 ml-1">×{li.quantity}</span>}
                      </p>
                      <div className="flex flex-wrap gap-2 mt-0.5">
                        {li.size && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">
                            Taille {li.size}
                          </span>
                        )}
                        {li.color && (
                          <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
                            {li.color}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Prix unitaire */}
                    {li.unitPrice > 0 && (
                      <span className="text-sm text-gray-500 shrink-0">
                        {li.unitPrice.toFixed(2)} €
                      </span>
                    )}
                  </div>
                ))}
              </div>
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
          ) : product.quantity != null && product.quantity > 0 ? (
            <div className="flex gap-3 mb-3">
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
          ) : (
            <div className="mb-6 space-y-3">
              <div className="rounded-lg border border-red-300 bg-red-50 text-red-800 px-4 py-3 text-sm flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>
                  Cet article est actuellement en rupture de stock. Revenez bientôt !
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => { setAlertDone(false); setAlertOpen(true) }}
                className="w-full h-11 border-2 border-[#007bff] text-[#007bff] hover:bg-blue-50 gap-2"
              >
                <BellRing className="h-4 w-4" />
                M'alerter quand ce produit est de retour en stock
              </Button>
            </div>
          )}

          {/* Share with friends button */}
          {settings.shareEnabled !== false && (
            <div className="mb-6">
              <Button
                onClick={() => setShareOpen(true)}
                variant="outline"
                className="w-full h-10 border-2 gap-2"
                style={{
                  borderColor: settings.shareColor || '#007bff',
                  color: settings.shareColor || '#007bff',
                }}
              >
                <Share2 className="h-4 w-4" />
                {settings.shareButtonText || 'Partager cet article'}
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

      {/* Reviews section */}
      {product && <ReviewsSection sku={product.sku} />}

      {/* Share modal */}
      {product && (
        <ShareModal
          open={shareOpen}
          onOpenChange={setShareOpen}
          product={{
            sku: product.sku,
            brand: product.brand,
            title: product.title,
            mainPhoto: product.mainPhoto,
            price: product.price,
          }}
          settings={{
            shareColor: settings.shareColor || '#007bff',
            shareButtonText: settings.shareButtonText || 'Partager cet article',
            shareCollectEmails: settings.shareCollectEmails !== false,
          }}
        />
      )}

      {/* Back-in-stock alert modal */}
      {product && (
        <Dialog open={alertOpen} onOpenChange={(o) => { if (!o) resetAlertModal() }}>
          <DialogContent className="max-w-md">
            {alertDone ? (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="flex items-center justify-center h-8 w-8 rounded-full bg-emerald-100 text-emerald-600">
                      <Check className="h-5 w-5" />
                    </span>
                    C'est noté !
                  </DialogTitle>
                  <DialogDescription>
                    Nous avons bien enregistré votre demande. Dès que <strong>{product.brand}{product.title ? ` ${product.title}` : ''}</strong> sera de retour en stock, vous recevrez un email à l'adresse <strong className="break-all">{alertEmail.trim().toLowerCase()}</strong>.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-800">
                  💡 Astuce : ajoutez notre email à vos contacts pour éviter qu'il ne finisse dans les spams.
                </div>
                <DialogFooter>
                  <Button onClick={resetAlertModal} className="bg-[#007bff] hover:bg-[#0056b3]">
                    Fermer
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <BellRing className="h-5 w-5 text-[#007bff]" />
                    M'alerter quand ce produit est de retour en stock
                  </DialogTitle>
                  <DialogDescription>
                    Laissez votre adresse email : nous vous préviendrons dès que <strong>{product.brand}{product.title ? ` ${product.title}` : ''}</strong> sera à nouveau disponible.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 py-2">
                  <Input
                    type="email"
                    placeholder="Votre adresse email"
                    value={alertEmail}
                    onChange={e => setAlertEmail(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !alertSubmitting) submitAlert() }}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    En soumettant ce formulaire, vous acceptez de recevoir un email unique de notification de retour en stock. Votre email ne sera pas utilisé à d'autres fins.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={resetAlertModal}>Annuler</Button>
                  <Button
                    onClick={submitAlert}
                    disabled={alertSubmitting || !alertEmail.trim()}
                    className="bg-[#007bff] hover:bg-[#0056b3]"
                  >
                    {alertSubmitting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enregistrement…</>
                      : <><BellRing className="h-4 w-4 mr-2" /> M'alerter</>
                    }
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
