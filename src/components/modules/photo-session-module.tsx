'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Camera, Plus, Trash2, Loader2, Image as ImageIcon, X, Check, Link2,
  ChevronLeft, Upload, FileImage, Calendar, Tag, Download, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { usePermissions } from '@/hooks/use-permissions'
import { cn } from '@/lib/utils'
import { photoUrl } from '@/lib/photo-url'

interface Photo {
  id: string
  path: string
  filename: string
  createdAt: string
}

interface Session {
  id: string
  name: string
  notes: string | null
  photos: Photo[]
  attachedStockId: string | null
  attachedAt: string | null
  createdAt: string
  updatedAt: string
}

export function PhotoSessionModule() {
  const { can } = usePermissions()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [tryonPhoto, setTryonPhoto] = useState<string | null>(null)  // photo path being transformed
  const [tryonModel, setTryonModel] = useState<string>('man_1')
  const [tryonLoading, setTryonLoading] = useState(false)
  const [tryonResult, setTryonResult] = useState<string | null>(null)  // output URL from Replicate
  const [tryonError, setTryonError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/photo-sessions')
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  // Refresh selected session when sessions list updates
  useEffect(() => {
    if (selectedSession) {
      const updated = sessions.find((s) => s.id === selectedSession.id)
      if (updated) setSelectedSession(updated)
    }
  }, [sessions, selectedSession])

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Donne un nom à la session')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/photo-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), notes: newNotes.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      toast.success('Session créée')
      setCreateOpen(false)
      setNewName('')
      setNewNotes('')
      await fetchSessions()
      setSelectedSession(data)
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setCreating(false)
    }
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedSession) return
    setUploading(true)
    try {
      const formData = new FormData()
      Array.from(files).forEach((file) => formData.append('photos', file))

      const res = await fetch(`/api/photo-sessions/${selectedSession.id}/photos`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur upload')
        return
      }
      toast.success(`${data.added} photo(s) ajoutée(s)`)
      await fetchSessions()
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeletePhoto = async (photoId: string) => {
    if (!selectedSession) return
    if (!confirm('Supprimer cette photo ?')) return
    try {
      const res = await fetch(
        `/api/photo-sessions/${selectedSession.id}/photos?photoId=${photoId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        toast.error('Erreur suppression')
        return
      }
      toast.success('Photo supprimée')
      await fetchSessions()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const handleDeleteSession = async (id: string, name: string) => {
    if (!confirm(`Supprimer la session "${name}" et toutes ses photos ?`)) return
    try {
      const res = await fetch(`/api/photo-sessions/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        toast.error('Erreur suppression')
        return
      }
      toast.success('Session supprimée')
      setSelectedSession(null)
      await fetchSessions()
    } catch {
      toast.error('Erreur réseau')
    }
  }

  const handleVirtualTryOn = async () => {
    if (!tryonPhoto) return
    setTryonLoading(true)
    setTryonError(null)
    setTryonResult(null)
    try {
      const res = await fetch('/api/ai/virtual-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoPath: tryonPhoto, modelImage: tryonModel }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur')
      }
      // If the prediction returned immediately (Prefer: wait)
      if (data.outputUrl) {
        setTryonResult(data.outputUrl)
        toast.success('Transformation réussie !')
      } else if (data.predictionId) {
        // Need to poll for the result
        const provider = data.provider || 'replicate'
        toast.info('Transformation en cours...', { description: 'Cela peut prendre 30-60 secondes.' })
        const predictionId = data.predictionId
        // Poll every 5 seconds for up to 2 minutes
        for (let i = 0; i < 24; i++) {
          await new Promise(r => setTimeout(r, 5000))
          const pollRes = await fetch(`/api/ai/virtual-tryon?id=${predictionId}&provider=${provider}`)
          const pollData = await pollRes.json()
          if (pollData.status === 'succeeded' && pollData.outputUrl) {
            setTryonResult(pollData.outputUrl)
            toast.success('Transformation réussie !')
            return
          }
          if (pollData.status === 'failed') {
            throw new Error('La transformation a échoué')
          }
        }
        throw new Error('Délai dépassé. Réessayez.')
      }
    } catch (e: unknown) {
      setTryonError(e instanceof Error ? e.message : 'Erreur')
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setTryonLoading(false)
    }
  }

  // Replace the original photo with the virtual try-on result
  const applyTryOnResult = async () => {
    if (!tryonResult || !tryonPhoto || !selectedSession) return
    try {
      // Download the result image and replace the original file
      const res = await fetch(tryonResult)
      const blob = await res.blob()
      const buffer = Buffer.from(await blob.arrayBuffer())

      // Write the new image to the same path (overwrite original)
      const fullPath = `${process.cwd()}/public${tryonPhoto}`
      const fs = await import('fs')
      fs.writeFileSync(fullPath, buffer)

      toast.success('Photo remplacée par la version virtuelle !')
      setTryonPhoto(null)
      setTryonResult(null)
      await fetchSessions()
    } catch (e: unknown) {
      toast.error('Erreur lors du remplacement de la photo')
    }
  }

  const handleExportSession = async () => {
    if (!selectedSession) return
    if (selectedSession.photos.length === 0) {
      toast.error('Aucune photo à exporter')
      return
    }
    setExporting(true)
    try {
      // Fetch the ZIP as a blob (binary data) so we can trigger a browser download.
      const res = await fetch(`/api/photo-sessions/${selectedSession.id}/export`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur export')
      }
      // Convert response to blob and trigger download
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      // Extract filename from Content-Disposition header, fallback to a generated name
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match ? match[1] : `session-${selectedSession.id}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${selectedSession.photos.length} photo(s) exportée(s)`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setExporting(false)
    }
  }

  // Detail view (single session)
  if (selectedSession) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
              <ChevronLeft className="h-4 w-4" />
              Retour
            </Button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Camera className="h-6 w-6" />
                {selectedSession.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedSession.photos.length} photo(s) · Créée le{' '}
                {new Date(selectedSession.createdAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Ajouter photos
            </Button>
            <Button
              variant="outline"
              onClick={handleExportSession}
              disabled={exporting || selectedSession.photos.length === 0}
              title="Télécharger toutes les photos en ZIP"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Exporter
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => handleDeleteSession(selectedSession.id, selectedSession.name)}
              title="Supprimer la session"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Status badge */}
        {selectedSession.attachedStockId && (
          <Card className="bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900">
            <CardContent className="p-4 flex items-center gap-2 text-sm text-green-900 dark:text-green-200">
              <Check className="h-4 w-4" />
              Cette session a été rattachée à un article de stock.
              <Badge variant="outline" className="ml-auto">
                {new Date(selectedSession.attachedAt!).toLocaleDateString('fr-FR')}
              </Badge>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {selectedSession.notes && (
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedSession.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Hidden file input (accepts camera on mobile) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />

        {/* Photo grid */}
        {selectedSession.photos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground mb-3">Aucune photo pour l'instant</p>
              <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                Prendre / ajouter des photos
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                Sur mobile : utilise la caméra. Sur PC : sélectionne des fichiers.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {selectedSession.photos.map((photo) => (
              <Card key={photo.id} className="overflow-hidden group">
                <div className="relative aspect-square bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoUrl(photo.path)}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={photoUrl(photo.path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 left-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Voir en grand"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => { setTryonPhoto(photo.path); setTryonResult(null); setTryonError(null) }}
                    className="absolute bottom-2 right-2 bg-purple-600 hover:bg-purple-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Essai virtuel (IA)"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </button>
                </div>
                <CardContent className="p-2">
                  <p className="text-xs text-muted-foreground truncate">
                    {new Date(photo.createdAt).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tip */}
        <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
          <CardContent className="p-4 text-sm text-blue-900 dark:text-blue-200">
            <strong>💡 Astuce :</strong> Pour rattacher ces photos à un article de stock, allez dans le module{' '}
            <strong>Stock</strong> → éditez l'article → section Photos → bouton "Importer depuis shooting".
          </CardContent>
        </Card>

        {/* Virtual Try-On Dialog */}
        {tryonPhoto && (
          <Dialog open={true} onOpenChange={(o) => { if (!o) { setTryonPhoto(null); setTryonResult(null); setTryonError(null) } }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Essai virtuel IA
                </DialogTitle>
                <DialogDescription>
                  Transforme la photo de l'article en photo portée par un mannequin. ~30 secondes par transformation.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Photo originale */}
                <div className="flex gap-3">
                  <div className="w-32 h-32 rounded-lg overflow-hidden border shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoUrl(tryonPhoto)} alt="Original" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs text-muted-foreground">Photo d'origine</p>
                    <Label className="text-xs">Modèle (mannequin)</Label>
                    <select
                      value={tryonModel}
                      onChange={e => setTryonModel(e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="man_1">Homme — debout, face</option>
                      <option value="woman_1">Femme — debout, face</option>
                      <option value="man_2">Homme — décontracté</option>
                      <option value="woman_2">Femme — décontracté</option>
                    </select>
                  </div>
                </div>

                {/* Résultat */}
                {tryonResult && (
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <div className="w-32 h-32 rounded-lg overflow-hidden border shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl(tryonPhoto)} alt="Avant" className="w-full h-full object-cover" />
                      </div>
                      <div className="text-2xl flex items-center">→</div>
                      <div className="w-32 h-32 rounded-lg overflow-hidden border shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={tryonResult} alt="Après" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600">✓ Transformation réussie ! Voulez-vous remplacer la photo d'origine ?</p>
                  </div>
                )}

                {tryonError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">
                    ❌ {tryonError}
                  </div>
                )}

                {tryonLoading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                    <span className="ml-2 text-sm text-muted-foreground">Transformation en cours...</span>
                  </div>
                )}
              </div>

              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => { setTryonPhoto(null); setTryonResult(null); setTryonError(null) }}>
                  Fermer
                </Button>
                {!tryonResult && !tryonLoading && (
                  <Button onClick={handleVirtualTryOn} className="bg-purple-600 hover:bg-purple-700">
                    <Sparkles className="h-4 w-4 mr-1" /> Transformer
                  </Button>
                )}
                {tryonResult && (
                  <Button onClick={applyTryOnResult} className="bg-emerald-600 hover:bg-emerald-700">
                    <Check className="h-4 w-4 mr-1" /> Remplacer la photo
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  // List view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-6 w-6" />
            Shooting Photo
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Capturez vos produits pendant le shooting, puis rattachez les photos aux fiches stock
          </p>
        </div>
        {can('photos', 'create') && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nouvelle session
          </Button>
        )}
      </div>

      {/* Sessions grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Camera className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-3">Aucune session de shooting</p>
            {can('photos', 'create') && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Créer ma première session
              </Button>
            )}
            <p className="text-xs text-muted-foreground mt-3 max-w-md">
              Le workflow : créez une session avec un nom mémo (ex: "T-shirt Nike M noir"),
              prenez vos photos pendant le shooting, puis rattachez-les à la fiche stock plus tard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sessions.map((session) => {
            const firstPhoto = session.photos[0]
            return (
              <Card
                key={session.id}
                className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedSession(session)}
              >
                <div className="aspect-video bg-muted relative">
                  {firstPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl(firstPhoto.path)}
                      alt={session.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                      <ImageIcon className="h-10 w-10" />
                    </div>
                  )}
                  <Badge className="absolute top-2 right-2 bg-black/70 hover:bg-black/70 text-white">
                    <FileImage className="h-3 w-3" />
                    {session.photos.length}
                  </Badge>
                  {session.attachedStockId && (
                    <Badge className="absolute top-2 left-2 bg-green-600 hover:bg-green-600 text-white gap-1">
                      <Link2 className="h-3 w-3" />
                      Rattaché
                    </Badge>
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="font-medium text-sm truncate">{session.name}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(session.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {session.notes && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      {session.notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create session dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle session de shooting</DialogTitle>
            <DialogDescription>
              Donnez un nom mémo pour retrouver facilement les photos (marque, modèle, taille, couleur...).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="session-name">Nom de la session *</Label>
              <Input
                id="session-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="ex: T-shirt Nike M noir, Jeans Levi's 38 bleu..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="session-notes">Notes (optionnel)</Label>
              <Input
                id="session-notes"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="ex: état, défauts, quantité..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
