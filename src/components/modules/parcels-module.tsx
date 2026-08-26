'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Package, MapPin, Truck, Printer, AlertCircle, CheckCircle2, Search,
  ChevronRight, ExternalLink, Layers,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  PARCEL_STATUSES, CARRIERS, getCarrierLabel, getPlatformColor, getPlatformLabel,
  getParcelStatusColor, getParcelStatusLabel, formatEUR, formatDateTime,
} from '@/lib/constants'
import { useSettings } from '@/hooks/use-settings'
import { cn } from '@/lib/utils'
import type { Sale } from './sales-module'

const ICONS: Record<string, React.ElementType> = {
  A_PREPARER: Package,
  A_IMPRIMER: Printer,
  A_DEPOSER: MapPin,
  PRET_EXPEDITION: CheckCircle2,
  EN_TRANSIT: Truck,
  LIVRE: CheckCircle2,
  PROBLEME: AlertCircle,
}

const PAGE_SIZE = 10

// A "colis" is either:
// - a single Sale (no boutiqueOrderId — manual sale, marketplace, etc.)
// - a group of Sales sharing the same boutiqueOrderId (multiple articles in one parcel)
interface Colis {
  key: string
  boutiqueOrderId: string | null
  sales: Sale[]
}

export function ParcelsModule() {
  const { data: sales, loading, refresh } = useFetch<Sale[]>('/api/sales')
  const { getTrackingUrl } = useSettings()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  // Build the list of "colis" — group sales by boutiqueOrderId.
  // Sales without boutiqueOrderId stay as individual colis (1 article = 1 colis).
  const colis = useMemo<Colis[]>(() => {
    if (!sales) return []
    const groups = new Map<string, Sale[]>()
    const singles: Sale[] = []
    for (const s of sales) {
      if (s.boutiqueOrderId) {
        if (!groups.has(s.boutiqueOrderId)) groups.set(s.boutiqueOrderId, [])
        groups.get(s.boutiqueOrderId)!.push(s)
      } else {
        singles.push(s)
      }
    }
    const allColis: Colis[] = []
    for (const [boutiqueOrderId, group] of groups.entries()) {
      allColis.push({ key: `order-${boutiqueOrderId}`, boutiqueOrderId, sales: group })
    }
    for (const s of singles) {
      allColis.push({ key: `sale-${s.id}`, boutiqueOrderId: null, sales: [s] })
    }
    // Sort by sale date (most recent first)
    allColis.sort((a, b) => {
      const aDate = new Date(a.sales[0].saleDate).getTime()
      const bDate = new Date(b.sales[0].saleDate).getTime()
      return bDate - aDate
    })
    return allColis
  }, [sales])

  // Apply filters
  const filtered = useMemo(() => {
    return colis.filter(c => {
      // Status filter: a colis matches if ALL its sales have the same status
      // (which is the normal case after mark-ready sets them all together).
      // For mixed statuses, we use the first sale's status as the displayed value.
      const colisStatus = c.sales[0].parcelStatus
      if (statusFilter !== 'all' && colisStatus !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        // Search across all articles in the colis
        return c.sales.some(s =>
          s.stockItem.sku.toLowerCase().includes(q) ||
          s.stockItem.brand.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.trackingNumber?.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [colis, statusFilter, search])

  // Reset page when filters change
  const filterKey = `${statusFilter}|${search}`
  const [lastFilterKey, setLastFilterKey] = useState(filterKey)
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Compteur par statut pour la barre de filtres rapides
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    colis.forEach(c => {
      const status = c.sales[0].parcelStatus
      counts[status] = (counts[status] || 0) + 1
    })
    return counts
  }, [colis])

  // Update the parcelStatus of ALL sales in a colis at once.
  // For grouped colis (multiple articles), we update each sale individually.
  const updateStatus = async (colis: Colis, newStatus: string) => {
    try {
      const results = await Promise.all(
        colis.sales.map(s =>
          fetch(`/api/sales/${s.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parcelStatus: newStatus }),
          })
        )
      )
      const failed = results.filter(r => !r.ok).length
      if (failed === 0) {
        toast.success(`Statut colis mis à jour (${colis.sales.length} article${colis.sales.length > 1 ? 's' : ''})`)
      } else {
        toast.error(`${failed} article(s) n'ont pas pu être mis à jour`)
      }
      refresh()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats résumé par statut */}
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2">
        {PARCEL_STATUSES.map(s => {
          const Icon = ICONS[s.id] || Package
          const count = statusCounts[s.id] || 0
          const active = statusFilter === s.id
          return (
            <button
              key={s.id}
              onClick={() => setStatusFilter(active ? 'all' : s.id)}
              className={cn(
                'p-3 rounded-lg border text-left transition-all',
                active ? 'border-foreground/30 bg-card shadow-sm' : 'border-border/60 bg-card/50 hover:bg-muted/40'
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase truncate">{s.label}</span>
              </div>
              <p className="text-xl font-bold">{count}</p>
            </button>
          )
        })}
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Statut colis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {PARCEL_STATUSES.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
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
              <p className="text-sm font-medium">Aucun colis</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter !== 'all' ? 'Aucun colis dans ce statut.' : 'Enregistrez une vente pour voir les colis associés.'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Article(s)</TableHead>
                    <TableHead className="hidden md:table-cell">Client</TableHead>
                    <TableHead>Plateforme</TableHead>
                    <TableHead className="hidden lg:table-cell">Transporteur</TableHead>
                    <TableHead className="hidden lg:table-cell">N° suivi</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Valeur du colis</TableHead>
                    <TableHead className="hidden xl:table-cell">Date vente</TableHead>
                    <TableHead>Statut colis</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map(colis => {
                    const firstSale = colis.sales[0]
                    const total = colis.sales.reduce((sum, s) => sum + (s.salePrice * ((s as { qty?: number }).qty || 1)), 0)
                    const multiArticles = colis.sales.length > 1
                    return (
                      <TableRow key={colis.key} className={cn('hover:bg-muted/40', multiArticles && 'bg-muted/10')}>
                        <TableCell>
                          {colis.sales.map((sale, idx) => (
                            <div key={sale.id} className={cn(idx > 0 && 'mt-1 pt-1 border-t border-dashed border-border/40')}>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{sale.stockItem.brand}</span>
                                {sale.stockItem.size && (
                                  <span className="text-[10px] text-muted-foreground">· {sale.stockItem.size}</span>
                                )}
                                {sale.stockItem.color && (
                                  <span className="text-[10px] text-muted-foreground">· {sale.stockItem.color}</span>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">{sale.stockItem.sku}</div>
                            </div>
                          ))}
                          {multiArticles && (
                            <Badge variant="secondary" className="mt-1 text-[9px] gap-1">
                              <Layers className="h-2.5 w-2.5" /> Lot de {colis.sales.length} articles
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-xs">
                          {firstSale.customerName || '—'}
                        </TableCell>
                        <TableCell>
                          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-block', getPlatformColor(firstSale.platform))}>
                            {getPlatformLabel(firstSale.platform)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          <div className="flex items-center gap-1.5">
                            <Truck className="h-3 w-3 text-muted-foreground" />
                            {firstSale.carrier ? getCarrierLabel(firstSale.carrier) : '—'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {(() => {
                            if (!firstSale.trackingNumber) return '—'
                            const trackingUrl = getTrackingUrl(firstSale.carrier, firstSale.trackingNumber)
                            if (trackingUrl) {
                              return (
                                <a
                                  href={trackingUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-950/50 px-1.5 py-0.5 rounded font-mono transition-colors"
                                  title={`Suivre sur ${getCarrierLabel(firstSale.carrier)}`}
                                >
                                  {firstSale.trackingNumber}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )
                            }
                            return <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{firstSale.trackingNumber}</code>
                          })()}
                        </TableCell>
                        <TableCell className="text-right hidden sm:table-cell">
                          {multiArticles ? (
                            <div>
                              <span className="font-semibold">{formatEUR(total)}</span>
                              <p className="text-[9px] text-muted-foreground">Σ {colis.sales.length} articles</p>
                            </div>
                          ) : (
                            <div>
                              <div>{formatEUR(firstSale.salePrice * ((firstSale as { qty?: number }).qty || 1))}</div>
                              {((firstSale as { qty?: number }).qty || 1) > 1 && (
                                <p className="text-[9px] text-muted-foreground">
                                  {formatEUR(firstSale.salePrice)} × {(firstSale as { qty?: number }).qty}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                          {formatDateTime(firstSale.saleDate)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={firstSale.parcelStatus}
                            onValueChange={(v) => updateStatus(colis, v)}
                          >
                            <SelectTrigger className="h-7 w-[140px] text-xs px-2">
                              <SelectValue>
                                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block', getParcelStatusColor(firstSale.parcelStatus))}>
                                  {getParcelStatusLabel(firstSale.parcelStatus)}
                                </span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {PARCEL_STATUSES.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right">
                          {/* Bouton flèche pour avancer au statut suivant */}
                          {(() => {
                            const currentIdx = PARCEL_STATUSES.findIndex(s => s.id === firstSale.parcelStatus)
                            const isFinal = currentIdx >= 5  // LIVRE ou PROBLEME
                            if (isFinal) return null
                            const nextStatus = PARCEL_STATUSES[currentIdx + 1]
                            if (!nextStatus || nextStatus.id === 'PROBLEME') return null
                            const Icon = ICONS[nextStatus.id] || ChevronRight
                            return (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => updateStatus(colis, nextStatus.id)}
                                title={`Passer à : ${nextStatus.label}${multiArticles ? ` (${colis.sales.length} articles)` : ''}`}
                              >
                                <Icon className="h-3 w-3 mr-1" /> {nextStatus.label}
                              </Button>
                            )
                          })()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} colis{filtered.length > 1 ? 's' : ''} ·{' '}
                  Page {safePage} sur {totalPages} ·{' '}
                  Affiche {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}
                  {statusFilter !== 'all' && <> · Filtré : <span className="font-medium">{getParcelStatusLabel(statusFilter)}</span></>}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="h-8"
                  >
                    Préc.
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
                    Suiv.
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Légende des statuts */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Workflow colis</p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {PARCEL_STATUSES.map((s, i) => {
              const Icon = ICONS[s.id] || Package
              return (
                <div key={s.id} className="flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full font-medium', s.color)}>
                    <Icon className="h-3 w-3" /> {s.label}
                  </span>
                  {i < PARCEL_STATUSES.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
