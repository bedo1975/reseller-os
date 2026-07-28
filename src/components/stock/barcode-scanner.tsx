'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Barcode, Camera, CameraOff, Keyboard, Loader2, Package, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'

interface StockItemLite {
  id: string
  sku: string
  brand: string
  title: string | null
  category: string
  size: string | null
  color: string | null
  barcode: string | null
  quantity: number
  suggestedPrice: number | null
  status: string
  photos: string
}

interface BarcodeScannerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFound: (item: StockItemLite) => void      // code-barres trouvé en DB
  onNotFound: (barcode: string) => void       // code-barres scanné mais inconnu → ouvrir formulaire ajout
}

const SCAN_TIMEOUT_MS = 30000 // arrêt auto après 30s sans scan

export function BarcodeScannerModal({ open, onOpenChange, onFound, onNotFound }: BarcodeScannerModalProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const scannerRef = useRef<any>(null)
  const containerId = 'barcode-scanner-region'
  const stopTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Reset on open
  useEffect(() => {
    if (open) {
      setMode('camera')
      setManualCode('')
      setCameraError(null)
      setScanning(false)
    } else {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Start camera when entering camera mode
  useEffect(() => {
    if (open && mode === 'camera') {
      // Small delay to let DOM render the container
      const t = setTimeout(() => startCamera(), 100)
      return () => clearTimeout(t)
    } else {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const startCamera = async () => {
    setCameraError(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // Stop any existing scanner
      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        scannerRef.current = null
      }

      const scanner = new Html5Qrcode(containerId, { verbose: false })
      scannerRef.current = scanner

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 16 / 9,
        formatsToSupport: [
          // Code-barres 1D (produits)
          3,  // QR_CODE
          4,  // EAN_13
          5,  // EAN_8
          6,  // CODE_39
          7,  // CODE_93
          8,  // CODE_128
          9,  // ITF
          10, // CODABAR
          11, // UPC_A
          12, // UPC_E
        ],
      }

      await scanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          // Success callback
          handleScannedCode(decodedText)
        },
        () => {
          // Ignore per-frame failures
        },
      )

      // Auto-stop after 30s
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        toast.info('Aucun code-barres détecté après 30s. Tu peux saisir le code manuellement.')
        setMode('manual')
      }, SCAN_TIMEOUT_MS)
    } catch (e: any) {
      console.error('Camera start error:', e)
      setCameraError(e?.message || 'Impossible d\'accéder à la caméra. Vérifie les permissions ou saisis le code manuellement.')
      setScanning(false)
      setMode('manual')
    }
  }

  const stopCamera = useCallback(async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (scannerRef.current) {
      try {
        const s = scannerRef.current
        scannerRef.current = null
        if (s.isScanning) {
          await s.stop()
          await s.clear()
        }
      } catch {}
    }
    setScanning(false)
  }, [])

  const handleScannedCode = async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    // Stop camera to prevent multiple scans
    await stopCamera()
    setLookingUp(true)
    try {
      const res = await fetch(`/api/stock/by-barcode/${encodeURIComponent(trimmed)}`)
      if (res.status === 404) {
        // Code inconnu → ouvrir formulaire d'ajout
        toast.info(`Code-barres ${trimmed} inconnu — création d'un nouvel article`)
        onNotFound(trimmed)
      } else if (res.ok) {
        const data = await res.json()
        if (data.found && data.item) {
          toast.success(`Article trouvé : ${data.item.brand}`)
          onFound(data.item)
        } else {
          onNotFound(trimmed)
        }
      } else {
        toast.error('Erreur lors de la recherche')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLookingUp(false)
    }
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) {
      toast.error('Saisis un code-barres')
      return
    }
    handleScannedCode(manualCode.trim())
  }

  const handleClose = (o: boolean) => {
    if (!o) {
      stopCamera()
    }
    onOpenChange(o)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Barcode className="h-5 w-5" />
            Scanner un code-barres
          </DialogTitle>
          <DialogDescription>
            Scanne le code-barres d&apos;un produit avec la caméra, ou saisis-le manuellement.
          </DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-2 p-1 bg-muted rounded-lg">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors ${
              mode === 'camera' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Camera className="h-3.5 w-3.5" /> Caméra
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-medium transition-colors ${
              mode === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Keyboard className="h-3.5 w-3.5" /> Saisie manuelle
          </button>
        </div>

        {mode === 'camera' ? (
          <div className="space-y-3">
            {cameraError ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
                <CameraOff className="h-8 w-8 mx-auto text-amber-600 mb-2" />
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">{cameraError}</p>
                <Button size="sm" variant="outline" onClick={() => setMode('manual')}>
                  <Keyboard className="h-4 w-4 mr-1" /> Saisie manuelle
                </Button>
              </div>
            ) : (
              <>
                <div
                  id={containerId}
                  className="w-full aspect-video bg-black rounded-lg overflow-hidden relative"
                >
                  {scanning && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" style={{ top: '50%' }} />
                    </div>
                  )}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {scanning
                    ? 'Place le code-barres dans le cadre…'
                    : lookingUp
                      ? 'Recherche en cours…'
                      : 'Caméra en attente'}
                </p>
                {lookingUp && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Recherche de l&apos;article…
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Code-barres</Label>
              <Input
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="ex: 3401234567890"
                className="font-mono text-lg tracking-wider text-center"
                autoFocus
                inputMode="numeric"
              />
              <p className="text-[10px] text-muted-foreground">
                Saisis le code-barres (EAN-13, EAN-8, UPC, etc.) puis valide avec Entrée.
              </p>
            </div>
            {lookingUp && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={lookingUp || !manualCode.trim()}
            >
              <Search className="h-4 w-4 mr-2" /> Rechercher
            </Button>
          </form>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)}>
            <X className="h-4 w-4 mr-1" /> Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal "Quantité à ajouter au stock" — quand le code-barres est connu
// ─────────────────────────────────────────────────────────────────────────

interface QuickQuantityModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: StockItemLite | null
  onConfirm: (item: StockItemLite, qtyToAdd: number) => Promise<void>
}

export function QuickQuantityModal({ open, onOpenChange, item, onConfirm }: QuickQuantityModalProps) {
  const [qty, setQty] = useState('1')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) setQty('1')
  }, [open])

  if (!item) return null

  // Parse photos for display
  let photos: string[] = []
  try { photos = JSON.parse(item.photos) } catch {}
  const mainPhoto = photos[0] || null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(qty)
    if (!n || n <= 0) {
      toast.error('Quantité invalide')
      return
    }
    setSaving(true)
    try {
      await onConfirm(item, n)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            Article trouvé
          </DialogTitle>
          <DialogDescription>
            Cet article existe déjà. Saisis la quantité à ajouter au stock.
          </DialogDescription>
        </DialogHeader>

        {/* Article preview */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border">
          <div className="h-14 w-14 rounded-md overflow-hidden bg-muted shrink-0">
            {mainPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mainPhoto.startsWith('/uploads/') ? `/api${mainPhoto}` : mainPhoto} alt={item.brand} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.brand}</p>
            <p className="text-sm font-medium text-foreground truncate">
              {item.title || `${item.brand} ${item.category}`}
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5 text-[10px] text-muted-foreground">
              <span>SKU: <code className="font-mono">{item.sku}</code></span>
              <span>·</span>
              <span>Stock actuel: <strong className="text-foreground">{item.quantity}</strong></span>
            </div>
            {item.barcode && (
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                📷 {item.barcode}
              </p>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qty-add" className="text-xs">Quantité à ajouter</Label>
            <Input
              id="qty-add"
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="text-2xl text-center font-bold h-14"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              Nouveau stock après ajout : <strong>{item.quantity + (parseInt(qty) || 0)}</strong> unité(s)
            </p>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Ajout…</>
              ) : (
                <><Plus className="h-4 w-4 mr-1" /> Ajouter au stock</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
