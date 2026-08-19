'use client'

import { useState, useEffect } from 'react'
import { Ruler, X, Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

interface SizeGuide {
  type: string
  title: string
  image: string | null
  headers: string[]
  rows: string[][]
}

const SIZE_GUIDE_LABELS: Record<string, { label: string; icon: string }> = {
  men: { label: 'Hommes', icon: '👨' },
  women: { label: 'Femmes', icon: '👩' },
  kids: { label: 'Enfants', icon: '👶' },
}

export function SizeGuideModal({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const [guides, setGuides] = useState<SizeGuide[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState<string>('men')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/boutique/size-guide')
      .then(r => r.json())
      .then(data => {
        setGuides(data.guides || [])
        // Default to first available guide
        if (data.guides?.length > 0 && !data.guides.find((g: SizeGuide) => g.type === activeType)) {
          setActiveType(data.guides[0].type)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  const activeGuide = guides.find(g => g.type === activeType)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-[#007bff]" />
            Guide des tailles
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : guides.length === 0 ? (
          <p className="text-center py-12 text-muted-foreground text-sm">
            Aucun guide des tailles configuré.
          </p>
        ) : (
          <>
            {/* Tabs: Hommes / Femmes / Enfants */}
            {guides.length > 1 && (
              <div className="flex gap-2 mb-4 border-b pb-2">
                {guides.map(g => {
                  const config = SIZE_GUIDE_LABELS[g.type] || { label: g.title, icon: '📏' }
                  const active = activeType === g.type
                  return (
                    <button
                      key={g.type}
                      onClick={() => setActiveType(g.type)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        active
                          ? 'bg-[#007bff] text-white'
                          : 'bg-muted hover:bg-muted/70 text-muted-foreground'
                      }`}
                    >
                      <span>{config.icon}</span>
                      {config.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Active guide table */}
            {activeGuide && (
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-gray-900">{activeGuide.title}</h3>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700" style={{ width: '80px' }}></th>
                        {activeGuide.headers.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeGuide.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                          {/* Image column: only render on first row, with rowspan to merge vertically */}
                          {ri === 0 && (
                            <td
                              className="px-3 py-2 align-middle text-center border-r border-gray-100"
                              rowSpan={activeGuide.rows.length}
                              style={{ width: '80px', verticalAlign: 'middle' }}
                            >
                              {activeGuide.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={activeGuide.image}
                                  alt="Guide des tailles"
                                  className="w-16 h-24 object-contain rounded mx-auto"
                                />
                              ) : (
                                <span className="text-gray-300 text-xs">Pas d'image</span>
                              )}
                            </td>
                          )}
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-3 py-2 text-gray-700 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
