'use client'

import { useSession } from 'next-auth/react'
import { useFetch } from '@/hooks/use-fetch'
import { LoadingState } from '@/components/shared/states'
import { StatCard } from '@/components/shared/stat-card'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp, TrendingDown, Package, Euro, Percent, Target, Boxes, ArrowRight,
  ShoppingCart, MapPin, Crown, Clock,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts'
import { formatEUR, getPlatformLabel, getPlatformColor, PUBLICATION_STATUSES, PLATFORMS } from '@/lib/constants'
import { useAppStore, type ModuleKey } from '@/lib/store'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardData {
  ca: number
  purchases: number
  platformFees: number
  expenses: number
  profit: number
  margin: number
  avgRoi: number
  salesCount: number
  totalStockItems: number
  stockValue: number
  statusCounts: Record<string, number>
  caByPlatform: Record<string, number>
  topBrands: { brand: string; profit: number; count: number }[]
  monthlyEvolution: { month: string; ca: number; profit: number }[]
  supplierStats: {
    id: string; name: string; type: string; itemsCount: number; itemsSold: number;
    totalSpent: number; totalRevenue: number; totalProfit: number; roi: number;
  }[]
}

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#78716c', '#8b5cf6']

export function DashboardModule({ onNavigate }: { onNavigate: (m: ModuleKey) => void }) {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'admin'
  const { data, loading } = useFetch<DashboardData>('/api/dashboard')

  if (loading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    )
  }

  const platformData = Object.entries(data.caByPlatform).map(([platform, value]) => ({
    name: getPlatformLabel(platform),
    value: parseFloat(value.toFixed(2)),
    raw: platform,
  }))

  const statusData = PUBLICATION_STATUSES.map(s => ({
    name: s.label,
    value: data.statusCounts[s.id] || 0,
    color: s.color,
    id: s.id,
  })).filter(s => s.value > 0)

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card className="border-emerald-200 dark:border-emerald-900 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-card dark:to-emerald-950/20">
        <CardContent className="p-6 lg:p-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 hover:bg-emerald-100">
                  Performance du mois
                </Badge>
              </div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">
                {formatEUR(data.profit)} <span className="text-base font-normal text-muted-foreground">de bénéfice</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                CA {formatEUR(data.ca)} · Marge {data.margin}% · {data.salesCount} ventes · ROI moyen {data.avgRoi}%
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => onNavigate('stock')} variant="outline" size="sm">
                <Boxes className="h-4 w-4 mr-2" /> Voir le stock
              </Button>
              {isAdmin && (
                <Button onClick={() => onNavigate('profitability')} size="sm">
                  <TrendingUp className="h-4 w-4 mr-2" /> Rentabilité
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          label="CA du mois"
          value={formatEUR(data.ca)}
          icon={Euro}
          accent="emerald"
          trend={`${data.salesCount} ventes`}
          trendUp
        />
        <StatCard
          label="Bénéfice net"
          value={formatEUR(data.profit)}
          icon={TrendingUp}
          accent="violet"
          trend={`Marge ${data.margin}%`}
          trendUp
        />
        <StatCard
          label="ROI moyen"
          value={`${data.avgRoi}%`}
          icon={Target}
          accent="sky"
          trend="vs achats"
          trendUp
        />
        <StatCard
          label="Valeur stock"
          value={formatEUR(data.stockValue)}
          icon={Package}
          accent="amber"
          trend={`${data.totalStockItems} articles`}
          trendUp={false}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Évolution CA */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Évolution CA & Bénéfice</CardTitle>
            <CardDescription>6 derniers mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data.monthlyEvolution}>
                <defs>
                  <linearGradient id="caGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                <YAxis className="text-xs" tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}€`} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', fontSize: 12 }}
                  formatter={(v: number) => formatEUR(v)}
                />
                <Area type="monotone" dataKey="ca" name="CA" stroke="#10b981" fill="url(#caGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="profit" name="Bénéfice" stroke="#8b5cf6" fill="url(#profitGrad)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </AreaChart>
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
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {platformData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {platformData.map((p, i) => (
                <div key={p.raw} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="font-medium">{p.name}</span>
                  </div>
                  <span className="text-muted-foreground">{formatEUR(p.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline + Top brands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline publication */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" /> Pipeline publication
            </CardTitle>
            <CardDescription>Répartition des articles par statut</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusData.map(s => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${s.color.split(' ')[0]}`} />
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <Badge variant="secondary" className="font-mono">{s.value}</Badge>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => onNavigate('publication')}>
              Gérer les publications <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Top marques */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" /> Top marques (profit)
            </CardTitle>
            <CardDescription>Toutes périodes confondues</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topBrands.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Pas encore de ventes</p>
            ) : (
              <div className="space-y-2.5">
                {data.topBrands.slice(0, 5).map((b, i) => (
                  <div key={b.brand} className="flex items-center gap-3">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-700' :
                      i === 1 ? 'bg-stone-200 text-stone-700' :
                      i === 2 ? 'bg-orange-100 text-orange-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{b.brand}</p>
                      <p className="text-xs text-muted-foreground">{b.count} ventes</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-emerald-600">{formatEUR(b.profit)}</p>
                    </div>
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => onNavigate('bi')}>
                  Plus d'analyses <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top fournisseurs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" /> Top fournisseurs
              </CardTitle>
              <CardDescription>Performance sourcing</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('sourcing')}>
              Voir tout <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="px-2 py-2 font-medium">Fournisseur</th>
                  <th className="px-2 py-2 font-medium text-right">Articles</th>
                  <th className="px-2 py-2 font-medium text-right">Investi</th>
                  <th className="px-2 py-2 font-medium text-right">CA généré</th>
                  <th className="px-2 py-2 font-medium text-right">Profit</th>
                  <th className="px-2 py-2 font-medium text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {data.supplierStats.slice(0, 5).map(s => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-2.5 font-medium">{s.name}</td>
                    <td className="px-2 py-2.5 text-right text-muted-foreground">{s.itemsCount}</td>
                    <td className="px-2 py-2.5 text-right">{formatEUR(s.totalSpent)}</td>
                    <td className="px-2 py-2.5 text-right">{formatEUR(s.totalRevenue)}</td>
                    <td className="px-2 py-2.5 text-right font-medium text-emerald-600">{formatEUR(s.totalProfit)}</td>
                    <td className="px-2 py-2.5 text-right">
                      <Badge variant={s.roi > 100 ? 'default' : 'secondary'} className={s.roi > 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : ''}>
                        {s.roi}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { key: 'stock' as ModuleKey, label: 'Ajouter un article', icon: Boxes, accent: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { key: 'sales' as ModuleKey, label: 'Enregistrer une vente', icon: ShoppingCart, accent: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
          { key: 'parcels' as ModuleKey, label: 'Préparer un colis', icon: Package, accent: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
          { key: 'bi' as ModuleKey, label: 'Analyser mes ventes', icon: Clock, accent: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
        ].map(action => (
          <button
            key={action.key}
            onClick={() => onNavigate(action.key)}
            className="text-left p-4 rounded-xl border bg-card hover:shadow-md hover:border-foreground/20 transition-all"
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${action.accent} mb-2.5`}>
              <action.icon className="h-4 w-4" />
            </div>
            <p className="text-sm font-medium leading-tight">{action.label}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
