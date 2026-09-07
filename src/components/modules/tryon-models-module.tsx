'use client'

import { useState, useCallback, useRef } from 'react'
import {
  User, Plus, Trash2, Loader2, Image as ImageIcon, Upload, X, Check, Pencil,
  Eye, EyeOff, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useFetch } from '@/hooks/use-fetch'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'

interface TryOnModel {
  id: string
  name: string
  gender: string
  imageUrl: string
  isActive: boolean
  order: number
  createdAt: string
}

interface ModelForm {
  name: string
  gender: string
  imageUrl: string
  isActive: boolean
}

const GENDER_LABELS: Record<string, string> = {
  'homme': 'Homme',
  'femme': 'Femme',
  'enfant': 'Enfant',
  'autre': 'Autre',
}

const GENDER_COLORS: Record<string, string> = {
  'homme': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'femme': 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
  'enfant': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'autre': 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
}

const emptyForm: ModelForm = {
  name: '',
  gender: 'homme',
  imageUrl: '',
  isActive: true,
}

export function TryOnModelsModule() {
  const { can } = usePermissions()
  const { data, loading, refresh } = useFetch<{ models: TryOnModel[] }>('/api/virtual-tryon-models')
  const models = data?.models || []

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ModelForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TryOnModel | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canEdit = can('photos', 'create') || can('photos', 'edit')

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (model: TryOnModel) => {
    setForm({
      name: model.name,
      gender: model.gender,
      imageUrl: model.imageUrl,
      isActive: model.isActive,
    })
    setEditingId(model.id)
    setShowForm(true)
  }

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Le fichier doit être une image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image trop lourde (max 10 MB)')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/virtual-tryon-models/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur upload')
      }
      setForm(f => ({ ...f, imageUrl: data.imageUrl }))
      toast.success('Image uploadée')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (!form.imageUrl) {
      toast.error('Une image est requise')
      return
    }

    setSaving(true)
    try {
      const url = editingId
        ? `/api/virtual-tryon-models/${editingId}`
        : '/api/virtual-tryon-models'
      const method = editingId ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur')
      }

      toast.success(editingId ? 'Modèle modifié' : 'Modèle créé')
      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      refresh()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (model: TryOnModel) => {
    try {
      const res = await fetch(`/api/virtual-tryon-models/${model.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !model.isActive }),
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success(model.isActive ? 'Modèle désactivé' : 'Modèle activé')
      refresh()
    } catch {
      toast.error('Erreur')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/virtual-tryon-models/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Erreur')
      toast.success('Modèle supprimé')
      setDeleteTarget(null)
      refresh()
    } catch {
      toast.error('Erreur')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600" />
            Modèles Virtual Try-On
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les mannequins disponibles pour l'essai virtuel côté boutique
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Nouveau modèle
          </Button>
        )}
      </div>

      {/* Info banner */}
      <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-900">
        <CardContent className="p-4 text-sm text-purple-900 dark:text-purple-200">
          <strong className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4" />
            Comment ça marche ?
          </strong>
          <p className="mt-1.5">
            Upload une photo de mannequin (personne en pied, face caméra, fond blanc ou neutre).
            Cette photo sera utilisée par le modèle IDM-VTON pour générer l'essai virtuel.
            Les modèles « actifs » sont visibles côté boutique dans la section « Essayer sur moi ».
          </p>
        </CardContent>
      </Card>

      {/* Models grid */}
      {models.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <User className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-3">Aucun modèle pour l'instant</p>
            {canEdit && (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Ajouter le premier modèle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {models.map((model) => (
            <Card
              key={model.id}
              className={cn(
                'overflow-hidden group transition-shadow hover:shadow-md',
                !model.isActive && 'opacity-60'
              )}
            >
              <div className="relative aspect-[3/4] bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={model.imageUrl.startsWith('/uploads/')
                    ? `/api${model.imageUrl}`
                    : model.imageUrl
                  }
                  alt={model.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2">
                  <Badge className={cn('border-0', GENDER_COLORS[model.gender] || GENDER_COLORS.autre)}>
                    {GENDER_LABELS[model.gender] || model.gender}
                  </Badge>
                </div>
                {!model.isActive && (
                  <div className="absolute top-2 right-2">
                    <Badge variant="secondary" className="bg-gray-800 text-white">
                      <EyeOff className="h-3 w-3 mr-1" />
                      Inactif
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <p className="font-medium text-sm truncate">{model.name}</p>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 flex-1 text-xs"
                      onClick={() => openEdit(model)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Éditer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleToggleActive(model)}
                      title={model.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {model.isActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => setDeleteTarget(model)}
                      title="Supprimer"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(o) => { if (!o) setShowForm(false) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              {editingId ? 'Modifier le modèle' : 'Nouveau modèle'}
            </DialogTitle>
            <DialogDescription>
              Upload une photo de mannequin (format portrait recommandé, fond neutre).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-xs">Photo du mannequin *</Label>
              {form.imageUrl ? (
                <div className="relative w-full max-w-[200px] aspect-[3/4] rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imageUrl.startsWith('/uploads/') ? `/api${form.imageUrl}` : form.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full"
                    title="Changer l'image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  className="block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 transition-colors"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(file)
                    }}
                  />
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-600" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Cliquez pour uploader une photo
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG ou WebP — max 10 MB
                      </p>
                    </>
                  )}
                </label>
              )}
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Nom du modèle *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="ex: Homme athlétique, Femme élancée..."
              />
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <Label className="text-xs">Genre</Label>
              <Select
                value={form.gender}
                onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="homme">Homme</SelectItem>
                  <SelectItem value="femme">Femme</SelectItem>
                  <SelectItem value="enfant">Enfant</SelectItem>
                  <SelectItem value="autre">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Active toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="isActive" className="text-sm cursor-pointer">
                Actif (visible côté boutique)
              </Label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Annuler
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.imageUrl || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              {editingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce modèle ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {deleteTarget?.name} » sera définitivement supprimé, ainsi que sa photo.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
