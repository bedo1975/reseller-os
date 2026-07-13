'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle2, Camera, FileText, Send, Eye, Lock, Package, Search, Edit,
  MapPin, Trash2, AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PUBLICATION_STATUSES, getPubStatusColor, getPubStatusLabel, formatEUR,
  getPlatformLabel, getPlatformColor, PLATFORMS,
} from '@/lib/constants'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'

const STAGE_ICONS: Record<string, React.ElementType> = {
  A_PHOTOGRAPHIER: Camera,
  A_REDIGER: FileText,
  PRET_A_PUBLIER: Send,
  PUBLIE: Eye,
  RESERVE: Lock,
  VENDU: Package,
}

const CHECKLIST = [
  { id: 'photos', label: 'Photos faites' },
  { id: 'redaction', label: 'Description rédigée' },
  { id: 'prix', label: 'Prix conseillé défini' },
  { id: 'publie', label: 'Publié en ligne' },
]

interface Supplier { id: string; name: string; type: string }

interface StockItem {
  id: string
  sku: string
  barcode: string | null
  photos: string
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
  warehouse: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  status: string
  platform: string | null
  platforms: string  // JSON array
  suggestedPrice: number | null
  description: string | null
  measurements: string | null
  sale?: { id: string; salePrice: number; profit: number } | null
}

// Helper pour parser le JSON platforms en toute sécurité
function parsePlatforms(s: string | null | undefined): string[] {
  if (!s) return []
  try {
    const arr = JSON.parse(s)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

export function PublicationModule() {
  const { data: items, loading, refresh } = useFetch<StockItem[]>('/api/stock')

  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [platformFilter, setPlatformFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [editItem, setEditItem] = useState<StockItem | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'bulk'; item?: StockItem } | null>(null)

  const filtered = useMemo(() => {
    if (!items) return []
    return items.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false
      if (platformFilter !== 'all') {
        // Filtre sur platform OU platforms (multi-plateformes)
        const platforms = parsePlatforms(i.platforms)
        if (i.platform !== platformFilter && !platforms.includes(platformFilter)) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          i.sku.toLowerCase().includes(q) ||
          i.brand.toLowerCase().includes(q) ||
          i.color?.toLowerCase().includes(q) ||
          i.lotReference?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [items, statusFilter, platformFilter, search])

  const updateStatus = async (itemId: string, newStatus: string, platforms?: string[]) => {
    const body: Record<string, unknown> = { status: newStatus }
    if (platforms !== undefined) body.platforms = JSON.stringify(platforms)
    const res = await fetch(`/api/stock/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      toast.success('Statut mis à jour')
      refresh()
    } else {
      toast.error('Erreur')
    }
  }

  // ─── Gestion de la sélection ───
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(i => i.id)))
    }
  }

  const isAllSelected = filtered.length > 0 && filtered.every(i => selectedIds.has(i.id))
  const isSomeSelected = filtered.some(i => selectedIds.has(i.id)) && !isAllSelected

  // ─── Suppression ───
  const askDeleteSingle = (item: StockItem) => {
    setDeleteTarget({ type: 'single', item })
    setShowDeleteModal(true)
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
        toast.error('Erreur lors de la suppression')
      }
    } else if (deleteTarget.type === 'bulk') {
      const ids = Array.from(selectedIds)
      let okCount = 0
      let errCount = 0
      for (const id of ids) {
        const res = await fetch(`/api/stock/${id}`, { method: 'DELETE' })
        if (res.ok) okCount++
        else errCount++
      }
      if (okCount > 0) toast.success(`${okCount} article${okCount > 1 ? 's' : ''} supprimé${okCount > 1 ? 's' : ''}`)
      if (errCount > 0) toast.error(`${errCount} suppression(s) en échec`)
      setSelectedIds(new Set())
      refresh()
    }
    setDeleteTarget(null)
  }

  // ─── Toggle d'une plateforme dans platforms ───
  const togglePlatform = (itemId: string, platformId: string, currentPlatforms: string[]) => {
    const next = currentPlatforms.includes(platformId)
      ? currentPlatforms.filter(x => x !== platformId)
      : [...currentPlatforms, platformId]
    updateStatus(itemId, items?.find(i => i.id === itemId)?.status || 'PUBLIE', next)
  }

  // Compteur par statut pour la barre de filtres rapides
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    items?.forEach(i => {
      counts[i.status] = (counts[i.status] || 0) + 1
    })
    return counts
  }, [items])

  return (
    <div className="space-y-4">
      {/* Checklist pré-publication */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold">Checklist pré-publication</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {CHECKLIST.map(c => (
              <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/40 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>{c.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtres rapides par statut (style tabs) */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            statusFilter === 'all'
              ? 'bg-foreground text-background border-foreground'
              : 'bg-card hover:bg-muted border-border'
          )}
        >
          Tous ({items?.length || 0})
        </button>
        {PUBLICATION_STATUSES.map(s => {
          const Icon = STAGE_ICONS[s.id] || Package
          const count = statusCounts[s.id] || 0
          const active = statusFilter === s.id
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(s.id)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5',
                active
                  ? cn(s.color, 'border-transparent')
                  : 'bg-card hover:bg-muted border-border'
              )}
            >
              <Icon className="h-3 w-3" />
              {s.label}
              <span className={cn(
                'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono',
                active ? 'bg-white/30' : 'bg-muted-foreground/15'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Barre d'actions bulk */}
      {selectedIds.size > 0 && (
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
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Désélectionner
              </Button>
              <Button variant="destructive" size="sm" onClick={askDeleteBulk}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                Supprimer ({selectedIds.size})
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Toolbar (recherche + filtre plateforme) */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par SKU, marque, couleur, lot..."
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
                {PLATFORMS.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tableau */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Aucun article dans ce statut</p>
              <p className="text-xs text-muted-foreground mt-1">Changez de filtre ou ajoutez des articles.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                  <TableHead className="w-12"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Marque</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead className="hidden lg:table-cell">Taille</TableHead>
                  <TableHead className="hidden lg:table-cell">Couleur</TableHead>
                  <TableHead className="text-right">Coût</TableHead>
                  <TableHead className="text-right">Prix conseillé</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Plateformes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => {
                  const photos: string[] = (() => {
                    try { return JSON.parse(item.photos) } catch { return [] }
                  })()
                  const location = [item.rack, item.shelf ? `Ét. ${item.shelf}` : null, item.bin ? `Bac ${item.bin}` : null].filter(Boolean).join(' · ')
                  const platforms = parsePlatforms(item.platforms)
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'hover:bg-muted/40 transition-colors',
                        isSelected && 'bg-emerald-50/50 dark:bg-emerald-950/20'
                      )}
                    >
                      <TableCell className="p-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="h-4 w-4 rounded border-border cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                          {photos[0] ? (
                            <img src={photos[0]} alt={item.brand} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-4 w-4 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.brand}</div>
                        {location && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 shrink-0" /> {location}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.description || '—'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{item.size || '—'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">{item.color || '—'}</TableCell>
                      <TableCell className="text-right">{formatEUR(item.purchaseCost)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">
                        {item.suggestedPrice ? formatEUR(item.suggestedPrice) : '—'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.status}
                          onValueChange={(v) => {
                            if (v === 'PUBLIE' && platforms.length === 0 && !item.platform) {
                              toast.error('Sélectionnez au moins une plateforme avant de publier')
                              return
                            }
                            updateStatus(item.id, v)
                          }}
                        >
                          <SelectTrigger className="h-7 w-[140px] text-xs px-2">
                            <SelectValue>
                              <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', getPubStatusColor(item.status))}>
                                {getPubStatusLabel(item.status)}
                              </span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {PUBLICATION_STATUSES.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {item.status === 'VENDU' && item.platform ? (
                          // Si vendu, on affiche seulement la plateforme de vente effective
                          <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', getPlatformColor(item.platform))}>
                            {getPlatformLabel(item.platform)} (vendu)
                          </span>
                        ) : (
                          // Sinon, on affiche des toggle chips pour chaque plateforme
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {PLATFORMS.map(p => {
                              const active = platforms.includes(p.id)
                              return (
                                <button
                                  key={p.id}
                                  onClick={() => togglePlatform(item.id, p.id, platforms)}
                                  className={cn(
                                    'text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-all',
                                    active
                                      ? cn(p.color, 'ring-1 ring-current')
                                      : 'bg-muted text-muted-foreground/50 hover:bg-muted/70'
                                  )}
                                  title={active ? `Retirer de ${p.label}` : `Publier sur ${p.label}`}
                                >
                                  {p.label}
                                </button>
                              )
                            })}
                            {platforms.length === 0 && (
                              <span className="text-[10px] text-muted-foreground italic">Cliquez pour publier</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => setEditItem(item)}
                            title="Éditer"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                            onClick={() => askDeleteSingle(item)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Stats résumé */}
      {!loading && filtered.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <div className="text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span> article{filtered.length > 1 ? 's' : ''}
                {statusFilter !== 'all' && (
                  <> · Filtré par : <span className="font-medium">{getPubStatusLabel(statusFilter)}</span></>
                )}
              </div>
              <div className="flex gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground">Coût total : </span>
                  <span className="font-semibold">{formatEUR(filtered.reduce((s, i) => s + i.purchaseCost, 0))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Potentiel : </span>
                  <span className="font-semibold text-emerald-600">{formatEUR(filtered.reduce((s, i) => s + (i.suggestedPrice || 0), 0))}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      <EditItemDialog
        item={editItem}
        onOpenChange={(o) => !o && setEditItem(null)}
        onSaved={() => { setEditItem(null); refresh() }}
      />

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
                  Cette action est <strong>irréversible</strong>. Les articles sélectionnés et leurs données associées seront définitivement supprimés.
                </p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-muted/40 p-2 text-xs space-y-1">
                  {filtered.filter(i => selectedIds.has(i.id)).map(i => (
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

// Dialogue d'édition rapide (description + prix conseillé)
function EditItemDialog({ item, onOpenChange, onSaved }: {
  item: StockItem | null
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const { getByType } = useSettings()
  const categories = getByType('category')
  const conditions = getByType('condition')
  const sizes = getByType('size')
  const colors = getByType('color')

  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    description: '',
    suggestedPrice: '',
    category: 'vetements',
    condition: 'bon',
    size: '',
    color: '',
  })

  useMemo(() => {
    if (item) {
      setForm({
        description: item.description || '',
        suggestedPrice: item.suggestedPrice ? String(item.suggestedPrice) : '',
        category: item.category,
        condition: item.condition,
        size: item.size || '',
        color: item.color || '',
      })
    }
  }, [item])

  const submit = async () => {
    if (!item) return
    setSaving(true)
    try {
      const res = await fetch(`/api/stock/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Article modifié')
      onSaved()
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Dialog open={!!item} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Éditer : {item.brand}
            <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
          </DialogTitle>
          <DialogDescription>
            Modifiez la description, le prix conseillé et les caractéristiques.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Catégorie</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.code}>{c.value}</SelectItem>)}
                </SelectContent>
              </Select>
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Prix conseillé (€)</Label>
            <Input type="number" step="0.01" value={form.suggestedPrice} onChange={e => setForm({ ...form, suggestedPrice: e.target.value })} placeholder="29.99" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Ralph Lauren Polo L bleu marine — très bon état, lavé et repassé. Article authentique."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
