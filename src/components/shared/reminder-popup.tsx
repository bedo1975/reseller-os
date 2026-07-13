'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Bell, CheckCircle2, Clock, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatEUR, formatDate } from '@/lib/constants'

interface Reminder {
  id: string
  title: string
  description: string | null
  category: string
  frequency: string
  intervalNum: number
  lastDone: string | null
  nextDue: string
}

const categoryLabels: Record<string, string> = {
  urssaf: 'URSSAF',
  stock: 'Stock',
  compta: 'Comptabilité',
  general: 'Général',
}

const categoryColors: Record<string, string> = {
  urssaf: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  stock: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  compta: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  general: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
}

const frequencyLabels: Record<string, string> = {
  daily: 'jour',
  weekly: 'semaine',
  monthly: 'mois',
  quarterly: 'trimestre',
  yearly: 'an',
}

export function ReminderPopup() {
  const { data: session } = useSession()
  const [dueReminders, setDueReminders] = useState<Reminder[]>([])
  const [showPopup, setShowPopup] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!session) return
    let cancelled = false

    const checkReminders = async () => {
      try {
        const res = await fetch('/api/reminders', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled && data.dueReminders?.length > 0) {
          setDueReminders(data.dueReminders)
          // Petit délai pour pas claquer au chargement
          setTimeout(() => setShowPopup(true), 1500)
        }
      } catch {
        // Silencieux
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    checkReminders()
    return () => { cancelled = true }
  }, [session])

  const markDone = async (id: string, frequency: string, intervalNum: number) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'done', frequency, intervalNum }),
      })
      toast.success('Action marquée comme faite ! Prochaine échéance calculée.')
      setDueReminders(prev => prev.filter(r => r.id !== id))
      if (dueReminders.length <= 1) setShowPopup(false)
    } catch {
      toast.error('Erreur')
    }
  }

  const dismiss = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dismiss' }),
      })
      setDueReminders(prev => prev.filter(r => r.id !== id))
      if (dueReminders.length <= 1) setShowPopup(false)
    } catch {
      toast.error('Erreur')
    }
  }

  if (loading || dueReminders.length === 0) return null

  return (
    <Dialog open={showPopup} onOpenChange={setShowPopup}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="relative">
              <Bell className="h-5 w-5 text-amber-600" />
              <span className="absolute -top-1 -right-1 h-2 w-2 bg-rose-500 rounded-full animate-pulse" />
            </div>
            Rappel{dueReminders.length > 1 ? 's' : ''} du jour
          </DialogTitle>
          <DialogDescription>
            {dueReminders.length} action{dueReminders.length > 1 ? 's' : ''} à effectuer aujourd'hui
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {dueReminders.map((r) => (
            <Card key={r.id} className="border-amber-200 dark:border-amber-900">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', categoryColors[r.category] || categoryColors.general)}>
                        {categoryLabels[r.category] || r.category}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{r.title}</p>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>Échéance : {formatDate(r.nextDue)}</span>
                  <span>·</span>
                  <Clock className="h-3 w-3" />
                  <span>Tous les {r.intervalNum} {frequencyLabels[r.frequency] || r.frequency}{r.intervalNum > 1 ? 's' : ''}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => markDone(r.id, r.frequency, r.intervalNum)}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" /> Fait
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => dismiss(r.id)}
                  >
                    Plus tard
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
