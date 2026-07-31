'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/use-permissions'
import {
  TrendingUp, Search, Save, Download, Trash2, History, ExternalLink,
  Star, Filter, X, RefreshCw, Package, AlertCircle, Eye,
} from 'lucide-react'

interface TrendResult {
  title: string
  image: string
  price: number
  url: string
  platform: string
  score: number
  seller: string
  location: string
  postedDaysAgo: number
}

interface TrendSummary {
  totalResults: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  medianPrice: number
  topScore: number
  trendScore: number
  platforms: string[]
  period: string
  country: string
}

interface SavedSearch {
  id: string
  name: string
  keyword: string
  category: string | null
  platform: string
  country: string
  period: string
  priceMin: number | null
  priceMax: number | null
  createdAt: string
  updatedAt: string
  snapshots?: Array<{
    id: string
    capturedAt: string
    totalResults: number
    avgPrice: number
    topScore: number
  }>
}

const PLATFORMS = [
  { value: 'all', label: 'Toutes les plateformes' },
  { value: 'vinted', label: 'Vinted' },
  { value: 'ebay', label: 'eBay' },
  { value: 'etsy', label: 'Etsy' },
]

const COUNTRIES = [
  { value: 'fr', label: '🇫🇷 France' },
  { value: 'be', label: '🇧🇪 Belgique' },
  { value: 'es', label: '🇪🇸 Espagne' },
  { value: 'it', label: '🇮🇹 Italie' },
  { value: 'de', label: '🇩🇪 Allemagne' },
  { value: 'uk', label: '🇬🇧 Royaume-Uni' },
  { value: 'us', label: '🇺🇸 États-Unis' },
]

const PERIODS = [
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
  { value: '12m', label: '12 derniers mois' },
]

const CATEGORIES = [
  { value: 'all', label: 'Toutes catégories' },
  { value: 'vetements', label: '👕 Vêtements' },
  { value: 'chaussures', label: '👟 Chaussures' },
  { value: 'accessoires', label: '👜 Accessoires' },
  { value: 'luxe', label: '💎 Luxe' },
  { value: 'maison', label: '🏠 Maison' },
]

const PLATFORM_COLORS: Record<string, string> = {
  vinted: 'bg-teal-100 text-teal-800 border-teal-300',
  ebay: 'bg-red-100 text-red-800 border-red-300',
  etsy: 'bg-orange-100 text-orange-800 border-orange-300',
}

export function ProductTrendModule() {
  const { can } = usePermissions()
  const [activeTab, setActiveTab] = useState<'search' | 'saved'>('search')

  // Search form state
  const [form, setForm] = useState({
    keyword: '',
    category: 'all',
    platform: 'all',
    country: 'fr',
    period: '30d',
    priceMin: '',
    priceMax: '',
  })
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TrendResult[]>([])
  const [summary, setSummary] = useState<TrendSummary | null>(null)
  const [searchedAt, setSearchedAt] = useState<string | null>(null)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [loadingSaved, setLoadingSaved] = useState(true)
  const [expandedSearch, setExpandedSearch] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<any[]>([])

  const fetchSaved = useCallback(async () => {
    setLoadingSaved(true)
    try {
      const res = await fetch('/api/product-trends/saved')
      const data = await res.json()
      setSavedSearches(data.searches || [])
    } catch {
      toast.error('Erreur de chargement des recherches sauvegardées')
    } finally {
      setLoadingSaved(false)
    }
  }, [])

  useEffect(() => { fetchSaved() }, [fetchSaved])

  const runSearch = async () => {
    if (!form.keyword.trim()) {
      toast.error('Saisis un mot-clé de recherche')
      return
    }
    setSearching(true)
    setResults([])
    setSummary(null)
    try {
      const res = await fetch('/api/product-trends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: form.keyword,
          category: form.category === 'all' ? null : form.category,
          platform: form.platform,
          country: form.country,
          period: form.period,
          priceMin: form.priceMin ? parseFloat(form.priceMin) : null,
          priceMax: form.priceMax ? parseFloat(form.priceMax) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      setResults(data.results)
      setSummary(data.summary)
      setSearchedAt(data.searchedAt)
      toast.success(`${data.results.length} produits trouvés`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSearching(false)
    }
  }

  const saveCurrentSearch = async () => {
    if (!saveName.trim()) {
      toast.error('Donne un nom à ta recherche')
      return
    }
    try {
      const res = await fetch('/api/product-trends/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName,
          keyword: form.keyword,
          category: form.category === 'all' ? null : form.category,
          platform: form.platform,
          country: form.country,
          period: form.period,
          priceMin: form.priceMin || null,
          priceMax: form.priceMax || null,
          captureSnapshot: true,
          snapshotData: summary ? {
            totalResults: summary.totalResults,
            avgPrice: summary.avgPrice,
            minPrice: summary.minPrice,
            maxPrice: summary.maxPrice,
            medianPrice: summary.medianPrice,
            topScore: summary.topScore,
            topItems: results.slice(0, 10),
          } : null,
        }),
      })
      if (res.ok) {
        toast.success('Recherche sauvegardée avec snapshot')
        setSaveDialogOpen(false)
        setSaveName('')
        fetchSaved()
      } else {
        toast.error('Erreur lors de la sauvegarde')
      }
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const exportCsv = async () => {
    if (results.length === 0) {
      toast.error('Aucun résultat à exporter')
      return
    }
    try {
      const res = await fetch('/api/product-trends/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          results,
          searchName: form.keyword,
        }),
      })
      if (!res.ok) { toast.error('Erreur export'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tendances-${form.keyword.replace(/[^a-zA-Z0-9-_]/g, '_')}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export CSV téléchargé')
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const loadSavedSearch = (s: SavedSearch) => {
    setForm({
      keyword: s.keyword,
      category: s.category || 'all',
      platform: s.platform,
      country: s.country,
      period: s.period,
      priceMin: s.priceMin?.toString() || '',
      priceMax: s.priceMax?.toString() || '',
    })
    setActiveTab('search')
    toast.info(`Recherche "${s.name}" chargée — clique sur Rechercher pour lancer`)
  }

  const deleteSavedSearch = async (id: string) => {
    if (!confirm('Supprimer cette recherche sauvegardée et tout son historique ?')) return
    const res = await fetch(`/api/product-trends/saved/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Recherche supprimée')
      fetchSaved()
    } else {
      toast.error('Erreur')
    }
  }

  const captureSnapshot = async (searchId: string) => {
    // Run a fresh search with the saved params and capture snapshot
    const s = savedSearches.find(x => x.id === searchId)
    if (!s) return
    setSearching(true)
    try {
      const res = await fetch('/api/product-trends/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: s.keyword,
          category: s.category,
          platform: s.platform,
          country: s.country,
          period: s.period,
          priceMin: s.priceMin,
          priceMax: s.priceMax,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error); return }

      // Save snapshot
      const snapRes = await fetch(`/api/product-trends/saved/${searchId}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalResults: data.summary.totalResults,
          avgPrice: data.summary.avgPrice,
          minPrice: data.summary.minPrice,
          maxPrice: data.summary.maxPrice,
          medianPrice: data.summary.medianPrice,
          topScore: data.summary.topScore,
          topItems: data.results.slice(0, 10),
        }),
      })
      if (snapRes.ok) {
        toast.success('Snapshot capturé')
        fetchSaved()
        // If expanded, refresh snapshots
        if (expandedSearch === searchId) {
          viewSnapshots(searchId)
        }
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSearching(false)
    }
  }

  const viewSnapshots = async (searchId: string) => {
    if (expandedSearch === searchId) {
      setExpandedSearch(null)
      setSnapshots([])
      return
    }
    try {
      const res = await fetch(`/api/product-trends/saved/${searchId}`)
      const data = await res.json()
      if (res.ok) {
        setExpandedSearch(searchId)
        setSnapshots(data.search?.snapshots || [])
      }
    } catch {
      toast.error('Erreur')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Product Trend
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identifie les produits tendance sur Vinted, eBay et Etsy pour orienter tes achats de revente.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'search' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Search className="h-4 w-4 inline mr-1" /> Recherche
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'saved' ? 'border-blue-600 text-blue-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Save className="h-4 w-4 inline mr-1" /> Recherches sauvegardées
          {savedSearches.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-xs">{savedSearches.length}</Badge>
          )}
        </button>
      </div>

      {/* SEARCH TAB */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtres de recherche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-2 lg:col-span-3">
                  <Label className="text-xs">Mot-clé de recherche *</Label>
                  <Input
                    value={form.keyword}
                    onChange={e => setForm({ ...form, keyword: e.target.value })}
                    placeholder="ex: sneakers Nike, sac Louis Vuitton, veste Zara..."
                    onKeyDown={e => { if (e.key === 'Enter' && !searching) runSearch() }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Catégorie</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue placeholder="Toutes catégories" /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Plateforme</Label>
                  <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Pays / Région</Label>
                  <Select value={form.country} onValueChange={v => setForm({ ...form, country: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Période</Label>
                  <Select value={form.period} onValueChange={v => setForm({ ...form, period: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Prix min (€)</Label>
                  <Input type="number" value={form.priceMin} onChange={e => setForm({ ...form, priceMin: e.target.value })} placeholder="0" />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Prix max (€)</Label>
                  <Input type="number" value={form.priceMax} onChange={e => setForm({ ...form, priceMax: e.target.value })} placeholder="100" />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t">
                <Button onClick={runSearch} disabled={searching}>
                  {searching ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  {searching ? 'Recherche en cours...' : 'Rechercher'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Summary + actions */}
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatCard label="Résultats" value={summary.totalResults.toString()} icon={<Package className="h-4 w-4" />} />
                <StatCard label="Prix moyen" value={`${summary.avgPrice.toFixed(2)} €`} icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="Prix médian" value={`${summary.medianPrice.toFixed(2)} €`} icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="Prix min" value={`${summary.minPrice.toFixed(2)} €`} icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="Prix max" value={`${summary.maxPrice.toFixed(2)} €`} icon={<TrendingUp className="h-4 w-4" />} />
                <StatCard label="Score tendance" value={`${summary.trendScore}/100`} icon={<Star className="h-4 w-4" />} highlight={summary.trendScore > 70} />
              </div>

              <div className="flex gap-2 justify-end">
                {can('product-trend', 'create') && (
                  <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(!saveDialogOpen)}>
                    <Save className="h-4 w-4 mr-1" /> Sauvegarder
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={exportCsv}>
                  <Download className="h-4 w-4 mr-1" /> Export CSV
                </Button>
              </div>

              {saveDialogOpen && (
                <Card>
                  <CardContent className="pt-4 flex gap-2 items-end">
                    <div className="flex-1 space-y-1.5">
                      <Label className="text-xs">Nom de la recherche</Label>
                      <Input
                        value={saveName}
                        onChange={e => setSaveName(e.target.value)}
                        placeholder={`ex: ${form.keyword} ${form.country.toUpperCase()}`}
                        onKeyDown={e => { if (e.key === 'Enter') saveCurrentSearch() }}
                      />
                    </div>
                    <Button onClick={saveCurrentSearch}>Sauvegarder + Capturer snapshot</Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {/* Results */}
          {searching ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {results.map((r, i) => (
                <Card key={i} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="aspect-square bg-muted relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.image} alt={r.title} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <Badge className={`${PLATFORM_COLORS[r.platform] || 'bg-gray-100 text-gray-800'} text-xs`}>
                        {r.platform}
                      </Badge>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-xs bg-white/90">
                        <Star className="h-3 w-3 mr-0.5 text-yellow-500" />
                        {r.score}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <p className="text-sm font-medium line-clamp-2 leading-tight" title={r.title}>{r.title}</p>
                    <p className="text-lg font-bold text-blue-600">{r.price.toFixed(2)} €</p>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{r.location}</span>
                      <span>il y a {r.postedDaysAgo}j</span>
                    </div>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1"
                    >
                      <ExternalLink className="h-3 w-3" /> Voir sur {r.platform}
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : summary ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucun produit trouvé. Essaie un autre mot-clé ou élargis tes filtres.
            </CardContent></Card>
          ) : null}
        </div>
      )}

      {/* SAVED SEARCHES TAB */}
      {activeTab === 'saved' && (
        <div className="space-y-3">
          {loadingSaved ? (
            <Skeleton className="h-32" />
          ) : savedSearches.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Save className="h-12 w-12 mx-auto mb-3 opacity-30" />
              Aucune recherche sauvegardée.
              <p className="mt-2">Lance une recherche puis clique sur "Sauvegarder" pour suivre son évolution dans le temps.</p>
            </CardContent></Card>
          ) : (
            savedSearches.map(s => (
              <Card key={s.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm">{s.name}</p>
                        {s.snapshots?.[0] && (
                          <Badge variant="outline" className="text-xs">
                            Score: {s.snapshots[0].topScore}/100
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        <span className="font-medium">« {s.keyword} »</span>
                        {s.category && <span>· {s.category}</span>}
                        <span>· {s.platform === 'all' ? 'toutes plateformes' : s.platform}</span>
                        <span>· {s.country.toUpperCase()}</span>
                        <span>· {s.period}</span>
                        {s.priceMin || s.priceMax ? (
                          <span>· {s.priceMin || 0}€ - {s.priceMax || '∞'}€</span>
                        ) : null}
                      </div>
                      {s.snapshots?.[0] && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Dernier snapshot : {new Date(s.snapshots[0].capturedAt).toLocaleString('fr-FR')}
                          {' · '}{s.snapshots[0].totalResults} résultats à {s.snapshots[0].avgPrice.toFixed(2)} € en moyenne
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => loadSavedSearch(s)} title="Charger dans la recherche">
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => captureSnapshot(s.id)} disabled={searching} title="Capturer un snapshot">
                        <RefreshCw className={`h-3.5 w-3.5 ${searching ? 'animate-spin' : ''}`} />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => viewSnapshots(s.id)} title="Voir l'historique">
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteSavedSearch(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Snapshots history */}
                  {expandedSearch === s.id && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Historique des snapshots</p>
                      {snapshots.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">Aucun snapshot. Clique sur le bouton refresh pour en capturer un.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b text-left text-muted-foreground">
                                <th className="py-1 pr-3">Date</th>
                                <th className="py-1 pr-3 text-right">Résultats</th>
                                <th className="py-1 pr-3 text-right">Prix moyen</th>
                                <th className="py-1 pr-3 text-right">Min</th>
                                <th className="py-1 pr-3 text-right">Max</th>
                                <th className="py-1 pr-3 text-right">Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {snapshots.map((snap: any) => (
                                <tr key={snap.id} className="border-b last:border-0">
                                  <td className="py-1.5 pr-3">{new Date(snap.capturedAt).toLocaleString('fr-FR')}</td>
                                  <td className="py-1.5 pr-3 text-right">{snap.totalResults}</td>
                                  <td className="py-1.5 pr-3 text-right font-medium">{snap.avgPrice.toFixed(2)} €</td>
                                  <td className="py-1.5 pr-3 text-right text-muted-foreground">{snap.minPrice?.toFixed(2) ?? '-'} €</td>
                                  <td className="py-1.5 pr-3 text-right text-muted-foreground">{snap.maxPrice?.toFixed(2) ?? '-'} €</td>
                                  <td className="py-1.5 pr-3 text-right">
                                    <Badge variant={snap.topScore > 70 ? 'default' : 'secondary'} className="text-xs">{snap.topScore}</Badge>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, highlight }: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-blue-500 bg-blue-50' : ''}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          {icon}
          {label}
        </div>
        <p className={`text-lg font-bold ${highlight ? 'text-blue-700' : ''}`}>{value}</p>
      </CardContent>
    </Card>
  )
}
