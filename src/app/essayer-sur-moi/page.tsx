'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { useFetch } from '@/hooks/use-fetch'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import {
  Upload, Loader2, Sparkles, Check, X, Download, RefreshCw, AlertCircle, Camera, ChevronRight, ShoppingBag,
} from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  sku: string
  title?: string | null
  brand: string
  mainPhoto?: string | null
  photos: string[]
  price: number | null
}

export default function TryOnPage() {
  return (
    <Suspense fallback={<TryOnPageFallback />}>
      <TryOnPageContent />
    </Suspense>
  )
}

function TryOnPageFallback() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-purple-100">
          <Sparkles className="h-8 w-8 text-purple-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Essayer sur moi</h1>
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
      <div className="grid md:grid-cols-2 gap-8">
        <Skeleton className="aspect-[3/4] rounded-lg" />
        <Skeleton className="aspect-[3/4] rounded-lg" />
      </div>
    </div>
  )
}

function TryOnPageContent() {
  const searchParams = useSearchParams()
  const sku = searchParams.get('sku')
  const settings = useBoutiqueSettings()
  const primaryColor = '#' + settings.primaryColor

  // Fetch the product details (if SKU is provided)
  const { data: productData, loading: productLoading } = useFetch<{ product: Product }>(
    sku ? `/api/boutique/products/${sku}` : null
  )
  const product = productData?.product

  // Client photo state
  const [clientPhotoPath, setClientPhotoPath] = useState<string | null>(null)
  const [clientPhotoUrl, setClientPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category state
  const [category, setCategory] = useState<string>('upper_body')

  // Try-on state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop lourde (max 10 MB)')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('photo', file)

      const res = await fetch('/api/boutique/try-on/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur upload')
      }
      setClientPhotoPath(data.photoPath)
      setClientPhotoUrl(data.photoUrl)
      setResult(null)
      toast.success('Photo uploadée !')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const handleTransform = async () => {
    if (!clientPhotoPath || !sku) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/boutique/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientPhotoPath, sku, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur')
      }

      if (data.outputUrl) {
        setResult(data.outputUrl)
        toast.success('Transformation réussie !')
      } else if (data.predictionId) {
        toast.info('Transformation en cours...', {
          description: 'Cela peut prendre 30-60 secondes.'
        })
        const predictionId = data.predictionId
        // Poll every 5 seconds for up to 2 minutes
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 5000))
          const pollRes = await fetch(`/api/boutique/try-on/status?id=${predictionId}`)
          const pollData = await pollRes.json()
          if (pollData.status === 'succeeded' && pollData.outputUrl) {
            setResult(pollData.outputUrl)
            toast.success('Transformation réussie !')
            return
          }
          if (pollData.status === 'failed') {
            throw new Error(pollData.error || 'La transformation a échoué')
          }
        }
        throw new Error('Délai dépassé. Réessayez.')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur')
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setClientPhotoPath(null)
    setClientPhotoUrl(null)
    setResult(null)
    setError(null)
  }

  const handleDownload = async () => {
    if (!result) return
    try {
      const res = await fetch(result)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `essai-virtuel-${sku || 'tryon'}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erreur lors du téléchargement')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Essayer sur moi</span>
      </nav>

      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
             style={{ backgroundColor: primaryColor + '20' }}>
          <Sparkles className="h-8 w-8" style={{ color: primaryColor }} />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Essayer sur moi</h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Uploadez une photo de vous et voyez à quoi ressemblerait cet article porté.
          Votre photo sera <strong>automatiquement supprimée</strong> après 15 minutes.
        </p>
      </div>

      {/* No SKU state */}
      {!sku && (
        <div className="text-center py-12 bg-amber-50 rounded-lg border border-amber-200">
          <ShoppingBag className="h-12 w-12 text-amber-500 mx-auto mb-3" />
          <p className="text-gray-700 mb-2">Aucun produit sélectionné</p>
          <p className="text-sm text-gray-500 mb-4">
            Allez sur une fiche produit et cliquez sur « Essayer sur moi » pour commencer.
          </p>
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-[#007bff] hover:underline">
            Parcourir la boutique <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Product loading */}
      {sku && productLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Product not found */}
      {sku && !productLoading && !product && (
        <div className="text-center py-12 bg-red-50 rounded-lg border border-red-200">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-700 mb-2">Produit introuvable</p>
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-[#007bff] hover:underline">
            Retour à la boutique <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      {/* Main content */}
      {sku && product && (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: Product + Client photo */}
          <div className="space-y-4">
            {/* Product photo */}
            <div>
              <Label className="text-xs text-gray-500 uppercase mb-2 block">Article sélectionné</Label>
              <div className="flex gap-3 p-3 border rounded-lg bg-white">
                <div className="w-20 h-20 rounded-lg overflow-hidden border shrink-0 bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.mainPhoto || product.photos[0] || ''}
                    alt={product.brand}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.brand}</p>
                  <p className="text-xs text-gray-500 truncate">{product.title || 'Sans titre'}</p>
                  {product.price != null && (
                    <p className="text-sm font-bold mt-1">{product.price.toFixed(2)} €</p>
                  )}
                </div>
              </div>
            </div>

            {/* Client photo upload */}
            <div>
              <Label className="text-xs text-gray-500 uppercase mb-2 block">Votre photo *</Label>
              {clientPhotoUrl ? (
                <div className="relative">
                  <div className="w-full aspect-[3/4] max-w-[300px] rounded-lg overflow-hidden border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={clientPhotoUrl} alt="Vous" className="w-full h-full object-cover" />
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full"
                    title="Changer la photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragActive(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleUpload(file)
                  }}
                  className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    dragActive ? 'border-purple-400 bg-purple-50' : 'border-gray-300 hover:border-purple-400 hover:bg-purple-50/50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(file)
                    }}
                  />
                  {uploading ? (
                    <Loader2 className="h-10 w-10 animate-spin mx-auto text-purple-600" />
                  ) : (
                    <>
                      <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600 font-medium">
                        Cliquez ou glissez votre photo ici
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        JPG, PNG ou WebP — max 10 MB
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Photo en pied, face caméra, fond neutre de préférence
                      </p>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Category selector */}
            <div>
              <Label className="text-xs text-gray-500 uppercase mb-2 block">Type de vêtement</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="upper_body">Haut (t-shirt, veste, pull…)</option>
                <option value="lower_body">Bas (pantalon, jupe…)</option>
                <option value="dresses">Robe / Tenue complète</option>
              </select>
            </div>
          </div>

          {/* Right: Result */}
          <div className="space-y-4">
            <Label className="text-xs text-gray-500 uppercase mb-2 block">Résultat</Label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium mb-1">Erreur</p>
                  <p className="text-xs">{error}</p>
                </div>
              </div>
            )}

            {result ? (
              <div className="space-y-3">
                <div className="w-full aspect-[3/4] max-w-[300px] rounded-lg overflow-hidden border bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={result} alt="Résultat" className="w-full h-full object-cover" />
                </div>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <Check className="h-4 w-4" />
                  Transformation réussie !
                </p>
                <div className="flex gap-2">
                  <Button onClick={handleDownload} variant="outline" className="flex-1">
                    <Download className="h-4 w-4 mr-1" />
                    Télécharger
                  </Button>
                  <Button onClick={handleTransform} variant="outline" className="flex-1" disabled={loading || !clientPhotoPath}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refaire
                  </Button>
                </div>
              </div>
            ) : loading ? (
              <div className="w-full aspect-[3/4] max-w-[300px] rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 flex flex-col items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-purple-600 mb-3" />
                <p className="text-sm text-purple-700 font-medium">Transformation en cours...</p>
                <p className="text-xs text-purple-500 mt-1">30-60 secondes</p>
              </div>
            ) : clientPhotoUrl ? (
              <div className="w-full aspect-[3/4] max-w-[300px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center">
                <Camera className="h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 text-center px-4">
                  Cliquez sur « Transformer » pour voir le résultat
                </p>
              </div>
            ) : (
              <div className="w-full aspect-[3/4] max-w-[300px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center">
                <Sparkles className="h-10 w-10 text-gray-400 mb-2" />
                <p className="text-sm text-gray-500 text-center px-4">
                  Uploadez votre photo pour commencer
                </p>
              </div>
            )}

            {/* Transform button */}
            {!result && (
              <Button
                onClick={handleTransform}
                disabled={!clientPhotoPath || loading}
                className="w-full"
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-1" />
                )}
                {loading ? 'Transformation...' : 'Transformer'}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Privacy notice */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-xs text-blue-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>Confidentialité :</strong> votre photo est utilisée uniquement pour générer
            l'aperçu et est <strong>automatiquement supprimée de nos serveurs après 15 minutes</strong>.
            Nous ne stockons ni ne partageons vos photos.
          </span>
        </p>
      </div>
    </div>
  )
}
