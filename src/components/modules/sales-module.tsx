'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Plus, ShoppingCart, Search, Euro, TrendingUp, Percent, Edit, Trash2, FileText, Package, Barcode } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/use-permissions'
import {
  formatEUR, formatDateTime, PLATFORMS, CARRIERS, PARCEL_STATUSES,
  getPlatformLabel, getPlatformColor, getCarrierLabel, getParcelStatusLabel, getParcelStatusColor,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/shared/confirm-provider'
import { useSettings } from '@/hooks/use-settings'
import { useBoutiqueCategories } from '@/hooks/use-boutique-categories'
import { BarcodeScannerModal } from '@/components/stock/barcode-scanner'
import type { StockItem } from './stock-module'

interface Sale {
  id: string
  stockItemId: string
  stockItem: StockItem
  saleDate: string
  platform: string
  customerName: string | null
  customerContact: string | null
  salePrice: number
  shippingCost: number
  carrierShippingCost?: number
  paymentFees?: number
  platformFees: number
  platformFixedFees?: number
  profit: number
  margin: number
  carrier: string | null
  trackingNumber: string | null
  parcelStatus: string
  notes: string | null
}

// Valeurs par défaut des frais par plateforme (au cas où l'utilisateur ne saisit rien)
const PLATFORM_DEFAULT_FEES: Record<string, { percent: number; fixed: number }> = {
  vinted: { percent: 5, fixed: 0.7 },
  leboncoin: { percent: 0, fixed: 0 },
  ebay: { percent: 13, fixed: 0.35 },
  vestiaire: { percent: 15, fixed: 0 },
}

export function SalesModule() {
  const confirm = useConfirm()
  const { getByType } = useSettings()
  const platforms = getByType('platform')
  const { data: sales, loading, refresh } = useFetch<Sale[]>('/api/sales')
  const { data: stockItems } = useFetch<StockItem[]>('/api/stock')
  const { can } = usePermissions()
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const availableItems = (stockItems || []).filter(i => i.status !== 'VENDU')

  const filtered = useMemo(() => {
    if (!sales) return []
    return sales.filter(s => {
      if (platformFilter !== 'all' && s.platform !== platformFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.stockItem.sku.toLowerCase().includes(q) ||
          s.stockItem.brand.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.trackingNumber?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [sales, search, platformFilter])

  const totalCA = filtered.reduce((s, x) => s + x.salePrice, 0)
  const totalProfit = filtered.reduce((s, x) => s + x.profit, 0)
  const avgMargin = totalCA > 0 ? (totalProfit / totalCA) * 100 : 0

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer cette vente ?',
      description: 'L\'article repassera en statut "Publié".',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    const res = await fetch(`/api/sales/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Vente supprimée')
      refresh()
    } else {
      toast.error('Erreur')
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Ventes</p>
            </div>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Euro className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">CA total</p>
            </div>
            <p className="text-2xl font-bold">{formatEUR(totalCA)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase">Bénéfice</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatEUR(totalProfit)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Percent className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Marge moy.</p>
            </div>
            <p className="text-2xl font-bold">{avgMargin.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par SKU, marque, client, n° suivi..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Plateforme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes plateformes</SelectItem>
                {platforms.map(p => <SelectItem key={p.code} value={p.code}>{p.value}</SelectItem>)}
              </SelectContent>
            </Select>
            {can('sales', 'create') && (
            <Button
              onClick={() => { setEditingSale(null); setShowForm(true) }}
              disabled={availableItems.length === 0 && !editingSale}
            >
              <Plus className="h-4 w-4 mr-2" /> Nouvelle vente
            </Button>
            )}
            <Button
              variant="outline"
              onClick={() => window.open('/admin/factures', '_blank')}
              title="Liste des factures émises"
            >
              <FileText className="h-4 w-4 mr-2" /> Factures
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Aucune vente</p>
            <p className="text-xs text-muted-foreground mt-1">Enregistrez votre première vente pour démarrer.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Article</th>
                    <th className="px-3 py-2.5 font-medium">N° facture</th>
                    <th className="px-3 py-2.5 font-medium">Plateforme</th>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium text-right">Prix</th>
                    <th className="px-3 py-2.5 font-medium text-right hidden lg:table-cell">Frais</th>
                    <th className="px-3 py-2.5 font-medium text-right">Marge</th>
                    <th className="px-3 py-2.5 font-medium text-right">Profit</th>
                    <th className="px-3 py-2.5 font-medium hidden md:table-cell">Transporteur</th>
                    <th className="px-3 py-2.5 font-medium">Statut colis</th>
                    <th className="px-3 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const totalFees = (s.platformFees || 0) + (s.platformFixedFees || 0)
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground">
                          {formatDateTime(s.saleDate)}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{s.stockItem.brand}</p>
                          <p className="text-xs text-muted-foreground font-mono">{s.stockItem.sku}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          {s.invoiceNumber ? (
                            <a
                              href={`/api/invoices/${s.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 px-1.5 py-0.5 rounded font-mono transition-colors"
                              title="Voir la facture PDF"
                            >
                              <FileText className="h-3 w-3" />
                              {s.invoiceNumber}
                            </a>
                          ) : (
                            <a
                              href={`/api/invoices/${s.id}/pdf`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] bg-muted hover:bg-muted/80 px-1.5 py-0.5 rounded transition-colors text-muted-foreground"
                              title="Générer la facture"
                            >
                              <FileText className="h-3 w-3" /> Générer
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getPlatformColor(s.platform))}>
                            {getPlatformLabel(s.platform)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs">{s.customerName || '—'}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatEUR(s.salePrice)}</td>
                        <td className="px-3 py-2.5 text-right text-xs text-rose-600 hidden lg:table-cell">
                          -{formatEUR(totalFees)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Badge variant="outline" className="font-mono">{s.margin}%</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{formatEUR(s.profit)}</td>
                        <td className="px-3 py-2.5 text-xs hidden md:table-cell">{s.carrier ? getCarrierLabel(s.carrier) : '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', getParcelStatusColor(s.parcelStatus))}>
                            {getParcelStatusLabel(s.parcelStatus)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {can('sales', 'edit') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { setEditingSale(s); setShowForm(true) }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            )}
                            {can('sales', 'delete') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                              onClick={() => handleDelete(s.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form (create or edit) */}
      <SaleForm
        open={showForm}
        onOpenChange={setShowForm}
        availableItems={availableItems}
        editingSale={editingSale}
        onSaved={() => { setShowForm(false); setEditingSale(null); refresh() }}
      />
    </div>
  )
}

function SaleForm({ open, onOpenChange, availableItems, editingSale, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  availableItems: StockItem[]
  editingSale: Sale | null
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerCategory, setPickerCategory] = useState('')
  const [pickerSubcat, setPickerSubcat] = useState('')
  const [pickerSearch, setPickerSearch] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [pickerFilteredIds, setPickerFilteredIds] = useState<Set<string> | null>(null)
  const { getByType } = useSettings()
  const { categories: boutiqueCats, getSubcategories: getBoutiqueSubcats } = useBoutiqueCategories()
  const platforms = getByType('platform')
  // Plateforme par défaut = première plateforme des settings, ou 'vinted' en fallback
  const defaultPlatformCode = platforms[0]?.code || 'vinted'
  const [form, setForm] = useState({
    stockItemId: '',
    saleDate: new Date().toISOString().split('T')[0],
    platform: defaultPlatformCode,
    customerName: '',
    customerContact: '',
    salePrice: '',
    shippingCost: '4.95',
    carrierShippingCost: '',
    paymentFees: '',
    platformFeesPercent: '',
    platformFixedFees: '',
    carrier: 'mondial_relay',
    trackingNumber: '',
    parcelStatus: 'A_PREPARER',
    notes: '',
    paymentMethod: '',
  })

  // Auto-remplir les frais depuis les settings quand la plateforme change (en mode création)
  // On utilise un effet pour détecter le changement de plateforme et pré-remplir si les champs sont vides
  useEffect(() => {
    if (editingSale) return // Pas d'auto-fill en édition
    const platformAttr = platforms.find(p => p.code === form.platform)
    if (platformAttr) {
      setForm(prev => ({
        ...prev,
        platformFeesPercent: String(platformAttr.percentFees ?? 0),
        platformFixedFees: String(platformAttr.fixedFees ?? 0),
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.platform])

  // Sync form quand on ouvre en mode édition
  const lastEditingId = useRef<string | null>(null)
  if (editingSale && editingSale.id !== lastEditingId.current) {
    lastEditingId.current = editingSale.id
    // Pour une vente existante, on ne connaît pas le % exact, on affiche juste le montant €
    const feesEuro = editingSale.platformFees || 0
    setForm({
      stockItemId: editingSale.stockItemId,
      saleDate: new Date(editingSale.saleDate).toISOString().split('T')[0],
      platform: editingSale.platform,
      customerName: editingSale.customerName || '',
      customerContact: editingSale.customerContact || '',
      salePrice: String(editingSale.salePrice),
      shippingCost: String(editingSale.shippingCost),
      carrierShippingCost: String(editingSale.carrierShippingCost || 0),
      paymentFees: String(editingSale.paymentFees || 0),
      platformFeesPercent: '',  // En édition, on conserve le montant € existant
      platformFixedFees: String(editingSale.platformFixedFees || 0),
      carrier: editingSale.carrier || 'mondial_relay',
      trackingNumber: editingSale.trackingNumber || '',
      parcelStatus: editingSale.parcelStatus,
      notes: editingSale.notes || '',
      paymentMethod: (editingSale as any).paymentMethod || '',
    })
    // Garder une trace des frais € pour l'envoi
    ;(form as Record<string, unknown>)._platformFeesEuro = feesEuro
  }
  if (!editingSale && lastEditingId.current !== null) {
    lastEditingId.current = null
  }

  const selectedItem = availableItems.find(i => i.id === form.stockItemId) ||
    (editingSale ? editingSale.stockItem : null)

  // En mode création : récupérer les frais depuis les settings (déjà auto-remplis via useEffect)
  // En fallback, utiliser PLATFORM_DEFAULT_FEES (hard-coded)
  const platformAttr = platforms.find(p => p.code === form.platform)
  const platformDefault = platformAttr
    ? { percent: platformAttr.percentFees ?? 0, fixed: platformAttr.fixedFees ?? 0 }
    : (PLATFORM_DEFAULT_FEES[form.platform] || { percent: 0, fixed: 0 })
  const autoPercent = form.platformFeesPercent || String(platformDefault.percent)
  const autoFixed = form.platformFixedFees || String(platformDefault.fixed)

  // En mode édition, on garde le montant € existant
  const feesEuro = editingSale
    ? (editingSale.platformFees || 0)
    : (form.salePrice ? parseFloat(form.salePrice) * (parseFloat(autoPercent) || 0) / 100 : 0)

  const projectedProfit = (selectedItem && form.salePrice)
    ? (parseFloat(form.salePrice) + (parseFloat(form.shippingCost || '0') || 0))  // CA brut
      - (parseFloat(form.paymentFees || '0') || 0)  // frais bancaires (déduits du CA)
      - selectedItem.purchaseCost
      - feesEuro
      - (parseFloat(autoFixed) || 0)
      - (parseFloat(form.carrierShippingCost || '0') || 0)
    : 0

  const submit = async () => {
    if (!form.salePrice || (!form.stockItemId && !editingSale)) {
      toast.error('Article et prix de vente requis')
      return
    }
    setSaving(true)
    try {
      const payload = {
        stockItemId: form.stockItemId,
        saleDate: form.saleDate,
        platform: form.platform,
        customerName: form.customerName,
        customerContact: form.customerContact,
        salePrice: form.salePrice,
        shippingCost: form.shippingCost,
        carrierShippingCost: form.carrierShippingCost || '0',
        paymentFees: form.paymentFees || '0',
        paymentMethod: form.paymentMethod || null,
        // En édition : envoyer le montant € existant. En création : calculer depuis le %
        platformFees: editingSale ? String(editingSale.platformFees) : String(feesEuro.toFixed(2)),
        platformFixedFees: autoFixed,
        carrier: form.carrier,
        trackingNumber: form.trackingNumber,
        parcelStatus: form.parcelStatus,
        notes: form.notes,
      }

      const url = editingSale ? `/api/sales/${editingSale.id}` : '/api/sales'
      const method = editingSale ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      toast.success(editingSale ? 'Vente modifiée' : 'Vente enregistrée')
      onSaved()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  // Auto-select first available item in create mode
  if (open && !editingSale && !form.stockItemId && availableItems.length > 0) {
    setForm(f => ({ ...f, stockItemId: availableItems[0].id }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={editingSale?.id || 'new'}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingSale ? 'Modifier la vente' : 'Enregistrer une vente'}</DialogTitle>
          <DialogDescription>
            {editingSale
              ? `Édition de la vente de ${editingSale.stockItem.brand}`
              : 'La marge et le bénéfice sont calculés automatiquement.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {/* Article (non modifiable en édition) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Article *</Label>
            {editingSale ? (
              <Input
                value={`${editingSale.stockItem.sku} — ${editingSale.stockItem.brand} (${editingSale.stockItem.size || '—'})`}
                disabled
              />
            ) : form.stockItemId ? (
              <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30">
                <span className="text-xs text-muted-foreground truncate">
                  {selectedItem ? `${selectedItem.brand} ${selectedItem.title || selectedItem.category} ${selectedItem.size ? '· ' + selectedItem.size : ''} ${selectedItem.color ? '· ' + selectedItem.color : ''}` : ''}
                </span>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setPickerFilteredIds(null); setPickerOpen(true) }} title="Changer d'article">
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setScannerOpen(true)} title="Scanner un code-barres">
                    <Barcode className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => setForm({ ...form, stockItemId: '' })} title="Détacher">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-1">
                <Button type="button" variant="outline" size="sm" onClick={() => { setPickerFilteredIds(null); setPickerOpen(true) }} className="flex-1 justify-start text-muted-foreground">
                  <Search className="h-4 w-4 mr-2" /> Rechercher un article…
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setScannerOpen(true)} className="shrink-0" title="Scanner un code-barres">
                  <Barcode className="h-4 w-4" />
                </Button>
              </div>
            )}
            {selectedItem && (
              <p className="text-xs text-muted-foreground">
                Coût d'achat : <span className="font-medium text-foreground">{formatEUR(selectedItem.purchaseCost)}</span>
              </p>
            )}
          </div>

          {/* Prix + date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Prix de vente (€) *</Label>
              <Input type="number" step="0.01" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} placeholder="29.99" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date de vente</Label>
              <Input type="date" value={form.saleDate} onChange={e => setForm({ ...form, saleDate: e.target.value })} />
            </div>
          </div>

          {/* Frais */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Frais port facturés client (€)</Label>
              <Input type="number" step="0.01" value={form.shippingCost} onChange={e => setForm({ ...form, shippingCost: e.target.value })} />
              <p className="text-[10px] text-muted-foreground">Revenu net (non déduit du CA)</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frais port réels transporteur (€)</Label>
              <Input type="number" step="0.01" value={form.carrierShippingCost} onChange={e => setForm({ ...form, carrierShippingCost: e.target.value })} placeholder="0.00" />
              <p className="text-[10px] text-muted-foreground">Charge réelle déduite du CA</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frais bancaires (€)</Label>
              <div className="flex gap-1">
                <Input type="number" step="0.01" value={form.paymentFees} onChange={e => setForm({ ...form, paymentFees: e.target.value })} placeholder="0.00" className="flex-1" />
                <Select
                  value={form.paymentMethod || '__none__'}
                  onValueChange={async (v) => {
                    if (v === '__none__') {
                      setForm({ ...form, paymentMethod: '', paymentFees: '0' })
                      return
                    }
                    // Fetch the payment method's fee settings
                    try {
                      const res = await fetch('/api/boutique/payments')
                      const data = await res.json()
                      const method = (data.methods || []).find((m: any) => m.code === v)
                      if (method) {
                        // Calculate fees: fixed + (salePrice × percent/100)
                        const salePrice = parseFloat(form.salePrice) || 0
                        const calculatedFees = (method.feesFixed || 0) + (salePrice * (method.feesPercent || 0) / 100)
                        setForm({ ...form, paymentMethod: v, paymentFees: calculatedFees.toFixed(2) })
                      }
                    } catch {}
                  }}
                >
                  <SelectTrigger className="w-[120px] shrink-0"><SelectValue placeholder="Méthode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Aucun</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                    <SelectItem value="paypal">PayPal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Sélectionnez Stripe/PayPal pour calculer automatiquement les frais depuis Boutique Admin → Paiements.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frais plateforme %</Label>
              <Input
                type="number"
                step="0.01"
                value={form.platformFeesPercent}
                onChange={e => setForm({ ...form, platformFeesPercent: e.target.value })}
                placeholder={String(platformDefault.percent)}
                disabled={!!editingSale}
              />
              {editingSale && (
                <p className="text-[10px] text-muted-foreground">Montant actuel : {formatEUR(editingSale.platformFees || 0)}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Frais plateforme fixe (€)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.platformFixedFees}
                onChange={e => setForm({ ...form, platformFixedFees: e.target.value })}
                placeholder={String(platformDefault.fixed)}
              />
              <p className="text-[10px] text-muted-foreground">Ex. 0,70€ Vinted Pro</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Plateforme</Label>
              <Select value={form.platform} onValueChange={v => setForm({ ...form, platform: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {platforms.map(p => <SelectItem key={p.code} value={p.code}>{p.value}</SelectItem>)}
                </SelectContent>
              </Select>
              {(() => {
                const platformAttr = platforms.find(p => p.code === form.platform)
                if (!platformAttr) return null
                const hasFees = (platformAttr.percentFees ?? 0) > 0 || (platformAttr.fixedFees ?? 0) > 0
                if (!hasFees) return null
                return (
                  <p className="text-[10px] text-muted-foreground">
                    Frais configurés : {platformAttr.percentFees ?? 0}% + {Number(platformAttr.fixedFees ?? 0).toFixed(2)}€ fixe
                  </p>
                )
              })()}
            </div>
          </div>

          {/* Client */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Client</Label>
              <Input value={form.customerName} onChange={e => setForm({ ...form, customerName: e.target.value })} placeholder="Nom du client" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact</Label>
              <Input value={form.customerContact} onChange={e => setForm({ ...form, customerContact: e.target.value })} placeholder="email / pseudo" />
            </div>
          </div>

          {/* Colis */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Transporteur</Label>
              <Select value={form.carrier} onValueChange={v => setForm({ ...form, carrier: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CARRIERS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° suivi</Label>
              <Input value={form.trackingNumber} onChange={e => setForm({ ...form, trackingNumber: e.target.value })} placeholder="MR12345678" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Statut colis</Label>
              <Select value={form.parcelStatus} onValueChange={v => setForm({ ...form, parcelStatus: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARCEL_STATUSES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Remarques, retours, litiges..."
              rows={2}
            />
          </div>

          {/* Récap bénéfice */}
          {projectedProfit !== 0 && form.salePrice && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Frais plateforme totaux</span>
                <span className="font-semibold text-rose-600">
                  -{formatEUR((feesEuro || 0) + (parseFloat(autoFixed) || 0))}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Bénéfice projeté</span>
                <span className="font-semibold text-emerald-600">{formatEUR(projectedProfit)}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-muted-foreground">Marge</span>
                <span className="font-semibold">
                  {form.salePrice ? ((projectedProfit / parseFloat(form.salePrice)) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : (editingSale ? 'Modifier la vente' : 'Enregistrer la vente')}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Article picker modal */}
      {pickerOpen && (
        <Dialog open={true} onOpenChange={(o) => { if (!o) setPickerOpen(false) }}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Rechercher un article</DialogTitle>
              <DialogDescription>Sélectionnez un article en stock (non vendu).</DialogDescription>
            </DialogHeader>
            {pickerFilteredIds && (
              <div className="flex items-center justify-between gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                <span>📋 {pickerFilteredIds.size} variantes trouvées par le scanner — choisissez la bonne.</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setPickerFilteredIds(null)}>
                  Voir tout
                </Button>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 pb-2">
              <Select value={pickerCategory || '__all__'} onValueChange={v => { setPickerCategory(v === '__all__' ? '' : v); setPickerSubcat('') }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes catégories</SelectItem>
                  {boutiqueCats.map(c => <SelectItem key={c.slug} value={c.slug}>{c.emoji} {c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={pickerSubcat || '__all__'} onValueChange={v => setPickerSubcat(v === '__all__' ? '' : v)} disabled={!pickerCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sous-cat." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Toutes</SelectItem>
                  {getBoutiqueSubcats(pickerCategory).map(sc => <SelectItem key={sc.slug} value={sc.slug}>{sc.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={pickerSearch} onChange={e => setPickerSearch(e.target.value)} placeholder="Rechercher…" className="h-8 text-xs" />
            </div>
            <div className="max-h-[50vh] overflow-y-auto space-y-1">
              {availableItems
                .filter(s => !pickerFilteredIds || pickerFilteredIds.has(s.id))
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
                      onClick={() => { setForm({ ...form, stockItemId: s.id }); setPickerOpen(false) }}
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
              {availableItems
                .filter(s => !pickerFilteredIds || pickerFilteredIds.has(s.id))
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

      {/* Barcode scanner modal */}
      <BarcodeScannerModal
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onFound={(data: any) => {
          // data is the full API response: { found, item, items? }
          const allItems = data.items || [data.item]
          const matchable = allItems.filter((s: any) => s.status !== 'VENDU')

          if (matchable.length === 0) {
            toast.error('Article trouvé mais déjà vendu')
            setScannerOpen(false)
            return
          }

          if (matchable.length === 1) {
            // Single match — select it directly
            setForm({ ...form, stockItemId: matchable[0].id })
            setScannerOpen(false)
            toast.success(`Article trouvé : ${matchable[0].brand} ${matchable[0].title || matchable[0].category || ''}`)
            return
          }

          // Multiple matches (variants) — open the picker filtered to only these items
          setScannerOpen(false)
          setPickerFilteredIds(new Set(matchable.map((s: any) => s.id)))
          setPickerSearch('')
          setPickerCategory('')
          setPickerSubcat('')
          toast.info(`${matchable.length} variantes trouvées — choisissez la bonne dans la liste`, {
            description: matchable.map((s: any) => `${s.size || '—'} ${s.color || ''}`.trim()).join(' · '),
          })
          setPickerOpen(true)
        }}
        onNotFound={(code: string) => {
          toast.error(`Aucun article avec le code-barres ${code}`)
        }}
      />
    </Dialog>
  )
}
