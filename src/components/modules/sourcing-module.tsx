'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
  Plus, Truck, MapPin, Phone, Mail, TrendingUp, TrendingDown, Edit, Trash2,
  Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/use-permissions'
import { formatEUR, SUPPLIER_TYPES, getSupplierTypeLabel } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/shared/confirm-provider'

interface SupplierStat {
  id: string
  name: string
  type: string
  siret: string | null
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  itemsCount: number
  itemsSold: number
  totalSpent: number
  totalRevenue: number
  totalProfit: number
  roi: number
}

const TYPE_COLORS: Record<string, string> = {
  friperie: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  grossiste: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  destockeur: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'vide-grenier': 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  particulier: 'bg-stone-100 text-stone-700 dark:bg-stone-900 dark:text-stone-300',
}

export function SourcingModule() {
  const confirm = useConfirm()
  const { data: suppliers, loading, refresh } = useFetch<SupplierStat[]>('/api/suppliers')
  const { can } = usePermissions()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<SupplierStat | null>(null)
  const [viewSupplier, setViewSupplier] = useState<SupplierStat | null>(null)

  const filtered = useMemo(() => {
    if (!suppliers) return []
    return suppliers.filter(s => {
      if (typeFilter !== 'all' && s.type !== typeFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          s.name.toLowerCase().includes(q) ||
          s.contact?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [suppliers, search, typeFilter])

  const totalSpent = filtered.reduce((s, x) => s + x.totalSpent, 0)
  const totalRevenue = filtered.reduce((s, x) => s + x.totalRevenue, 0)
  const totalProfit = filtered.reduce((s, x) => s + x.totalProfit, 0)
  const avgRoi = totalSpent > 0 ? (totalProfit / totalSpent) * 100 : 0

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer ce fournisseur ?',
      description: 'Les articles associés ne seront pas supprimés.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Fournisseur supprimé')
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
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Fournisseurs</p>
            </div>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
              <p className="text-xs text-muted-foreground uppercase">Investi</p>
            </div>
            <p className="text-2xl font-bold">{formatEUR(totalSpent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase">CA généré</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatEUR(totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">ROI moyen</p>
            <p className="text-2xl font-bold">{avgRoi.toFixed(1)}%</p>
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
                placeholder="Rechercher par nom, contact, téléphone, adresse..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {SUPPLIER_TYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {can('sourcing', 'create') && (
              <Button onClick={() => { setEditing(null); setShowForm(true) }}>
                <Plus className="h-4 w-4 mr-2" /> Nouveau fournisseur
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Aucun fournisseur</p>
              <p className="text-xs text-muted-foreground mt-1">Ajoutez votre premier fournisseur pour suivre le sourcing.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Fournisseur</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Articles</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Investi</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">CA généré</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">ROI</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const positiveRoi = s.roi >= 100
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setViewSupplier(s)}
                    >
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        {s.address && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[200px]">{s.address}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', TYPE_COLORS[s.type])}>
                          {getSupplierTypeLabel(s.type)}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {s.contact ? (
                          <div className="text-xs">
                            <div>{s.contact}</div>
                            {s.phone && <div className="text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{s.phone}</div>}
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        <div className="text-sm font-medium">{s.itemsCount}</div>
                        <div className="text-[10px] text-muted-foreground">{s.itemsSold} vendus</div>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">{formatEUR(s.totalSpent)}</TableCell>
                      <TableCell className="text-right hidden lg:table-cell">{formatEUR(s.totalRevenue)}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600">{formatEUR(s.totalProfit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant={positiveRoi ? 'default' : 'secondary'}
                          className={cn('font-mono', positiveRoi && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300')}
                        >
                          {s.roi}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditing(s); setShowForm(true) }}>
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700" onClick={() => handleDelete(s.id)}>
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

      {/* Form */}
      <SupplierForm
        open={showForm}
        onOpenChange={setShowForm}
        supplier={editing}
        onSaved={() => { setShowForm(false); refresh() }}
      />

      {/* Detail dialog */}
      <SupplierDetail
        open={!!viewSupplier}
        onOpenChange={(o) => !o && setViewSupplier(null)}
        supplier={viewSupplier}
        onEdit={(s) => { setViewSupplier(null); setEditing(s); setShowForm(true) }}
      />
    </div>
  )
}

function SupplierDetail({ open, onOpenChange, supplier, onEdit }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  supplier: SupplierStat | null
  onEdit: (s: SupplierStat) => void
}) {
  if (!supplier) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {supplier.name}
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TYPE_COLORS[supplier.type])}>
              {getSupplierTypeLabel(supplier.type)}
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(supplier.contact || supplier.phone || supplier.email || supplier.address) && (
            <div className="space-y-1.5 text-sm">
              {supplier.contact && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {supplier.contact}</div>}
              {supplier.phone && <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {supplier.phone}</div>}
              {supplier.email && <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {supplier.email}</div>}
              {supplier.address && <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {supplier.address}</div>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground uppercase">Articles achetés</p>
              <p className="text-2xl font-bold mt-1">{supplier.itemsCount}</p>
              <p className="text-xs text-muted-foreground">{supplier.itemsSold} vendus</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground uppercase">ROI</p>
              <p className="text-2xl font-bold mt-1">{supplier.roi}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground uppercase">Investi</p>
              <p className="text-xl font-bold mt-1">{formatEUR(supplier.totalSpent)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/40">
              <p className="text-xs text-muted-foreground uppercase">CA généré</p>
              <p className="text-xl font-bold mt-1 text-emerald-600">{formatEUR(supplier.totalRevenue)}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 col-span-2">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase">Bénéfice</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{formatEUR(supplier.totalProfit)}</p>
            </div>
          </div>

          {supplier.notes && (
            <div className="text-sm bg-muted/40 p-3 rounded-lg">
              <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
              <p>{supplier.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button onClick={() => onEdit(supplier)}>
            <Edit className="h-4 w-4 mr-2" /> Modifier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SupplierForm({ open, onOpenChange, supplier, onSaved }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  supplier: SupplierStat | null
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', type: 'friperie', siret: '', contact: '', phone: '', email: '', address: '', notes: '',
  })

  useMemo(() => {
    if (supplier) {
      setForm({
        name: supplier.name, type: supplier.type, siret: supplier.siret || '',
        contact: supplier.contact || '', phone: supplier.phone || '',
        email: supplier.email || '', address: supplier.address || '', notes: supplier.notes || '',
      })
    } else if (open) {
      setForm({
        name: '', type: 'friperie', siret: '', contact: '', phone: '', email: '', address: '', notes: '',
      })
    }
  }, [supplier, open])

  const submit = async () => {
    if (!form.name || !form.type) {
      toast.error('Nom et type requis')
      return
    }
    setSaving(true)
    try {
      const url = supplier ? `/api/suppliers/${supplier.id}` : '/api/suppliers'
      const method = supplier ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success(supplier ? 'Fournisseur modifié' : 'Fournisseur créé')
      onSaved()
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</DialogTitle>
          <DialogDescription>
            {supplier ? supplier.name : 'Renseignez les informations du fournisseur.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nom *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Grossiste X" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type *</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUPPLIER_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">SIRET (si professionnel)</Label>
            <Input value={form.siret} onChange={e => setForm({ ...form, siret: e.target.value })} placeholder="123 456 789 00012" className="font-mono text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Contact</Label>
            <Input value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} placeholder="Marc Dubois" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Téléphone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="contact@..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Adresse</Label>
            <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="12 rue du Commerce, Lyon" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Conditions, qualité habituelle, etc." rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement...' : (supplier ? 'Modifier' : 'Créer')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
