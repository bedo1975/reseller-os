'use client'

import { useState, useMemo } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileDown, FileSpreadsheet, FileText, Plus, Trash2, Receipt, BookOpen,
  ClipboardList, BarChart3, BookCheck, BookMarked, Printer, Percent, Edit, AlertTriangle, Calendar,
  Upload, ExternalLink, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatEUR, formatDate, EXPENSE_CATEGORIES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/components/shared/confirm-provider'
import type { Sale } from './sales-module'

interface Expense {
  id: string
  date: string
  category: string
  label: string
  amount: number
  isRecurring: boolean
  recurringFreq: string | null
}

type Tab = 'synthese' | 'recettes' | 'achats' | 'urssaf'

export function TaxesModule() {
  const [activeTab, setActiveTab] = useState<Tab>('synthese')
  const [year, setYear] = useState(new Date().getFullYear())

  const tabs = [
    { id: 'synthese' as Tab, label: 'Synthèse', icon: BarChart3, description: 'Vue d\'ensemble + dépenses' },
    { id: 'recettes' as Tab, label: 'Livre des recettes', icon: BookOpen, description: 'Recettes chronologiques (légal)' },
    { id: 'achats' as Tab, label: 'Registre des achats', icon: ClipboardList, description: 'Achats par article (légal)' },
    { id: 'urssaf' as Tab, label: 'Déclaration URSSAF', icon: Percent, description: 'Cotisations sociales' },
  ]

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const Icon = t.icon
          const active = activeTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2',
                active
                  ? 'bg-foreground text-background border-foreground'
                  : 'bg-card hover:bg-muted border-border'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* Year selector (commun) */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium">Année fiscale :</span>
            <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
              <SelectTrigger className="w-[110px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
        </CardContent>
      </Card>

      {activeTab === 'synthese' && <SyntheseTab year={year} />}
      {activeTab === 'recettes' && <RecettesTab year={year} />}
      {activeTab === 'achats' && <AchatsTab year={year} />}
      {activeTab === 'urssaf' && <UrssafTab year={year} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 1 — SYNTHÈSE (le module Fiscalité existant)
// ═══════════════════════════════════════════════════════════════════════════

function SyntheseTab({ year }: { year: number }) {
  const confirm = useConfirm()
  const { data: sales, loading: salesLoading } = useFetch<Sale[]>('/api/sales')
  const { data: expenses, loading: expLoading, refresh } = useFetch<Expense[]>('/api/expenses')
  const { data: taxSettings } = useFetch<{ taxRate: number }>('/api/tax-rates')
  const { data: purchases } = useFetch<any[]>('/api/purchases')
  const [showForm, setShowForm] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [month, setMonth] = useState<string>('all')
  // Fetch the accounting ACHATS data (same source as the Registre des achats tab).
  // This includes ALL stock items purchased in the period (sold or not) + all Purchase entries,
  // and correctly multiplies purchaseCost by quantity. Used for the "Achats" total in the synthèse.
  const { data: achatsData } = useFetch<any>(`/api/accounting?type=achats&year=${year}${month !== 'all' ? `&month=${month}` : ''}`)
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: 'frais_port',
    label: '',
    amount: '',
    isRecurring: false,
    recurringFreq: '',
  })
  const [saving, setSaving] = useState(false)

  const yearSales = useMemo(() => {
    const filtered = (sales || []).filter(s => new Date(s.saleDate).getFullYear() === year)
    if (month === 'all') return filtered
    return filtered.filter(s => new Date(s.saleDate).getMonth() + 1 === parseInt(month))
  }, [sales, year, month])

  const yearExpenses = useMemo(() => {
    const filtered = (expenses || []).filter(e => new Date(e.date).getFullYear() === year)
    if (month === 'all') return filtered
    return filtered.filter(e => new Date(e.date).getMonth() + 1 === parseInt(month))
  }, [expenses, year, month])

  // Achats hors stock (Purchase entries — inclut les pré-commandes validées)
  const yearPurchases = useMemo(() => {
    const filtered = (purchases || []).filter(p => new Date(p.date).getFullYear() === year)
    if (month === 'all') return filtered
    return filtered.filter(p => new Date(p.date).getMonth() + 1 === parseInt(month))
  }, [purchases, year, month])

  const totalCA = yearSales.reduce((s, x) => s + x.salePrice + (x.shippingCost || 0), 0)
  // Total purchases (for the "Achats" card — includes ALL items purchased in the period, sold or not)
  const totalHorsStockPurchases = yearPurchases.reduce((s, p) => s + (p.amount || 0), 0)
  const totalPurchases = achatsData?.total ?? (yearSales.reduce((s, x) => s + x.stockItem.purchaseCost * (x.stockItem.quantity || 1), 0) + totalHorsStockPurchases)
  const totalPlatformFees = yearSales.reduce((s, x) => s + (x.platformFees || 0) + (x.platformFixedFees || 0), 0)
  // Frais de port FACTURÉS au client (inclus dans le CA — c'est un revenu)
  const totalShippingBilled = yearSales.reduce((s, x) => s + x.shippingCost, 0)
  // Frais de port RÉELS payés au transporteur (charge déductible)
  const totalCarrierShipping = yearSales.reduce((s, x) => s + (x.carrierShippingCost || 0), 0)
  // Frais bancaires (Stripe, PayPal...) — déduits du CA (charge déductible)
  const totalPaymentFees = yearSales.reduce((s, x) => s + (x.paymentFees || 0), 0)
  const totalOtherExpenses = yearExpenses.reduce((s, e) => s + e.amount, 0)
  const taxRate = taxSettings?.taxRate || 0
  const urssafCotisation = totalCA * taxRate / 100
  // Bénéfice net = CA - Total des charges (tous les décaissements)
  // En micro-entreprise, on déduit TOUTES les charges au moment du paiement (pas au moment de la vente).
  // achatsData.total includes: StockItems (purchaseCost × qty) + Purchases (hors stock) + Expenses (dépenses)
  // So we must NOT deduct totalOtherExpenses again (it's already in achatsData.total via the Expenses).
  // Fallback: if achatsData hasn't loaded, use totalPurchases (StockItems + Purchases) + totalOtherExpenses (Expenses)
  const totalProfit = totalCA
    - (achatsData?.total ?? (totalPurchases + totalOtherExpenses))  // all charges
    - totalPlatformFees
    - totalCarrierShipping
    - totalPaymentFees
    - urssafCotisation

  const exportCSV = () => {
    const rows: string[][] = []
    rows.push(['Type', 'Date', 'Plateforme', 'Article', 'Description', 'CA (prix+port client)', 'Coût', 'Frais plateforme', 'Frais port client', 'Frais port transporteur', 'Profit', 'Marge %'])
    yearSales.forEach(s => {
      rows.push([
        'Vente', formatDate(s.saleDate), s.platform, s.stockItem.sku,
        `${s.stockItem.brand} ${s.stockItem.size || ''} ${s.stockItem.color || ''}`.trim(),
        (s.salePrice + (s.shippingCost || 0)).toFixed(2), s.stockItem.purchaseCost.toFixed(2),
        ((s.platformFees || 0) + (s.platformFixedFees || 0)).toFixed(2),
        s.shippingCost.toFixed(2), (s.carrierShippingCost || 0).toFixed(2),
        s.profit.toFixed(2), s.margin.toString(),
      ])
    })
    yearExpenses.forEach(e => {
      rows.push(['Dépense', formatDate(e.date), '', '', e.label, '', '', '', '', '', '', (-e.amount).toFixed(2), ''])
    })
    yearPurchases.forEach(p => {
      rows.push(['Achat HS', formatDate(p.date), '', '', p.designation, '', (-p.amount).toFixed(2), '', '', '', '', (-p.amount).toFixed(2), ''])
    })
    rows.push([])
    rows.push(['TOTAUX', '', '', '', '', totalCA.toFixed(2), totalPurchases.toFixed(2), totalPlatformFees.toFixed(2), totalShippingBilled.toFixed(2), totalCarrierShipping.toFixed(2), totalProfit.toFixed(2), ''])

    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reseller-os-fiscalite-${year}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export CSV téléchargé')
  }

  const exportExcel = () => {
    const rows: string[][] = []
    rows.push(['Type', 'Date', 'Plateforme', 'SKU', 'Description', 'CA (€)', 'Coût (€)', 'Frais plateforme (€)', 'Frais port client (€)', 'Frais port transporteur (€)', 'Profit (€)', 'Marge (%)'])
    yearSales.forEach(s => {
      rows.push([
        'Vente', formatDate(s.saleDate), s.platform, s.stockItem.sku,
        `${s.stockItem.brand} ${s.stockItem.size || ''} ${s.stockItem.color || ''}`.trim(),
        (s.salePrice + (s.shippingCost || 0)).toFixed(2), s.stockItem.purchaseCost.toFixed(2),
        ((s.platformFees || 0) + (s.platformFixedFees || 0)).toFixed(2),
        s.shippingCost.toFixed(2), (s.carrierShippingCost || 0).toFixed(2),
        s.profit.toFixed(2), s.margin.toString(),
      ])
    })
    yearExpenses.forEach(e => {
      rows.push(['Dépense', formatDate(e.date), '', '', e.label, '', '', '', '', '', '', (-e.amount).toFixed(2), ''])
    })
    const tsv = rows.map(r => r.join('\t')).join('\n')
    const blob = new Blob(['\ufeff' + tsv], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reseller-os-fiscalite-${year}.xls`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Export Excel téléchargé')
  }

  const exportPDF = () => {
    const win = window.open('', '_blank')
    if (!win) {
      toast.error('Bloqueur de pop-up : autorisez les pop-ups pour exporter en PDF')
      return
    }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8">
      <title>Reseller OS — Fiscalité ${year}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 40px; color: #1a1a1a; }
        h1 { font-size: 24px; margin: 0 0 4px; }
        .subtitle { color: #666; margin-bottom: 24px; font-size: 13px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
        .summary div { background: #f7f7f7; padding: 14px; border-radius: 8px; }
        .summary .label { font-size: 11px; color: #666; text-transform: uppercase; }
        .summary .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 28px; }
        th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #f7f7f7; font-weight: 600; text-transform: uppercase; font-size: 10px; color: #666; }
        .total { font-weight: 700; background: #f0fdf4 !important; }
        .profit { color: #10b981; font-weight: 600; }
        h2 { font-size: 16px; margin-top: 24px; }
      </style></head>
      <body>
        <h1>Reseller OS — Rapport fiscal ${year}</h1>
        <p class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR')}</p>
        <div class="summary">
          <div><div class="label">CA</div><div class="value">${formatEUR(totalCA)}</div></div>
          <div><div class="label">Achats</div><div class="value">${formatEUR(totalPurchases)}</div></div>
          <div><div class="label">Frais plateforme</div><div class="value">${formatEUR(totalPlatformFees)}</div></div>
          <div><div class="label">Frais port client</div><div class="value">${formatEUR(totalShippingBilled)}</div></div>
          <div><div class="label">Frais port transporteur</div><div class="value">${formatEUR(totalCarrierShipping)}</div></div>
          <div><div class="label">Autres dépenses</div><div class="value">${formatEUR(totalOtherExpenses)}</div></div>
          <div><div class="label">Bénéfice net</div><div class="value profit">${formatEUR(totalProfit)}</div></div>
          <div><div class="label">Marge</div><div class="value">${totalCA > 0 ? ((totalProfit / totalCA) * 100).toFixed(1) : 0}%</div></div>
          <div><div class="label">Nb ventes</div><div class="value">${yearSales.length}</div></div>
        </div>
        <h2>Ventes</h2>
        <table><thead><tr><th>Date</th><th>Plateforme</th><th>Article</th><th>CA</th><th>Coût</th><th>Frais</th><th>Profit</th></tr></thead>
        <tbody>
          ${yearSales.map(s => `
            <tr>
              <td>${formatDate(s.saleDate)}</td>
              <td>${s.platform}</td>
              <td>${s.stockItem.brand} (${s.stockItem.sku})</td>
              <td>${formatEUR(s.salePrice + (s.shippingCost || 0))}</td>
              <td>${formatEUR(s.stockItem.purchaseCost)}</td>
              <td>${formatEUR((s.platformFees || 0) + (s.carrierShippingCost || 0) + (s.platformFixedFees || 0))}</td>
              <td class="profit">${formatEUR(s.profit)}</td>
            </tr>
          `).join('')}
          <tr class="total">
            <td colspan="3">TOTAUX</td>
            <td>${formatEUR(totalCA)}</td>
            <td>${formatEUR(totalPurchases)}</td>
            <td>${formatEUR(totalPlatformFees + totalCarrierShipping)}</td>
            <td class="profit">${formatEUR(yearSales.reduce((s, x) => s + x.profit, 0))}</td>
          </tr>
        </tbody></table>
        ${yearExpenses.length > 0 ? `
          <h2>Autres dépenses</h2>
          <table><thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Montant</th></tr></thead>
          <tbody>
            ${yearExpenses.map(e => `
              <tr><td>${formatDate(e.date)}</td><td>${e.category}</td><td>${e.label}</td><td>${formatEUR(e.amount)}</td></tr>
            `).join('')}
            <tr class="total"><td colspan="3">TOTAL DÉPENSES</td><td>${formatEUR(totalOtherExpenses)}</td></tr>
          </tbody></table>
        ` : ''}
        <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `)
    win.document.close()
    toast.success('Export PDF ouvert — utilisez Ctrl/Cmd+P pour enregistrer')
  }

  const addExpense = async () => {
    if (!form.label || !form.amount) {
      toast.error('Libellé et montant requis')
      return
    }
    setSaving(true)
    try {
      if (editingExpense) {
        // Édition
        const res = await fetch(`/api/expenses/${editingExpense.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erreur')
        toast.success('Dépense modifiée')
        setEditingExpense(null)
      } else {
        // Création
        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        if (!res.ok) throw new Error('Erreur')
        toast.success(form.isRecurring ? 'Dépense récurrente créée (prochaines occurrences générées)' : 'Dépense ajoutée')
      }
      setForm({ date: new Date().toISOString().split('T')[0], category: 'frais_port', label: '', amount: '', isRecurring: false, recurringFreq: '' })
      setShowForm(false)
      refresh()
    } catch {
      toast.error('Erreur')
    } finally {
      setSaving(false)
    }
  }

  const editExpense = (e: Expense) => {
    setEditingExpense(e)
    setForm({
      date: new Date(e.date).toISOString().split('T')[0],
      category: e.category,
      label: e.label,
      amount: String(e.amount),
      isRecurring: e.isRecurring,
      recurringFreq: e.recurringFreq || '',
    })
    setShowForm(true)
  }

  const deleteExpense = async (id: string) => {
    const ok = await confirm({
      title: 'Supprimer cette dépense ?',
      description: 'Cette action est irréversible.',
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    })
    if (!ok) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    toast.success('Dépense supprimée')
    refresh()
  }

  const resetData = async (scope: 'all' | 'sales' | 'purchases' | 'expenses') => {
    setResetting(true)
    try {
      const res = await fetch('/api/accounting/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur')
      }
      const data = await res.json()
      toast.success(data.message || 'Données réinitialisées')
      setShowResetModal(false)
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setResetting(false)
    }
  }

  const loading = salesLoading || expLoading

  return (
    <div className="space-y-5">
      {/* Hero avec exports */}
      <Card className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-card dark:to-amber-950/20 border-amber-200 dark:border-amber-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-5 w-5 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100">
                  Synthèse fiscale {year}
                </Badge>
                {month !== 'all' && (
                  <Badge variant="outline" className="text-[10px]">
                    {new Date(year, parseInt(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} {year}
                  </Badge>
                )}
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatEUR(totalProfit)} <span className="text-base font-normal text-muted-foreground">bénéfice net</span></p>
              <p className="text-sm text-muted-foreground mt-1">
                CA {formatEUR(totalCA)} · Marge nette {totalCA > 0 ? ((totalProfit / totalCA) * 100).toFixed(1) : 0}%
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Période
                </Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute l'année {year}</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportCSV}><FileDown className="h-4 w-4 mr-2" /> CSV</Button>
              <Button variant="outline" onClick={exportExcel}><FileSpreadsheet className="h-4 w-4 mr-2" /> Excel</Button>
              <Button onClick={exportPDF}><FileText className="h-4 w-4 mr-2" /> PDF</Button>
              <Button variant="outline" className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => setShowResetModal(true)}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard label="Chiffre d'affaires" value={totalCA} hint="Inclut prix article + frais port client" />
          <SummaryCard label="Achats + Dépenses" value={achatsData?.total ?? (totalPurchases + totalOtherExpenses)} hint="Articles stock + hors stock + dépenses (visible dans le Registre des achats)" />
          <SummaryCard label="Frais plateforme" value={totalPlatformFees} />
          <SummaryCard label="dont Frais port client" value={totalShippingBilled} hint="Inclus dans le CA (revenu)" />
          <SummaryCard label="Frais port réels (transporteur)" value={totalCarrierShipping} hint="Charge déductible du CA" />
          <SummaryCard label="Frais bancaires (Stripe/PayPal)" value={totalPaymentFees} hint="Charge déductible du CA" />
          <SummaryCard label="Autres dépenses" value={totalOtherExpenses} hint="Dépenses saisies dans l'onglet Dépenses" />
          <SummaryCard label={`Cotisations URSSAF (${taxRate}%)`} value={parseFloat(urssafCotisation.toFixed(2))} />
          <SummaryCard label="Bénéfice net" value={totalProfit} highlight />
          <SummaryCard label="Marge nette" value={totalCA > 0 ? parseFloat(((totalProfit / totalCA) * 100).toFixed(1)) : 0} suffix="%" />
          <SummaryCard label="Nb ventes" value={yearSales.length} />
        </div>
      )}

      {/* Dépenses */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Dépenses ({yearExpenses.length})</CardTitle>
              <CardDescription>Abonnements, fournitures, carburant, etc.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {yearExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune dépense enregistrée pour {year}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Catégorie</th>
                    <th className="px-2 py-2 font-medium">Libellé</th>
                    <th className="px-2 py-2 font-medium text-right">Montant</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {yearExpenses.map(e => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-2.5 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                      <td className="px-2 py-2.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {EXPENSE_CATEGORIES.find(c => c.id === e.category)?.label || e.category}
                        </Badge>
                      </td>
                      <td className="px-2 py-2.5">{e.label} {e.isRecurring && <Badge variant="secondary" className="text-[9px] h-4 ml-1 bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">↻ {e.recurringFreq === 'weekly' ? 'hebdo' : e.recurringFreq === 'monthly' ? 'mensuel' : e.recurringFreq === 'yearly' ? 'annuel' : ''}</Badge>}</td>
                      <td className="px-2 py-2.5 text-right font-medium">{formatEUR(e.amount)}</td>
                      <td className="px-2 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => editExpense(e)} title="Éditer">
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-600" onClick={() => deleteExpense(e.id)} title="Supprimer">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => { setShowForm(false); setEditingExpense(null) }}>
          <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-base">{editingExpense ? 'Modifier la dépense' : 'Nouvelle dépense'}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Catégorie</Label>
                  <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Libellé</Label>
                <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Abonnement Vinted Pro" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Montant (€)</Label>
                <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="9.99" />
              </div>

              {/* Option récurrent */}
              {!editingExpense && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isRecurring}
                      onChange={e => setForm({ ...form, isRecurring: e.target.checked })}
                      className="h-4 w-4 rounded border-border"
                    />
                    <span className="text-sm font-medium">Dépense récurrente</span>
                  </label>
                  {form.isRecurring && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Répéter tous les</Label>
                      <Select value={form.recurringFreq || 'monthly'} onValueChange={v => setForm({ ...form, recurringFreq: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semaines</SelectItem>
                          <SelectItem value="monthly">Mois</SelectItem>
                          <SelectItem value="yearly">Années</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Les prochaines occurrences seront générées automatiquement pour l'année à venir.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setEditingExpense(null) }}>Annuler</Button>
                <Button className="flex-1" onClick={addExpense} disabled={saving}>
                  {saving ? 'Enregistrement...' : (editingExpense ? 'Modifier' : 'Ajouter')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modale de réinitialisation */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowResetModal(false)}>
          <Card className="max-w-md w-full border-rose-300 dark:border-rose-800" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-rose-700 dark:text-rose-300">
                <AlertTriangle className="h-5 w-5" />
                Réinitialiser les données fiscales
              </CardTitle>
              <CardDescription>
                Sélectionnez les données à supprimer. Cette action est irréversible.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                <strong>⚠️ Attention :</strong> les ventes supprimées remettront les articles en statut "Publié". Les factures associées seront perdues.
              </div>

              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start text-sm" disabled={resetting} onClick={() => resetData('sales')}>
                  <Trash2 className="h-4 w-4 mr-2 text-rose-600" />
                  Supprimer toutes les ventes ({yearSales.length})
                  <span className="text-[10px] text-muted-foreground ml-auto">articles → Publié</span>
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" disabled={resetting} onClick={() => resetData('expenses')}>
                  <Trash2 className="h-4 w-4 mr-2 text-rose-600" />
                  Supprimer toutes les dépenses ({yearExpenses.length})
                  <span className="text-[10px] text-muted-foreground ml-auto">y compris récurrentes</span>
                </Button>
                <Button variant="outline" className="w-full justify-start text-sm" disabled={resetting} onClick={() => resetData('purchases')}>
                  <Trash2 className="h-4 w-4 mr-2 text-rose-600" />
                  Supprimer les achats hors stock
                  <span className="text-[10px] text-muted-foreground ml-auto">fournitures, emballages…</span>
                </Button>
                <Button variant="destructive" className="w-full justify-start text-sm" disabled={resetting} onClick={() => resetData('all')}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Tout supprimer (ventes + dépenses + achats)
                  {resetting && <span className="ml-auto text-xs">Suppression…</span>}
                </Button>
              </div>

              <Button variant="outline" className="w-full" onClick={() => setShowResetModal(false)}>
                Annuler
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, highlight, suffix, hint }: { label: string; value: number; highlight?: boolean; suffix?: string; hint?: string }) {
  const isCount = label.toLowerCase().includes('nb') || label.toLowerCase().includes('ventes')
  return (
    <Card className={highlight ? 'border-emerald-200 dark:border-emerald-900' : ''}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={`text-xl font-bold mt-1 ${highlight ? 'text-emerald-600' : ''}`}>
          {isCount ? value : formatEUR(value)}{suffix}
        </p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 2 — LIVRE DES RECETTES (format légal)
// ═══════════════════════════════════════════════════════════════════════════

interface RecetteEntry {
  numero: number
  date: string
  dateEncaissement: string
  invoiceNumber: string  // OBLIGATOIRE légalement
  designation: string
  client: string
  origine: string
  modePaiement: string
  montantHT: number
  montantTTC: number
  tva: number
  sku: string
}

interface RecettesData {
  type: string
  year: number
  month: number | null
  periodLabel: string
  regime: string
  vatEnabled?: boolean
  vatExemptionText?: string
  vatRate?: number
  tvaRegime: string
  entries: RecetteEntry[]
  totalTTC: number
  totalHT: number
  monthlyTotals: { month: string; monthNum: number; total: number; count: number }[]
  count: number
}

function RecettesTab({ year }: { year: number }) {
  const [month, setMonth] = useState<string>('all')
  const { data, loading } = useFetch<RecettesData>(`/api/accounting?type=recettes&year=${year}${month !== 'all' ? `&month=${month}` : ''}`)

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const exportPDF = () => {
    const win = window.open('', '_blank')
    if (!win) {
      toast.error('Bloqueur de pop-up : autorisez les pop-ups')
      return
    }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8">
      <title>Livre des recettes ${year}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 30px; color: #1a1a1a; font-size: 11px; }
        h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
        h2 { font-size: 13px; margin: 20px 0 8px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a; }
        .header p { margin: 2px 0; font-size: 11px; color: #555; }
        .regime { background: #fef3c7; padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 10px; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 6px 5px; text-align: left; border: 1px solid #ccc; font-size: 10px; }
        th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 9px; }
        .total-row td { background: #ecfdf5; font-weight: 700; }
        .month-row td { background: #fafafa; font-weight: 600; border-top: 2px solid #999; }
        .right { text-align: right; }
        .center { text-align: center; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature div { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 10px; }
        @page { margin: 1cm; size: A4 landscape; }
      </style></head>
      <body>
        <div class="header">
          <h1>LIVRE DES RECETTES</h1>
          <p>Période : ${data.periodLabel}</p>
          <p>Régime : ${data.regime}</p>
          <div class="regime">${data.tvaRegime}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">N°</th>
              <th style="width: 70px;">Date</th>
              <th style="width: 90px;">N° facture</th>
              <th style="width: 70px;">Encaiss.</th>
              <th>Désignation</th>
              <th>Client</th>
              <th>Origine</th>
              <th>Mode paiement</th>
              <th class="right" style="width: 60px;">HT (€)</th>
              <th class="right" style="width: 60px;">TVA (€)</th>
              <th class="right" style="width: 70px;">TTC (€)</th>
            </tr>
          </thead>
          <tbody>
            ${data.entries.map(e => `
              <tr>
                <td class="center">${e.numero}</td>
                <td>${formatDate(e.date)}</td>
                <td><strong>${e.invoiceNumber}</strong></td>
                <td>${formatDate(e.dateEncaissement)}</td>
                <td>${e.designation}</td>
                <td>${e.client}</td>
                <td>${e.origine}</td>
                <td>${e.modePaiement}</td>
                <td class="right">${e.montantHT.toFixed(2)}</td>
                <td class="right">0,00</td>
                <td class="right"><strong>${e.montantTTC.toFixed(2)}</strong></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="8" class="right">TOTAL ${data.month ? 'MENSUEL' : 'ANNUEL'}</td>
              <td class="right">${data.totalHT.toFixed(2)}</td>
              <td class="right">0,00</td>
              <td class="right">${data.totalTTC.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Récapitulatif par mois</h2>
        <table>
          <thead>
            <tr><th>Mois</th><th class="right">Nombre de recettes</th><th class="right">Montant TTC (€)</th></tr>
          </thead>
          <tbody>
            ${data.monthlyTotals.map(m => `
              <tr class="month-row">
                <td>${m.month}</td>
                <td class="right">${m.count}</td>
                <td class="right">${m.total.toFixed(2)}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="right">${data.count}</td>
              <td class="right">${data.totalTTC.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          ${data.vatEnabled
            ? `<div style="margin-bottom: 8px;"><strong>Régime TVA :</strong> TVA applicable — taux ${data.vatRate || 20}%</div>`
            : `<div style="margin-bottom: 8px;"><strong>Mention légale :</strong> ${data.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base'}</div>`
          }
          Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')} · Reseller OS
        </div>

        <div class="signature">
          <div>Signature de l'exploitant</div>
          <div>Date</div>
        </div>

        <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `)
    win.document.close()
    toast.success('Livre des recettes PDF ouvert')
  }

  const exportCSV = () => {
    const rows: string[][] = [
      ['N°', 'Date', 'N° facture', 'Date encaissement', 'Désignation', 'Client', 'Origine', 'Mode paiement', 'Montant HT', 'TVA', 'Montant TTC'],
    ]
    data.entries.forEach(e => {
      rows.push([
        String(e.numero), formatDate(e.date), e.invoiceNumber, formatDate(e.dateEncaissement),
        e.designation, e.client, e.origine, e.modePaiement,
        e.montantHT.toFixed(2), '0.00', e.montantTTC.toFixed(2),
      ])
    })
    rows.push([])
    rows.push(['', '', '', '', '', '', '', 'TOTAL', data.totalHT.toFixed(2), '0.00', data.totalTTC.toFixed(2)])
    const csv = rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `livre-recettes-${year}${month !== 'all' ? `-m${month}` : ''}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('CSV téléchargé')
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-card dark:to-emerald-950/20 border-emerald-200 dark:border-emerald-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <BookOpen className="h-5 w-5 text-emerald-600" />
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                  {data.vatEnabled
                    ? `TVA applicable — ${data.vatRate || 20}%`
                    : (data.vatExemptionText || 'TVA non applicable, art. 293 B du CGI')
                  }
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {data.periodLabel}
                </Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatEUR(data.totalTTC)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.count} recettes · {data.regime} · {data.tvaRegime}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Période
                </Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[170px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute l'année {year}</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" onClick={exportCSV}><FileDown className="h-4 w-4 mr-2" /> CSV</Button>
              <Button onClick={exportPDF}><Printer className="h-4 w-4 mr-2" /> Imprimer PDF</Button>
              <Button variant="outline" className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => setShowResetModal(true)}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info légale */}
      <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
        <CardContent className="p-4 flex gap-3">
          <BookCheck className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">À propos du livre des recettes</p>
            <ul className="text-xs text-amber-700/80 dark:text-amber-300/80 space-y-1 list-disc pl-4">
              <li>Document <strong>obligatoire</strong> pour les micro-entreprises (art. 286 du CGI)</li>
              <li>Numérotation <strong>continue et sans rupture</strong> (1, 2, 3…)</li>
              <li>Tenu <strong>chronologiquement</strong>, au jour le jour</li>
              <li>Conservation <strong>10 ans</strong> (art. L102B du LPF)</li>
              <li>En cas de contrôle : amende de 5 000€ en cas d'absence ou de tenue incorrecte</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Récap par mois */}
      {data.monthlyTotals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Récapitulatif mensuel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {data.monthlyTotals.map(m => (
                <div key={m.monthNum} className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground capitalize">{m.month}</p>
                  <p className="text-lg font-bold mt-0.5">{formatEUR(m.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{m.count} recette{m.count > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau légal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des recettes ({data.count})</CardTitle>
          <CardDescription>Numérotation continue chronologique</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucune recette enregistrée pour {year}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-muted-foreground border-b bg-muted/30 uppercase">
                    <th className="px-2 py-2 font-medium">N°</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">N° facture</th>
                    <th className="px-2 py-2 font-medium">Désignation</th>
                    <th className="px-2 py-2 font-medium hidden md:table-cell">Client</th>
                    <th className="px-2 py-2 font-medium hidden lg:table-cell">Origine</th>
                    <th className="px-2 py-2 font-medium hidden lg:table-cell">Mode paiement</th>
                    <th className="px-2 py-2 font-medium text-right">HT</th>
                    <th className="px-2 py-2 font-medium text-right">TTC</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.numero} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{e.numero}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-2 py-2">
                        <code className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {e.invoiceNumber}
                        </code>
                      </td>
                      <td className="px-2 py-2 max-w-[200px] truncate">{e.designation}</td>
                      <td className="px-2 py-2 hidden md:table-cell text-muted-foreground">{e.client}</td>
                      <td className="px-2 py-2 hidden lg:table-cell text-muted-foreground">{e.origine}</td>
                      <td className="px-2 py-2 hidden lg:table-cell text-muted-foreground text-[10px]">{e.modePaiement}</td>
                      <td className="px-2 py-2 text-right">{formatEUR(e.montantHT)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{formatEUR(e.montantTTC)}</td>
                    </tr>
                  ))}
                  <tr className="bg-emerald-50 dark:bg-emerald-950/30 border-t-2 border-emerald-200 dark:border-emerald-900">
                    <td colSpan={7} className="px-2 py-2.5 text-right font-semibold text-xs uppercase">
                      Total {data.month ? 'mensuel' : 'annuel'}
                    </td>
                    <td className="px-2 py-2.5 text-right font-bold">{formatEUR(data.totalHT)}</td>
                    <td className="px-2 py-2.5 text-right font-bold text-emerald-600">{formatEUR(data.totalTTC)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 3 — REGISTRE DES ACHATS (format légal)
// ═══════════════════════════════════════════════════════════════════════════

interface AchatEntry {
  numero: number
  purchaseId?: string
  date: string
  invoiceNumber: string
  orderNumber?: string
  invoicePath?: string | null
  invoiceName?: string | null
  designation: string
  fournisseur: string
  siret: string | null
  typeFournisseur: string
  lotReference: string
  modePaiement: string
  montant: number
  montantHT: number
  sku: string
  prixVente: number | null
  vendu?: boolean
  isHorsStock?: boolean
  isPreOrderReceived?: boolean
  isExpense?: boolean
  quantite?: number
}

interface AchatsData {
  type: string
  year: number
  month: number | null
  periodLabel: string
  regime: string
  vatEnabled: boolean
  vatRate: number
  vatExemptionText?: string
  tvaRegime: string
  entries: AchatEntry[]
  total: number
  totalHT: number
  monthlyTotals: { month: string; monthNum: number; total: number; count: number }[]
  bySupplierType: { type: string; total: number; count: number }[]
  count: number
}

function AchatsTab({ year }: { year: number }) {
  const confirm = useConfirm()
  const [month, setMonth] = useState<string>('all')
  const { data, loading, refresh: refreshAchats } = useFetch<AchatsData>(`/api/accounting?type=achats&year=${year}${month !== 'all' ? `&month=${month}` : ''}`)

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  const exportPDF = () => {
    const win = window.open('', '_blank')
    if (!win) { toast.error('Bloqueur de pop-up'); return }
    win.document.write(`
      <!DOCTYPE html>
      <html lang="fr"><head><meta charset="utf-8">
      <title>Registre des achats ${data.periodLabel}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; margin: 30px; color: #1a1a1a; font-size: 11px; }
        h1 { font-size: 18px; margin: 0 0 4px; text-align: center; }
        h2 { font-size: 13px; margin: 20px 0 8px; }
        .header { text-align: center; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #1a1a1a; }
        .header p { margin: 2px 0; font-size: 11px; color: #555; }
        .regime { background: #fef3c7; padding: 6px 10px; border-radius: 4px; display: inline-block; font-size: 10px; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 6px 5px; text-align: left; border: 1px solid #ccc; font-size: 10px; }
        th { background: #f3f4f6; font-weight: 600; text-transform: uppercase; font-size: 9px; }
        .total-row td { background: #ecfdf5; font-weight: 700; }
        .right { text-align: right; }
        .center { text-align: center; }
        .footer { margin-top: 30px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 10px; color: #666; text-align: center; }
        .signature { margin-top: 40px; display: flex; justify-content: space-between; }
        .signature div { width: 45%; border-top: 1px solid #333; padding-top: 6px; font-size: 10px; }
        @page { margin: 1cm; size: A4 landscape; }
      </style></head>
      <body>
        <div class="header">
          <h1>REGISTRE DES ACHATS</h1>
          <p>Période : ${data.periodLabel}</p>
          <p>Régime : ${data.regime}</p>
          <div class="regime">${data.tvaRegime} · ${data.count} achats · Total : ${formatEUR(data.total)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px;">N°</th>
              <th style="width: 70px;">Date</th>
              <th style="width: 80px;">N° facture</th>
              <th style="width: 80px;">N° cmd four.</th>
              <th>Désignation</th>
              <th>Fournisseur</th>
              <th>Mode paiement</th>
              <th style="width: 60px;">Statut</th>
              ${data.vatEnabled ? '<th class="right" style="width: 60px;">HT (€)</th>' : ''}
              <th class="right" style="width: 60px;">TTC (€)</th>
            </tr>
          </thead>
          <tbody>
            ${data.entries.map(e => `
              <tr>
                <td class="center">${e.numero}</td>
                <td>${formatDate(e.date)}</td>
                <td><strong>${e.invoiceNumber}</strong></td>
                <td>${e.orderNumber || '—'}</td>
                <td>${e.designation}</td>
                <td>${e.fournisseur}${e.siret ? `<br><span style="font-size:9px; color:#888;">SIRET : ${e.siret}</span>` : ''}</td>
                <td>${e.modePaiement}</td>
                <td>${e.isExpense ? 'Dépense' : e.isPreOrderReceived ? 'En stock' : e.isHorsStock ? 'HS' : e.vendu ? 'Vendu' : 'En stock'}</td>
                ${data.vatEnabled ? `<td class="right">${e.montantHT.toFixed(2)}</td>` : ''}
                <td class="right"><strong>${e.montant.toFixed(2)}</strong></td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="${data.vatEnabled ? 8 : 7}" class="right">TOTAL ${data.month ? 'MENSUEL' : 'ANNUEL'}</td>
              ${data.vatEnabled ? `<td class="right">${data.totalHT.toFixed(2)}</td>` : ''}
              <td class="right">${data.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <h2>Répartition par type de fournisseur</h2>
        <table>
          <thead><tr><th>Type</th><th class="right">Articles</th><th class="right">Total (€)</th><th class="right">% du total</th></tr></thead>
          <tbody>
            ${data.bySupplierType.map(s => `
              <tr>
                <td>${s.type}</td>
                <td class="right">${s.count}</td>
                <td class="right">${s.total.toFixed(2)}</td>
                <td class="right">${data.total > 0 ? ((s.total / data.total) * 100).toFixed(1) : 0}%</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="right">${data.count}</td>
              <td class="right">${data.total.toFixed(2)}</td>
              <td class="right">100%</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          ${data.vatEnabled
            ? `<div style="margin-bottom: 8px;"><strong>Régime TVA :</strong> TVA applicable — taux ${data.vatRate || 20}%</div>`
            : `<div style="margin-bottom: 8px;"><strong>Mention légale :</strong> ${data.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base'}</div>`
          }
          Document généré le ${new Date().toLocaleDateString('fr-FR')} · Reseller OS
        </div>
        <div class="signature"><div>Signature de l'exploitant</div><div>Date</div></div>
        <script>window.onload = () => { window.print(); }</script>
      </body></html>
    `)
    win.document.close()
    toast.success('Registre des achats PDF ouvert')
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="bg-gradient-to-br from-sky-50 via-white to-sky-50/30 dark:from-sky-950/30 dark:via-card dark:to-sky-950/20 border-sky-200 dark:border-sky-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ClipboardList className="h-5 w-5 text-sky-600" />
                <Badge className="bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300 hover:bg-sky-100">
                  {data.vatEnabled
                    ? `TVA applicable — ${data.vatRate || 20}%`
                    : (data.vatExemptionText || 'TVA non applicable, art. 293 B du CGI')
                  }
                </Badge>
                <Badge variant="outline" className="text-[10px]">{data.periodLabel}</Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatEUR(data.total)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data.count} achat(s) enregistré(s) · {data.tvaRegime}
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Période
                </Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toute l'année {year}</SelectItem>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })} {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={exportPDF}><Printer className="h-4 w-4 mr-2" /> Imprimer PDF</Button>
              <Button variant="outline" className="border-rose-300 dark:border-rose-800 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={async () => {
                const ok = await confirm({
                  title: 'Vider le registre des achats ?',
                  description: 'Supprime toutes les ventes (articles → Publié) ET tous les achats hors stock. Action irréversible.',
                  confirmLabel: 'Tout vider',
                  variant: 'destructive',
                })
                if (!ok) return
                try {
                  const res = await fetch('/api/accounting/reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ scope: 'all' }),
                  })
                  if (!res.ok) throw new Error('Erreur')
                  const data = await res.json()
                  toast.success(data.message || 'Registre vidé')
                } catch {
                  toast.error('Erreur lors de la réinitialisation')
                }
              }}>
                <AlertTriangle className="h-4 w-4 mr-2" /> Vider
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Répartition par type de fournisseur */}
      {data.bySupplierType.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par type de fournisseur</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {data.bySupplierType.map(s => (
                <div key={s.type} className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">{s.type}</p>
                  <p className="text-lg font-bold mt-0.5">{formatEUR(s.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{s.count} article{s.count > 1 ? 's' : ''} · {data.total > 0 ? ((s.total / data.total) * 100).toFixed(0) : 0}%</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Récap mensuel */}
      {data.monthlyTotals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Récapitulatif mensuel</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {data.monthlyTotals.map(m => (
                <div key={m.monthNum} className="p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground capitalize">{m.month}</p>
                  <p className="text-lg font-bold mt-0.5">{formatEUR(m.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{m.count} achat{m.count > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau légal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail des achats ({data.count})</CardTitle>
          <CardDescription>Tous les articles achetés sur la période — numérotation continue chronologique</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Aucun achat enregistré pour {data.periodLabel}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] text-muted-foreground border-b bg-muted/30 uppercase">
                    <th className="px-2 py-2 font-medium">N°</th>
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">N° facture</th>
                    <th className="px-2 py-2 font-medium hidden xl:table-cell">N° cmd four.</th>
                    <th className="px-2 py-2 font-medium">Désignation</th>
                    <th className="px-2 py-2 font-medium hidden md:table-cell">Fournisseur</th>
                    <th className="px-2 py-2 font-medium hidden lg:table-cell">Paiement</th>
                    <th className="px-2 py-2 font-medium">Statut</th>
                    {data.vatEnabled && <th className="px-2 py-2 font-medium text-right">HT</th>}
                    <th className="px-2 py-2 font-medium text-right">TTC</th>
                    <th className="px-2 py-2 font-medium">Facture</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map(e => (
                    <tr key={e.numero} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-2 font-mono text-[10px] text-muted-foreground">{e.numero}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="px-2 py-2">
                        <code className="text-[10px] bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {e.invoiceNumber}
                        </code>
                      </td>
                      <td className="px-2 py-2 hidden xl:table-cell">
                        <code className="text-[10px] bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                          {e.orderNumber || '—'}
                        </code>
                      </td>
                      <td className="px-2 py-2 max-w-[200px] truncate">
                        {e.designation}
                        {e.isHorsStock && (
                          <span className="ml-1 text-[9px] bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-1 py-0.5 rounded font-medium">HS</span>
                        )}
                      </td>
                      <td className="px-2 py-2 hidden md:table-cell">
                        <div className="text-muted-foreground">{e.fournisseur}</div>
                        {e.siret && <div className="text-[9px] text-muted-foreground/70 font-mono">SIRET : {e.siret}</div>}
                      </td>
                      <td className="px-2 py-2 hidden lg:table-cell text-muted-foreground text-[10px]">{e.modePaiement}</td>
                      <td className="px-2 py-2">
                        {e.isExpense ? (
                          <span className="text-[9px] bg-sky-100 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded font-medium">Dépense</span>
                        ) : e.isPreOrderReceived ? (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">En stock</span>
                        ) : e.isHorsStock ? (
                          <span className="text-[9px] bg-violet-100 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded font-medium">HS</span>
                        ) : e.vendu ? (
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-medium">Vendu</span>
                        ) : (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded font-medium">En stock</span>
                        )}
                      </td>
                      {data.vatEnabled && <td className="px-2 py-2 text-right">{formatEUR(e.montantHT)}</td>}
                      <td className="px-2 py-2 text-right font-semibold">{formatEUR(e.montant)}</td>
                      <td className="px-2 py-2">
                        <PurchaseInvoiceCell entry={e} onRefresh={refreshAchats} />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-sky-50 dark:bg-sky-950/30 border-t-2 border-sky-200 dark:border-sky-900">
                    <td colSpan={data.vatEnabled ? 9 : 8} className="px-2 py-2.5 text-right font-semibold text-xs uppercase">
                      Total {data.month ? 'mensuel' : 'annuel'}
                    </td>
                    {data.vatEnabled && <td className="px-2 py-2.5 text-right font-bold">{formatEUR(data.totalHT)}</td>}
                    <td className="px-2 py-2.5 text-right font-bold text-sky-600">{formatEUR(data.total)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ONGLET 4 — DÉCLARATION URSSAF
// ═══════════════════════════════════════════════════════════════════════════

interface UrssafData {
  activityType: string
  activityTypeLabel: string
  taxRate: number
  selectedMonth: number | null
  selectedYear: number
  month: { label: string; ca: number; cotisation: number; salesCount: number }
  trimester: { label: string; ca: number; cotisation: number; salesCount: number }
  year: { label: string; ca: number; cotisation: number; salesCount: number }
  monthlyBreakdown: { month: string; monthNum: number; ca: number; cotisation: number; salesCount: number }[]
  quarterlyBreakdown: { label: string; ca: number; cotisation: number; salesCount: number }[]
}

function UrssafTab({ year }: { year: number }) {
  const [month, setMonth] = useState<string>(String(new Date().getMonth() + 1))
  const { data, loading } = useFetch<UrssafData>(`/api/urssaf?year=${year}&month=${month}`)

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-br from-amber-50 via-white to-amber-50/30 dark:from-amber-950/30 dark:via-card dark:to-amber-950/20 border-amber-200 dark:border-amber-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Percent className="h-5 w-5 text-amber-600" />
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 hover:bg-amber-100">
                  {data.activityTypeLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{data.taxRate}% du CA</Badge>
              </div>
              <p className="text-3xl font-bold tracking-tight">{formatEUR(data.month.cotisation)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Cotisation {data.month.label} · CA {formatEUR(data.month.ca)} · {data.month.salesCount} ventes
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] text-muted-foreground uppercase">Mois</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(year, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className={cn('border-2', data.month.salesCount > 0 ? 'border-amber-300 dark:border-amber-800' : '')}>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">{data.month.label}</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">{formatEUR(data.month.cotisation)}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div className="flex justify-between"><span>CA</span><span className="font-medium">{formatEUR(data.month.ca)}</span></div>
              <div className="flex justify-between"><span>Ventes</span><span className="font-medium">{data.month.salesCount}</span></div>
              <div className="flex justify-between"><span>Taux</span><span className="font-medium">{data.taxRate}%</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-2', data.trimester.salesCount > 0 ? 'border-sky-300 dark:border-sky-800' : '')}>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">{data.trimester.label}</p>
            <p className="text-2xl font-bold mt-1 text-sky-600">{formatEUR(data.trimester.cotisation)}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div className="flex justify-between"><span>CA</span><span className="font-medium">{formatEUR(data.trimester.ca)}</span></div>
              <div className="flex justify-between"><span>Ventes</span><span className="font-medium">{data.trimester.salesCount}</span></div>
              <div className="flex justify-between"><span>Taux</span><span className="font-medium">{data.taxRate}%</span></div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn('border-2', data.year.salesCount > 0 ? 'border-emerald-300 dark:border-emerald-800' : '')}>
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">{data.year.label}</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{formatEUR(data.year.cotisation)}</p>
            <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
              <div className="flex justify-between"><span>CA</span><span className="font-medium">{formatEUR(data.year.ca)}</span></div>
              <div className="flex justify-between"><span>Ventes</span><span className="font-medium">{data.year.salesCount}</span></div>
              <div className="flex justify-between"><span>Taux</span><span className="font-medium">{data.taxRate}%</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {data.quarterlyBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Détail par trimestre</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="px-3 py-2.5 font-medium">Trimestre</th>
                    <th className="px-3 py-2.5 font-medium text-right">Ventes</th>
                    <th className="px-3 py-2.5 font-medium text-right">CA (€)</th>
                    <th className="px-3 py-2.5 font-medium text-right">Cotisation ({data.taxRate}%)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.quarterlyBreakdown.map(q => (
                    <tr key={q.label} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2.5 font-medium">{q.label}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{q.salesCount}</td>
                      <td className="px-3 py-2.5 text-right">{formatEUR(q.ca)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-600">{formatEUR(q.cotisation)}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 dark:bg-amber-950/30 border-t-2 border-amber-200 dark:border-amber-900">
                    <td className="px-3 py-2.5 font-semibold text-xs uppercase">Total année</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{data.year.salesCount}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{formatEUR(data.year.ca)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-600">{formatEUR(data.year.cotisation)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data.monthlyBreakdown.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Détail par mois</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                    <th className="px-3 py-2.5 font-medium">Mois</th>
                    <th className="px-3 py-2.5 font-medium text-right">Ventes</th>
                    <th className="px-3 py-2.5 font-medium text-right">CA (€)</th>
                    <th className="px-3 py-2.5 font-medium text-right">Cotisation (€)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.map(m => (
                    <tr key={m.monthNum} className={cn('border-b last:border-0 hover:bg-muted/30', parseInt(month) === m.monthNum && 'bg-amber-50/50 dark:bg-amber-950/20')}>
                      <td className="px-3 py-2.5 font-medium capitalize">{m.month}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{m.salesCount}</td>
                      <td className="px-3 py-2.5 text-right">{formatEUR(m.ca)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-amber-600">{formatEUR(m.cotisation)}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50 dark:bg-amber-950/30 border-t-2 border-amber-200 dark:border-amber-900">
                    <td className="px-3 py-2.5 font-semibold text-xs uppercase">Total</td>
                    <td className="px-3 py-2.5 text-right font-semibold">{data.year.salesCount}</td>
                    <td className="px-3 py-2.5 text-right font-bold">{formatEUR(data.year.ca)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-amber-600">{formatEUR(data.year.cotisation)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <Percent className="h-3.5 w-3.5 inline mr-1" />
            Cotisations calculées sur le CA avec un taux de <strong>{data.taxRate}%</strong> ({data.activityTypeLabel}).
            Pour modifier le taux : <strong>Paramètres → Taux d'imposition</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Purchase invoice cell (for achats hors stock in the registre) ──────────
// Inline component that handles upload/view/print/delete of a supplier invoice
// for each purchase entry in the "Détail des achats" table.

function PurchaseInvoiceCell({ entry, onRefresh }: { entry: AchatEntry; onRefresh: () => void }) {
  const [uploading, setUploading] = useState(false)

  // Only purchases (hors stock) have a purchaseId — StockItems don't
  if (!entry.purchaseId) {
    return <span className="text-[10px] text-muted-foreground">—</span>
  }

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/purchases/${entry.purchaseId}/invoice-upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Erreur'); return }
      toast.success('Facture téléversée')
      onRefresh()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setUploading(false)
    }
  }

  const remove = async () => {
    try {
      const res = await fetch(`/api/purchases/${entry.purchaseId}/invoice-upload`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Erreur'); return }
      toast.success('Facture supprimée')
      onRefresh()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  if (entry.invoicePath) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          onClick={() => window.open(entry.invoicePath!, '_blank')}
          title="Voir la facture"
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => window.open(entry.invoicePath!, '_blank')}
          title="Imprimer"
        >
          <Printer className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
          onClick={remove}
          title="Supprimer la facture"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <label className="inline-flex items-center gap-1 cursor-pointer text-[10px] text-muted-foreground hover:text-[#007bff]">
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0]
          if (file) upload(file)
          e.target.value = ''
        }}
      />
      {uploading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Upload className="h-3.5 w-3.5" />
      )}
      <span>{uploading ? '…' : 'Joindre'}</span>
    </label>
  )
}
