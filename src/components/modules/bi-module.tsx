'use client'

import { useFetch } from '@/hooks/use-fetch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
} from 'recharts'
import { Crown, Clock, Layers, Layers3, Target, Zap } from 'lucide-react'
import { formatEUR } from '@/lib/constants'

interface BiData {
  topBrandsByProfit: { brand: string; profit: number; sales: number; count: number; avgProfit: number; roi: number }[]
  topCategories: { category: string; profit: number; sales: number; count: number; margin: number }[]
  sellTimeByBrand: { brand: string; avgDays: number; count: number }[]
  caByPlatform: { platform: string; sales: number; profit: number; fees: number; count: number; margin: number }[]
  stockBrandSummary: { brand: string; total: number; sold: number; available: number; value: number }[]
}

const PIE_COLORS = ['#10b981', '#06b6d4', '#f59e0b', '#8b5cf6', '#ef4444', '#78716c', '#ec4899', '#14b8a6']

export function BiModule() {
  const { data, loading } = useFetch<BiData>('/api/bi')

  if (loading || !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top marques rentables */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" /> Marques les plus rentables
          </CardTitle>
          <CardDescription>Classées par bénéfice total généré</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2.5">
            {data.topBrandsByProfit.slice(0, 8).map((b, i) => (
              <div key={b.brand} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' :
                  i === 1 ? 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300' :
                  i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">{b.brand}</p>
                    <p className="font-bold text-emerald-600">{formatEUR(b.profit)}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                    <span>{b.count} ventes</span>
                    <span>CA {formatEUR(b.sales)}</span>
                    <span>Bénéf. moyen {formatEUR(b.avgProfit)}</span>
                    <Badge variant={b.roi > 100 ? 'default' : 'secondary'} className={b.roi > 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 h-5 text-[10px]' : 'h-5 text-[10px]'}>
                      ROI {b.roi}%
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Temps moyen de vente */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-sky-500" /> Temps moyen de vente par marque
          </CardTitle>
          <CardDescription>Jours écoulés entre l'achat et la vente</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.sellTimeByBrand} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 12 }} unit=" j" />
              <YAxis type="category" dataKey="brand" tick={{ fontSize: 12 }} width={90} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(v: number) => `${v} jours`}
              />
              <Bar dataKey="avgDays" name="Jours" fill="#06b6d4" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 p-3 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900">
            <p className="text-xs text-sky-700 dark:text-sky-300">
              <Zap className="h-3.5 w-3.5 inline mr-1" />
              Les marques qui se vendent rapidement libèrent votre trésorerie plus vite — privilégiez-les au sourcing.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Performance par catégorie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-violet-500" /> Performance par catégorie
            </CardTitle>
            <CardDescription>Rentabilité par type de produit</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.topCategories}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `${v}€`} />
                <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="sales" name="CA" fill="#06b6d4" radius={[6, 6, 0, 0]} />
                <Bar dataKey="profit" name="Bénéfice" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* CA par plateforme */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-emerald-500" /> CA par plateforme
            </CardTitle>
            <CardDescription>Comparaison des revenus</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.caByPlatform}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={95}
                  paddingAngle={3}
                  dataKey="sales"
                  nameKey="platform"
                >
                  {data.caByPlatform.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatEUR(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tableau récap par plateforme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-rose-500" /> Détail par plateforme
          </CardTitle>
          <CardDescription>Marge et frais par canal de vente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b bg-muted/30">
                  <th className="px-3 py-2.5 font-medium">Plateforme</th>
                  <th className="px-3 py-2.5 font-medium text-right">Ventes</th>
                  <th className="px-3 py-2.5 font-medium text-right">CA</th>
                  <th className="px-3 py-2.5 font-medium text-right">Frais</th>
                  <th className="px-3 py-2.5 font-medium text-right">Profit</th>
                  <th className="px-3 py-2.5 font-medium text-right">Marge</th>
                </tr>
              </thead>
              <tbody>
                {data.caByPlatform.map(p => (
                  <tr key={p.platform} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-medium capitalize">{p.platform}</td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">{p.count}</td>
                    <td className="px-3 py-2.5 text-right">{formatEUR(p.sales)}</td>
                    <td className="px-3 py-2.5 text-right text-rose-600">{formatEUR(p.fees)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{formatEUR(p.profit)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <Badge variant="outline" className="font-mono">{p.margin}%</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* État du stock par marque */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-500" /> État du stock par marque
          </CardTitle>
          <CardDescription>Vendus vs disponibles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.stockBrandSummary.map(b => {
              const soldPct = b.total > 0 ? (b.sold / b.total) * 100 : 0
              return (
                <div key={b.brand} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{b.brand}</span>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{b.available} dispo</span>
                      <span>{b.sold} vendus</span>
                      <span className="font-semibold text-foreground">{formatEUR(b.value)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full"
                      style={{ width: `${soldPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
