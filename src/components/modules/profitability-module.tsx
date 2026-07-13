'use client'

import { useState } from 'react'
import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { TrendingUp, Euro, Percent, Target, PiggyBank, Receipt, ShoppingCart, Calendar } from 'lucide-react'
import { formatEUR } from '@/lib/constants'
import { StatCard } from '@/components/shared/stat-card'

interface ProfitData {
  ca: number
  purchases: number
  platformFees: number
  expenses: number
  profit: number
  margin: number
  avgRoi: number
  salesCount: number
  monthlyEvolution: { month: string; ca: number; profit: number }[]
  caByPlatform: Record<string, number>
  topBrands: { brand: string; profit: number; count: number; sales: number }[]
  supplierStats: {
    id: string; name: string; totalSpent: number; totalProfit: number; roi: number;
  }[]
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#78716c', '#8b5cf6', '#06b6d4']

export function ProfitabilityModule() {
  const now = new Date()
  const [year, setYear] = useState<string>(String(now.getFullYear()))
  const [month, setMonth] = useState<string>(String(now.getMonth() + 1))

  const { data, loading } = useFetch<ProfitData>(
    `/api/dashboard?year=${year}&month=${month}`
  )

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32" />
        <Skeleton className="h-80" />
        <Skeleton className="h-64" />
      </div>
    )
  }

  const platformData = Object.entries(data.caByPlatform).map(([p, v]) => ({
    name: p === 'vinted' ? 'Vinted' : p === 'leboncoin' ? 'Leboncoin' : p === 'ebay' ? 'eBay' : 'Vestiaire',
    value: parseFloat(v.toFixed(2)),
  }))

  const costBreakdown = [
    { name: 'Achats', value: data.purchases, color: '#f59e0b' },
    { name: 'Frais plateforme', value: data.platformFees, color: '#ef4444' },
    { name: 'Autres dépenses', value: data.expenses, color: '#8b5cf6' },
    { name: 'Bénéfice', value: data.profit, color: '#10b981' },
  ].filter(c => c.value > 0)

  const selectedMonthLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      {/* Hero avec sélecteur de période */}
      <Card className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-card dark:to-emerald-950/20 border-emerald-200 dark:border-emerald-900">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <PiggyBank className="h-5 w-5 text-emerald-600" />
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                  Rentabilité — {selectedMonthLabel}
                </Badge>
              </div>
              <p className="text-4xl font-bold tracking-tight">{formatEUR(data.profit)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                CA {formatEUR(data.ca)} · Achats {formatEUR(data.purchases)} · Marge nette {data.margin}%
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Année
                </Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-[110px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] text-muted-foreground uppercase font-semibold flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Mois
                </Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                      <SelectItem key={m} value={String(m)}>
                        {new Date(parseInt(year), m - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label={`CA ${selectedMonthLabel}`} value={formatEUR(data.ca)} icon={Euro} accent="emerald" trend={`${data.salesCount} ventes`} trendUp />
        <StatCard label="Achats" value={formatEUR(data.purchases)} icon={ShoppingCart} accent="amber" />
        <StatCard label="Bénéfice net" value={formatEUR(data.profit)} icon={TrendingUp} accent="violet" trend={`Marge ${data.margin}%`} trendUp />
        <StatCard label="ROI moyen" value={`${data.avgRoi}%`} icon={Target} accent="sky" />
      </div>

      {/* CA & Profit evolution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Évolution CA & Bénéfice</CardTitle>
          <CardDescription>6 derniers mois — vue détaillée</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={data.monthlyEvolution}>
              <defs>
                <linearGradient id="caG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pfG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => formatEUR(v)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="ca" name="CA" stroke="#10b981" fill="url(#caG)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="profit" name="Bénéfice" stroke="#8b5cf6" fill="url(#pfG)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Cost breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Décomposition des coûts</CardTitle>
            <CardDescription>Mois courant</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={costBreakdown}
                  cx="50%" cy="50%"
                  outerRadius={90}
                  dataKey="value"
                  label={(e: { name: string; percent?: number }) => `${e.name} ${((e.percent || 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                  style={{ fontSize: 11 }}
                >
                  {costBreakdown.map((c, i) => (
                    <Cell key={i} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CA par plateforme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">CA par plateforme</CardTitle>
            <CardDescription>Ce mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={platformData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={100} />
                <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="value" fill="#10b981" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top marques rentables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top marques par bénéfice</CardTitle>
          <CardDescription>Vue rentabilité</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.topBrands.slice(0, 8)}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
              <XAxis dataKey="brand" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
              <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="profit" name="Bénéfice" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="sales" name="CA" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ROI fournisseurs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" /> ROI par fournisseur
          </CardTitle>
          <CardDescription>Quels fournisseurs vous rendent le plus ?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {data.supplierStats
              .filter(s => s.totalSpent > 0)
              .sort((a, b) => b.roi - a.roi)
              .map(s => (
                <div key={s.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">Investi {formatEUR(s.totalSpent)}</span>
                      <span className="text-xs text-emerald-600">+{formatEUR(s.totalProfit)}</span>
                      <Badge variant={s.roi > 100 ? 'default' : 'secondary'} className={s.roi > 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ''}>
                        {s.roi}%
                      </Badge>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                      style={{ width: `${Math.min(s.roi, 500) / 5}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
