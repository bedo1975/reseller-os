'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Eye, EyeOff, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface LinkItem {
  label: string
  url: string
  visible: boolean
  order?: number
}

interface LinkEditorProps {
  value: string  // JSON string
  onChange: (json: string) => void
  placeholder?: string
  showOrder?: boolean
}

export function LinkEditor({ value, onChange, placeholder, showOrder }: LinkEditorProps) {
  const [items, setItems] = useState<LinkItem[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const isInternalChange = useRef(false)

  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    try {
      const parsed = JSON.parse(value || '[]')
      if (Array.isArray(parsed)) {
        const currentJson = JSON.stringify(items)
        const newJson = JSON.stringify(parsed)
        if (currentJson !== newJson) {
          setItems(parsed)
        }
      } else {
        setItems([])
      }
    } catch {
      setItems([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const update = (newItems: LinkItem[]) => {
    // Reassign order
    if (showOrder) {
      newItems.forEach((item, i) => { item.order = i + 1 })
    }
    isInternalChange.current = true
    setItems(newItems)
    onChange(JSON.stringify(newItems))
  }

  const addItem = () => {
    update([...items, { label: '', url: '', visible: true, order: items.length + 1 }])
  }

  const updateItem = (index: number, field: keyof LinkItem, val: any) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: val }
    update(newItems)
  }

  const removeItem = (index: number) => {
    update(items.filter((_, i) => i !== index))
  }

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === items.length - 1) return
    const newItems = [...items]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]]
    update(newItems)
  }

  // ── Drag & Drop ──────────────────────────────────────────────
  const handleDragStart = (index: number) => {
    setDragIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    const newItems = [...items]
    const [draggedItem] = newItems.splice(dragIndex, 1)
    newItems.splice(index, 0, draggedItem)
    update(newItems)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground italic py-2">Aucun lien configuré. Cliquez sur "Ajouter un lien".</p>
      )}
      {items.map((item, index) => (
        <div
          key={index}
          draggable={showOrder === true}
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            'flex items-center gap-2 p-2 border rounded-md bg-card transition-all',
            showOrder && 'cursor-grab active:cursor-grabbing',
            dragIndex === index && 'opacity-50 border-blue-500',
            dragOverIndex === index && dragIndex !== index && 'border-blue-500 border-t-2 bg-blue-50',
          )}
        >
          {showOrder && (
            <div className="flex items-center gap-0.5 shrink-0">
              <GripVertical className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <button
                  onClick={() => moveItem(index, 'up')}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  disabled={index === 0}
                  title="Monter"
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  onClick={() => moveItem(index, 'down')}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  disabled={index === items.length - 1}
                  title="Descendre"
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
          <Input
            value={item.label}
            onChange={e => updateItem(index, 'label', e.target.value)}
            placeholder="Libellé"
            className="h-8 text-sm flex-1 min-w-[100px]"
          />
          <Input
            value={item.url}
            onChange={e => updateItem(index, 'url', e.target.value)}
            placeholder={placeholder || "/categorie/..."}
            className="h-8 text-sm flex-1 min-w-[120px] font-mono text-xs"
          />
          <button
            onClick={() => updateItem(index, 'visible', !item.visible)}
            className={`shrink-0 p-1.5 rounded-md transition-colors ${
              item.visible
                ? 'text-green-600 hover:bg-green-50'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={item.visible ? 'Visible — cliquer pour masquer' : 'Masqué — cliquer pour afficher'}
          >
            {item.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={() => removeItem(index)}
            className="shrink-0 p-1.5 rounded-md text-red-600 hover:bg-red-50"
            title="Supprimer"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={addItem}>
        <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un lien
      </Button>
      {showOrder && items.length > 1 && (
        <p className="text-[11px] text-muted-foreground pt-1">
          💡 Astuce : tu peux glisser-déposer les liens pour les réordonner (icône ⠿ à gauche).
        </p>
      )}
    </div>
  )
}
