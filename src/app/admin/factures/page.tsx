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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileText, Mail, ExternalLink, Search, Link as LinkIcon, Send, Calendar, X } from 'lucide-react'
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
  stockItem: {
    brand: string
    title: string | null
    category: string
    sku: string
  }
}

export default function FacturesPage() {
  const { data: sales, loading } = useFetch<SaleWithInvoice[]>('/api/sales')
  const { getByType, getLabel: getAttrLabel } = useSettings()

  // Platforms come from the user's settings (Paramètres → Plateformes), not a hardcoded list.
  // This way, if the user adds/edits/removes platforms in settings, the filter follows.
  const platformAttrs = getByType('platform')

  // Resolve a platform code to its display label (falls back to the raw code if not found).
  const platformLabel = (code: string): string =>
    platformAttrs.find(p => p.code === code)?.value || getAttrLabel('platform', code) || code

  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [yearFilter, setYearFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [sending, setSending] = useState<string | null>(null)
  const [copying, setCopying] = useState<string | null>(null)

  // Email popup state — when customerContact is empty, the user can enter an email
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [emailDialogSale, setEmailDialogSale] = useState<SaleWithInvoice | null>(null)
  const [emailDialogValue, setEmailDialogValue] = useState('')

  // Filter sales that have an invoice number
  const salesWithInvoices = useMemo(() => {
    if (!sales) return []
    return sales.filter(s => s.invoiceNumber)
  }, [sales])

  const filtered = useMemo(() => {
    return salesWithInvoices.filter(s => {
      if (platformFilter !== 'all' && s.platform !== platformFilter) return false
      // Year + month filters — based on saleDate
      if (yearFilter !== 'all' || monthFilter !== 'all') {
        const d = new Date(s.saleDate)
        if (isNaN(d.getTime())) return false
        if (yearFilter !== 'all' && String(d.getFullYear()) !== yearFilter) return false
        if (monthFilter !== 'all' && String(d.getMonth() + 1).padStart(2, '0') !== monthFilter) return false
      }
      if (search) {
        const q = search.toLowerCase()
        return (
          s.invoiceNumber?.toLowerCase().includes(q) ||
          s.customerName?.toLowerCase().includes(q) ||
          s.customerContact?.toLowerCase().includes(q) ||
          s.stockItem.brand.toLowerCase().includes(q) ||
          s.stockItem.sku.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [salesWithInvoices, search, platformFilter, yearFilter, monthFilter])

  // Available years — descending, derived from sales dates (only years that have at least one sale)
  const years = useMemo(() => {
    const set = new Set<string>()
    salesWithInvoices.forEach(s => {
      const d = new Date(s.saleDate)
      if (!isNaN(d.getTime())) set.add(String(d.getFullYear()))
    })
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [salesWithInvoices])

  // Reset month when year changes (months are dependent on year for the data subset)
  // Note: we keep the month list static so the user can pick any month; the filter just yields no rows if that month has no sales in the selected year.
  const MONTHS = [
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' },
  ]

  const hasDateFilter = yearFilter !== 'all' || monthFilter !== 'all'
  const resetDateFilter = () => {
    setYearFilter('all')
    setMonthFilter('all')
  }

  // Build the platform dropdown — platforms from settings + any extras found in the data
  // (extras can happen if a platform was deleted from settings but old sales still reference it)
  const platforms = useMemo(() => {
    const fromSettings = platformAttrs.map(p => p.code)
    const extras = Array.from(new Set(salesWithInvoices.map(s => s.platform)))
      .filter(p => !fromSettings.includes(p))
    return [...fromSettings, ...extras]
  }, [platformAttrs, salesWithInvoices])

  // Build the public PDF URL — uses window.location.origin so it works even without shareSiteUrl
  const buildInvoiceUrl = (invoiceNumber: string): string => {
    if (typeof window === 'undefined') return ''
    const origin = window.location.origin
    return `${origin}/api/invoices/by-number/${encodeURIComponent(invoiceNumber)}/pdf`
  }

  const doSend = async (saleId: string, email: string, invoiceNumber: string, saleDate: string) => {
    setSending(saleId)
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

  const handleSendClick = (sale: SaleWithInvoice) => {
    const email = sale.customerContact?.trim() || ''
    if (!email) {
      // No email on file → open the dialog to ask for one
      setEmailDialogSale(sale)
      setEmailDialogValue('')
      setEmailDialogOpen(true)
      return
    }
    doSend(sale.id, email, sale.invoiceNumber || '', sale.saleDate)
  }

  const confirmSendFromDialog = async () => {
    if (!emailDialogSale) return
    const email = emailDialogValue.trim()
    if (!email) {
      toast.error('Veuillez saisir une adresse email')
      return
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Adresse email invalide')
      return
    }
    setEmailDialogOpen(false)
    await doSend(
      emailDialogSale.id,
      email,
      emailDialogSale.invoiceNumber || '',
      emailDialogSale.saleDate,
    )
    setEmailDialogSale(null)
    setEmailDialogValue('')
  }

  const previewInvoice = (saleId: string) => {
    window.open(`/api/invoices/${saleId}/pdf`, '_blank')
  }

  const copyInvoiceLink = async (sale: SaleWithInvoice) => {
    if (!sale.invoiceNumber) return
    setCopying(sale.id)
    try {
      const url = buildInvoiceUrl(sale.invoiceNumber)
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
            <p className="text-2xl font-bold mt-1">{salesWithInvoices.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase">CA facturé</p>
            <p className="text-2xl font-bold mt-1">{formatEUR(filtered.reduce((s, x) => s + x.salePrice, 0))}</p>
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
            <p className="text-2xl font-bold mt-1">{filtered.filter(s => s.customerContact).length}</p>
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
                    <th className="px-3 py-2.5 font-medium">Article</th>
                    <th className="px-3 py-2.5 font-medium">Plateforme</th>
                    <th className="px-3 py-2.5 font-medium text-right">Montant</th>
                    <th className="px-3 py-2.5 font-medium text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => {
                    const hasEmail = !!s.customerContact?.trim()
                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5">
                          <code className="text-xs bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                            {s.invoiceNumber}
                          </code>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(s.saleDate)}</td>
                        <td className="px-3 py-2.5">{s.customerName || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {s.customerContact || <span className="italic text-amber-600 dark:text-amber-400">à saisir</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <div>
                            <p className="font-medium">{s.stockItem.brand}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{s.stockItem.sku}</p>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline">{platformLabel(s.platform)}</Badge>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold">{formatEUR(s.salePrice)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => previewInvoice(s.id)}
                              title="Aperçu PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => handleSendClick(s)}
                              disabled={sending === s.id}
                              title={hasEmail ? 'Envoyer par email' : 'Saisir l\'email puis envoyer'}
                            >
                              {sending === s.id ? (
                                <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Mail className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => copyInvoiceLink(s)}
                              disabled={copying === s.id}
                              title="Copier le lien de téléchargement direct"
                            >
                              {copying === s.id ? (
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
              {emailDialogSale && (
                <>
                  Aucun email n'est enregistré pour cette vente. Saisissez l'adresse du destinataire
                  pour lui envoyer la facture <strong className="font-mono">{emailDialogSale.invoiceNumber}</strong>.
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
            {emailDialogSale && (
              <div className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                <div><strong>Client :</strong> {emailDialogSale.customerName || '—'}</div>
                <div><strong>Article :</strong> {emailDialogSale.stockItem.brand} {emailDialogSale.stockItem.title || emailDialogSale.stockItem.category}</div>
                <div><strong>Montant :</strong> {formatEUR(emailDialogSale.salePrice)}</div>
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
