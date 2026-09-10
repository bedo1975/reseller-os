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
  Upload, Loader2, Sparkles, Check, X, Download, RefreshCw, AlertCircle, Camera, ChevronRight, ShoppingBag, Shirt, Layers
} from 'lucide-react'
import { toast } from 'sonner'

interface Product {
  sku: string
  title?: string | null
  brand: string
  mainPhoto?: string | null
  photos: string[]
  price: number | null
  category?: string | null
  subcategory?: string | null
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

  // Client auth state — the try-on feature requires a logged-in boutique client
  const [client, setClient] = useState<{ firstName?: string; email?: string } | null>(null)
  const [clientChecked, setClientChecked] = useState(false)

  useEffect(() => {
    fetch('/api/boutique/client/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClient(data) })
      .catch(() => {})
      .finally(() => setClientChecked(true))
  }, [])

  // Client photo state
  const [clientPhotoPath, setClientPhotoPath] = useState<string | null>(null)
  const [clientPhotoUrl, setClientPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Category state — initialized with empty string for automatic detection
  const [category, setCategory] = useState<string>('')
  const [prompt, setPrompt] = useState<string>('')
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0)

  // Reset selected photo when product changes
  useEffect(() => {
    const photoParam = searchParams.get('photo')
    const idx = photoParam ? parseInt(photoParam, 10) : 0
    setSelectedPhotoIndex(Number.isNaN(idx) ? 0 : idx)
    setCategory('') // Réinitialise à la détection automatique pour chaque nouveau produit
    setResult(null)
    setError(null)
  }, [sku, searchParams])

  // Try-on state
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPromptUsed, setLastPromptUsed] = useState<string>('')

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
    setLastPromptUsed(prompt)
    try {
      const res = await fetch('/api/boutique/try-on', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientPhotoPath, 
          sku, 
          category: category || undefined, 
          prompt, 
          photoIndex: selectedPhotoIndex 
        }),
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

      {/* Loading client auth state */}
      {sku && !clientChecked && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Not logged in — show login prompt */}
      {sku && clientChecked && !client && (
        <div className="max-w-md mx-auto py-8">
          <div className="bg-white rounded-lg border border-purple-200 p-8 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-purple-100">
              <Sparkles className="h-8 w-8 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Connexion requise</h2>
            <p className="text-sm text-gray-600 mb-6">
              Pour utiliser l'essai virtuel, vous devez être connecté à votre compte client.
              Cela nous permet de protéger votre vie privée et de limiter l'usage du service.
            </p>
            <div className="flex flex-col gap-2">
              <Link
