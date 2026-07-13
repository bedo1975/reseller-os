'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Eye, EyeOff, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HourEntry {
  day: string
  hours: string
  closed: boolean
  visible?: boolean
}

interface HoursEditorProps {
  value: string  // JSON string of days
  onChange: (json: string) => void
  visible?: boolean  // master toggle
  onVisibleChange?: (v: boolean) => void
}

const DEFAULT_DAYS: HourEntry[] = [
  { day: 'Lundi', hours: '9h - 18h', closed: false, visible: true },
  { day: 'Mardi', hours: '9h - 18h', closed: false, visible: true },
  { day: 'Mercredi', hours: '9h - 18h', closed: false, visible: true },
  { day: 'Jeudi', hours: '9h - 18h', closed: false, visible: true },
  { day: 'Vendredi', hours: '9h - 18h', closed: false, visible: true },
  { day: 'Samedi', hours: '10h - 17h', closed: false, visible: true },
  { day: 'Dimanche', hours: '', closed: true, visible: true },
]

// Ensure every entry has a defined `visible` (legacy entries may lack it)
function normalize(entries: HourEntry[]): HourEntry[] {
  return entries.map(e => ({ ...e, visible: e.visible === undefined ? true : e.visible }))
}

export function HoursEditor({ value, onChange, visible = true, onVisibleChange }: HoursEditorProps) {
  const [entries, setEntries] = useState<HourEntry[]>(() => {
    try {
      const parsed = JSON.parse(value || '[]')
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalize(parsed)
      }
    } catch {}
    return DEFAULT_DAYS
  })

  // Ref to track the last JSON string we emitted — prevents the feedback loop
  // where the parent's value prop flows back and overwrites our local state.
  const lastEmittedRef = useRef<string>('')

  useEffect(() => {
    // Only re-sync from parent if the parent's value differs from what we last emitted.
    // This prevents losing user edits when the parent re-renders.
    if (value === lastEmittedRef.current) return

    try {
      const parsed = JSON.parse(value || '[]')
      if (Array.isArray(parsed) && parsed.length > 0) {
        setEntries(normalize(parsed))
      } else if (value === '' || value === '[]') {
        setEntries(DEFAULT_DAYS)
      }
    } catch {
      setEntries(DEFAULT_DAYS)
    }
  }, [value])

  const update = (newEntries: HourEntry[]) => {
    const json = JSON.stringify(newEntries)
    lastEmittedRef.current = json
    setEntries(newEntries)
    onChange(json)
  }

  const updateEntry = (index: number, field: keyof HourEntry, val: any) => {
    const newEntries = [...entries]
    newEntries[index] = { ...newEntries[index], [field]: val }
    // If closed is checked, clear hours
    if (field === 'closed' && val === true) {
      newEntries[index].hours = ''
    }
    update(newEntries)
  }

  return (
    <div className="space-y-4">
      {/* Master visibility toggle */}
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors',
          visible ? 'border-primary/30 bg-primary/5' : 'border-muted-foreground/20 bg-muted/30'
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'w-9 h-9 rounded-md flex items-center justify-center',
            visible ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
          )}>
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <Label className="text-sm font-semibold cursor-pointer" onClick={() => onVisibleChange?.(!visible)}>
              Afficher les horaires dans le footer
            </Label>
            <p className="text-[11px] text-muted-foreground">
              {visible ? 'Le bloc horaires est visible sur la boutique.' : 'Le bloc horaires est masqué sur la boutique.'}
            </p>
          </div>
        </div>
        <Switch
          checked={visible}
          onCheckedChange={(v) => onVisibleChange?.(!!v)}
          aria-label="Afficher les horaires"
        />
      </div>

      {/* Days editor — disabled when master toggle is off */}
      <div className={cn('space-y-2 transition-opacity', !visible && 'opacity-50 pointer-events-none')}>
        {/* Header row (desktop only) */}
        <div className="hidden md:grid grid-cols-[120px_1fr_auto_auto] gap-3 px-1 text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
          <span>Jour</span>
          <span>Horaires</span>
          <span className="w-16 text-center">Fermé</span>
          <span className="w-20 text-center">Affiché</span>
        </div>

        {entries.map((entry, index) => {
          const dayVisible = entry.visible !== false
          return (
            <div
              key={index}
              className={cn(
                'grid grid-cols-1 md:grid-cols-[120px_1fr_auto_auto] gap-2 md:gap-3 items-center rounded-md border px-2 py-1.5 transition-colors',
                !dayVisible && 'bg-muted/40 border-dashed',
                dayVisible && 'bg-card'
              )}
            >
              {/* Day */}
              <div className="w-full md:w-28 shrink-0">
                <Input
                  value={entry.day}
                  onChange={e => updateEntry(index, 'day', e.target.value)}
                  className="h-8 text-sm font-medium"
                  placeholder="Jour"
                />
              </div>

              {/* Hours */}
              <div className="flex-1">
                <Input
                  value={entry.hours}
                  onChange={e => updateEntry(index, 'hours', e.target.value)}
                  className="h-8 text-sm"
                  placeholder={entry.closed ? 'Fermé' : '9h - 18h'}
                  disabled={entry.closed}
                />
              </div>

              {/* Closed checkbox */}
              <div className="flex items-center justify-center gap-2 shrink-0 md:w-16">
                <Checkbox
                  id={`closed-${index}`}
                  checked={entry.closed}
                  onCheckedChange={(v) => updateEntry(index, 'closed', !!v)}
                />
                <Label htmlFor={`closed-${index}`} className="text-xs cursor-pointer text-muted-foreground md:sr-only">
                  Fermé
                </Label>
              </div>

              {/* Per-day visibility toggle */}
              <div className="flex items-center justify-center shrink-0 md:w-20">
                <button
                  type="button"
                  onClick={() => updateEntry(index, 'visible', !dayVisible)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors',
                    dayVisible
                      ? 'border-green-500/40 bg-green-500/10 text-green-700 hover:bg-green-500/20'
                      : 'border-muted-foreground/30 bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                  title={dayVisible ? 'Masquer ce jour du footer' : 'Afficher ce jour dans le footer'}
                >
                  {dayVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{dayVisible ? 'Affiché' : 'Masqué'}</span>
                </button>
              </div>
            </div>
          )
        })}
        <p className="text-[11px] text-muted-foreground pt-1">
          Cochez « Fermé » pour les jours de fermeture (affiché comme « Fermé » dans le footer).
          Cliquez sur l'œil pour masquer un jour du footer sans le supprimer (ex. : masquer Dimanche).
        </p>
      </div>
    </div>
  )
}
