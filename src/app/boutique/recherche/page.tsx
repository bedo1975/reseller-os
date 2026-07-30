'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, ChevronRight, Package } from 'lucide-react'
import { ProductCard } from '@/components/boutique/product-card'

function RechercheContent() {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!query) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/boutique/products?search=${encodeURIComponent(query)}&limit=100`)
      .then(r => r.json())
      .then(data => setProducts(data.products || []))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/boutique" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Recherche</span>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Search className="h-6 w-6 text-[#007bff]" />
          Résultats pour « {query} »
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Recherche en cours…' : `${products.length} produit${products.length > 1 ? 's' : ''} trouvé${products.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-lg" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Aucun produit trouvé pour « {query} »</p>
          <p className="text-sm text-gray-400 mb-6">Essayez avec d'autres mots-clés</p>
          <Link href="/boutique" className="inline-flex items-center gap-2 bg-[#007bff] text-white font-medium px-5 py-2 rounded-lg hover:bg-[#0056b3]">
            Voir tous les produits
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {products.map(p => <ProductCard key={p.sku} product={p} />)}
        </div>
      )}
    </div>
  )
}

export default function RecherchePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-6"><Skeleton className="h-64" /></div>}>
      <RechercheContent />
    </Suspense>
  )
}
