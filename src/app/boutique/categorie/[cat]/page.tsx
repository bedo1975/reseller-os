'use client'

import { useState, useEffect, useMemo } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useFetch } from '@/hooks/use-fetch'
import { ProductCard } from '@/components/boutique/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ChevronRight, Package, Filter, X } from 'lucide-react'

const CONDITION_LABELS: Record<string, string> = {
  'neuf': 'Neuf avec étiquette',
  'tres-bon': 'Très bon état',
  'bon': 'Bon état',
  'correct': 'État correct',
}

interface Subcat { slug: string; label: string }

interface Product {
  sku: string
  brand: string
  category: string
  subcategory?: string | null
  size?: string | null
  color?: string | null
  condition?: string | null
  price: number | null
  mainPhoto?: string | null
  quantity?: number
}

export default function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = use(params)
  const [sort, setSort] = useState('newest')
  const [sizeFilter, setSizeFilter] = useState<string>('all')
  const [conditionFilter, setConditionFilter] = useState<string>('all')
  const [subcatFilter, setSubcatFilter] = useState<string>('all')
  const [categoryInfo, setCategoryInfo] = useState<{ label: string; emoji: string } | null>(null)
  const [subcats, setSubcats] = useState<Subcat[]>([])

  // Fetch category tree to get labels + subcategories from DB
  useEffect(() => {
    fetch('/api/boutique/categories')
      .then(r => r.json())
      .then(data => {
        const found = (data.categories || []).find((c: any) => c.slug === cat)
        if (found) {
          setCategoryInfo({ label: found.label, emoji: found.emoji })
          setSubcats(found.subcategories || [])
        }
      })
      .catch(() => {})
  }, [cat])

  const { data, loading } = useFetch<{ products: Product[]; count: number }>(
    `/api/boutique/products?category=${cat}&sort=${sort}`
  )
  const allProducts = data?.products || []

  // Extract unique sizes and conditions from products
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>()
    allProducts.forEach(p => { if (p.size) sizes.add(p.size) })
    return Array.from(sizes).sort()
  }, [allProducts])

  const availableConditions = useMemo(() => {
    const conditions = new Set<string>()
    allProducts.forEach(p => { if (p.condition) conditions.add(p.condition) })
    return Array.from(conditions)
  }, [allProducts])

  // Apply filters client-side
  const products = useMemo(() => {
    return allProducts.filter(p => {
      if (sizeFilter !== 'all' && p.size !== sizeFilter) return false
      if (conditionFilter !== 'all' && p.condition !== conditionFilter) return false
      if (subcatFilter !== 'all' && p.subcategory !== subcatFilter) return false
      return true
    })
  }, [allProducts, sizeFilter, conditionFilter, subcatFilter])

  const hasActiveFilters = sizeFilter !== 'all' || conditionFilter !== 'all' || subcatFilter !== 'all'

  const resetFilters = () => {
    setSizeFilter('all')
    setConditionFilter('all')
    setSubcatFilter('all')
  }

  const categoryLabel = categoryInfo?.label || cat
  const categoryEmoji = categoryInfo?.emoji || ''

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6 flex-wrap">
        <Link href="/boutique" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">{categoryLabel}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {categoryEmoji && <span className="mr-2">{categoryEmoji}</span>}
            {categoryLabel}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Chargement...' : `${products.length} article(s) disponible(s)`}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[10px] text-gray-500 uppercase">Trier par</Label>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Plus récents</SelectItem>
              <SelectItem value="price-asc">Prix croissant</SelectItem>
              <SelectItem value="price-desc">Prix décroissant</SelectItem>
              <SelectItem value="brand">Marque (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className="hidden md:block w-56 shrink-0 space-y-5">
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <Filter className="h-4 w-4" /> Filtres
              </h3>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-xs text-[#007bff] hover:underline">Effacer</button>
              )}
            </div>

            {/* Subcategory filter */}
            {subcats.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700 uppercase">Sous-catégorie</Label>
                <div className="space-y-1">
                  <button
                    onClick={() => setSubcatFilter('all')}
                    className={`block w-full text-left px-2 py-1 rounded text-sm ${subcatFilter === 'all' ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Toutes
                  </button>
                  {subcats.map(s => (
                    <button
                      key={s.slug}
                      onClick={() => setSubcatFilter(s.slug)}
                      className={`block w-full text-left px-2 py-1 rounded text-sm ${subcatFilter === s.slug ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Size filter */}
            {availableSizes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700 uppercase">Taille</Label>
                <div className="space-y-1">
                  <button
                    onClick={() => setSizeFilter('all')}
                    className={`block w-full text-left px-2 py-1 rounded text-sm ${sizeFilter === 'all' ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Toutes les tailles
                  </button>
                  {availableSizes.map(s => (
                    <button
                      key={s}
                      onClick={() => setSizeFilter(s)}
                      className={`block w-full text-left px-2 py-1 rounded text-sm ${sizeFilter === s ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Condition filter */}
            {availableConditions.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-gray-700 uppercase">État</Label>
                <div className="space-y-1">
                  <button
                    onClick={() => setConditionFilter('all')}
                    className={`block w-full text-left px-2 py-1 rounded text-sm ${conditionFilter === 'all' ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    Tous les états
                  </button>
                  {availableConditions.map(c => (
                    <button
                      key={c}
                      onClick={() => setConditionFilter(c)}
                      className={`block w-full text-left px-2 py-1 rounded text-sm ${conditionFilter === c ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {CONDITION_LABELS[c] || c}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1 min-w-0">
          {/* Mobile filters */}
          <div className="md:hidden mb-4 flex gap-2 flex-wrap">
            {availableSizes.length > 0 && (
              <Select value={sizeFilter} onValueChange={setSizeFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Taille" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes tailles</SelectItem>
                  {availableSizes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {availableConditions.length > 0 && (
              <Select value={conditionFilter} onValueChange={setConditionFilter}>
                <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="État" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous états</SelectItem>
                  {availableConditions.map(c => <SelectItem key={c} value={c}>{CONDITION_LABELS[c] || c}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {hasActiveFilters && (
              <button onClick={resetFilters} className="text-xs text-[#007bff] flex items-center gap-1 px-2">
                <X className="h-3 w-3" /> Effacer
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">{hasActiveFilters ? 'Aucun article ne correspond à vos filtres' : 'Aucun article disponible dans cette catégorie'}</p>
              {hasActiveFilters ? (
                <button onClick={resetFilters} className="text-sm text-[#007bff] hover:underline">Réinitialiser les filtres</button>
              ) : (
                <Link href="/boutique" className="text-sm text-[#007bff] hover:underline">← Retour à la boutique</Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map(p => (
                <ProductCard key={p.sku} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
