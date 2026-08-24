'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { FileText, Mail, ExternalLink, Search, Download } from 'lucide-react'
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

const PLATFORM_LABELS: Record<string, string> = {
  vinted: 'Vinted',
  leboncoin: 'Leboncoin',
  ebay: 'eBay',
  vestiaire: 'Vestiaire Collective',
  boutique: 'Boutique',
}

export default function FacturesPage() {
  const { data: sales, loading } = useFetch<SaleWithInvoice[]>('/api/sales')
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('all')
  const [sending, setSending] = useState<string | null>(null)

  // Filter sales that have an invoice number
  const salesWithInvoices = useMemo(() => {
    if (!sales) return []
    return sales.filter(s => s.invoiceNumber)
  }, [sales])

  const filtered = useMemo(() => {
    return salesWithInvoices.filter(s => {
      if (platformFilter !== 'all' && s.platform !== platformFilter) return false
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
  }, [salesWithInvoices, search, platformFilter])

  const platforms = useMemo(() => {
    return Array.from(new Set(salesWithInvoices.map(s => s.platform)))
  }, [salesWithInvoices])

  const sendByEmail = async (saleId: string, email: string, invoiceNumber: string, saleDate: string) => {
    if (!email) {
      toast.error('Cet article n\'a pas d\'email client')
      return
    }
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

  const previewInvoice = (saleId: string) => {
    window.open(`/api/invoices/${saleId}/pdf`, '_blank')
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Factures de vente
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Liste des factures émises, filtrables par plateforme. Aperçu PDF et envoi par email.
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
            <Select value={platformFilter} onValueChange={setPlatformFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes plateformes</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>{PLATFORM_LABELS[p] || p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <p className="text-sm font-medium">Aucune facture</p>
            <p className="text-xs text-muted-foreground mt-1">
              Les factures apparaîtront ici dès qu'une vente aura un numéro de facture attribué.
            </p>
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
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5">
                        <code className="text-xs bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {s.invoiceNumber}
                        </code>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{formatDate(s.saleDate)}</td>
                      <td className="px-3 py-2.5">{s.customerName || '—'}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{s.customerContact || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div>
                          <p className="font-medium">{s.stockItem.brand}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{s.stockItem.sku}</p>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline">{PLATFORM_LABELS[s.platform] || s.platform}</Badge>
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
                            onClick={() => sendByEmail(s.id, s.customerContact || '', s.invoiceNumber || '', s.saleDate)}
                            disabled={sending === s.id || !s.customerContact}
                            title={s.customerContact ? 'Envoyer par email' : 'Pas d\'email client'}
                          >
                            {sending === s.id ? (
                              <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Mail className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
