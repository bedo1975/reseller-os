'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoadingState({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 gap-3', className)}>
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label || 'Chargement...'}</p>
    </div>
  )
}

export function EmptyState({ title, description, icon: Icon }: {
  title: string
  description?: string
  icon?: React.ElementType
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      {Icon && (
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    </div>
  )
}
