'use client'

import { useState, useMemo, useRef } from 'react'
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
import { Plus, ShoppingCart, Search, Euro, TrendingUp, Percent, Edit, Trash2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import {
  formatEUR, formatDateTime, PLATFORMS, CARRIERS, PARCEL_STATUSES,
  getPlatformLabel, getPlatformColor, getCarrierLabel, getParcelStatusLabel, getParcelStatusColor,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/shared/confirm-provider'
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
  const { data: sales, loading, refresh } = useFetch<Sale[]>('/api/sales')
  const { data: stockItems } = useFetch<StockItem[]>('/api/stock')
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)

  const availableItems = (stockItems || []).filter(i => i.status === 'PUBLIE' || i.status === 'RESERVE')

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
                {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              onClick={() => { setEditingSale(null); setShowForm(true) }}
              disabled={availableItems.length === 0 && !editingSale}
            >
              <Plus className="h-4 w-4 mr-2" /> Nouvelle vente
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
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={() => { setEditingSale(s); setShowForm(true) }}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                              onClick={() => handleDelete(s.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
  const [form, setForm] = useState({
    stockItemId: '',
    saleDate: new Date().toISOString().split('T')[0],
    platform: 'vinted',
    customerName: '',
    customerContact: '',
    salePrice: '',
    shippingCost: '4.95',
    carrierShippingCost: '',
    platformFeesPercent: '',
    platformFixedFees: '',
    carrier: 'mondial_relay',
    trackingNumber: '',
    parcelStatus: 'A_PREPARER',
    notes: '',
  })

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
      platformFeesPercent: '',  // En édition, on conserve le montant € existant
      platformFixedFees: String(editingSale.platformFixedFees || 0),
      carrier: editingSale.carrier || 'mondial_relay',
      trackingNumber: editingSale.trackingNumber || '',
      parcelStatus: editingSale.parcelStatus,
      notes: editingSale.notes || '',
    })
    // Garder une trace des frais € pour l'envoi
    ;(form as Record<string, unknown>)._platformFeesEuro = feesEuro
  }
  if (!editingSale && lastEditingId.current !== null) {
    lastEditingId.current = null
  }

  const selectedItem = availableItems.find(i => i.id === form.stockItemId) ||
    (editingSale ? editingSale.stockItem : null)

  // En mode création : auto-remplir les frais selon la plateforme
  const platformDefault = PLATFORM_DEFAULT_FEES[form.platform] || { percent: 0, fixed: 0 }
  const autoPercent = form.platformFeesPercent || String(platformDefault.percent)
  const autoFixed = form.platformFixedFees || String(platformDefault.fixed)

  // En mode édition, on garde le montant € existant
  const feesEuro = editingSale
    ? (editingSale.platformFees || 0)
    : (form.salePrice ? parseFloat(form.salePrice) * (parseFloat(autoPercent) || 0) / 100 : 0)

  const projectedProfit = (selectedItem && form.salePrice)
    ? (parseFloat(form.salePrice) + (parseFloat(form.shippingCost || '0') || 0))  // CA
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
            ) : (
              <Select value={form.stockItemId} onValueChange={v => setForm({ ...form, stockItemId: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un article" /></SelectTrigger>
                <SelectContent>
                  {availableItems.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.sku} — {i.brand} ({i.size})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  {PLATFORMS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
    </Dialog>
  )
}
