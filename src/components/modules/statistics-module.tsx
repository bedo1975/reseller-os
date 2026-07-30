'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts'
import {
  Globe, Users, Eye, ShoppingCart, Star, TrendingUp, MapPin, Monitor, MousePointerClick,
  FileText, Package, Award, ExternalLink,
} from 'lucide-react'
import { formatEUR } from '@/lib/constants'

const PERIODS = [
  { value: '7d', label: '7 derniers jours' },
  { value: '30d', label: '30 derniers jours' },
  { value: '90d', label: '90 derniers jours' },
  { value: '12m', label: '12 derniers mois' },
  { value: 'all', label: 'Tout' },
]

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google', facebook: 'Facebook', instagram: 'Instagram', twitter: 'Twitter/X',
  direct: 'Direct', other: 'Autre', bing: 'Bing', yahoo: 'Yahoo',
  leboncoin: 'Leboncoin', vinted: 'Vinted',
}

const DEVICE_LABELS: Record<string, string> = {
  mobile: 'Mobile', desktop: 'Ordinateur', tablet: 'Tablette', unknown: 'Inconnu',
}

const PIE_COLORS = ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8', '#6c757d', '#fd7e14', '#e83e8c']

interface StatsData {
  period: string
  summary: {
    totalVisitors: number
    newVisitors: number
    totalPageViews: number
    avgPageViewsPerVisitor: number
    totalSales: number
    totalRevenue: number
    totalProfit: number
    totalReviews: number
    avgRating: number
  }
  visitorsByCountry: [string, number][]
  visitorsByCity: [string, number][]
  visitorsBySource: [string, number][]
  visitorsByDevice: [string, number][]
  visitorsByBrowser: [string, number][]
  visitorsByOS: [string, number][]
  topPages: { path: string; count: number }[]
  topProducts: { sku: string; views: number; brand: string; title: string; photo: string }[]
  dailyChart: { date: string; visitors: number; sales: number; revenue: number }[]
  recentVisitors: {
    id: string; ipAddress: string; country: string; city: string; region: string | null;
    device: string; browser: string; os: string; referrerSource: string; referrerDomain: string | null;
    language: string | null; isFirstVisit: boolean; createdAt: string;
  }[]
  reviews: {
    total: number
    avgRating: number
    byRating: [string, number][]
    byProduct: { sku: string; count: number; avgRating: number; brand: string; title: string }[]
    recent: { id: string; productSku: string; authorName: string; rating: number; title: string; comment: string; createdAt: string }[]
  }
}

function StatCard({ icon: Icon, label, value, hint, color = 'text-blue-600' }: {
  icon: React.ElementType; label: string; value: string | number; hint?: string; color?: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export function StatisticsModule() {
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/stats?period=${period}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  const s = data.summary

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart className="h-6 w-6" />
            Statistiques
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Visiteurs, pages vues, provenances, avis et ventes
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Visiteurs" value={s.totalVisitors} hint={`${s.newVisitors} nouveaux`} color="text-blue-600" />
        <StatCard icon={Eye} label="Pages vues" value={s.totalPageViews} hint={`${s.avgPageViewsPerVisitor} par visiteur`} color="text-purple-600" />
        <StatCard icon={ShoppingCart} label="Ventes" value={s.totalSales} hint={formatEUR(s.totalRevenue)} color="text-emerald-600" />
        <StatCard icon={TrendingUp} label="Bénéfice" value={formatEUR(s.totalProfit)} color="text-green-600" />
        <StatCard icon={Star} label="Note moyenne" value={`${s.avgRating}/5`} hint={`${s.totalReviews} avis`} color="text-amber-500" />
        <StatCard icon={Globe} label="Pays" value={data.visitorsByCountry.length} color="text-cyan-600" />
        <StatCard icon={MapPin} label="Villes" value={data.visitorsByCity.length} color="text-pink-600" />
        <StatCard icon={MousePointerClick} label="Sources" value={data.visitorsBySource.length} hint="provenances différentes" color="text-orange-600" />
      </div>

      {/* Daily chart */}
      {data.dailyChart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Évolution quotidienne</CardTitle>
            <CardDescription>Visiteurs et ventes par jour</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.dailyChart}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visitors" name="Visiteurs" stroke="#007bff" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sales" name="Ventes" stroke="#28a745" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Two columns: Sources + Devices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="h-4 w-4" /> Provenance des visiteurs</CardTitle>
          </CardHeader>
          <CardContent>
            {data.visitorsBySource.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.visitorsBySource.map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={(e: any) => e.name}>
                      {data.visitorsBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1 mt-2">
                  {data.visitorsBySource.map(([source, count]) => (
                    <div key={source} className="flex justify-between text-xs">
                      <span>{SOURCE_LABELS[source] || source}</span>
                      <strong>{count}</strong>
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
          </CardContent>
        </Card>

        {/* Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Monitor className="h-4 w-4" /> Appareils</CardTitle>
          </CardHeader>
          <CardContent>
            {data.visitorsByDevice.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.visitorsByDevice.map(([k, v]) => ({ name: DEVICE_LABELS[k] || k, value: v }))}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#007bff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {data.visitorsByBrowser.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Navigateurs</p>
                      {data.visitorsByBrowser.slice(0, 4).map(([b, c]) => (
                        <p key={b} className="text-xs flex justify-between"><span className="capitalize">{b}</span><strong>{c}</strong></p>
                      ))}
                    </div>
                  )}
                  {data.visitorsByOS.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">OS</p>
                      {data.visitorsByOS.slice(0, 4).map(([o, c]) => (
                        <p key={o} className="text-xs flex justify-between"><span className="capitalize">{o}</span><strong>{c}</strong></p>
                      ))}
                    </div>
                  )}
                  {data.visitorsByCountry.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Top pays</p>
                      {data.visitorsByCountry.slice(0, 4).map(([c, n]) => (
                        <p key={c} className="text-xs flex justify-between"><span>{c}</span><strong>{n}</strong></p>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
          </CardContent>
        </Card>
      </div>

      {/* Geolocation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Top villes</CardTitle>
          </CardHeader>
          <CardContent>
            {data.visitorsByCity.length > 0 ? (
              <div className="space-y-1">
                {data.visitorsByCity.map(([city, count]) => (
                  <div key={city} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                    <span className="flex items-center gap-2"><MapPin className="h-3 w-3 text-muted-foreground" /> {city}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée de géolocalisation</p>}
          </CardContent>
        </Card>

        {/* Top pages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Pages les plus visitées</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topPages.length > 0 ? (
              <div className="space-y-1">
                {data.topPages.map((p, i) => (
                  <div key={p.path} className="flex justify-between items-center text-sm py-1 border-b last:border-0">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-muted-foreground font-mono text-xs">{i + 1}.</span>
                      <span className="truncate" title={p.path}>{p.path}</span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">{p.count} vues</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-4">Aucune donnée</p>}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      {data.topProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Produits les plus visités</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {data.topProducts.map((p, i) => (
                <a
                  key={p.sku}
                  href={`/boutique/produit/${encodeURIComponent(p.sku)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 border rounded-md hover:bg-muted/40 transition-colors"
                >
                  <span className="text-muted-foreground font-bold text-sm w-6">{i + 1}.</span>
                  <div className="h-10 w-10 rounded-md overflow-hidden bg-muted shrink-0">
                    {p.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.photo} alt={p.brand} className="w-full h-full object-cover" />
                    ) : <div className="w-full h-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.brand} — {p.title || p.sku}</p>
                    <p className="text-[10px] text-muted-foreground">{p.views} vues</p>
                  </div>
                  <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent visitors with details */}
      {data.recentVisitors && data.recentVisitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Visiteurs récents ({data.recentVisitors.length})</CardTitle>
            <CardDescription>IP, géolocalisation, appareil et provenance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr className="text-left text-[10px] text-muted-foreground uppercase border-b">
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">IP</th>
                    <th className="px-2 py-2 font-medium">Pays</th>
                    <th className="px-2 py-2 font-medium">Ville</th>
                    <th className="px-2 py-2 font-medium">Appareil</th>
                    <th className="px-2 py-2 font-medium">Navigateur</th>
                    <th className="px-2 py-2 font-medium">OS</th>
                    <th className="px-2 py-2 font-medium">Source</th>
                    <th className="px-2 py-2 font-medium">Langue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentVisitors.map(v => (
                    <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                        {new Date(v.createdAt).toLocaleDateString('fr-FR')} {new Date(v.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px]">{v.ipAddress}</td>
                      <td className="px-2 py-1.5">{v.country}</td>
                      <td className="px-2 py-1.5">{v.city}{v.region ? ` (${v.region})` : ''}</td>
                      <td className="px-2 py-1.5 capitalize">{v.device}</td>
                      <td className="px-2 py-1.5 capitalize">{v.browser}</td>
                      <td className="px-2 py-1.5 capitalize">{v.os}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="secondary" className="text-[9px]">{v.referrerSource}</Badge>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">{v.language || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Award className="h-4 w-4" /> Avis clients</CardTitle>
          <CardDescription>
            {data.reviews.total} avis · Note moyenne : {data.reviews.avgRating}/5
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rating distribution */}
          {data.reviews.byRating.length > 0 && (
            <div className="flex items-center gap-4 flex-wrap">
              {data.reviews.byRating.map(([rating, count]) => (
                <div key={rating} className="flex items-center gap-1">
                  <span className="text-sm font-bold">{rating}</span>
                  <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          )}

          {/* Reviews by product */}
          {data.reviews.byProduct.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-2">Avis par produit</p>
              <div className="space-y-1">
                {data.reviews.byProduct.map(p => (
                  <a
                    key={p.sku}
                    href={`/boutique/produit/${encodeURIComponent(p.sku)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-sm py-1 border-b last:border-0 hover:bg-muted/30 px-2 rounded"
                  >
                    <span className="truncate">{p.brand} — {p.title || p.sku}</span>
                    <span className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="flex items-center gap-0.5">
                        {p.avgRating.toFixed(1)} <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      </span>
                      <Badge variant="secondary" className="text-[10px]">{p.count}</Badge>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Recent reviews */}
          {data.reviews.recent.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase mb-2">Avis récents</p>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {data.reviews.recent.map(r => (
                  <a
                    key={r.id}
                    href={`/boutique/produit/${encodeURIComponent(r.productSku)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-2 border rounded-md hover:bg-muted/30 text-sm"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{r.authorName}</span>
                      <span className="flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={`h-3 w-3 ${i < r.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </span>
                    </div>
                    {r.title && <p className="text-xs font-semibold">{r.title}</p>}
                    {r.comment && <p className="text-xs text-muted-foreground line-clamp-2">{r.comment}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(r.createdAt).toLocaleDateString('fr-FR')} · {r.productSku}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}

          {data.reviews.total === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Aucun avis pour le moment</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
