'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useSettings } from '@/hooks/use-settings'
import { useBoutiqueCategories } from '@/hooks/use-boutique-categories'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Plus, Search, MapPin, Barcode, Edit, Trash2, Package, ChevronLeft, ChevronRight,
  Eye, AlertCircle, Camera, Upload, RefreshCw, Sparkles, ScanEye, QrCode, Link2, Download,
  Tag, Euro, Layers, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  formatEUR, formatDate, PUBLICATION_STATUSES,
  getPubStatusColor, getPubStatusLabel,
  getPlatformColor,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { photoUrl } from '@/lib/photo-url'
import { useConfirm } from '@/components/shared/confirm-provider'
import { BarcodeScannerModal, QuickQuantityModal } from '@/components/stock/barcode-scanner'
import { usePermissions } from '@/hooks/use-permissions'

const PAGE_SIZE = 10

interface Supplier {
  id: string
  name: string
  type: string
}

interface StockItem {
  id: string
  sku: string
  barcode: string | null
  photos: string
  title: string | null
  brand: string
  category: string
  size: string | null
  color: string | null
  condition: string
  purchaseDate: string
  supplierId: string | null
  supplier: Supplier | null
  purchaseCost: number
  lotReference: string | null
  purchaseInvoiceNumber: string | null
  purchasePaymentMethod: string | null
  warehouse: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  status: string
  platform: string | null
  platforms: string  // JSON array
  quantity: number
  soldCount: number
  suggestedPrice: number | null
  description: string | null
  measurements: string | null
  isLot?: boolean
  lotItems?: string | null
  sales?: Array<{ id: string; salePrice: number; profit: number; saleDate: string; invoiceNumber: string | null }> | null
}

export function StockModule() {
  const { data: items, loading, refresh } = useFetch<StockItem[]>('/api/stock')
  const { data: suppliers } = useFetch<Supplier[]>('/api/suppliers')
  const { getByType, getLabel } = useSettings()
  const { can } = usePermissions()

  const categories = getByType('category')
  const conditions = getByType('condition')
  const brandAttributes = getByType('brand')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [showForm, setShowForm] = useState(false)
  const [showPurchaseForm, setShowPurchaseForm] = useState(false)
  const [showLotForm, setShowLotForm] = useState(false)
  const [editingItem, setEditingItem] = useState<StockItem | null>(null)
  const [viewItem, setViewItem] = useState<StockItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; item?: StockItem } | null>(null)
  // Scanner code-barres
  const [showScanner, setShowScanner] = useState(false)
  const [quickQtyItem, setQuickQtyItem] = useState<any>(null)
  const [prefillBarcode, setPrefillBarcode] = useState<string | null>(null)

  // Quand le scanner trouve un code-barres inconnu → ouvrir le formulaire d'ajout avec le code pré-rempli
  const handleBarcodeNotFound = (barcode: string) => {
    setShowScanner(false)
    if (!can('stock', 'create')) {
      toast.error("Vous n'avez pas la permission de créer un article")
      return
    }
    setEditingItem(null)
    setPrefillBarcode(barcode)
    setShowForm(true)
  }

  // Quand le scanner trouve un article → ouvrir la modal "quantité à ajouter"
  const handleBarcodeFound = (item: any) => {
    setShowScanner(false)
    if (!can('stock', 'edit')) {
      toast.error("Vous n'avez pas la permission de modifier le stock")
      return
    }
    setQuickQtyItem(item)
  }

  // Quand l'utilisateur valide la quantité à ajouter → PATCH l'article
  const handleQuickQtyConfirm = async (item: any, qtyToAdd: number) => {
    if (!can('stock', 'edit')) {
      toast.error("Vous n'avez pas la permission de modifier le stock")
      return
    }
    const res = await fetch(`/api/stock/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quantity: (item.quantity || 0) + qtyToAdd,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Erreur lors de la mise à jour')
    }
    toast.success(`${qtyToAdd} unité(s) ajoutée(s) — nouveau stock : ${(item.quantity || 0) + qtyToAdd}`)
    refresh()
  }

  const brands = useMemo(() => {
    if (!items) return []
    return Array.from(new Set(items.map(i => i.brand))).sort()
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (brandFilter !== 'all' && i.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && i.category !== categoryFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          i.sku.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.color?.toLowerCase().includes(q) ||
          i.barcode?.toLowerCase().includes(q) ||
          i.lotReference?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, search, statusFilter, brandFilter, categoryFilter])

  // Quand les filtres changent, on reset la page via la clé de filtre
  const filterKey = `${search}|${statusFilter}|${brandFilter}|${categoryFilter}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Sépare les articles en stock (non vendus) des articles vendus
  const inStockItems = filtered.filter(i => i.status !== 'VENDU')
  const soldItems = filtered.filter(i => i.status === 'VENDU')
  const totalStockValue = inStockItems.reduce((sum, i) => sum + i.purchaseCost, 0)
  const totalSuggestedValue = inStockItems.reduce((sum, i) => sum + (i.suggestedPrice || 0), 0)
  const totalSoldValue = soldItems.reduce((sum, i) => sum + (i.sales?.reduce((ss, sl) => ss + sl.salePrice, 0) || 0), 0)

  // ─── Gestion des cards cliquables ───
  const [showStockDetail, setShowStockDetail] = useState(false)
  const [showSoldDetail, setShowSoldDetail] = useState(false)
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === paginated.length) {
      // Tout est sélectionné sur cette page → désélectionner
      setSelectedIds(new Set())
    } else {
      // Sinon → sélectionner tous les items de la page courante
      setSelectedIds(new Set(paginated.map(i => i.id)))
    }
  }

  const isAllSelected = paginated.length > 0 && paginated.every(i => selectedIds.has(i.id))
  const isSomeSelected = paginated.some(i => selectedIds.has(i.id)) && !isAllSelected

  // ─── Suppression (modale au lieu de confirm) ───
  const askDeleteSingle = (item: StockItem) => {
    setDeleteTarget({ type: 'single', item })
    setShowDeleteModal(true)
  }

  // ─── Dissocier un lot (restaure le stock source + supprime le lot) ───
  const unlinkLot = async (item: StockItem) => {
    if (!confirm(`Dissocier le lot "${item.title}" ? Les articles seront remis en stock.`)) return
    try {
      const res = await fetch(`/api/stock/${item.id}/unlink-lot`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success(data.message || 'Lot dissocié')
      refresh()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const askDeleteBulk = () => {
    if (selectedIds.size === 0) return
    setDeleteTarget({ type: 'bulk' })
    setShowDeleteModal(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setShowDeleteModal(false)

    if (deleteTarget.type === 'single' && deleteTarget.item) {
      const res = await fetch(`/api/stock/${deleteTarget.item.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Article supprimé')
        refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        // Show the detailed error message from the API (e.g., "lié à une vente...")
        toast.error(data.error || 'Erreur lors de la suppression', {
          duration: 8000, // longer duration so user can read it
        })
      }
    } else if (deleteTarget.type === 'bulk') {
      // Suppression multiple
      const ids = Array.from(selectedIds)
      let okCount = 0
      let errCount = 0
      let firstErrorMessage = ''
      for (const id of ids) {
        const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' })
        if (res.ok) {
          okCount++
        } else {
          errCount++
          if (!firstErrorMessage) {
            const data = await res.json().catch(() => ({}))
            firstErrorMessage = data.error || ''
          }
        }
      }
      if (okCount > 0) toast.success(`${okCount} article${okCount > 1 ? 's' : ''} supprimé${okCount > 1 ? 's' : ''}`)
      if (errCount > 0) {
        const msg = firstErrorMessage
          ? `${errCount} suppression(s) en échec. Raison : ${firstErrorMessage}`
          : `${errCount} suppression(s) en échec`
        toast.error(msg, { duration: 8000 })
      }
      setSelectedIds(new Set())
      refresh()
    }
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-5">
      {/* Stats — cards cliquables */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Articles en stock (non vendus) */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowStockDetail(!showStockDetail)}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">En stock</p>
            <p className="text-2xl font-bold mt-1">{inStockItems.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{soldItems.length} vendus exclus</p>
          </CardContent>
        </Card>
        {/* Valeur du stock réel (coût d'achat des articles non vendus) */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowStockDetail(!showStockDetail)}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Valeur stock (coût)</p>
            <p className="text-2xl font-bold mt-1">{formatEUR(totalStockValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">articles non vendus</p>
          </CardContent>
        </Card>
        {/* Valeur de revente estimée (prix conseillé des articles en stock) */}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Valeur revente estimée</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{formatEUR(totalSuggestedValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">prix conseillé × stock</p>
          </CardContent>
        </Card>
        {/* CA généré (articles vendus) */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setShowSoldDetail(!showSoldDetail)}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">CA vendus</p>
            <p className="text-2xl font-bold mt-1 text-sky-600">{formatEUR(totalSoldValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{soldItems.length} article{soldItems.length > 1 ? 's' : ''} vendu{soldItems.length > 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Détail des articles en stock (toggle au clic sur les cards) */}
      {showStockDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail du stock ({inStockItems.length} articles)</CardTitle>
            <CardDescription>Valeur stock : {formatEUR(totalStockValue)} · Valeur revente : {formatEUR(totalSuggestedValue)}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="text-left text-[10px] text-muted-foreground border-b bg-muted/80 uppercase">
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Marque</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                    <th className="px-3 py-2 font-medium text-right">Qté dispo</th>
                    <th className="px-3 py-2 font-medium text-right">Coût</th>
                    <th className="px-3 py-2 font-medium text-right">Prix conseillé</th>
                  </tr>
                </thead>
                <tbody>
                  {inStockItems.map(item => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-[10px]">{item.sku}</td>
                      <td className="px-3 py-2 font-medium">{item.brand}</td>
                      <td className="px-3 py-2">
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getPubStatusColor(item.status))}>
                          {getPubStatusLabel(item.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className={cn(
                          'font-semibold px-1.5 py-0.5 rounded',
                          item.quantity > 5 ? 'text-emerald-600' : item.quantity > 1 ? 'text-amber-600' : 'text-red-600'
                        )}>
                          {item.quantity}
                        </span>
                        {item.soldCount > 0 && (
                          <span className="text-[9px] text-muted-foreground ml-1" title={`${item.soldCount} déjà vendu(s)`}>
                            ({item.soldCount} vendus)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatEUR(item.purchaseCost)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{item.suggestedPrice ? formatEUR(item.suggestedPrice) : '—'}</td>
                    </tr>
                  ))}
                  {inStockItems.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Aucun article en stock</td></tr>
                  )}
                </tbody>
                {inStockItems.length > 0 && (
                  <tfoot>
                    <tr className="bg-muted/50 font-semibold text-xs">
                      <td colSpan={4} className="px-3 py-2 text-right uppercase">Total</td>
                      <td className="px-3 py-2 text-right">{formatEUR(totalStockValue)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600">{formatEUR(totalSuggestedValue)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Détail des articles vendus (toggle au clic sur la card CA vendus) */}
      {showSoldDetail && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Détail des ventes ({soldItems.length} articles vendus)</CardTitle>
            <CardDescription>CA total : {formatEUR(totalSoldValue)}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr className="text-left text-[10px] text-muted-foreground border-b bg-muted/80 uppercase">
                    <th className="px-3 py-2 font-medium">SKU</th>
                    <th className="px-3 py-2 font-medium">Marque</th>
                    <th className="px-3 py-2 font-medium">Plateforme</th>
                    <th className="px-3 py-2 font-medium text-right">Qté vendue</th>
                    <th className="px-3 py-2 font-medium text-right">Coût achat</th>
                    <th className="px-3 py-2 font-medium text-right">Prix vente</th>
                    <th className="px-3 py-2 font-medium text-right">Bénéfice</th>
                  </tr>
                </thead>
                <tbody>
                  {soldItems.map(item => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-[10px]">{item.sku}</td>
                      <td className="px-3 py-2 font-medium">{item.brand}</td>
                      <td className="px-3 py-2 text-muted-foreground">{item.platform || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{item.soldCount}</span>
                        {item.quantity > 0 && (
                          <span className="text-[9px] text-muted-foreground ml-1" title="encore disponible">
                            ({item.quantity} restant)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{formatEUR(item.purchaseCost)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatEUR(item.sales?.reduce((s, sl) => s + sl.salePrice, 0) || 0)}</td>
                      <td className="px-3 py-2 text-right text-emerald-600 font-semibold">{formatEUR(item.sales?.reduce((s, sl) => s + sl.profit, 0) || 0)}</td>
                    </tr>
                  ))}
                  {soldItems.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Aucun article vendu</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par SKU, marque, code-barres, lot..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 lg:flex">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-[150px]">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  {PUBLICATION_STATUSES.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full lg:w-[140px]">
                  <SelectValue placeholder="Marque" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes marques</SelectItem>
                  {brands.map(b => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full lg:w-[140px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              {can('stock', 'create') && (
                <Button onClick={() => { setEditingItem(null); setShowForm(true) }}>
                  <Plus className="h-4 w-4 mr-2" /> Nouvel article
                </Button>
              )}
              {can('stock', 'scan') && (
                <Button
                  variant="outline"
                  className="border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                  onClick={() => setShowScanner(true)}
                >
                  <Barcode className="h-4 w-4 mr-2" /> Scanner code-barres
                </Button>
              )}
              {can('stock', 'create') && (
                <Button variant="outline" onClick={() => setShowLotForm(true)}>
                  <Layers className="h-4 w-4 mr-2" /> Nouveau Lot
                </Button>
              )}
              {can('stock', 'purchase') && (
                <Button variant="outline" onClick={() => setShowPurchaseForm(true)}>
                  <Plus className="h-4 w-4 mr-2" /> Achat hors stock
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barre d'actions bulk (visible quand des items sont sélectionnés) */}
      {selectedIds.size > 0 && can('stock', 'delete') && (
        <Card className="border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                {selectedIds.size}
              </div>
              <span className="text-sm font-medium">
                {selectedIds.size} article{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Désélectionner
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={askDeleteBulk}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Supprimer ({selectedIds.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Aucun article trouvé</p>
              <p className="text-xs text-muted-foreground mt-1">Modifiez vos filtres ou ajoutez un nouvel article.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    {can('stock', 'delete') ? (
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={isAllSelected}
                        ref={el => { if (el) el.indeterminate = isSomeSelected }}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border cursor-pointer"
                        title="Tout sélectionner"
                      />
                    </TableHead>
                    ) : (
                    <TableHead className="w-10" />
                    )}
                    <TableHead className="w-12"></TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Marque</TableHead>
                    <TableHead className="hidden md:table-cell">Catégorie</TableHead>
                    <TableHead className="hidden lg:table-cell">Taille</TableHead>
                    <TableHead className="hidden lg:table-cell">Couleur</TableHead>
                    <TableHead className="hidden xl:table-cell">Emplacement</TableHead>
                    <TableHead className="text-right">Qté dispo</TableHead>
                    <TableHead className="text-right">Coût</TableHead>
                    <TableHead className="text-right hidden md:table-cell">Prix conseillé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="hidden lg:table-cell">Plateforme</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(item => {
                    const photos: string[] = (() => {
                      try { return JSON.parse(item.photos) } catch { return [] }
                    })()
                    const location = [item.rack, item.shelf ? `Ét. ${item.shelf}` : null, item.bin ? `Bac ${item.bin}` : null].filter(Boolean).join(' · ')
                    return (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'hover:bg-muted/40 transition-colors',
                          selectedIds.has(item.id) && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                        )}
                      >
                        {can('stock', 'delete') ? (
                        <TableCell className="p-2" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelect(item.id)}
                            className="h-4 w-4 rounded border-border cursor-pointer"
                          />
                        </TableCell>
                        ) : (
                        <TableCell className="p-2" />
                        )}
                        <TableCell className="p-1.5 cursor-pointer" onClick={() => setViewItem(item)}>
                          <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                            {photos[0] ? (
                              <img src={photoUrl(photos[0])} alt={item.brand} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/40" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="font-medium">{item.brand}</TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-xs">{getLabel('category', item.category)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{item.size || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">{item.color || '—'}</TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                          {location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 shrink-0" /> {location}
                            </span>
                          ) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={cn(
                            'font-semibold px-1.5 py-0.5 rounded inline-block min-w-[28px]',
                            item.quantity > 5
                              ? 'text-emerald-600'
                              : item.quantity > 1
                                ? 'text-amber-600'
                                : 'text-red-600'
                          )}>
                            {item.quantity}
                          </span>
                          {item.soldCount > 0 && (
                            <span className="block text-[9px] text-muted-foreground" title={`${item.soldCount} déjà vendu(s)`}>
                              {item.soldCount} vendu{item.soldCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatEUR(item.purchaseCost)}</TableCell>
                        <TableCell className="text-right hidden md:table-cell">
                          {item.suggestedPrice ? (
                            <span className="font-semibold text-emerald-600">{formatEUR(item.suggestedPrice)}</span>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', getPubStatusColor(item.status))}>
                            {getPubStatusLabel(item.status)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {(() => {
                            // Affiche platform (singulier) si vendu, sinon platforms (pluriel)
                            if (item.platform) {
                              return (
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', getPlatformColor(item.platform))}>
                                  {getLabel('platform', item.platform)}
                                </span>
                              )
                            }
                            const platList: string[] = (() => {
                              try { return JSON.parse(item.platforms || '[]') } catch { return [] }
                            })()
                            if (platList.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {platList.map(p => (
                                    <span key={p} className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block', getPlatformColor(p))}>
                                      {getLabel('platform', p)}
                                    </span>
                                  ))}
                                </div>
                              )
                            }
                            return '—'
                          })()}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setViewItem(item)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {item.isLot && can('stock', 'delete') && (
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-amber-600 hover:text-amber-700" onClick={() => unlinkLot(item)} title="Dissocier le lot (restaurer le stock)">
                                Dissocier
                              </Button>
                            )}
                            {can('stock', 'edit') && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingItem(item); setShowForm(true) }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {can('stock', 'delete') && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => askDeleteSingle(item)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} article{filtered.length > 1 ? 's' : ''} ·{' '}
                  Page {safePage} sur {totalPages} ·{' '}
                  Affiche {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-8"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Préc.
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                    .map((p, idx, arr) => {
                      const showEllipsisBefore = idx > 0 && arr[idx - 1] !== p - 1
                      return (
                        <span key={p} className="flex items-center">
                          {showEllipsisBefore && <span className="px-1 text-muted-foreground">…</span>}
                          <Button
                            variant={p === safePage ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setPage(p)}
                          >
                            {p}
                          </Button>
                        </span>
                      )
                    })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="h-8"
                  >
                    Suiv. <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <StockForm
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setPrefillBarcode(null) }}
        item={editingItem}
        suppliers={suppliers || []}
        categories={categories}
        conditions={conditions}
        sizes={getByType('size')}
        colors={getByType('color')}
        onSaved={() => { setShowForm(false); setPrefillBarcode(null); refresh() }}
        prefillBarcode={prefillBarcode}
      />

      {/* Scanner code-barres */}
      <BarcodeScannerModal
        open={showScanner}
        onOpenChange={setShowScanner}
        onFound={handleBarcodeFound}
        onNotFound={handleBarcodeNotFound}
      />

      {/* Modal quantité à ajouter (quand code-barres trouvé) */}
      <QuickQuantityModal
        open={!!quickQtyItem}
        onOpenChange={(o) => { if (!o) setQuickQtyItem(null) }}
        item={quickQtyItem}
        onConfirm={handleQuickQtyConfirm}
      />

      {/* View Dialog */}
      <StockDetail open={!!viewItem} onOpenChange={(o) => !o && setViewItem(null)} item={viewItem} />

      {/* Purchase Form (achat hors stock) */}
      <PurchaseForm
        open={showPurchaseForm}
        onOpenChange={setShowPurchaseForm}
        suppliers={suppliers || []}
        onSaved={() => { setShowPurchaseForm(false); refresh() }}
      />

      {showLotForm && (
        <LotForm
          stockItems={items || []}
          onOpenChange={(o) => { if (!o) setShowLotForm(false) }}
          onSaved={() => { setShowLotForm(false); refresh() }}
        />
      )}

      {/* Modale de confirmation de suppression */}
      <Dialog open={showDeleteModal} onOpenChange={(o) => { setShowDeleteModal(o); if (!o) setDeleteTarget(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <AlertCircle className="h-5 w-5" />
              Confirmation de suppression
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === 'bulk'
                ? `Vous êtes sur le point de supprimer ${selectedIds.size} article${selectedIds.size > 1 ? 's' : ''}.`
                : 'Vous êtes sur le point de supprimer cet article.'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {deleteTarget?.type === 'bulk' ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Cette action est <strong>irréversible</strong>. Les articles sélectionnés et leurs données associées (ventes, photos) seront définitivement supprimés.
                </p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-muted/40 p-2 text-xs space-y-1">
                  {paginated.filter(i => selectedIds.has(i.id)).map(i => (
                    <div key={i.id} className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-mono text-[10px]">{i.sku}</span>
                      <span className="truncate">{i.brand}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm">
                Cette action est <strong>irréversible</strong>. L'article
                {deleteTarget?.item && (
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded ml-1">
                    {deleteTarget.item.sku}
                  </span>
                )}
                {deleteTarget?.item && (
                  <span> — {deleteTarget.item.brand}</span>
                )}
                et toutes ses données associées seront définitivement supprimés.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setDeleteTarget(null) }}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              {deleteTarget?.type === 'bulk'
                ? `Supprimer ${selectedIds.size} article${selectedIds.size > 1 ? 's' : ''}`
                : 'Supprimer'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Form (identique à la version précédente)
// ─────────────────────────────────────────────────────────────────────────────

function StockForm({ open, onOpenChange, item, suppliers, categories, conditions, sizes, colors, onSaved, prefillBarcode }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item: StockItem | null
  suppliers: Supplier[]
  categories: { id: string; code: string; value: string; isDefault: boolean }[]
  conditions: { id: string; code: string; value: string; isDefault: boolean }[]
  sizes: { id: string; code: string; value: string; isDefault: boolean }[]
  colors: { id: string; code: string; value: string; isDefault: boolean }[]
  onSaved: () => void
  prefillBarcode?: string | null
}) {
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const { getSubcategories: getBoutiqueSubcategories, categories: boutiqueCats } = useBoutiqueCategories()
  const { getByType: getByTypeLocal } = useSettings()
  const brandAttributes = getByTypeLocal('brand')
  const [analyzing, setAnalyzing] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  // Photo session import
  const [showSessionPicker, setShowSessionPicker] = useState(false)
  const [photoSessions, setPhotoSessions] = useState<Array<{
    id: string
    name: string
    notes: string | null
    photos: Array<{ id: string; path: string }>
    attachedStockId: string | null
    createdAt: string
  }>>([])
  const [loadingSessions, setLoadingSessions] = useState(false)
  const defaultCat = boutiqueCats[0]?.slug || 'vetements'
  const defaultCond = conditions.find(c => c.isDefault)?.code || conditions[0]?.code || 'bon'
  const [form, setForm] = useState({
    sku: '', title: '', brand: '', category: defaultCat, subcategory: '', size: '', color: '', condition: defaultCond,
    purchaseCost: '', purchaseDate: new Date().toISOString().split('T')[0],
    supplierId: '', lotReference: '', lotOrigin: '', lotCurrent: '',
    warehouse: '', rack: '', shelf: '', bin: '', weight: '', quantity: '1',
    description: '', suggestedPrice: '', salePrice: '', saleActive: false,
    platforms: '[]', platform: '', salePlatform: '', purchaseInvoiceNumber: '', purchasePaymentMethod: '', status: 'A_PHOTOGRAPHIER',
    barcode: '',
  })
  // Multi-variant mode
  const [multiVariant, setMultiVariant] = useState(false)
  const [variants, setVariants] = useState<{ size: string; color: string; quantity: string }[]>([
    { size: '', color: '', quantity: '1' },
  ])

  useMemo(() => {
    if (item) {
      setForm({
        sku: item.sku, title: item.title || '', brand: item.brand, category: item.category,
        subcategory: (item as { subcategory?: string }).subcategory || '',
        size: item.size || '', color: item.color || '', condition: item.condition,
        purchaseCost: String(item.purchaseCost),
        purchaseDate: new Date(item.purchaseDate).toISOString().split('T')[0],
        supplierId: item.supplierId || '', lotReference: item.lotReference || '',
        lotOrigin: (item as { lotOrigin?: string }).lotOrigin || '',
        lotCurrent: (item as { lotCurrent?: string }).lotCurrent || '',
        purchaseInvoiceNumber: (item as { purchaseInvoiceNumber?: string }).purchaseInvoiceNumber || '',
        purchasePaymentMethod: (item as { purchasePaymentMethod?: string }).purchasePaymentMethod || '',
        warehouse: item.warehouse || '', rack: item.rack || '', shelf: item.shelf || '', bin: item.bin || '',
        weight: (item as { weight?: number }).weight ? String(item.weight) : '',
        quantity: String((item as { quantity?: number }).quantity ?? 1),
        description: item.description || '', suggestedPrice: item.suggestedPrice ? String(item.suggestedPrice) : '',
        salePrice: (item as any).salePrice ? String((item as any).salePrice) : '',
        saleActive: (item as any).saleActive === true,
        platforms: item.platforms || '[]',
        platform: item.platform || '',
        salePlatform: (item as { salePlatform?: string }).salePlatform || '',
        status: item.status,
        barcode: item.barcode || '',
      })
      try { setPhotos(JSON.parse(item.photos) || []) } catch { setPhotos([]) }
    } else if (open) {
      setForm({
        sku: '', title: '', brand: '', category: defaultCat, subcategory: '', size: '', color: '', condition: defaultCond,
        purchaseCost: '', purchaseDate: new Date().toISOString().split('T')[0],
        supplierId: '', lotReference: '', lotOrigin: '', lotCurrent: '',
        warehouse: '', rack: '', shelf: '', bin: '', weight: '', quantity: '1',
        description: '', suggestedPrice: '', salePrice: '', saleActive: false,
        platforms: '[]', platform: '', salePlatform: '', purchaseInvoiceNumber: '', purchasePaymentMethod: '', status: 'A_PHOTOGRAPHIER',
        barcode: prefillBarcode || '',
      })
      setPhotos([])
    }
  }, [item, open, prefillBarcode])

  const subcategories = getBoutiqueSubcategories(form.category)

  // Upload de photos
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    if (photos.length + fileList.length > 10) {
      toast.error('Maximum 10 photos par article')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(fileList).forEach(f => formData.append('files', f))
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur upload')
      }
      const data = await res.json()
      setPhotos([...photos, ...data.urls])
      toast.success(`${data.urls.length} photo(s) ajoutée(s)`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setUploading(false)
    }
  }

  const removePhoto = async (url: string, index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index)
    setPhotos(newPhotos)
    if (url.startsWith('/uploads/')) {
      try { await fetch(`/api/upload?path=${encodeURIComponent(url)}`, { method: 'DELETE' }) } catch {}
    }
  }

  // Ouvrir le picker de sessions de shooting
  const openSessionPicker = async () => {
    setShowSessionPicker(true)
    setLoadingSessions(true)
    try {
      const res = await fetch('/api/photo-sessions')
      const data = await res.json()
      // Only show sessions that have photos and are not already attached to another stock item
      const available = (data.sessions || []).filter((s: any) => s.photos.length > 0)
      setPhotoSessions(available)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoadingSessions(false)
    }
  }

  // Importer les photos d'une session vers cet article
  const importFromSession = async (sessionId: string) => {
    if (!item) return
    try {
      const res = await fetch(`/api/photo-sessions/${sessionId}/attach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      // Recharger les photos de l'article
      try {
        const updated = await fetch(`/api/stock/${item.id}`).then(r => r.json())
        if (updated.photos) {
          setPhotos(JSON.parse(updated.photos) || [])
        }
      } catch {}
      toast.success(`${data.addedPhotos} photo(s) importée(s) depuis le shooting`)
      setShowSessionPicker(false)
      onSaved()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const movePhoto = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= photos.length) return
    const newPhotos = [...photos]
    ;[newPhotos[index], newPhotos[newIndex]] = [newPhotos[newIndex], newPhotos[index]]
    setPhotos(newPhotos)
  }

  // Génère une description via l'IA
  const generateDescription = async () => {
    if (!form.brand) { toast.error('Renseignez au moins la marque avant de générer'); return }
    if (form.description && form.description.trim().length > 0) {
      const ok = await confirm({
        title: 'Remplacer la description ?',
        description: 'Une nouvelle description sera générée par l\'IA.',
        confirmLabel: 'Remplacer',
      })
      if (!ok) return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand: form.brand, category: form.category, size: form.size, color: form.color,
          condition: form.condition, sku: form.sku, suggestedPrice: form.suggestedPrice, platform: form.platform,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const data = await res.json()
      setForm({ ...form, description: data.description })
      toast.success('Description générée par l\'IA')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  // Analyse photo avec IA (détection marque, catégorie, couleur, état)
  const analyzePhoto = async () => {
    if (photos.length === 0) {
      toast.error('Ajoutez au moins une photo d\'abord')
      return
    }
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoUrl: photos[0] }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const data = await res.json()
      // Auto-remplit le formulaire avec les données détectées
      setForm(prev => ({
        ...prev,
        brand: data.brand || prev.brand,
        category: data.category || prev.category,
        color: data.color || prev.color,
        size: data.size || prev.size,
        condition: data.condition || prev.condition,
        suggestedPrice: data.estimatedPrice ? String(data.estimatedPrice) : prev.suggestedPrice,
        description: data.description || prev.description,
      }))
      toast.success('Photo analysée ! Marque, couleur et état détectés.', {
        description: data.brand ? `Marque : ${data.brand}` : 'Marque non identifiée',
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'analyse')
    } finally {
      setAnalyzing(false)
    }
  }

  const submit = async () => {
    if (!form.brand) {
      toast.error('Marque requise')
      return
    }

    // Multi-variant mode: create one StockItem per variant
    if (multiVariant && !item) {
      const validVariants = variants.filter(v => v.size || v.color)
      if (validVariants.length === 0) {
        toast.error('Ajoutez au moins une variante (taille ou couleur)')
        return
      }
      setSaving(true)
      let created = 0
      let failed = 0
      const baseSku = form.sku || `ART-${Date.now().toString(36).toUpperCase()}`
      for (let i = 0; i < validVariants.length; i++) {
        const v = validVariants[i]
        const suffix = [v.size, v.color].filter(Boolean).join('-').toUpperCase()
        const sku = suffix ? `${baseSku}-${suffix}` : `${baseSku}-${i + 1}`
        const payload = {
          ...form,
          sku,
          size: v.size || null,
          color: v.color || null,
          quantity: parseInt(v.quantity) || 1,
          photos: JSON.stringify(photos),
        }
        if (form.status !== 'VENDU') delete (payload as Record<string, unknown>).platform
        try {
          const res = await fetch('/api/stock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
          if (res.ok) created++
          else failed++
        } catch {
          failed++
        }
      }
      toast.success(`${created} article(s) créé(s)${failed > 0 ? `, ${failed} échec(s)` : ''}`)
      setSaving(false)
      onSaved()
      return
    }

    // Single item mode (original)
    if (!form.sku) {
      toast.error('SKU requis')
      return
    }
    setSaving(true)
    try {
      const url = item ? `/api/stock/${item.id}` : '/api/stock'
      const method = item ? 'PATCH' : 'POST'
      const payload = { ...form, photos: JSON.stringify(photos) }
      if (form.status !== 'VENDU') {
        delete (payload as Record<string, unknown>).platform
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erreur')
      }
      toast.success(item ? 'Article modifié' : 'Article créé')
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Modifier l\'article' : 'Nouvel article'}</DialogTitle>
          <DialogDescription>
            {item ? `SKU: ${item.sku}` : 'Renseignez les informations d\'identification et de stockage.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Photos */}
          <div>
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Camera className="h-4 w-4" /> Photos ({photos.length}/10)
            </h4>
            <label
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files) }}
              className={cn(
                'block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                dragActive ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                  : 'border-border hover:border-foreground/30 hover:bg-muted/40',
                uploading && 'opacity-50 pointer-events-none'
              )}
            >
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple className="hidden"
                onChange={(e) => handleFiles(e.target.files)} disabled={uploading || photos.length >= 10} />
              {uploading ? (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Upload en cours...
                </div>
              ) : photos.length >= 10 ? (
                <p className="text-sm text-muted-foreground">Maximum 10 photos atteint</p>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">Cliquez ou glissez vos photos ici</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF — max 10 Mo par photo</p>
                </div>
              )}
            </label>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-3">
                {photos.map((url, index) => (
                  <div key={index} className="relative group aspect-square rounded-lg overflow-hidden bg-muted border">
                    <img src={photoUrl(url)} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                    {index === 0 && (
                      <div className="absolute top-1 left-1 bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">PRINCIPALE</div>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <button type="button" onClick={() => movePhoto(index, 'left')} disabled={index === 0}
                        className="p-1 bg-white/20 hover:bg-white/30 text-white rounded disabled:opacity-30" title="Déplacer à gauche">
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => removePhoto(url, index)}
                        className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded" title="Supprimer">
                        <Trash2 className="h-3 w-3" />
                      </button>
                      <button type="button" onClick={() => movePhoto(index, 'right')} disabled={index === photos.length - 1}
                        className="p-1 bg-white/20 hover:bg-white/30 text-white rounded disabled:opacity-30" title="Déplacer à droite">
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bouton Importer depuis shooting */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              onClick={openSessionPicker}
              disabled={uploading}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Importer depuis shooting
            </Button>

            {/* Bouton Analyser photo avec IA */}
            {photos.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 border-violet-300 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                onClick={analyzePhoto}
                disabled={analyzing || !form.brand}
              >
                {analyzing ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Analyse en cours…</>
                ) : (
                  <><ScanEye className="h-3.5 w-3.5 mr-1.5" /> Analyser la photo avec l'IA</>
                )}
              </Button>
            )}
            {analyzing && (
              <p className="text-[11px] text-violet-600 flex items-center gap-1 mt-1">
                <ScanEye className="h-3 w-3" />
                L'IA détecte la marque, catégorie, couleur et état depuis la photo principale…
              </p>
            )}
          </div>

          {/* Identification */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Package className="h-4 w-4" /> Identification
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs">Titre / Nom du produit</Label>
                <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="ex: T-shirt Nike Sportswear blanc" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">SKU *</Label>
                <Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="RL-POLO-00125" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Barcode className="h-3 w-3" /> Code-barres
                </Label>
                <Input
                  value={form.barcode}
                  onChange={e => setForm({ ...form, barcode: e.target.value })}
                  placeholder="3401234567890"
                  className="font-mono text-sm"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Marque *</Label>
                {brandAttributes.length > 0 ? (
                  <Select value={form.brand || '__custom__'} onValueChange={v => setForm({ ...form, brand: v === '__custom__' ? '' : v })}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                    <SelectContent>
                      {brandAttributes.map(b => <SelectItem key={b.id} value={b.value}>{b.value}</SelectItem>)}
                      <SelectItem value="__custom__">+ Autre (saisie manuelle)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Ralph Lauren" />
                )}
                {form.brand === '' && brandAttributes.length > 0 && (
                  <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} placeholder="Saisir la marque…" className="mt-1" autoFocus />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">État</Label>
                <Select value={form.condition} onValueChange={v => setForm({ ...form, condition: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {conditions.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie</Label>
                <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, subcategory: '' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {boutiqueCats.map(c => <SelectItem key={c.slug} value={c.slug}>{c.emoji} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {subcategories.length > 0 ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Sous-catégorie</Label>
                  <Select
                    value={form.subcategory || '__none__'}
                    onValueChange={v => setForm({ ...form, subcategory: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {subcategories.map(s => <SelectItem key={s.slug} value={s.slug}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {/* Multi-variant toggle (only for new items) */}
              {!item && (
                <div className="md:col-span-2 flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setMultiVariant(!multiVariant)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      multiVariant
                        ? 'border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
                        : 'border-border text-muted-foreground hover:border-foreground/20'
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Article multi-variantes (tailles/couleurs)
                  </button>
                </div>
              )}
              {/* Single size/color (when not multi-variant) */}
              {!multiVariant && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Taille</Label>
                    <Select
                      value={form.size || '__none__'}
                      onValueChange={v => setForm({ ...form, size: v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {sizes.map(s => <SelectItem key={s.id} value={s.code}>{s.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Couleur</Label>
                    <Select
                      value={form.color || '__none__'}
                      onValueChange={v => setForm({ ...form, color: v === '__none__' ? '' : v })}
                    >
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {colors.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Multi-variant table */}
          {multiVariant && !item && (
            <div className="border rounded-lg p-3 bg-blue-50/30 dark:bg-blue-950/10">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Variantes ({variants.length})
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setVariants([...variants, { size: '', color: '', quantity: '1' }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une variante
                </Button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center text-[10px] font-medium text-muted-foreground uppercase">
                  <span>Taille</span>
                  <span>Couleur</span>
                  <span className="text-center">Qté</span>
                  <span></span>
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_80px_32px] gap-2 items-center">
                    <Select
                      value={v.size || '__none__'}
                      onValueChange={val => setVariants(prev => prev.map((p, idx) => idx === i ? { ...p, size: val === '__none__' ? '' : val } : p))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {sizes.map(s => <SelectItem key={s.id} value={s.code}>{s.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select
                      value={v.color || '__none__'}
                      onValueChange={val => setVariants(prev => prev.map((p, idx) => idx === i ? { ...p, color: val === '__none__' ? '' : val } : p))}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {colors.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0"
                      value={v.quantity}
                      onChange={e => setVariants(prev => prev.map((p, idx) => idx === i ? { ...p, quantity: e.target.value } : p))}
                      className="h-8 text-xs text-center"
                      placeholder="1"
                    />
                    {variants.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500"
                        onClick={() => setVariants(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Chaque variante créera un article séparé en stock avec le même titre, marque, prix et photos.
                Le SKU sera automatiquement suffixé (ex: ART-001-S-BLEU).
              </p>
            </div>
          )}

          {/* Achat */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Euro className="h-4 w-4" /> Achat
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Coût d'achat (€)</Label>
                <Input type="number" step="0.01" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} placeholder="12.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date d'achat</Label>
                <Input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Mode de paiement</Label>
                <Select value={form.purchasePaymentMethod || '__none__'} onValueChange={v => setForm({ ...form, purchasePaymentMethod: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    <SelectItem value="especes">Espèces</SelectItem>
                    <SelectItem value="carte_bancaire">Carte bancaire</SelectItem>
                    <SelectItem value="virement">Virement</SelectItem>
                    <SelectItem value="cheque">Chèque</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-1">
                <Label className="text-xs">Fournisseur</Label>
                <Select value={form.supplierId} onValueChange={v => setForm({ ...form, supplierId: v })}>
                  <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                  <SelectContent>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">N° facture fournisseur</Label>
                <Input value={form.purchaseInvoiceNumber || ''} onChange={e => setForm({ ...form, purchaseInvoiceNumber: e.target.value })} placeholder="FAC-2026-001" className="font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Référence lot</Label>
                <Input value={form.lotReference} onChange={e => setForm({ ...form, lotReference: e.target.value })} placeholder="LOT-1-2026" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lot d'origine</Label>
                <Select value={form.lotOrigin || '__none__'} onValueChange={v => setForm({ ...form, lotOrigin: v === '__none__' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {getByTypeLocal('lot_origin').map(l => <SelectItem key={l.id} value={l.code}>{l.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Lot actuel</Label>
                <Input value={form.lotCurrent} onChange={e => setForm({ ...form, lotCurrent: e.target.value })} placeholder="Lot en cours" />
              </div>
            </div>
          </div>

          {/* Stockage & Logistique */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Stockage & Logistique
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Entrepôt</Label>
                <Input value={form.warehouse} onChange={e => setForm({ ...form, warehouse: e.target.value })} placeholder="Principal" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Rack</Label>
                <Input value={form.rack} onChange={e => setForm({ ...form, rack: e.target.value })} placeholder="Rack B" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Étagère</Label>
                <Input value={form.shelf} onChange={e => setForm({ ...form, shelf: e.target.value })} placeholder="3" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bin</Label>
                <Input value={form.bin} onChange={e => setForm({ ...form, bin: e.target.value })} placeholder="12" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Poids (g)</Label>
                <Input type="number" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} placeholder="500" />
              </div>
              {!multiVariant && (
              <div className="space-y-1.5">
                <Label className="text-xs">Quantité disponible</Label>
                <Input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder="1" />
                {item && item.soldCount > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    {item.soldCount} unité{item.soldCount > 1 ? 's' : ''} déjà vendue{item.soldCount > 1 ? 's' : ''} (non modifiable ici)
                  </p>
                )}
              </div>
              )}
            </div>
          </div>

          {/* Publication */}
          <div className="border rounded-lg p-3 bg-muted/20">
            <h4 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Tag className="h-4 w-4" /> Publication
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Statut</Label>
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PUBLICATION_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prix conseillé (€)</Label>
                <Input type="number" step="0.01" value={form.suggestedPrice} onChange={e => setForm({ ...form, suggestedPrice: e.target.value })} placeholder="29.99" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prix promo (€) {form.saleActive && <span className="text-green-600 font-semibold">— Actif</span>}</Label>
                <div className="flex gap-2 items-center">
                  <Input type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="19.99" disabled={!form.saleActive} className="flex-1" />
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={form.saleActive}
                      onChange={e => setForm({ ...form, saleActive: e.target.checked })}
                      className="rounded"
                    />
                    Promo
                  </label>
                </div>
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs">Plateforme(s) de publication</Label>
                <div className="border rounded-md p-2 flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {getByTypeLocal('platform').map(p => {
                    const platList: string[] = (() => {
                      try { return JSON.parse(form.platforms || '[]') } catch { return [] }
                    })()
                    const checked = platList.includes(p.code)
                    return (
                      <label key={p.code} className="flex items-center gap-1.5 cursor-pointer text-xs hover:bg-muted/60 px-2 py-1 rounded border border-transparent hover:border-border">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const current: string[] = (() => {
                              try { return JSON.parse(form.platforms || '[]') } catch { return [] }
                            })()
                            const next = e.target.checked
                              ? [...current, p.code]
                              : current.filter(x => x !== p.code)
                            setForm({ ...form, platforms: JSON.stringify(next) })
                          }}
                          className="h-3.5 w-3.5 rounded border-border"
                        />
                        <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getPlatformColor(p.code))}>
                          {p.value}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Sélectionnez les plateformes où l'article est publié. Au moment de la vente, seule la plateforme effective sera conservée.
                  <a href="/settings" target="_blank" className="text-blue-600 hover:underline ml-1">Gérer la liste dans Paramètres → Attributs</a>
                </p>
              </div>
              {form.status === 'VENDU' && (
                <div className="space-y-1.5 md:col-span-3">
                  <Label className="text-xs">Plateforme de vente effective</Label>
                  <Select
                    value={form.platform || '__none__'}
                    onValueChange={v => setForm({ ...form, platform: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger className="max-w-md"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {getByTypeLocal('platform').map(p => <SelectItem key={p.code} value={p.code}>{p.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs">Plateforme de vente (attribut)</Label>
                <Select value={form.salePlatform || '__none__'} onValueChange={v => setForm({ ...form, salePlatform: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="max-w-md"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {getByTypeLocal('platform').map(p => <SelectItem key={p.id} value={p.code}>{p.value}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Description</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    onClick={generateDescription}
                    disabled={generating || !form.brand}
                    title={form.brand ? 'Générer une description avec l\'IA' : 'Renseignez la marque d\'abord'}
                  >
                    {generating ? (
                      <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Génération…</>
                    ) : (
                      <><Sparkles className="h-3 w-3 mr-1" /> Générer avec l'IA</>
                    )}
                  </Button>
                </div>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Description de l'article — cliquez sur « Générer avec l'IA » pour une description automatique optimisée…"
                  rows={4}
                  className="resize-y"
                />
                {generating && (
                  <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    L'IA rédige une description basée sur la marque, catégorie, taille, couleur et état…
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : (item ? 'Modifier' : 'Créer l\'article')}
          </Button>
        </DialogFooter>

        {/* Photo session picker (modal within modal) */}
        {showSessionPicker && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowSessionPicker(false)}
          >
            <div
              className="bg-background rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  Importer depuis shooting
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowSessionPicker(false)}>
                  Fermer
                </Button>
              </div>
              <div className="p-4 overflow-y-auto flex-1">
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : photoSessions.length === 0 ? (
                  <div className="text-center py-8">
                    <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Aucune session de shooting avec photos disponible.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Créez une session dans le module "Shooting Photo" d'abord.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {photoSessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex -space-x-2">
                          {session.photos.slice(0, 4).map((p, i) => (
                            <img
                              key={p.id}
                              src={p.path}
                              alt=""
                              className="w-12 h-12 rounded-md object-cover border-2 border-background"
                              style={{ zIndex: 4 - i }}
                            />
                          ))}
                          {session.photos.length > 4 && (
                            <div className="w-12 h-12 rounded-md border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                              +{session.photos.length - 4}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{session.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {session.photos.length} photo(s) ·{' '}
                            {new Date(session.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                          {session.notes && (
                            <p className="text-xs text-muted-foreground truncate">{session.notes}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          onClick={() => importFromSession(session.id)}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Importer
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StockDetail({ open, onOpenChange, item }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  item: StockItem | null
}) {
  const { getLabel } = useSettings()
  const [showQR, setShowQR] = useState(false)

  if (!item) return null
  const photos: string[] = (() => {
    try { return JSON.parse(item.photos) } catch { return [] }
  })()
  const location = [item.warehouse, item.rack, item.shelf ? `Étagère ${item.shelf}` : null, item.bin ? `Bac ${item.bin}` : null].filter(Boolean).join(' · ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {item.brand}
            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => {
                  window.open(`/api/stock/${item.id}/export`, '_blank')
                  toast.success('Export zip téléchargé')
                }}
                title="Exporter en zip (infos + photos) pour Vinted"
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export zip
              </Button>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setShowQR(true)}>
                <QrCode className="h-3.5 w-3.5 mr-1" /> QR Code
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {photos[0] && (
            <div className="aspect-[4/3] w-full rounded-lg overflow-hidden bg-muted">
              <img src={photoUrl(photos[0])} alt={item.brand} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', getPubStatusColor(item.status))}>
              {getPubStatusLabel(item.status)}
            </span>
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
              {item.quantity} dispo{item.quantity > 1 ? 's' : ''}
            </span>
            {item.soldCount > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {item.soldCount} vendu{item.soldCount > 1 ? 's' : ''}
              </span>
            )}
            {item.platform && (
              <span className={cn('text-xs font-semibold px-2 py-1 rounded-full', getPlatformColor(item.platform))}>
                {getLabel('platform', item.platform)} (vente)
              </span>
            )}
            {(() => {
              const platList: string[] = (() => {
                try { return JSON.parse(item.platforms || '[]') } catch { return [] }
              })()
              return platList.filter(p => p !== item.platform).map(p => (
                <span key={p} className={cn('text-xs font-semibold px-2 py-1 rounded-full', getPlatformColor(p))}>
                  {getLabel('platform', p)}
                </span>
              ))
            })()}
            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-muted">
              {getLabel('condition', item.condition)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Detail label="Catégorie" value={getLabel('category', item.category)} />
            <Detail label="Taille" value={item.size || '—'} />
            <Detail label="Couleur" value={item.color || '—'} />
            <Detail label="Lot" value={item.lotReference || '—'} />
            <Detail label="Code-barres" value={item.barcode || '—'} icon={<Barcode className="h-3 w-3" />} />
            <Detail label="Fournisseur" value={item.supplier?.name || '—'} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm pt-3 border-t">
            <Detail label="Coût d'achat" value={formatEUR(item.purchaseCost)} />
            <Detail label="Prix conseillé" value={item.suggestedPrice ? formatEUR(item.suggestedPrice) : '—'} />
            <Detail label="Date d'achat" value={formatDate(item.purchaseDate)} />
            <Detail label="Emplacement" value={location || '—'} icon={<MapPin className="h-3 w-3" />} />
          </div>
          {item.description && (
            <div className="text-sm bg-muted/40 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase mb-1">Description</p>
              <p>{item.description}</p>
            </div>
          )}
          {item.sales && item.sales.length > 0 && (
            <div className="text-sm bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase mb-1 font-semibold">
                Vendu ({item.sales.length} unité{item.sales.length > 1 ? 's' : ''})
              </p>
              <div className="flex items-center justify-between">
                <span>Prix de vente (dernier)</span>
                <span className="font-semibold">{formatEUR(item.sales[0].salePrice)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Bénéfice total</span>
                <span className="font-semibold text-emerald-600">
                  {formatEUR(item.sales.reduce((s, sl) => s + sl.profit, 0))}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 text-xs text-emerald-700/80 dark:text-emerald-300/80">
                <span>CA total</span>
                <span>{formatEUR(item.sales.reduce((s, sl) => s + sl.salePrice, 0))}</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Modale QR Code */}
      <Dialog open={showQR} onOpenChange={setShowQR}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-center">
              <QrCode className="h-5 w-5" /> QR Code
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl border">
              <img
                src={`/api/stock/${item.id}/qrcode`}
                alt={`QR code ${item.sku}`}
                className="w-48 h-48"
              />
            </div>
            <div className="text-center">
              <p className="font-semibold">{item.brand}</p>
              <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Scannez avec l'app mobile pour retrouver cet article
              </p>
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`/api/stock/${item.id}/qrcode`, '_blank')}
              >
                Ouvrir
              </Button>
              <a
                href={`/api/stock/${item.id}/qrcode`}
                download={`qr-${item.sku}.png`}
                className="flex-1"
              >
                <Button className="w-full">
                  Télécharger
                </Button>
              </a>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.print()}
            >
              Imprimer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  )
}

function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="font-medium mt-0.5">{value}</p>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PurchaseForm — Achat hors stock (fournitures, emballages, outils...)
// ═══════════════════════════════════════════════════════════════════════════

function PurchaseForm({ open, onOpenChange, suppliers, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  suppliers: Supplier[]
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    designation: '',
    category: 'fourniture',
    supplierId: '',
    supplierName: '',
    amount: '',
    invoiceNumber: '',
    paymentMethod: '',
    notes: '',
  })

  const submit = async () => {
    if (!form.designation || !form.amount) {
      toast.error('Désignation et montant requis')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success('Achat hors stock enregistré')
      setForm({
        date: new Date().toISOString().split('T')[0],
        designation: '', category: 'fourniture', supplierId: '', supplierName: '',
        amount: '', invoiceNumber: '', paymentMethod: '', notes: '',
      })
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Achat hors stock</DialogTitle>
          <DialogDescription>
            Fournitures de bureau, emballages, outils... Comptabilisé dans le registre des achats mais pas dans le stock.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Désignation *</Label>
            <Input value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} placeholder="Cartons d'emballage x50" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Montant TTC (€) *</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="29.99" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fourniture">Fourniture bureau</SelectItem>
                  <SelectItem value="emballage">Emballage</SelectItem>
                  <SelectItem value="outil">Outil</SelectItem>
                  <SelectItem value="materiel">Matériel</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Mode de paiement</Label>
              <Select value={form.paymentMethod || '__none__'} onValueChange={v => setForm({ ...form, paymentMethod: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  <SelectItem value="especes">Espèces</SelectItem>
                  <SelectItem value="carte_bancaire">Carte bancaire</SelectItem>
                  <SelectItem value="virement">Virement</SelectItem>
                  <SelectItem value="cheque">Chèque</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Fournisseur</Label>
              <Select value={form.supplierId || '__none__'} onValueChange={v => setForm({ ...form, supplierId: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° facture</Label>
              <Input value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} placeholder="FAC-2026-001" className="font-mono text-sm" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes optionnelles..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer l\'achat'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LotForm — Créer un lot à partir d'articles existants en stock
// ═══════════════════════════════════════════════════════════════════════════

function LotForm({ stockItems, onOpenChange, onSaved }: {
  stockItems: StockItem[]
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [name, setName] = useState('')
  const [lotItems, setLotItems] = useState<{ stockItemId: string; quantity: number }[]>([])
  const [lotPrice, setLotPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCategory, setPickerCategory] = useState('')
  const [pickerSubcat, setPickerSubcat] = useState('')
  const [pickerSearch, setPickerSearch] = useState('')

  // Calculate total from selected items
  const calculatedTotal = useMemo(() => {
    return lotItems.reduce((sum, li) => {
      const item = stockItems.find(s => s.id === li.stockItemId)
      if (!item) return sum
      const price = item.suggestedPrice ? parseFloat(item.suggestedPrice.toString()) : 0
      return sum + price * li.quantity
    }, 0)
  }, [lotItems, stockItems])

  const updateQty = (stockItemId: string, qty: number) => {
    setLotItems(prev => prev.map(li => li.stockItemId === stockItemId ? { ...li, quantity: Math.max(1, qty) } : li))
  }

  const removeItem = (stockItemId: string) => {
    setLotItems(prev => prev.filter(li => li.stockItemId !== stockItemId))
  }

  const addItem = (stockItemId: string) => {
    if (lotItems.find(li => li.stockItemId === stockItemId)) return
    const item = stockItems.find(s => s.id === stockItemId)
    if (!item) return
    setLotItems(prev => [...prev, { stockItemId, quantity: 1 }])
    setPickerOpen(false)
  }

  const submit = async () => {
    if (!name.trim()) { toast.error('Nom du lot requis'); return }
    if (lotItems.length === 0) { toast.error('Ajoutez au moins un article'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/stock/lot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          lotPrice: parseFloat(lotPrice) || calculatedTotal,
          items: lotItems,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Lot créé ! Stock décrémenté.')
      onSaved()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent className="sm:!max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" /> Nouveau Lot
          </DialogTitle>
          <DialogDescription>
            Composez un lot à partir d'articles en stock. Le stock de chaque article sera décrémenté.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Nom du lot */}
          <div className="space-y-1.5">
            <Label className="text-xs">Nom du lot *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lot été 2026 — 5 articles" />
          </div>

          {/* Bouton ajouter article */}
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter un article
          </Button>

          {/* Liste des articles du lot */}
          {lotItems.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b">
                  <tr className="text-left text-[10px] uppercase text-muted-foreground">
                    <th className="px-3 py-2">Article</th>
                    <th className="px-3 py-2 text-center">Qté</th>
                    <th className="px-3 py-2 text-right">Prix unit.</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {lotItems.map(li => {
                    const item = stockItems.find(s => s.id === li.stockItemId)
                    if (!item) return null
                    const price = item.suggestedPrice ? parseFloat(item.suggestedPrice.toString()) : 0
                    return (
                      <tr key={li.stockItemId} className="border-b last:border-0">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.brand} {item.title || item.category}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.size && `Taille ${item.size}`}
                            {item.color && ` · ${item.color}`}
                            {` · Stock: ${item.quantity}`}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={li.quantity}
                            onChange={e => updateQty(li.stockItemId, parseInt(e.target.value) || 1)}
                            className="w-16 h-8 text-center text-sm mx-auto"
                          />
                        </td>
                        <td className="px-3 py-2 text-right text-sm">{price.toFixed(2)} €</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold">{(price * li.quantity).toFixed(2)} €</td>
                        <td className="px-3 py-2 text-right">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => removeItem(li.stockItemId)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Layers className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun article dans le lot. Cliquez sur "Ajouter un article".</p>
            </div>
          )}

          {/* Total + prix du lot */}
          <div className="flex items-end justify-between gap-4 pt-3 border-t">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Total calculé (somme des articles)</p>
              <p className="text-lg font-bold">{calculatedTotal.toFixed(2)} €</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Prix du lot (€) — modifiable</Label>
              <Input
                type="number"
                step="0.01"
                value={lotPrice || calculatedTotal.toFixed(2)}
                onChange={e => setLotPrice(e.target.value)}
                className="w-32 text-right"
                placeholder={calculatedTotal.toFixed(2)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving || lotItems.length === 0 || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Layers className="h-4 w-4 mr-2" />}
            {saving ? 'Création...' : 'Créer le lot'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Product picker (reuse the pattern from preorder) */}
      {pickerOpen && (
        <Dialog open={true} onOpenChange={(o) => { if (!o) setPickerOpen(false) }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter un article au lot</DialogTitle>
              <DialogDescription>Sélectionnez un article en stock (non vendu, quantité supérieure à 0).</DialogDescription>
            </DialogHeader>
            {/* Filters */}
            <div className="grid grid-cols-3 gap-2 pb-2">
              <Select value={pickerCategory || '__all__'} onValueChange={v => { setPickerCategory(v === '__all__' ? '' : v); setPickerSubcat('') }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes catégories</SelectItem>
                  {Array.from(new Set(stockItems.map(s => s.category))).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={pickerSubcat || '__all__'} onValueChange={v => setPickerSubcat(v === '__all__' ? '' : v)} disabled={!pickerCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sous-cat." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes</SelectItem>
                  {Array.from(new Set(stockItems.filter(s => s.category === pickerCategory && s.subcategory).map(s => s.subcategory))).map(sc => <SelectItem key={sc} value={sc as string}>{sc}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Rechercher…" className="h-8 text-xs" />
            </div>
            <div className="max-h-[45vh] overflow-y-auto space-y-1">
              {stockItems
                .filter(s => s.status !== 'VENDU' && s.quantity > 0 && !lotItems.find(li => li.stockItemId === s.id))
                .filter(s => !pickerCategory || s.category === pickerCategory)
                .filter(s => !pickerSubcat || s.subcategory === pickerSubcat)
                .filter(s => !pickerSearch || s.brand.toLowerCase().includes(pickerSearch.toLowerCase()) || (s.title || '').toLowerCase().includes(pickerSearch.toLowerCase()) || s.sku.toLowerCase().includes(pickerSearch.toLowerCase()))
                .map(s => {
                  const photos: string[] = (() => { try { return JSON.parse(s.photos) } catch { return [] } })()
                  const photo = photos[0] ? (photos[0].startsWith('/uploads/') ? `/api${photos[0]}` : photos[0]) : null
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => addItem(s.id)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg border hover:border-[#007bff] hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                        {photo ? (
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-gray-300"><Package className="h-6 w-6" /></div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{s.brand} {s.title || s.category}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.size && `Taille ${s.size} · `}{s.color && `${s.color} · `}Stock: {s.quantity}
                        </p>
                      </div>
                      <span className="text-sm font-semibold shrink-0">
                        {s.suggestedPrice ? parseFloat(s.suggestedPrice.toString()).toFixed(2) + ' €' : '—'}
                      </span>
                    </button>
                  )
                })}
              {stockItems
                .filter(s => s.status !== 'VENDU' && s.quantity > 0 && !lotItems.find(li => li.stockItemId === s.id))
                .filter(s => !pickerCategory || s.category === pickerCategory)
                .filter(s => !pickerSubcat || s.subcategory === pickerSubcat)
                .filter(s => !pickerSearch || s.brand.toLowerCase().includes(pickerSearch.toLowerCase()) || (s.title || '').toLowerCase().includes(pickerSearch.toLowerCase()) || s.sku.toLowerCase().includes(pickerSearch.toLowerCase()))
                .length === 0 && (
                <p className="text-center py-8 text-muted-foreground text-sm">Aucun article disponible.</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  )
}
