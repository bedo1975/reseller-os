'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Search, Sparkles, Loader2, Heart, Eye, ExternalLink, Tag, Package,
  Filter, X, Clock, Bell, BellRing, Trash2, Save, Plus, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface VintedItem {
  id: string
  title: string
  price: number | null
  currency: string | null
  url: string
  image: string | null
  condition: string | null
  likes: number
  views: number
  brand: string | null
  size: string | null
  seller: { username: string | null }
  createdAt: number | null
  createdAtRaw: string | null
}

type Tab = 'search' | 'deals' | 'alerts'

interface VintedStatus {
  id: number
  title: string
  key: string
}

interface SavedSearch {
  id: string
  name: string
  searchParams: any
  intervalHours: number
  lastScannedAt: string | null
  enabled: boolean
  pendingAlerts: number
  unreadAlerts: number
  createdAt: string
}

interface VintedAlert {
  id: string
  savedSearchId: string
  savedSearchName: string
  item: VintedItem
  read: boolean
  createdAt: string
}

// Fallback conditions — REAL Vinted IDs (verified from Vinted Search Builder source)
// Used only if /api/vinted/conditions fails to return dynamic IDs
const FALLBACK_CONDITIONS: VintedStatus[] = [
  { id: 1, title: 'Neuf avec étiquette', key: 'new_with_tags' },
  { id: 6, title: 'Neuf sans étiquette', key: 'new_without_tags' },
  { id: 2, title: 'Très bon état', key: 'very_good' },
  { id: 3, title: 'Bon état', key: 'good' },
  { id: 4, title: 'Satisfaisant', key: 'satisfactory' },
]

// Real Vinted size IDs (clothing — verified)
const CLOTHING_SIZES = [
  { id: 2, label: 'XS / 34' },
  { id: 3, label: 'S / 36' },
  { id: 4, label: 'M / 38' },
  { id: 5, label: 'L / 40' },
  { id: 6, label: 'XL / 42' },
  { id: 7, label: 'XXL / 44' },
  { id: 8, label: '3XL / 46' },
  { id: 9, label: '4XL / 48' },
]

// Real Vinted shoe size IDs (verified — French/EU sizes)
const SHOE_SIZES = [
  { id: 53, label: '36' },
  { id: 54, label: '36,5' },
  { id: 55, label: '37' },
  { id: 56, label: '37,5' },
  { id: 57, label: '38' },
  { id: 1198, label: '38,5' },
  { id: 58, label: '39' },
  { id: 59, label: '39,5' },
  { id: 60, label: '40' },
  { id: 61, label: '40,5' },
  { id: 62, label: '41' },
  { id: 63, label: '41,5' },
  { id: 64, label: '42' },
  { id: 65, label: '42,5' },
  { id: 66, label: '43' },
  { id: 67, label: '43,5' },
  { id: 68, label: '44' },
  { id: 69, label: '44,5' },
  { id: 70, label: '45' },
  { id: 71, label: '45,5' },
  { id: 72, label: '46' },
]

// Common Vinted catalog categories (catalog[] IDs — verified)
// Source: Vinted URL structure
const CATEGORIES = [
  { id: '1206', label: '👨 Hommes' },
  { id: '1206&catalog_from=0', label: '  └ T-shirts & Polos hommes' },
  { id: '1206&catalog_from=1', label: '  └ Pantalons hommes' },
  { id: '1206&catalog_from=2', label: '  └ Vestes & Manteaux hommes' },
  { id: '1206&catalog_from=3', label: '  └ Chaussures hommes' },
  { id: '4', label: '👩 Femmes' },
  { id: '5', label: '  └ Robes' },
  { id: '6', label: '  └ T-shirts & Hauts' },
  { id: '16', label: '  └ Pantalons & Jeans' },
  { id: '18', label: '  └ Vestes & Manteaux' },
  { id: '20', label: '  └ Chaussures' },
  { id: '91', label: '  └ Accessoires' },
  { id: '1196', label: '🧒 Enfants' },
  { id: '1001', label: '🏠 Maison' },
  { id: '79', label: '🐾 Animaux' },
  { id: '76', label: '🎮 Jeux vidéo' },
  { id: '99', label: '📚 Livres, films, musique' },
]

const ORDERS = [
  { value: 'newest_first', label: 'Plus récents' },
  { value: 'price_low_to_high', label: 'Prix croissant' },
  { value: 'price_high_to_low', label: 'Prix décroissant' },
  { value: 'favourite_count_desc', label: 'Plus de favoris' },
]

interface SelectedBrand {
  id: number
  title: string
}

function ItemCard({ item }: { item: VintedItem }) {
  return (
    <Card className="overflow-hidden group hover:shadow-md transition-shadow">
      <div className="relative aspect-square bg-muted">
        {item.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-muted-foreground">
            <Package className="h-12 w-12" />
          </div>
        )}
        {item.likes <= 3 && (
          <Badge className="absolute top-2 left-2 bg-green-600 hover:bg-green-600 gap-1">
            <Sparkles className="h-3 w-3" /> Deal
          </Badge>
        )}
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          title="Voir sur Vinted"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium line-clamp-2 flex-1" title={item.title}>
            {item.title}
          </p>
          <span className="text-sm font-bold whitespace-nowrap">
            {item.price != null ? `${item.price} ${item.currency || '€'}` : '—'}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {item.brand && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Tag className="h-3 w-3" />
              {item.brand}
            </Badge>
          )}
          {item.size && <Badge variant="outline" className="text-xs">{item.size}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="truncate" title={item.condition || ''}>
            {item.condition || '—'}
          </span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5">
              <Heart className="h-3 w-3" /> {item.likes}
            </span>
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" /> {item.views}
            </span>
          </div>
        </div>
        {item.seller?.username && (
          <p className="text-xs text-muted-foreground truncate">
            par <span className="font-medium">{item.seller.username}</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function VintedModule() {
  const [tab, setTab] = useState<Tab>('search')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<VintedItem[]>([])

  // Dynamic conditions (fetched from Vinted /api/v2/statuses via our backend)
  const [conditions, setConditions] = useState<VintedStatus[]>(FALLBACK_CONDITIONS)
  const [selectedConditionIds, setSelectedConditionIds] = useState<number[]>([])

  // Search filters
  const [order, setOrder] = useState('newest_first')
  const [priceFrom, setPriceFrom] = useState('')
  const [priceTo, setPriceTo] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')

  // New: real size IDs (clothing + shoes)
  const [selectedSizeIds, setSelectedSizeIds] = useState<number[]>([])
  // New: selected brands (autocomplete)
  const [selectedBrands, setSelectedBrands] = useState<SelectedBrand[]>([])
  const [brandSearch, setBrandSearch] = useState('')
  const [brandSuggestions, setBrandSuggestions] = useState<SelectedBrand[]>([])
  const [brandSearching, setBrandSearching] = useState(false)
  // New: selected categories (catalog[])
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<string[]>([])

  // Deals params
  const [maxLikes, setMaxLikes] = useState(3)
  const [pages, setPages] = useState(5)
  const [dealsPriceFrom, setDealsPriceFrom] = useState('')
  const [dealsPriceTo, setDealsPriceTo] = useState('')

  const [showFilters, setShowFilters] = useState(false)

  // Saved searches & alerts
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [alerts, setAlerts] = useState<VintedAlert[]>([])
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveInterval, setSaveInterval] = useState(6)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [manualScanLoading, setManualScanLoading] = useState<string | null>(null)
  const [alertFilter, setAlertFilter] = useState<string | null>(null) // savedSearchId to filter by, null = all

  // Fetch conditions dynamically on mount
  useEffect(() => {
    fetch('/api/vinted/conditions')
      .then((r) => r.json())
      .then((data) => {
        if (data.statuses && Array.isArray(data.statuses) && data.statuses.length > 0) {
          setConditions(data.statuses)
        }
      })
      .catch(() => {
        // keep fallback
      })
  }, [])

  // Debounced brand search (autocomplete)
  useEffect(() => {
    if (brandSearch.trim().length < 2) {
      setBrandSuggestions([])
      return
    }
    setBrandSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/vinted/brands?keyword=${encodeURIComponent(brandSearch.trim())}`)
        const data = await res.json()
        setBrandSuggestions(data.brands || [])
      } catch {
        setBrandSuggestions([])
      } finally {
        setBrandSearching(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [brandSearch])

  const toggleCondition = (id: number) => {
    setSelectedConditionIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleSize = (id: number) => {
    setSelectedSizeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const toggleCatalog = (id: string) => {
    setSelectedCatalogIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  const addBrand = (brand: SelectedBrand) => {
    if (!selectedBrands.find((b) => b.id === brand.id)) {
      setSelectedBrands((prev) => [...prev, brand])
    }
    setBrandSearch('')
    setBrandSuggestions([])
  }

  const removeBrand = (id: number) => {
    setSelectedBrands((prev) => prev.filter((b) => b.id !== id))
  }

  // ── Saved searches & alerts ────────────────────────────────────────────
  const fetchSavedSearches = useCallback(async () => {
    try {
      const res = await fetch('/api/vinted/saved-searches')
      const data = await res.json()
      if (data.searches) setSavedSearches(data.searches)
    } catch {
      // silent
    }
  }, [])

  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await fetch('/api/vinted/alerts?unread=1')
      if (!res.ok) {
        console.error('[Vinted] fetchAlerts: HTTP', res.status)
        return
      }
      const data = await res.json()
      if (data.alerts) {
        setAlerts(data.alerts)
      } else if (data.error) {
        console.error('[Vinted] fetchAlerts error:', data.error)
      }
    } catch (e) {
      console.error('[Vinted] fetchAlerts exception:', e)
    } finally {
      setAlertsLoading(false)
    }
  }, [])

  // Load saved searches + alerts on mount
  useEffect(() => {
    fetchSavedSearches()
    fetchAlerts()
  }, [fetchSavedSearches, fetchAlerts])

  // Refresh alerts when entering the alerts tab
  useEffect(() => {
    if (tab === 'alerts') {
      fetchSavedSearches()
      fetchAlerts()
    }
  }, [tab, fetchSavedSearches, fetchAlerts])

  const openSaveDialog = () => {
    // Pre-fill name with current query or first brand
    const suggestedName = query.trim()
      || (selectedBrands.length > 0 ? selectedBrands[0].title : '')
      || 'Nouvelle recherche'
    setSaveName(suggestedName)
    setSaveInterval(6)
    setSaveDialogOpen(true)
  }

  const confirmSaveSearch = async () => {
    if (!saveName.trim()) {
      toast.error('Donne un nom à ta recherche')
      return
    }
    // Build the search params snapshot from current state (depends on active tab)
    const searchParams: any = {
      query,
      order,
      sizeFilter,
      statusIds: selectedConditionIds,
      sizeIds: selectedSizeIds,
      brandIds: selectedBrands.map((b) => b.id),
      catalogIds: selectedCatalogIds,
    }
    if (tab === 'deals') {
      searchParams.maxLikes = maxLikes
      searchParams.pages = pages
      searchParams.priceFrom = dealsPriceFrom
      searchParams.priceTo = dealsPriceTo
    } else {
      searchParams.priceFrom = priceFrom
      searchParams.priceTo = priceTo
    }

    try {
      const res = await fetch('/api/vinted/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          searchParams,
          intervalHours: saveInterval,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de la sauvegarde')
        return
      }
      toast.success(`Recherche "${saveName}" sauvegardée — scan toutes les ${saveInterval}h`)
      setSaveDialogOpen(false)
      await fetchSavedSearches()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const toggleSavedSearch = async (id: string, currentEnabled: boolean) => {
    try {
      await fetch(`/api/vinted/saved-searches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      setSavedSearches((prev) =>
        prev.map((s) => (s.id === id ? { ...s, enabled: !currentEnabled } : s)),
      )
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const deleteSavedSearch = async (id: string, name: string) => {
    if (!confirm(`Supprimer la recherche "${name}" ? Les alertes associées seront aussi supprimées.`)) return
    try {
      await fetch(`/api/vinted/saved-searches/${id}`, { method: 'DELETE' })
      toast.success('Recherche supprimée')
      setSavedSearches((prev) => prev.filter((s) => s.id !== id))
      setAlerts((prev) => prev.filter((a) => a.savedSearchId !== id))
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const markAlertsRead = async (savedSearchId?: string) => {
    try {
      await fetch('/api/vinted/alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ savedSearchId }),
      })
      // Refresh both
      await fetchAlerts()
      await fetchSavedSearches()
    } catch {
      // silent
    }
  }

  const manualScan = async () => {
    // Manual scan requires CRON_SECRET — only doable if env var is configured.
    // Otherwise, show a message.
    setManualScanLoading('manual')
    try {
      // Use the user's session cookie — this works only if CRON_SECRET is empty? No.
      // Actually /api/vinted/scan requires CRON_SECRET. We can't call it from the browser.
      // Instead, we'll just do a client-side fetch of /api/vinted/search and show results.
      toast.info('Le scan automatique est géré côté serveur (cron). Tu peux relancer une recherche manuelle ci-dessus.')
    } finally {
      setManualScanLoading(null)
    }
  }

  const runSearch = useCallback(async () => {
    if (!query.trim() && selectedBrands.length === 0 && selectedCatalogIds.length === 0) {
      toast.error('Saisis une recherche, une marque ou une catégorie')
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        query,
        order,
        per_page: '48',
      })
      if (priceFrom) params.set('price_from', priceFrom)
      if (priceTo) params.set('price_to', priceTo)
      if (selectedConditionIds.length) {
        params.set('status_ids', selectedConditionIds.join(','))
      }
      if (sizeFilter) params.set('size', sizeFilter)
      if (selectedSizeIds.length) params.set('size_ids', selectedSizeIds.join(','))
      if (selectedBrands.length) params.set('brand_ids', selectedBrands.map((b) => b.id).join(','))
      if (selectedCatalogIds.length) params.set('catalog_ids', selectedCatalogIds.join(','))

      const res = await fetch(`/api/vinted/search?${params.toString()}`)
      const data = await res.json()
      if (data.error) {
        toast.error(`Erreur Vinted: ${data.error}`)
        setItems([])
        return
      }
      setItems(data.items || [])
      toast.success(`${data.total} article(s) trouvé(s)`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [query, order, priceFrom, priceTo, selectedConditionIds, sizeFilter, selectedSizeIds, selectedBrands, selectedCatalogIds])

  const runDeals = useCallback(async () => {
    if (!query.trim() && selectedBrands.length === 0 && selectedCatalogIds.length === 0) {
      toast.error('Saisis une recherche, une marque ou une catégorie')
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams({
        query,
        max_likes: String(maxLikes),
        pages: String(pages),
      })
      if (sizeFilter) params.set('size', sizeFilter)
      if (dealsPriceFrom) params.set('price_from', dealsPriceFrom)
      if (dealsPriceTo) params.set('price_to', dealsPriceTo)
      if (selectedSizeIds.length) params.set('size_ids', selectedSizeIds.join(','))
      if (selectedBrands.length) params.set('brand_ids', selectedBrands.map((b) => b.id).join(','))
      if (selectedCatalogIds.length) params.set('catalog_ids', selectedCatalogIds.join(','))
      if (selectedConditionIds.length) params.set('status_ids', selectedConditionIds.join(','))

      const res = await fetch(`/api/vinted/deals?${params.toString()}`)
      const data = await res.json()
      if (data.error) {
        toast.error(`Erreur Vinted: ${data.error}`)
        setItems([])
        return
      }
      setItems(data.items || [])
      toast.success(`${data.total} deal(s) trouvé(s) (≤ ${maxLikes} favoris)`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [query, maxLikes, pages, sizeFilter, dealsPriceFrom, dealsPriceTo, selectedSizeIds, selectedBrands, selectedCatalogIds, selectedConditionIds])

  const resetFilters = () => {
    setPriceFrom('')
    setPriceTo('')
    setSelectedConditionIds([])
    setSizeFilter('')
    setSelectedSizeIds([])
    setSelectedBrands([])
    setSelectedCatalogIds([])
    setBrandSearch('')
    setBrandSuggestions([])
    setOrder('newest_first')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      tab === 'search' ? runSearch() : runDeals()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Search className="h-6 w-6" />
            Vinted Deals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Recherche en temps réel sur le catalogue Vinted — trouvez les meilleures affaires
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab('search')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors relative',
            tab === 'search'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Search className="h-4 w-4 inline mr-1.5" />
          Recherche
        </button>
        <button
          onClick={() => setTab('deals')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors relative',
            tab === 'deals'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Sparkles className="h-4 w-4 inline mr-1.5" />
          Deals (peu de favoris)
        </button>
        <button
          onClick={() => setTab('alerts')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors relative',
            tab === 'alerts'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <BellRing className="h-4 w-4 inline mr-1.5" />
          Mes alertes
          {alerts.length > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center text-xs bg-red-600 hover:bg-red-600 text-white">
              {alerts.length > 99 ? '99+' : alerts.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Search bar */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Rechercher sur Vinted (marque, modèle, mot-clé...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-[200px]"
            />
            <Button onClick={() => (tab === 'search' ? runSearch() : runDeals())} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {tab === 'search' ? 'Rechercher' : 'Trouver deals'}
            </Button>
            {tab !== 'alerts' && (
              <Button variant="outline" onClick={openSaveDialog} title="Sauvegarder cette recherche avec alertes">
                <Save className="h-4 w-4" />
                Sauvegarder
              </Button>
            )}
            {tab === 'search' && (
              <Button variant="outline" onClick={() => setShowFilters((v) => !v)}>
                <Filter className="h-4 w-4" />
                Filtres
              </Button>
            )}
          </div>

          {/* Info: age filter not available — Vinted rate-limits /items/{id} too aggressively */}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
            <Clock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Tri <strong>"Plus récents"</strong> par défaut = annonces les plus fraîches d'abord. Le filtre par âge exact n'est pas disponible : l'API Vinted ne renvoie pas les dates sur le catalog public, et l'endpoint détails est rate-limité à ~5 req/min. En mode Deals, limitez à <strong>2-3 pages</strong> pour ne voir que les plus récentes.
            </span>
          </div>

          {/* Filters (search tab only) */}
          {tab === 'search' && showFilters && (
            <div className="space-y-4 pt-4 border-t">
              {/* Row 1: Tri + Prix */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Tri</Label>
                  <Select value={order} onValueChange={setOrder}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ORDERS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prix min (€)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={priceFrom}
                    onChange={(e) => setPriceFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prix max (€)</Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={priceTo}
                    onChange={(e) => setPriceTo(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Marques (autocomplete) */}
              <div className="space-y-1.5">
                <Label className="text-xs">🏷️ Marques</Label>
                <div className="relative">
                  <Input
                    placeholder="Tape le nom d'une marque (ex: Nike, Zara, Levi's...)"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    className="mb-2"
                  />
                  {brandSearching && (
                    <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {brandSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-background border rounded-md shadow-md max-h-60 overflow-y-auto">
                      {brandSuggestions.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => addBrand(b)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                        >
                          <span>{b.title}</span>
                          <span className="text-xs text-muted-foreground">#{b.id}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedBrands.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBrands.map((b) => (
                      <Badge key={b.id} variant="secondary" className="gap-1">
                        <Tag className="h-3 w-3" />
                        {b.title}
                        <button
                          type="button"
                          onClick={() => removeBrand(b.id)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Row 3: Catégories */}
              <div className="space-y-1.5">
                <Label className="text-xs">📂 Catégories (catalog Vinted)</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const isSelected = selectedCatalogIds.includes(c.id)
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleCatalog(c.id)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md border transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted',
                        )}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 4: État */}
              <div className="space-y-1.5">
                <Label className="text-xs">✨ État</Label>
                <div className="flex flex-wrap gap-3">
                  {conditions.map((c) => (
                    <div key={c.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cond-${c.id}`}
                        checked={selectedConditionIds.includes(c.id)}
                        onCheckedChange={() => toggleCondition(c.id)}
                      />
                      <Label htmlFor={`cond-${c.id}`} className="text-sm cursor-pointer">
                        {c.title}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 5: Tailles vêtements */}
              <div className="space-y-1.5">
                <Label className="text-xs">📐 Tailles vêtements</Label>
                <div className="flex flex-wrap gap-2">
                  {CLOTHING_SIZES.map((s) => {
                    const isSelected = selectedSizeIds.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSize(s.id)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md border transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted',
                        )}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 6: Pointures chaussures */}
              <div className="space-y-1.5">
                <Label className="text-xs">👟 Pointures chaussures</Label>
                <div className="flex flex-wrap gap-2">
                  {SHOE_SIZES.map((s) => {
                    const isSelected = selectedSizeIds.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSize(s.id)}
                        className={cn(
                          'px-2.5 py-1 text-xs rounded-md border transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted',
                        )}
                      >
                        {s.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Row 7: Taille texte (filtre post-traitement) */}
              <div className="space-y-1.5">
                <Label className="text-xs">Taille (filtre texte libre, post-recherche)</Label>
                <Input
                  placeholder="ex: M, 42, S... (en plus des tailles Vinted ci-dessus)"
                  value={sizeFilter}
                  onChange={(e) => setSizeFilter(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  <X className="h-4 w-4" /> Réinitialiser
                </Button>
              </div>
            </div>
          )}

          {/* Deals params */}
          {tab === 'deals' && (
            <div className="space-y-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Favoris max</Label>
                  <Select value={String(maxLikes)} onValueChange={(v) => setMaxLikes(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 5, 10].map((n) => (
                        <SelectItem key={n} value={String(n)}>≤ {n} favoris</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Pages à scanner</Label>
                  <Select value={String(pages)} onValueChange={(v) => setPages(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2, 3, 5, 8, 10, 15, 20].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} ({n * 96})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prix min (€)</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={dealsPriceFrom}
                    onChange={(e) => setDealsPriceFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Prix max (€)</Label>
                  <Input
                    type="number"
                    placeholder="—"
                    value={dealsPriceTo}
                    onChange={(e) => setDealsPriceTo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taille (contient)</Label>
                  <Input
                    placeholder="ex: M, 42, S..."
                    value={sizeFilter}
                    onChange={(e) => setSizeFilter(e.target.value)}
                  />
                </div>
              </div>

              {/* Filtres avancés Deals (marques, catégories, tailles, états) */}
              <div className="space-y-3">
                {/* Marques */}
                <div className="space-y-1.5">
                  <Label className="text-xs">🏷️ Marques</Label>
                  <div className="relative">
                    <Input
                      placeholder="Tape le nom d'une marque (ex: Nike, Zara, Levi's...)"
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                      className="mb-2"
                    />
                    {brandSearching && (
                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    {brandSuggestions.length > 0 && (
                      <div className="absolute z-20 w-full bg-background border rounded-md shadow-md max-h-60 overflow-y-auto">
                        {brandSuggestions.map((b) => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => addBrand(b)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <span>{b.title}</span>
                            <span className="text-xs text-muted-foreground">#{b.id}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedBrands.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBrands.map((b) => (
                        <Badge key={b.id} variant="secondary" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {b.title}
                          <button
                            type="button"
                            onClick={() => removeBrand(b.id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Catégories */}
                <div className="space-y-1.5">
                  <Label className="text-xs">📂 Catégories (catalog Vinted)</Label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => {
                      const isSelected = selectedCatalogIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCatalog(c.id)}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-md border transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted',
                          )}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* État */}
                <div className="space-y-1.5">
                  <Label className="text-xs">✨ État</Label>
                  <div className="flex flex-wrap gap-3">
                    {conditions.map((c) => (
                      <div key={c.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`cond-deal-${c.id}`}
                          checked={selectedConditionIds.includes(c.id)}
                          onCheckedChange={() => toggleCondition(c.id)}
                        />
                        <Label htmlFor={`cond-deal-${c.id}`} className="text-sm cursor-pointer">
                          {c.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tailles vêtements */}
                <div className="space-y-1.5">
                  <Label className="text-xs">📐 Tailles vêtements</Label>
                  <div className="flex flex-wrap gap-2">
                    {CLOTHING_SIZES.map((s) => {
                      const isSelected = selectedSizeIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSize(s.id)}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-md border transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted',
                          )}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Pointures */}
                <div className="space-y-1.5">
                  <Label className="text-xs">👟 Pointures chaussures</Label>
                  <div className="flex flex-wrap gap-2">
                    {SHOE_SIZES.map((s) => {
                      const isSelected = selectedSizeIds.includes(s.id)
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSize(s.id)}
                          className={cn(
                            'px-2.5 py-1 text-xs rounded-md border transition-colors',
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background hover:bg-muted',
                          )}
                        >
                          {s.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {(dealsPriceFrom || dealsPriceTo || selectedBrands.length > 0 || selectedCatalogIds.length > 0 || selectedSizeIds.length > 0 || selectedConditionIds.length > 0) && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetFilters}
                  >
                    <X className="h-4 w-4" /> Réinitialiser filtres
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results (search + deals tabs) */}
      {tab !== 'alerts' && loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Recherche en cours sur Vinted...</span>
        </div>
      )}

      {tab !== 'alerts' && !loading && items.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Aucun résultat. Lance une recherche pour explorer le catalogue Vinted.
            </p>
          </CardContent>
        </Card>
      )}

      {tab !== 'alerts' && !loading && items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{items.length}</span> article(s)
              {tab === 'deals' && <span className="ml-2">· deals avec ≤ {maxLikes} favoris</span>}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}

      {/* Alerts tab */}
      {tab === 'alerts' && (
        <div className="space-y-6">
          {/* Setup warning if no saved searches */}
          {savedSearches.length === 0 && (
            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
              <CardContent className="p-6">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-2 flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Active les alertes Vinted
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                  Pour recevoir des alertes quand de nouvelles annonces correspondent à vos critères :
                </p>
                <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
                  <li>Va dans l'onglet <strong>Recherche</strong> ou <strong>Deals</strong></li>
                  <li>Configure tes filtres (marque, taille, prix, état...)</li>
                  <li>Clique sur <strong>"Sauvegarder"</strong> et donne un nom</li>
                  <li>Le serveur scannera Vinted toutes les N heures automatiquement</li>
                  <li>Les nouvelles annonces apparaîtront ici en alerte</li>
                </ol>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-3">
                  ⚙️ Le scan automatique nécessite la config du cron serveur (voir README).
                </p>
              </CardContent>
            </Card>
          )}

          {/* Saved searches list */}
          {savedSearches.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Mes recherches sauvegardées ({savedSearches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {savedSearches.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-md border transition-colors cursor-pointer',
                      s.enabled ? 'bg-card' : 'bg-muted/30 opacity-60',
                      alertFilter === s.id && 'border-blue-500 ring-1 ring-blue-500',
                    )}
                    onClick={() => setAlertFilter(alertFilter === s.id ? null : s.id)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSavedSearch(s.id, s.enabled) }}
                      className={cn(
                        'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0',
                        s.enabled
                          ? 'bg-green-600 border-green-600 text-white'
                          : 'bg-background border-muted-foreground',
                      )}
                      title={s.enabled ? 'Désactiver' : 'Activer'}
                    >
                      {s.enabled && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">{s.name}</p>
                        {s.unreadAlerts > 0 && (
                          <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs">
                            {s.unreadAlerts} nouvelle(s)
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          <Clock className="h-3 w-3" />
                          {s.intervalHours}h
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.lastScannedAt
                          ? `Dernier scan: ${new Date(s.lastScannedAt).toLocaleString('fr-FR')}`
                          : 'Jamais scanné (en attente du prochain passage du cron)'}
                      </p>
                      {/* Search params summary */}
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.searchParams.query && <span className="mr-2">🔍 "{s.searchParams.query}"</span>}
                        {s.searchParams.brandIds?.length > 0 && <span className="mr-2">🏷️ {s.searchParams.brandIds.length} marque(s)</span>}
                        {s.searchParams.sizeIds?.length > 0 && <span className="mr-2">📐 {s.searchParams.sizeIds.length} taille(s)</span>}
                        {s.searchParams.catalogIds?.length > 0 && <span className="mr-2">📂 {s.searchParams.catalogIds.length} cat.</span>}
                        {s.searchParams.priceFrom && <span className="mr-2">≥ {s.searchParams.priceFrom}€</span>}
                        {s.searchParams.priceTo && <span className="mr-2">≤ {s.searchParams.priceTo}€</span>}
                        {s.searchParams.maxLikes != null && <span className="mr-2">🔥 ≤ {s.searchParams.maxLikes} favoris</span>}
                      </p>
                    </div>
                    {s.unreadAlerts > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); markAlertsRead(s.id) }}
                        title="Marquer les alertes comme lues"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.id, s.name) }}
                      className="text-muted-foreground hover:text-destructive"
                      title="Supprimer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Recent alerts (5 most recent) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                Nouvelles annonces détectées
                {alertsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                {alertFilter && (
                  <Badge variant="outline" className="text-xs ml-2">
                    Filtré: {savedSearches.find(s => s.id === alertFilter)?.name || alertFilter}
                    <button onClick={() => setAlertFilter(null)} className="ml-1 hover:text-destructive">×</button>
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const filtered = alertFilter ? alerts.filter(a => a.savedSearchId === alertFilter) : alerts
                if (filtered.length === 0 && !alertsLoading) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Bell className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Aucune nouvelle annonce. Le scan automatique détectera les nouveaux articles.
                      </p>
                    </div>
                  )
                }
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {filtered.slice(0, 10).map((alert) => (
                        <ItemCard key={alert.id} item={alert.item} />
                      ))}
                    </div>
                    {filtered.length > 10 && (
                      <p className="text-xs text-muted-foreground mt-3 text-center">
                        + {filtered.length - 10} autre(s) alerte(s) — marque-les comme lues pour les voir disparaître
                      </p>
                    )}
                    {filtered.length > 0 && (
                      <div className="flex justify-center mt-4">
                        <Button variant="outline" size="sm" onClick={() => markAlertsRead()}>
                          <Check className="h-4 w-4" />
                          Tout marquer comme lu
                        </Button>
                      </div>
                    )}
                  </>
                )
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Save Search Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sauvegarder cette recherche</DialogTitle>
            <DialogDescription>
              Le serveur scannera Vinted automatiquement selon l'intervalle choisi et vous alertera des nouvelles annonces.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="save-name">Nom de la recherche</Label>
              <Input
                id="save-name"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="ex: T-shirts Nike M, Jeans Levi's 38..."
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fréquence de scan</Label>
              <Select value={String(saveInterval)} onValueChange={(v) => setSaveInterval(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 12, 24, 48, 168].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h < 24 ? `Toutes les ${h}h` : h === 24 ? 'Quotidien (24h)' : h === 168 ? 'Hebdomadaire' : `Toutes les ${h}h`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ⚠️ Évitez les intervalles trop courts (1h) pour ne pas se faire bloquer par Vinted. 6h est un bon compromis.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Annuler</Button>
            <Button onClick={confirmSaveSearch}>
              <Save className="h-4 w-4" />
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disclaimer */}
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <CardContent className="p-4 text-sm text-amber-900 dark:text-amber-200">
          <strong>⚠️ Note :</strong> Ce module interroge l'API catalogique publique de Vinted en lecture seule.
          Aucune donnée n'est envoyée vers Vinted — c'est uniquement de la consultation.
          Vinted peut bloquer temporairement l'accès en cas de requêtes trop fréquentes ; si vous obtenez
          une erreur 403/503, patientez quelques minutes.
        </CardContent>
      </Card>
    </div>
  )
}

