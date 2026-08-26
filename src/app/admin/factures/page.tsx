'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { useSettings } from '@/hooks/use-settings'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Mail, ExternalLink, Search, Link as LinkIcon, Send, Calendar, X, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { formatEUR, formatDate } from '@/lib/constants'

interface SaleWithInvoice {
  id: string
  invoiceNumber: string | null
  saleDate: string
  platform: string
  customerName: string | null
  customerContact: string | null
  salePrice: number
  qty?: number | null
  stockItem: {
    brand: string
    title: string | null
    category: string
    sku: string
  }
}

// Parse customerContact which may be a JSON string like {"email":"...","phone":"..."}
// or plain text (legacy sales). Returns the extracted email or the raw string.
function extractEmail(customerContact: string | null | undefined): string {
  if (!customerContact) return ''
  const trimmed = customerContact.trim()
  // Try JSON parse (boutique orders store it as JSON)
  try {
    const parsed = JSON.parse(trimmed)
    if (parsed && typeof parsed.email === 'string') return parsed.email
  } catch {
    // Not JSON — it's plain text (legacy sales or a raw email)
  }
  // If it looks like an email, return as-is
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return trimmed
  return trimmed
}

// A grouped invoice = 1 or more Sales sharing the same invoiceNumber
interface GroupedInvoice {
  invoiceNumber: string
  sales: SaleWithInvoice[]
  // Aggregated fields for display
  customerName: string | null
  email: string
  saleDate: string
  platform: string
  totalAmount: number
  articleCount: number
}

export default function FacturesPage() {
  const { data: sales, loading } = useFetch<SaleWithInvoice[]>('/api/sales')
  const { getByType, getLabel: getAttrLabel } = useSettings()

  const platformAttrs = getByType('platform')
  const platformLabel = (code: string): string =>
    platformAttrs.find(p => p.code === code)?.value || getAttrLabel('platform', code) || code

  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [sending, setSending] = useState<string | null>(null)
  const [copying, setCopying] = useState<string | null>(null)

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailDialogInvoice, setEmailDialogInvoice] = useState<GroupedInvoice | null>(null)
  const [emailDialogValue, setEmailDialogValue] = useState('')

  // Filter sales that have an invoice number
  const salesWithInvoices = useMemo(() => {
    if (!sales) return []
    return sales.filter(s => s.invoiceNumber)
  }, [sales])

  // Group sales by invoiceNumber — 1 row per invoice (not 1 per Sale).
  // A multi-article order shares one invoice number → 1 grouped invoice.
  const groupedInvoices = useMemo<GroupedInvoice[]>(() => {
    const map = new Map<string, SaleWithInvoice[]>()
    for (const s of salesWithInvoices) {
      if (!s.invoiceNumber) continue
      if (!map.has(s.invoiceNumber)) map.set(s.invoiceNumber, [])
      map.get(s.invoiceNumber)!.push(s)
    }
    const result: GroupedInvoice[] = []
    for (const [invoiceNumber, group] of map.entries()) {
      const first = group[0]
      const totalAmount = group.reduce((sum, s) => sum + (s.salePrice * (s.qty || 1)), 0)
      const articleCount = group.reduce((sum, s) => sum + (s.qty || 1), 0)
      result.push({
        invoiceNumber,
        sales: group.sort((a, b) => a.stockItem.sku.localeCompare(b.stockItem.sku)),
        customerName: first.customerName,
        email: extractEmail(first.customerContact),
        saleDate: first.saleDate,
        platform: first.platform,
        totalAmount,
        articleCount,
      })
    }
    // Sort by date descending
    result.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())
    return result
  }, [salesWithInvoices])

  // Apply filters on grouped invoices
  const filtered = useMemo(() => {
    return groupedInvoices.filter(inv => {
      if (platformFilter !== 'all' && inv.platform !== platformFilter) return false
      if (yearFilter !== 'all' || monthFilter !== 'all') {
        const d = new Date(inv.saleDate)
        if (isNaN(d.getTime())) return false
        if (yearFilter !== 'all' && String(d.getFullYear()) !== yearFilter) return false
        if (monthFilter !== 'all' && String(d.getMonth() + 1).padStart(2, '0') !== monthFilter) return false
      }
      if (search) {
        const q = search.toLowerCase()
        // Search across all articles in the invoice
        return (
          inv.invoiceNumber?.toLowerCase().includes(q) ||
          inv.customerName?.toLowerCase().includes(q) ||
          inv.email?.toLowerCase().includes(q) ||
          inv.sales.some(s =>
            s.stockItem.brand.toLowerCase().includes(q) ||
            s.stockItem.sku.toLowerCase().includes(q)
          )
        )
      }
      return true
    })
  }, [groupedInvoices, search, platformFilter, yearFilter, monthFilter])

  const years = useMemo(() => {
    const set = new Set<string>()
    groupedInvoices.forEach(inv => {
      const d = new Date(inv.saleDate)
      if (!isNaN(d.getTime())) set.add(String(d.getFullYear()))
    })
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [groupedInvoices])

  const MONTHS = [
    { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' }, { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' }, { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
  ]
  const hasDateFilter = yearFilter !== 'all' || monthFilter !== 'all'
  const resetDateFilter = () => { setYearFilter('all'); setMonthFilter('all') }

  const platforms = useMemo(() => {
    const fromSettings = platformAttrs.map(p => p.code)
    const extras = Array.from(new Set(groupedInvoices.map(inv => inv.platform)))
      .filter(p => !fromSettings.includes(p))
    return [...fromSettings, ...extras]
  }, [platformAttrs, groupedInvoices])

  const buildInvoiceUrl = (invoiceNumber: string): string => {
    if (typeof window === 'undefined') return ''
    const origin = window.location.origin
    return `${origin}/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}/pdf`
  }

  const doSend = async (saleId: string, email: string, invoiceNumber: string, saleDate: string) => {
    setSending(invoiceNumber)
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleId, email, invoiceNumber, saleDate }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      toast.success(`Facture envoyée à ${email}`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSending(null)
    }
  }

  const handleSendClick = (inv: GroupedInvoice) => {
    const email = inv.email.trim()
    if (!email) {
      setEmailDialogInvoice(inv)
      setEmailDialogValue('')
      setEmailDialogOpen(true)
      return
    }
    // Use the first Sale's id as the anchor for the send API
    doSend(inv.sales[0].id, email, inv.invoiceNumber, inv.saleDate)
  }

  const confirmSendFromDialog = async () => {
    if (!emailDialogInvoice) return
    const email = emailDialogValue.trim()
    if (!email) {
      toast.error('Veuillez saisir une adresse email')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide')
      return
    }
    setEmailDialogOpen(false)
    await doSend(
      emailDialogInvoice.sales[0].id,
      email,
      emailDialogInvoice.invoiceNumber,
      emailDialogInvoice.saleDate,
    )
    setEmailDialogInvoice(null)
    setEmailDialogValue('')
  }

  const previewInvoice = (saleId: string) => {
    window.open(`/api/invoices/${saleId}/pdf`, '_blank')
  }

  const copyInvoiceLink = async (inv: GroupedInvoice) => {
    setCopying(inv.invoiceNumber)
    try {
      const url = buildInvoiceUrl(inv.invoiceNumber)
      await navigator.clipboard.writeText(url)
      toast.success('Lien de la facture copié dans le presse-papier')
    } catch {
      toast.error('Impossible de copier le lien')
    } finally {
      setCopying(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Factures de vente
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Liste des factures émises, filtrables par année, mois et plateforme. Aperçu PDF, envoi par email et lien de téléchargement direct.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Total factures</p>
            <p className="text-2xl font-bold mt-1">{groupedInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">CA facturé</p>
            <p className="text-2xl font-bold mt-1">{formatEUR(filtered.reduce((s, inv) => s + inv.totalAmount, 0))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Plateformes</p>
            <p className="text-2xl font-bold mt-1">{platforms.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">Avec email client</p>
            <p className="text-2xl font-bold mt-1">{filtered.filter(inv => inv.email).length}</p>
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
                placeholder="Rechercher par n° facture, client, email, marque, SKU..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={yearFilter} onValueChange={v => { setYearFilter(v); if (v === 'all') setMonthFilter('all') }}>
              <SelectTrigger className="w-full lg:w-[120px]">
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes années</SelectItem>
                {years.map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter} disabled={yearFilter === 'all'}>
              <SelectTrigger className="w-full lg:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous mois</SelectItem>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes plateformes</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasDateFilter && (
              <Button variant="ghost" size="sm" onClick={resetDateFilter} title="Effacer le filtre date" className="gap-1">
                <X className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Effacer date</span>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {hasDateFilter || platformFilter !== 'all' || search
                ? 'Aucune facture ne correspond à vos filtres'
                : 'Aucune facture'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasDateFilter || platformFilter !== 'all' || search
                ? 'Essayez d\'élargir la période ou la plateforme.'
                : 'Les factures apparaîtront ici dès qu\'une vente aura un numéro de facture attribué.'}
            </p>
            {(hasDateFilter || platformFilter !== 'all' || search) && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => { resetDateFilter(); setPlatformFilter('all'); setSearch('') }}
              >
                Réinitialiser les filtres
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30 uppercase">
                    <th className="px-3 py-2.5 font-medium">N° Facture</th>
                    <th className="px-3 py-2.5 font-medium">Date</th>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium">Email</th>
                    <th className="px-3 py-2.5 font-medium">Article(s)</th>
                    <th className="px-3 py-2.5 font-medium">Plateforme</th>
                    <th className="px-3 py-2.5 font-medium text-right">Montant</th>
                    <th className="px-3 py-2.5 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const hasEmail = !!inv.email.trim()
                    const isMulti = inv.sales.length > 1
                    return (
                      <tr key={inv.invoiceNumber} className={`border-b last:border-0 hover:bg-muted/30 ${isMulti ? 'bg-muted/5' : ''}`}>
                        <td className="px-3 py-2.5">
                          <code className="text-xs bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                            {inv.invoiceNumber}
                          </code>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(inv.saleDate)}</td>
                        <td className="px-3 py-2.5">{inv.customerName || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {hasEmail ? inv.email : <span className="italic text-amber-600 dark:text-amber-400">à saisir</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {inv.sales.map((s, idx) => (
                            <div key={s.id} className={idx > 0 ? 'mt-1 pt-1 border-t border-dashed border-border/40' : ''}>
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{s.stockItem.brand}</span>
                                {(s.qty || 1) > 1 && (
                                  <span className="text-[10px] text-muted-foreground">×{s.qty}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono">{s.stockItem.sku}</p>
                            </div>
                          ))}
                          {isMulti && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                              <Layers className="h-2.5 w-2.5" /> {inv.articleCount} articles
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline">{platformLabel(inv.platform)}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatEUR(inv.totalAmount)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => previewInvoice(inv.sales[0].id)}
                              title="Aperçu PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleSendClick(inv)}
                              disabled={sending === inv.invoiceNumber}
                              title={hasEmail ? 'Envoyer par email' : 'Saisir l\'email puis envoyer'}
                            >
                              {sending === inv.invoiceNumber ? (
                                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => copyInvoiceLink(inv)}
                              disabled={copying === inv.invoiceNumber}
                              title="Copier le lien de téléchargement direct"
                            >
                              {copying === inv.invoiceNumber ? (
                                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <LinkIcon className="h-3.5 w-3.5" />
                              )}
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

      {/* Email dialog — shown when customerContact is empty */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Envoyer la facture par email
            </DialogTitle>
            <DialogDescription>
              {emailDialogInvoice && (
                <>
                  Aucun email n'est enregistré pour cette vente. Saisissez l'adresse du destinataire
                  pour lui envoyer la facture <strong className="font-mono">{emailDialogInvoice.invoiceNumber}</strong>.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-muted-foreground">Adresse email du client</label>
            <Input
              type="email"
              placeholder="client@exemple.fr"
              value={emailDialogValue}
              onChange={e => setEmailDialogValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmSendFromDialog()
              }}
              autoFocus
            />
            {emailDialogInvoice && (
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <div><strong>Client :</strong> {emailDialogInvoice.customerName || '—'}</div>
                <div><strong>Articles :</strong> {emailDialogInvoice.sales.map(s => `${s.stockItem.brand}${(s.qty || 1) > 1 ? ` ×${s.qty}` : ''}`).join(', ')}</div>
                <div><strong>Montant :</strong> {formatEUR(emailDialogInvoice.totalAmount)}</div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={confirmSendFromDialog} className="gap-2">
              <Send className="h-4 w-4" />
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
