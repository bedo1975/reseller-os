'use client'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon?: LucideIcon
  trend?: string
  trendUp?: boolean
  className?: string
  accent?: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet'
}

const accentMap = {
  emerald: 'from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-300',
  sky: 'from-sky-500/10 to-sky-500/5 text-sky-700 dark:text-sky-300',
  amber: 'from-amber-500/10 to-amber-500/5 text-amber-700 dark:text-amber-300',
  rose: 'from-rose-500/10 to-rose-500/5 text-rose-700 dark:text-rose-300',
  violet: 'from-violet-500/10 to-violet-500/5 text-violet-700 dark:text-violet-300',
}

const iconBgMap = {
  emerald: 'bg-emerald-500/15 text-emerald-600',
  sky: 'bg-sky-500/15 text-sky-600',
  amber: 'bg-amber-500/15 text-amber-600',
  rose: 'bg-rose-500/15 text-rose-600',
  violet: 'bg-violet-500/15 text-violet-600',
}

export function StatCard({ label, value, icon: Icon, trend, trendUp, className, accent = 'emerald' }: StatCardProps) {
  return (
    <Card className={cn('relative overflow-hidden border-border/60', className)}>
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-50', accentMap[accent])} />
      <CardContent className="relative p-4 lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
            <p className="text-2xl lg:text-3xl font-bold mt-1.5 leading-tight truncate">{value}</p>
            {trend && (
              <p className={cn(
                'text-xs mt-1.5 font-medium flex items-center gap-1',
                trendUp ? 'text-emerald-600' : 'text-rose-600'
              )}>
                {trendUp ? '▲' : '▼'} {trend}
              </p>
            )}
          </div>
          {Icon && (
            <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center shrink-0', iconBgMap[accent])}>
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
