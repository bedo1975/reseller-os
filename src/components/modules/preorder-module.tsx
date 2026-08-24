'use client'

import { useState, useMemo, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useFetch } from '@/hooks/use-fetch'
import { useSettings } from '@/hooks/use-settings'
import { useBoutiqueCategories } from '@/hooks/use-boutique-categories'
import { BarcodeScannerModal } from '@/components/stock/barcode-scanner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Plus, Trash2, Loader2, ArrowLeft, ClipboardList, CheckCircle2, Clock,
  XCircle, Package, Edit3, FileText, ShoppingCart, PackagePlus, PackageCheck, Search,
  Upload, Download, Printer, ExternalLink, Barcode,
} from 'lucide-react'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

interface Supplier {
  id: string
  name: string
  type: string
}

interface StockItemLite {
  id: string
  sku: string
  title: string | null
  brand: string
  category: string
  subcategory: string | null
  size: string | null
  color: string | null
  condition: string
  photos: string  // JSON array
  quantity: number
  purchaseCost: number
}

interface PreOrderItem {
  designation: string
  url: string
  description: string
  size: string
  color: string
  condition: string
  quantity: number
  unitPrice: number
  stockItemId: string | null
}

interface PreOrder {
  id: string
  reference: string
  name: string
  supplierId: string | null
  supplier: Supplier | null
  supplierName: string | null
  orderDate: string
  items: string  // JSON
  subtotal: number
  shippingCost: number
  total: number
  paymentMethod: string | null
  notes: string | null
  status: string  // pending | validated | received | cancelled
  orderNumber: string | null
  invoiceNumber: string | null
  supplierInvoicePath: string | null
  supplierInvoiceName: string | null
  purchaseId: string | null
  validatedAt: string | null
  createdAt: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  validated: { label: 'Validée', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  received: { label: 'Reçue', color: 'bg-blue-100 text-blue-700', icon: PackageCheck },
  cancelled: { label: 'Annulée', color: 'bg-red-100 text-red-700', icon: XCircle },
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('fr-FR') } catch { return '—' }
}

function fmtMoney(n: number): string {
  return (n || 0).toFixed(2) + ' €'
}

function parseItems(json: string): PreOrderItem[] {
  try { return JSON.parse(json) } catch { return [] }
}

// ── Main component ─────────────────────────────────────────────────────────

export function PreOrderModule() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PreOrder | null>(null)
  const [deleting, setDeleting] = useState(false)

  const { data: preorders, loading, refresh } = useFetch<PreOrder[]>('/api/preorders')

  const openDetail = (id: string) => {
    setSelectedId(id)
    setView('detail')
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/preorders/${deleteTarget.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Pré-commande supprimée')
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setDeleting(false)
    }
  }

  if (view === 'create') {
    return <CreatePreOrderForm onBack={() => setView('list')} onCreated={() => { refresh(); setView('list') }} />
  }

  if (view === 'detail' && selectedId) {
    return <PreOrderDetail id={selectedId} onBack={() => { refresh(); setView('list') }} />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Pré-commandes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Commandes fournisseurs en attente. Validez une pré-commande pour la convertir en commande et l'enregistrer en comptabilité (ACHATS).
          </p>
        </div>
        <Button onClick={() => setView('create')}>
          <Plus className="h-4 w-4 mr-2" /> Nouvelle pré-commande
        </Button>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">En attente</p>
                <p className="text-xl font-bold">{(preorders || []).filter(p => p.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Validées</p>
                <p className="text-xl font-bold">{(preorders || []).filter(p => p.status === 'validated').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Montant total (validées)</p>
                <p className="text-xl font-bold">{fmtMoney((preorders || []).filter(p => p.status === 'validated').reduce((s, p) => s + p.total, 0))}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Liste des pré-commandes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !preorders || preorders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucune pré-commande pour le moment.</p>
              <p className="text-xs mt-1">Cliquez sur « Nouvelle pré-commande » pour commencer.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Référence</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Nom</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Fournisseur</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Date</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Total</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Statut</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground hidden lg:table-cell">Facture</th>
                    <th className="pb-2 font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody>
                  {preorders.map(po => {
                    const cfg = STATUS_CONFIG[po.status] || STATUS_CONFIG.pending
                    const Icon = cfg.icon
                    const itemCount = parseItems(po.items).length
                    return (
                      <tr key={po.id} className="border-b hover:bg-muted/50 cursor-pointer" onClick={() => openDetail(po.id)}>
                        <td className="py-2.5 pr-3 font-mono text-xs">{po.reference}</td>
                        <td className="py-2.5 pr-3 font-medium">{po.name}</td>
                        <td className="py-2.5 pr-3 text-muted-foreground">
                          {po.supplier?.name || po.supplierName || '—'}
                          <span className="text-xs text-muted-foreground ml-1">({itemCount} art.)</span>
                        </td>
                        <td className="py-2.5 pr-3 text-muted-foreground">{fmtDate(po.orderDate)}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold">{fmtMoney(po.total)}</td>
                        <td className="py-2.5 pr-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 hidden lg:table-cell">
                          {po.supplierInvoicePath ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={(e) => { e.stopPropagation(); window.open(po.supplierInvoicePath!, '_blank') }}
                                title={`Voir la facture${po.invoiceNumber ? ` ${po.invoiceNumber}` : ''}`}
                              >
                                <FileText className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs font-mono">{po.invoiceNumber || 'PDF'}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => { e.stopPropagation(); window.open(po.supplierInvoicePath!, '_blank') }}
                                title="Imprimer"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {po.invoiceNumber || '—'}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 flex items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetail(po.id) }} title="Voir / modifier">
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={(e) => { e.stopPropagation(); setDeleteTarget(po) }}
                              title={po.status === 'validated' ? 'Supprimer (admin) — le Purchase lié sera aussi supprimé' : 'Supprimer (admin)'}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogue de suppression (liste) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la pré-commande</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la pré-commande <strong>{deleteTarget?.reference}</strong> ({deleteTarget?.name}) ?
              Cette action est irréversible. Les articles créés dans le stock ne seront pas supprimés.
              {deleteTarget?.status === 'validated' && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Cette pré-commande est validée. L'entrée comptable associée (dans Fiscalité → ACHATS) sera également supprimée.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Annuler</Button>
            <Button onClick={confirmDelete} disabled={deleting} variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deleting ? 'Suppression...' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Create form ────────────────────────────────────────────────────────────

function CreatePreOrderForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { data: suppliers } = useFetch<Supplier[]>('/api/suppliers')
  const { data: stockItems } = useFetch<StockItemLite[]>('/api/stock')
  const { getByType, getSubcategories } = useSettings()
  const { getSubcategories: getBoutiqueSubcategories, categories: boutiqueCats } = useBoutiqueCategories()
  const sizes = getByType('size')
  const colors = getByType('color')
  const conditions = getByType('condition')
  // Use boutique categories (from Boutique Admin → Catégories) instead of the old Attribute-based ones
  const categories = boutiqueCats.map(c => ({ id: c.slug, code: c.slug, value: c.label }))
  const getSubcats = (parentCode: string | null | undefined) => {
    const subs = getBoutiqueSubcategories(parentCode)
    // BoutiqueCategoryItem has { slug, label, parentId } — map to { id, code, value, parentCode }
    return subs.map(s => ({ id: s.slug, code: s.slug, value: s.label, parentCode: s.parentId }))
  }
  const [saving, setSaving] = useState(false)
  const [creatingArticleIdx, setCreatingArticleIdx] = useState<number | null>(null)
  const [pickerIdx, setPickerIdx] = useState<number | null>(null)  // which item line is picking a product
  const [scannerIdx, setScannerIdx] = useState<number | null>(null)  // which item line is scanning a barcode

  const [name, setName] = useState('')
  const [supplierId, setSupplierId] = useState<string>('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMethod, setPaymentMethod] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [shippingCost, setShippingCost] = useState(0)
  const [items, setItems] = useState<PreOrderItem[]>([
    { designation: '', url: '', description: '', size: '', color: '', condition: '', quantity: 1, unitPrice: 0, stockItemId: null },
  ])

  const subtotal = useMemo(() => {
    return items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0)
  }, [items])
  const total = subtotal + (Number(shippingCost) || 0)

  const updateItem = (idx: number, field: keyof PreOrderItem, value: any) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  const addItem = () => {
    setItems(prev => [...prev, { designation: '', url: '', description: '', size: '', color: '', condition: '', quantity: 1, unitPrice: 0, stockItemId: null }])
  }

  const removeItem = (idx: number) => {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  // When selecting an existing stock item, auto-fill the fields
  const selectStockItem = (idx: number, stockItemId: string) => {
    if (!stockItemId) {
      updateItem(idx, 'stockItemId', null)
      return
    }
    const item = (stockItems || []).find(i => i.id === stockItemId)
    if (!item) return
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const designation = item.title || `${item.brand} ${item.category}`.trim()
      return {
        ...it,
        stockItemId: item.id,
        designation,
        size: item.size || '',
        color: item.color || '',
        condition: item.condition || '',
        unitPrice: item.purchaseCost || 0,
      }
    }))
  }

  const submit = async () => {
    if (!name.trim()) { toast.error('Le nom est requis'); return }
    if (items.length === 0 || items.every(i => !i.designation.trim())) {
      toast.error('Au moins un article avec désignation est requis'); return
    }
    // Filter out empty items
    const cleanItems = items.filter(i => i.designation.trim())
    if (cleanItems.length === 0) { toast.error('Au moins un article est requis'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/preorders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          supplierId: supplierId || null,
          supplierName: supplierId ? (suppliers || []).find(s => s.id === supplierId)?.name : null,
          orderDate,
          paymentMethod: paymentMethod || null,
          items: cleanItems,
          shippingCost: Number(shippingCost) || 0,
          notes: notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Pré-commande créée')
      onCreated()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  // Create a StockItem from the current article line (qty = 0, status = A_PHOTOGRAPHIER)
  // and link it back to the pre-order item.
  //
  // IMPORTANT: purchaseCost is set to 0 (not item.unitPrice) to avoid double counting.
  // When the pre-order is validated, a Purchase entry is created with the pre-order total
  // (which includes this item's cost). If we also set purchaseCost > 0 on the StockItem,
  // the accounting API would count it TWICE in the ACHATS register:
  //   1. Once via StockItem.purchaseCost (in the stock-items-with-purchaseDate-in-period query)
  //   2. Once via Purchase.amount (the pre-order total)
  // By setting purchaseCost = 0, only the Purchase entry counts — which is correct.
  const createStockItem = async (idx: number) => {
    const item = items[idx]
    if (!item.designation.trim()) {
      toast.error('Veuillez saisir une désignation avant de créer l\'article')
      return
    }
    setCreatingArticleIdx(idx)
    try {
      // Generate a unique SKU
      const sku = `ART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku,
          title: item.designation.trim(),
          brand: item.designation.trim().split(' ')[0] || 'Article',  // first word as brand fallback
          category: categories[0]?.code || 'vetements',
          size: item.size || null,
          color: item.color || null,
          condition: item.condition || conditions[0]?.code || 'bon',
          purchaseCost: 0,  // 0 to avoid double counting (pre-order Purchase already accounts for the cost)
          purchaseDate: orderDate,
          supplierId: supplierId || null,
          quantity: 0,  // quantité = 0 comme demandé
          description: item.description || null,
          status: 'A_PHOTOGRAPHIER',
        }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur lors de la création'); return }
      // Link the created StockItem back to the pre-order item
      updateItem(idx, 'stockItemId', data.id)
      toast.success(`Article créé dans le stock (SKU: ${sku}, qté: 0, coût: 0€ — comptabilisé via la pré-commande)`)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setCreatingArticleIdx(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Retour
        </Button>
        <h1 className="text-2xl font-bold">Nouvelle pré-commande</h1>
      </div>

      {/* Infos générales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Nom de la pré-commande *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Achat rentrée septembre" />
          </div>
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Fournisseur</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un fournisseur (optionnel)" /></SelectTrigger>
              <SelectContent>
                {(suppliers || []).map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.type})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label>Méthode de paiement</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un mode de paiement (optionnel)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="especes">Espèces</SelectItem>
                <SelectItem value="carte_bancaire">Carte bancaire</SelectItem>
                <SelectItem value="virement">Virement</SelectItem>
                <SelectItem value="cheque">Chèque</SelectItem>
                <SelectItem value="paypal">PayPal</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Articles</CardTitle>
              <CardDescription className="text-xs">Ajoutez autant d'articles que nécessaire. Sélectionnez un article existant, saisissez-le manuellement, ou créez-le directement dans le stock.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" /> Ajouter un article
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="border rounded-lg p-4 space-y-3 relative">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Article {idx + 1}
                  {item.stockItemId && <span className="ml-2 text-green-600">✓ lié au stock</span>}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => createStockItem(idx)}
                    disabled={creatingArticleIdx === idx || !!item.stockItemId}
                    title={item.stockItemId ? 'Article déjà créé dans le stock' : 'Créer cet article dans le stock (quantité = 0)'}
                  >
                    {creatingArticleIdx === idx ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <PackagePlus className="h-4 w-4 mr-1" />}
                    Créer l'article
                  </Button>
                  {items.length > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Sélection article existant — ouvre une popup avec filtres catégorie/sous-catégorie */}
              <div className="space-y-1.5">
                <Label className="text-xs">Article existant (optionnel)</Label>
                {item.stockItemId ? (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-md border bg-muted/30">
                    <span className="text-xs text-muted-foreground">
                      ✓ Lié : {(stockItems || []).find(si => si.id === item.stockItemId)?.title || (stockItems || []).find(si => si.id === item.stockItemId)?.brand || 'Article'}
                    </span>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setPickerIdx(idx)} title="Changer d'article">
                        <Search className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="text-red-500" onClick={() => selectStockItem(idx, '')} title="Détacher">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPickerIdx(idx)}
                      className="flex-1 justify-start text-muted-foreground"
                    >
                      <Search className="h-4 w-4 mr-2" /> Rechercher un article existant…
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScannerIdx(idx)}
                      className="shrink-0"
                      title="Scanner un code-barres"
                    >
                      <Barcode className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Désignation *</Label>
                  <Input value={item.designation} onChange={e => updateItem(idx, 'designation', e.target.value)} placeholder="Ex: T-shirt Nike Sportswear blanc" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">URL de l'article</Label>
                  <Input value={item.url} onChange={e => updateItem(idx, 'url', e.target.value)} placeholder="https://..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Taille</Label>
                  <Select value={item.size || ''} onValueChange={(v) => updateItem(idx, 'size', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucune —</SelectItem>
                      {sizes.map(s => <SelectItem key={s.id} value={s.code}>{s.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Couleur</Label>
                  <Select value={item.color || ''} onValueChange={(v) => updateItem(idx, 'color', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucune —</SelectItem>
                      {colors.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">État</Label>
                  <Select value={item.condition || ''} onValueChange={(v) => updateItem(idx, 'condition', v === '__none__' ? '' : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Aucun —</SelectItem>
                      {conditions.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Quantité</Label>
                  <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tarif unitaire (€)</Label>
                  <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', Number(e.target.value))} />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs">Description</Label>
                  <Textarea value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} rows={2} placeholder="Détails complémentaires..." />
                </div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                Total ligne: <span className="font-semibold text-foreground">{fmtMoney((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0))}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totaux + notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} placeholder="Notes internes..." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Totaux</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total ({items.length} article{items.length > 1 ? 's' : ''})</span>
              <span className="font-medium">{fmtMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">Frais de port</span>
              <Input type="number" min="0" step="0.01" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} className="w-28 text-right h-8" />
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>Total pré-commande</span>
              <span>{fmtMoney(total)}</span>
            </div>
            <div className="text-xs text-muted-foreground pt-1">
              Statut: <span className="font-medium text-amber-600">En attente</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Annuler</Button>
        <Button onClick={submit} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          {saving ? 'Création...' : 'Créer la pré-commande'}
        </Button>
      </div>

      {/* Product picker modal */}
      {pickerIdx !== null && (
        <ProductPickerDialog
          open={true}
          onOpenChange={(o) => { if (!o) setPickerIdx(null) }}
          stockItems={stockItems || []}
          categories={categories}
          getSubcategories={getSubcats}
          onPick={(stockItemId) => {
            selectStockItem(pickerIdx, stockItemId)
            setPickerIdx(null)
          }}
        />
      )}

      {/* Barcode scanner modal */}
      {scannerIdx !== null && (
        <BarcodeScannerModal
          open={true}
          onOpenChange={(o) => { if (!o) setScannerIdx(null) }}
          onFound={(data: any) => {
            // The scanner found a stock item by barcode — link it to this line
            const allItems = data.items || [data.item]
            const matchable = allItems.filter((s: any) => s.id)
            if (matchable.length === 1) {
              selectStockItem(scannerIdx, matchable[0].id)
              setScannerIdx(null)
              toast.success(`Article trouvé : ${matchable[0].brand} ${matchable[0].title || ''}`)
            } else if (matchable.length > 1) {
              // Multiple matches — open the picker filtered to these items
              setScannerIdx(null)
              setPickerIdx(scannerIdx)
              toast.info(`${matchable.length} variantes trouvées — choisissez la bonne`)
            } else {
              toast.error('Aucun article trouvé')
            }
          }}
          onNotFound={(code: string) => {
            toast.error(`Aucun article avec le code-barres ${code}`)
          }}
        />
      )}
    </div>
  )
}

// ── Detail / edit ──────────────────────────────────────────────────────────

function PreOrderDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const { data: preorder, loading, refresh } = useFetch<PreOrder>(`/api/preorders/${id}`)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [uploadingInvoice, setUploadingInvoice] = useState(false)
  const [showValidateDialog, setShowValidateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [orderNumber, setOrderNumber] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')

  const items = preorder ? parseItems(preorder.items) : []
  const cfg = preorder ? (STATUS_CONFIG[preorder.status] || STATUS_CONFIG.pending) : null
  const isValidated = preorder?.status === 'validated'
  const isCancelled = preorder?.status === 'cancelled'
  const isPending = preorder?.status === 'pending'
  const isReceived = preorder?.status === 'received'

  const save = async (patch: any) => {
    setSaving(true)
    try {
      const res = await fetch(`/api/preorders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Enregistré')
      refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSaving(false)
    }
  }

  const deletePreorder = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/preorders/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Pré-commande supprimée')
      onBack()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const receiveOrder = async () => {
    setReceiving(true)
    try {
      const res = await fetch(`/api/preorders/${id}/receive`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success(data.message || 'Commande reçue — articles ajoutés au stock')
      setShowReceiveDialog(false)
      refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setReceiving(false)
    }
  }

  const uploadInvoice = async (file: File) => {
    setUploadingInvoice(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/preorders/${id}/invoice-upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur lors de l\'upload'); return }
      // Save the path + filename to the pre-order
      await save({
        supplierInvoicePath: data.path,
        supplierInvoiceName: data.filename,
      })
      toast.success('Facture téléversée avec succès')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setUploadingInvoice(false)
    }
  }

  const deleteInvoice = async () => {
    // 1. Delete the file from disk
    try {
      await fetch(`/api/preorders/${id}/invoice-upload`, { method: 'DELETE' })
    } catch {
      // Non-fatal — the DB reference will be cleared anyway
    }
    // 2. Clear the DB reference
    await save({ supplierInvoicePath: null, supplierInvoiceName: null })
    toast.success('Facture supprimée')
  }

  const validate = async () => {
    setValidating(true)
    try {
      const res = await fetch(`/api/preorders/${id}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber, invoiceNumber }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success(data.message || 'Pré-commande validée')
      setShowValidateDialog(false)
      refresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setValidating(false)
    }
  }

  if (loading || !preorder || !cfg) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const Icon = cfg.icon

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {preorder.name}
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <Icon className="h-3 w-3" /> {cfg.label}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{preorder.reference}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isPending && (
            <Button
              onClick={() => setShowValidateDialog(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" /> Valider la pré-commande
            </Button>
          )}
          {isValidated && (
            <Button
              onClick={() => setShowReceiveDialog(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Package className="h-4 w-4 mr-2" /> Commande reçue
            </Button>
          )}
          {(isValidated || isReceived) && (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/preorders/${id}/print`, '_blank')}
              title="Imprimer le bon de commande"
            >
              <Printer className="h-4 w-4 mr-2" /> Imprimer
            </Button>
          )}
          {isAdmin && !isCancelled && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer
            </Button>
          )}
        </div>
      </div>

      {/* Alerte si validée */}
      {isValidated && (
        <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-4 text-sm">
          <div className="flex items-start gap-2">
            <Package className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-green-800 dark:text-green-200">
                Commande validée le {fmtDate(preorder.validatedAt || preorder.createdAt)}
              </p>
              <p className="text-green-700 dark:text-green-300">
                Cette pré-commande a été convertie en commande. Une entrée de <strong>{fmtMoney(preorder.total)}</strong> a été créée dans <strong>Fiscalité → ACHATS</strong>.
                {preorder.purchaseId && <span className="font-mono text-xs"> (Purchase ID: {preorder.purchaseId})</span>}
              </p>
              {preorder.orderNumber && <p className="text-green-700 dark:text-green-300">N° commande fournisseur: <strong>{preorder.orderNumber}</strong></p>}
              {preorder.invoiceNumber && <p className="text-green-700 dark:text-green-300">N° facture fournisseur: <strong>{preorder.invoiceNumber}</strong></p>}
            </div>
          </div>
        </div>
      )}

      {/* Alerte si reçue */}
      {isReceived && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm">
          <div className="flex items-start gap-2">
            <PackageCheck className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-blue-800 dark:text-blue-200">
                Commande reçue — articles ajoutés au stock
              </p>
              <p className="text-blue-700 dark:text-blue-300">
                Tous les articles de cette pré-commande ont été ajoutés au stock avec le statut <strong>« À contrôler »</strong>.
                Une entrée de <strong>{fmtMoney(preorder.total)}</strong> est comptabilisée dans <strong>Fiscalité → ACHATS</strong>.
              </p>
              {preorder.orderNumber && <p className="text-blue-700 dark:text-blue-300">N° commande fournisseur: <strong>{preorder.orderNumber}</strong></p>}
              {preorder.invoiceNumber && <p className="text-blue-700 dark:text-blue-300">N° facture fournisseur: <strong>{preorder.invoiceNumber}</strong></p>}
            </div>
          </div>
        </div>
      )}

      {/* Infos générales (modifiables si non validée) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Informations générales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nom</Label>
            <Input
              value={preorder.name}
              disabled={isValidated || isCancelled}
              onChange={e => { /* allow inline edit via save button */ }}
              onBlur={e => { if (e.target.value !== preorder.name) save({ name: e.target.value }) }}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              defaultValue={preorder.orderDate.slice(0, 10)}
              disabled={isValidated || isCancelled}
              onChange={e => { if (e.target.value !== preorder.orderDate.slice(0, 10)) save({ orderDate: e.target.value }) }}
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs">Fournisseur</Label>
            <Input
              value={preorder.supplier?.name || preorder.supplierName || ''}
              disabled
              className="bg-muted/50"
            />
          </div>
          <div className="space-y-1.5 md:col-span-3">
            <Label className="text-xs">Méthode de paiement</Label>
            <Input
              value={
                preorder.paymentMethod === 'especes' ? 'Espèces'
                : preorder.paymentMethod === 'carte_bancaire' ? 'Carte bancaire'
                : preorder.paymentMethod === 'virement' ? 'Virement'
                : preorder.paymentMethod === 'cheque' ? 'Chèque'
                : preorder.paymentMethod === 'paypal' ? 'PayPal'
                : '—'
              }
              disabled
              className="bg-muted/50"
            />
          </div>
          {isValidated && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">N° commande fournisseur</Label>
                <Input
                  defaultValue={preorder.orderNumber || ''}
                  placeholder="À saisir"
                  onBlur={e => { if (e.target.value !== (preorder.orderNumber || '')) save({ orderNumber: e.target.value }) }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">N° facture fournisseur</Label>
                <Input
                  defaultValue={preorder.invoiceNumber || ''}
                  placeholder="À saisir"
                  onBlur={e => { if (e.target.value !== (preorder.invoiceNumber || '')) save({ invoiceNumber: e.target.value }) }}
                />
              </div>
            </>
          )}
          {isValidated && (
            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-xs">Facture fournisseur (PDF)</Label>
              {preorder.supplierInvoicePath ? (
                <div className="flex items-center justify-between gap-2 p-3 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-5 w-5 text-red-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{preorder.supplierInvoiceName || 'Facture'}</p>
                      <p className="text-[10px] text-muted-foreground">Fichier joint</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(preorder.supplierInvoicePath!, '_blank')}
                      title="Voir / Télécharger"
                    >
                      <ExternalLink className="h-3.5 w-3.5 mr-1" /> Voir
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(preorder.supplierInvoicePath!, '_blank')}
                      title="Imprimer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-600"
                      onClick={deleteInvoice}
                      title="Détacher la facture"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed border-gray-300 hover:border-[#007bff] hover:bg-blue-50 cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) uploadInvoice(file)
                      e.target.value = ''  // reset for re-upload
                    }}
                  />
                  {uploadingInvoice ? (
                    <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> <span className="text-sm text-muted-foreground">Téléversement…</span></>
                  ) : (
                    <><Upload className="h-4 w-4 text-muted-foreground" /> <span className="text-sm text-muted-foreground">Téléverser une facture (PDF, JPG, PNG…)</span></>
                  )}
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles */}
      <Card>
        <CardHeader><CardTitle className="text-base">Articles ({items.length})</CardTitle></CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucun article.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Article</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground">Attributs</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-center">Qté</th>
                    <th className="pb-2 pr-3 font-medium text-muted-foreground text-right">Prix unit.</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium">{it.designation || '—'}</div>
                        {it.description && <div className="text-xs text-muted-foreground">{it.description}</div>}
                        {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">Voir l'article →</a>}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {it.size && <div>Taille: {it.size}</div>}
                        {it.color && <div>Couleur: {it.color}</div>}
                        {it.condition && <div>État: {it.condition}</div>}
                      </td>
                      <td className="py-2.5 pr-3 text-center font-medium">{it.quantity}</td>
                      <td className="py-2.5 pr-3 text-right">{fmtMoney(Number(it.unitPrice) || 0)}</td>
                      <td className="py-2.5 text-right font-semibold">{fmtMoney((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Totaux */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
          <CardContent>
            <Textarea
              defaultValue={preorder.notes || ''}
              disabled={isValidated || isCancelled}
              rows={4}
              placeholder="Notes internes..."
              onBlur={e => { if (e.target.value !== (preorder.notes || '')) save({ notes: e.target.value }) }}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Totaux</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total</span>
              <span className="font-medium">{fmtMoney(preorder.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Frais de port</span>
              <span className="font-medium">{fmtMoney(preorder.shippingCost)}</span>
            </div>
            <div className="flex justify-between text-base font-bold border-t pt-2">
              <span>Total</span>
              <span>{fmtMoney(preorder.total)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogue de validation */}
      <Dialog open={showValidateDialog} onOpenChange={setShowValidateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valider la pré-commande</DialogTitle>
            <DialogDescription>
              Valider signifie que la commande a été acceptée et commandée chez le fournisseur.
              Une entrée de <strong>{fmtMoney(preorder.total)}</strong> sera créée dans Fiscalité → ACHATS.
              Vous pourrez modifier les numéros de commande/facture après validation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">N° commande fournisseur (optionnel)</Label>
              <Input value={orderNumber} onChange={e => setOrderNumber(e.target.value)} placeholder="Ex: CMD-FOUR-12345" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">N° facture fournisseur (optionnel)</Label>
              <Input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="Ex: FAC-2026-001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidateDialog(false)}>Annuler</Button>
            <Button onClick={validate} disabled={validating} className="bg-green-600 hover:bg-green-700">
              {validating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {validating ? 'Validation...' : 'Valider et convertir en commande'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de suppression */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la pré-commande</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la pré-commande <strong>{preorder.reference}</strong> ?
              Cette action est irréversible. Les articles créés dans le stock ne seront pas supprimés.
              {isValidated && (
                <span className="block mt-2 text-amber-600 font-medium">
                  ⚠️ Cette pré-commande est validée. L'entrée comptable associée (dans Fiscalité → ACHATS) sera également supprimée.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Annuler</Button>
            <Button onClick={deletePreorder} disabled={deleting} variant="destructive">
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              {deleting ? 'Suppression...' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue de réception */}
      <Dialog open={showReceiveDialog} onOpenChange={setShowReceiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marquer la commande comme reçue</DialogTitle>
            <DialogDescription>
              Tous les articles de cette pré-commande seront ajoutés au stock avec le statut <strong>« À contrôler »</strong>.
              <br /><br />
              {items.filter(i => i.stockItemId).length > 0 && (
                <span className="text-blue-600">
                  ℹ️ {items.filter(i => i.stockItemId).length} article(s) déjà créé(s) seront mis à jour (quantité + statut).
                </span>
              )}
              {items.filter(i => !i.stockItemId).length > 0 && (
                <span className="text-blue-600">
                  ℹ️ {items.filter(i => !i.stockItemId).length} nouvel(s) article(s) seront créés dans le stock.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(false)}>Annuler</Button>
            <Button onClick={receiveOrder} disabled={receiving} className="bg-blue-600 hover:bg-blue-700">
              {receiving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
              {receiving ? 'Traitement...' : 'Confirmer la réception'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Product picker dialog ────────────────────────────────────────────────
// Modal with category → subcategory filters, product grid (photo + name), and pagination.

interface ProductPickerProps {
  open: boolean
  onOpenChange: (o: boolean) => void
  stockItems: StockItemLite[]
  categories: { id: string; code: string; value: string }[]
  getSubcategories: (parentCode: string | null | undefined) => { id: string; code: string; value: string; parentCode: string | null }[]
  onPick: (stockItemId: string) => void
}

const PAGE_SIZE = 12

function ProductPickerDialog({ open, onOpenChange, stockItems, categories, getSubcategories, onPick }: ProductPickerProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Reset filters when dialog opens
  useEffect(() => {
    if (open) {
      setCategoryFilter('')
      setSubcategoryFilter('')
      setSearch('')
      setPage(1)
    }
  }, [open])

  const subcategories = categoryFilter ? getSubcategories(categoryFilter) : []

  // Filter stock items
  const filtered = useMemo(() => {
    let list = stockItems
    if (categoryFilter) list = list.filter(si => si.category === categoryFilter)
    if (subcategoryFilter) list = list.filter(si => si.subcategory === subcategoryFilter)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(si =>
        (si.title || '').toLowerCase().includes(q) ||
        si.brand.toLowerCase().includes(q) ||
        si.sku.toLowerCase().includes(q)
      )
    }
    return list
  }, [stockItems, categoryFilter, subcategoryFilter, search])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Helper to parse first photo
  const getPhoto = (photosJson: string): string | null => {
    try {
      const arr = JSON.parse(photosJson)
      if (Array.isArray(arr) && arr.length > 0) {
        const p = arr[0]
        return p.startsWith('/uploads/') ? `/api${p}` : p
      }
    } catch {}
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Rechercher un article existant</DialogTitle>
          <DialogDescription>
            Filtrez par catégorie et sous-catégorie, puis cliquez sur un article pour l'ajouter à la pré-commande.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-3 border-b">
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Select
              value={categoryFilter || '__all__'}
              onValueChange={(v) => { setCategoryFilter(v === '__all__' ? '' : v); setSubcategoryFilter(''); setPage(1) }}
            >
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les catégories</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Sous-catégorie</Label>
            <Select
              value={subcategoryFilter || '__all__'}
              onValueChange={(v) => { setSubcategoryFilter(v === '__all__' ? '' : v); setPage(1) }}
              disabled={!categoryFilter || subcategories.length === 0}
            >
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Toutes les sous-catégories</SelectItem>
                {subcategories.map(s => <SelectItem key={s.id} value={s.code}>{s.value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recherche</Label>
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Nom, marque, SKU…"
            />
          </div>
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground py-2">
          {filtered.length} article{filtered.length > 1 ? 's' : ''} trouvé{filtered.length > 1 ? 's' : ''}
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Aucun article trouvé. Ajustez les filtres ou créez un nouvel article.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {paginated.map(si => {
                const photo = getPhoto(si.photos)
                const designation = si.title || `${si.brand} ${si.category}`.trim()
                return (
                  <button
                    key={si.id}
                    type="button"
                    onClick={() => onPick(si.id)}
                    className="text-left border rounded-lg overflow-hidden hover:border-[#007bff] hover:shadow-md transition-all group"
                  >
                    <div className="aspect-square bg-gray-50 relative overflow-hidden">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt={designation} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-gray-300">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      <p className="text-xs font-medium line-clamp-2 leading-tight">{designation}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {si.brand}
                        {si.size ? ` · ${si.size}` : ''}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono">{si.sku}</p>
                      {si.quantity <= 0 && (
                        <span className="inline-block text-[9px] text-red-600 font-medium">Rupture</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Page {currentPage} sur {totalPages}
            </p>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                ← Précédent
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Suivant →
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
