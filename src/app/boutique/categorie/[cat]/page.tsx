'use client'

import { useState, useEffect, useMemo } from 'react'
import { use } from 'react'
import Link from 'next/link'
import { useFetch } from '@/hooks/use-fetch'
import { ProductCard } from '@/components/boutique/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { ChevronRight, ChevronDown, Package, Filter as FilterIcon, X } from 'lucide-react'

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

// Filter config shape (mirrors BoutiqueCategory.filtersJson)
interface CategoryFilterConfig {
  type: string
  label: string
  active: boolean
  collapsed: boolean
}

// Default filter fallback when a category has no filtersJson configured
const DEFAULT_FILTERS: CategoryFilterConfig[] = [
  { type: 'size', label: 'Taille', active: true, collapsed: false },
  { type: 'condition', label: 'État', active: true, collapsed: false },
]

function parseFilters(json: string | null | undefined): CategoryFilterConfig[] {
  try {
    const arr = JSON.parse(json || '[]')
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_FILTERS
    // Only keep entries that are marked active — but if none are active, fall back to defaults
    const normalized = arr
      .filter((x: any) => x && typeof x.type === 'string')
      .map((x: any) => ({
        type: String(x.type),
        label: (typeof x.label === 'string' && x.label) || x.type,
        active: !!x.active,
        collapsed: !!x.collapsed,
      }))
    const hasActive = normalized.some((f: CategoryFilterConfig) => f.active)
    return hasActive ? normalized : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

export default function CategoryPage({ params }: { params: Promise<{ cat: string }> }) {
  const { cat } = use(params)
  const [sort, setSort] = useState('newest')
  // Per-filter selection state — keyed by filter type ('size' | 'color' | 'condition' | 'brand')
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const [subcatFilter, setSubcatFilter] = useState<string>('all')
  const [categoryInfo, setCategoryInfo] = useState<{
    label: string
    emoji: string
    filtersJson?: string | null
  } | null>(null)
  const [subcats, setSubcats] = useState<Subcat[]>([])
  // Collapsed-state per filter section (UI only) — initialized from filtersJson on category change
  const [collapsedFilters, setCollapsedFilters] = useState<Set<string>>(new Set())

  // Fetch category tree to get labels + subcategories + filtersJson from DB
  useEffect(() => {
    fetch('/api/boutique/categories')
      .then(r => r.json())
      .then(data => {
        const found = (data.categories || []).find((c: any) => c.slug === cat)
        if (found) {
          setCategoryInfo({ label: found.label, emoji: found.emoji, filtersJson: found.filtersJson })
          setSubcats(found.subcategories || [])
        }
      })
      .catch(() => {})
  }, [cat])

  // Parse the filters config (falls back to size+condition if not configured)
  const filtersConfig = useMemo<CategoryFilterConfig[]>(
    () => parseFilters(categoryInfo?.filtersJson),
    [categoryInfo?.filtersJson],
  )
  const activeFilters = useMemo(
    () => filtersConfig.filter(f => f.active),
    [filtersConfig],
  )

  // Initialize collapsed state — ALL filters collapsed by default
  useEffect(() => {
    const allTypes = new Set<string>(['subcategory', ...filtersConfig.filter(f => f.active).map(f => f.type)])
    setCollapsedFilters(allTypes)
    setFilterValues({})
    setSubcatFilter('all')
  }, [filtersConfig])

  const { data, loading } = useFetch<{ products: Product[]; count: number }>(
    `/api/boutique/products?category=${cat}&sort=${sort}`
  )
  const allProducts = data?.products || []

  // Extract unique values per filter type from loaded products
  const availableValues = useMemo(() => {
    const out: Record<string, string[]> = { size: [], color: [], condition: [], brand: [] }
    const sets: Record<string, Set<string>> = { size: new Set(), color: new Set(), condition: new Set(), brand: new Set() }
    allProducts.forEach(p => {
      if (p.size) sets.size.add(p.size)
      if (p.color) sets.color.add(p.color)
      if (p.condition) sets.condition.add(p.condition)
      if (p.brand) sets.brand.add(p.brand)
    })
    for (const k of Object.keys(sets)) {
      out[k] = Array.from(sets[k]).sort()
    }
    return out
  }, [allProducts])

  // Apply filters client-side
  const products = useMemo(() => {
    return allProducts.filter(p => {
      if (filterValues.size && p.size !== filterValues.size) return false
      if (filterValues.color && p.color !== filterValues.color) return false
      if (filterValues.condition && p.condition !== filterValues.condition) return false
      if (filterValues.brand && p.brand !== filterValues.brand) return false
      if (subcatFilter !== 'all' && p.subcategory !== subcatFilter) return false
      return true
    })
  }, [allProducts, filterValues, subcatFilter])

  const hasActiveFilters =
    subcatFilter !== 'all' ||
    Object.values(filterValues).some(v => !!v)

  const setFilterValue = (type: string, value: string) => {
    setFilterValues(prev => {
      const next = { ...prev }
      if (!value) delete next[type]
      else next[type] = value
      return next
    })
  }

  const toggleCollapse = (type: string) => {
    setCollapsedFilters(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const resetFilters = () => {
    setFilterValues({})
    setSubcatFilter('all')
  }

  // Helper to render the list of options for a given filter type
  const renderFilterOptions = (f: CategoryFilterConfig) => {
    const values = availableValues[f.type] || []
    if (values.length === 0) return null
    const current = filterValues[f.type] || ''
    return (
      <div className="space-y-1">
        <button
          onClick={() => setFilterValue(f.type, '')}
          className={`block w-full text-left px-2 py-1 rounded text-sm ${!current ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          {f.type === 'condition' ? 'Tous les états' : f.type === 'size' ? 'Toutes les tailles' : f.type === 'color' ? 'Toutes les couleurs' : 'Toutes les marques'}
        </button>
        {values.map(v => (
          <button
            key={v}
            onClick={() => setFilterValue(f.type, v)}
            className={`block w-full text-left px-2 py-1 rounded text-sm ${current === v ? 'bg-blue-50 text-[#007bff] font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {f.type === 'condition' ? (CONDITION_LABELS[v] || v) : v}
          </button>
        ))}
      </div>
    )
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
            {categoryEmoji && categoryEmoji !== '📦' && <span className="mr-2">{categoryEmoji}</span>}
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
          <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                <FilterIcon className="h-4 w-4" /> Filtres
              </h3>
              {hasActiveFilters && (
                <button onClick={resetFilters} className="text-xs text-[#007bff] hover:underline">Effacer</button>
              )}
            </div>

            {/* Subcategory filter — collapsible, collapsed by default */}
            {subcats.length > 0 && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleCollapse('subcategory')}
                  className="flex items-center justify-between w-full text-left"
                >
                  <Label className="text-xs font-semibold text-gray-700 uppercase cursor-pointer">Sous-catégorie</Label>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${collapsedFilters.has('subcategory') ? '-rotate-90' : ''}`} />
                </button>
                {!collapsedFilters.has('subcategory') && (
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
                )}
              </div>
            )}

            {/* Dynamic collapsible filters from filtersJson */}
            {activeFilters.map(f => {
              const values = availableValues[f.type] || []
              if (values.length === 0) return null
              const isCollapsed = collapsedFilters.has(f.type)
              return (
                <div key={f.type} className="border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(f.type)}
                    className="flex items-center justify-between w-full text-left mb-2"
                  >
                    <Label className="text-xs font-semibold text-gray-700 uppercase cursor-pointer">
                      {f.label}
                    </Label>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                  {!isCollapsed && renderFilterOptions(f)}
                </div>
              )
            })}
          </div>
        </aside>

        {/* Products */}
        <div className="flex-1 min-w-0">
          {/* Mobile filters */}
          <div className="md:hidden mb-4 flex gap-2 flex-wrap">
            {activeFilters.map(f => {
              const values = availableValues[f.type] || []
              if (values.length === 0) return null
              return (
                <Select
                  key={f.type}
                  value={filterValues[f.type] || 'all'}
                  onValueChange={(v) => setFilterValue(f.type, v === 'all' ? '' : v)}
                >
                  <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder={f.label} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes / Tous</SelectItem>
                    {values.map(v => (
                      <SelectItem key={v} value={v}>
                        {f.type === 'condition' ? (CONDITION_LABELS[v] || v) : v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            })}
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
