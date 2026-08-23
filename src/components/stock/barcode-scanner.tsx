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
  onFound: (item: StockItemLite) => void
  onNotFound: (barcode: string) => void
}

const SCAN_TIMEOUT_MS = 30000

export function BarcodeScannerModal({ open, onOpenChange, onFound, onNotFound }: BarcodeScannerModalProps) {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera')
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [lookingUp, setLookingUp] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const scannerRef = useRef<any>(null)
  // CRITICAL: mountRef must have ZERO React children.
  // Only our JS code (document.createElement) puts stuff inside it.
  // The scanning indicator is a SIBLING (see JSX below), not a child.
  const mountRef = useRef<HTMLDivElement>(null)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFoundRef = useRef(onFound)
  const onNotFoundRef = useRef(onNotFound)

  useEffect(() => { onFoundRef.current = onFound }, [onFound])
  useEffect(() => { onNotFoundRef.current = onNotFound }, [onNotFound])

  // ── Stop camera (stable, no deps) ──
  const stopCamera = useCallback(async () => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }
    if (scannerRef.current) {
      try {
        const s = scannerRef.current
        scannerRef.current = null
        if (s.isScanning) await s.stop()
        s.clear()
      } catch {}
    }
    if (mountRef.current) {
      mountRef.current.innerHTML = ''
    }
    setScanning(false)
  }, [])

  // ── Handle scanned code ──
  const handleScannedCode = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return
    await stopCamera()
    setLookingUp(true)
    try {
      const res = await fetch(`/api/stock/by-barcode/${encodeURIComponent(trimmed)}`)
      if (res.status === 404) {
        toast.info(`Code-barres ${trimmed} inconnu — création d'un nouvel article`)
        onNotFoundRef.current(trimmed)
      } else if (res.ok) {
        const data = await res.json()
        if (data.found && data.item) {
          if (data.items && data.items.length > 1) {
            toast.success(`${data.items.length} variantes trouvées`)
            // Pass the full response so the caller can access data.items
            onFoundRef.current(data)
          } else {
            toast.success(`Article trouvé : ${data.item.brand}`)
            onFoundRef.current(data)
          }
        } else {
          onNotFoundRef.current(trimmed)
        }
      } else {
        toast.error('Erreur lors de la recherche')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLookingUp(false)
    }
  }, [stopCamera])

  // ── Start camera ──
  const startCamera = useCallback(async () => {
    setCameraError(null)
    setScanning(true)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      if (scannerRef.current) {
        try { await scannerRef.current.stop() } catch {}
        scannerRef.current = null
      }

      if (!mountRef.current) return
      mountRef.current.innerHTML = ''
      const scannerDiv = document.createElement('div')
      scannerDiv.id = 'barcode-scanner-region'
      scannerDiv.style.width = '100%'
      scannerDiv.style.height = '100%'
      mountRef.current.appendChild(scannerDiv)

      const scanner = new Html5Qrcode('barcode-scanner-region', { verbose: false })
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 16 / 9,
          formatsToSupport: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        },
        (decodedText: string) => { handleScannedCode(decodedText) },
        () => {},
      )

      if (stopTimerRef.current) clearTimeout(stopTimerRef.current)
      stopTimerRef.current = setTimeout(() => {
        toast.info('Aucun code-barres détecté après 30s. Tu peux saisir le code manuellement.')
        setMode('manual')
      }, SCAN_TIMEOUT_MS)
    } catch (e: any) {
      console.error('Camera start error:', e)
      setCameraError(e?.message || 'Impossible d\'accéder à la caméra.')
      setScanning(false)
      setMode('manual')
    }
  }, [handleScannedCode])

  // ── Start/stop camera when mode changes ──
  useEffect(() => {
    if (open && mode === 'camera') {
      const t = setTimeout(() => startCamera(), 100)
      return () => clearTimeout(t)
    } else if (mode === 'manual') {
      stopCamera()
    }
  }, [open, mode, startCamera, stopCamera])

  // ── Intercept close: stop camera FIRST, then close ──
  const handleClose = useCallback(async (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true)
      return
    }
    setClosing(true)
    await stopCamera()
    setClosing(false)
    onOpenChange(false)
  }, [stopCamera, onOpenChange])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => { stopCamera() }
  }, [stopCamera])

  // ── Reset when opening ──
  useEffect(() => {
    if (open) {
      setMode('camera')
      setManualCode('')
      setCameraError(null)
      setScanning(false)
    }
  }, [open])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCode.trim()) { toast.error('Saisis un code-barres'); return }
    handleScannedCode(manualCode.trim())
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
                {/* ── CRITICAL ARCHITECTURE ──
                  mountRef is an EMPTY div. React puts NOTHING inside it.
                  Only our JS code (startCamera) creates a child div + html5-qrcode
                  injects <video>/<canvas> into that child.
                  When stopCamera clears mountRef.innerHTML = '', it only removes
                  the scanner's elements — React never sees them, no removeChild error.

                  The scanning indicator (green line) is a SIBLING of mountRef,
                  positioned absolutely OVER it, NOT inside it. */}
                <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
                  {/* Scanner mount point — React children: NONE */}
                  <div ref={mountRef} className="absolute inset-0" />

                  {/* Scanning indicator — SIBLING of mountRef, not a child */}
                  {scanning && !closing && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 animate-pulse" style={{ top: '50%' }} />
                    </div>
                  )}
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  {closing ? 'Fermeture…' : scanning ? 'Place le code-barres dans le cadre…' : lookingUp ? 'Recherche en cours…' : 'Caméra en attente'}
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
            <Button type="submit" className="w-full" disabled={lookingUp || !manualCode.trim()}>
              <Search className="h-4 w-4 mr-2" /> Rechercher
            </Button>
          </form>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={closing}>
            {closing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
            {closing ? 'Fermeture…' : 'Annuler'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Modal "Quantité à ajouter au stock"
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

  useEffect(() => { if (open) setQty('1') }, [open])

  if (!item) return null

  let photos: string[] = []
  try { photos = JSON.parse(item.photos) } catch {}
  const mainPhoto = photos[0] || null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseInt(qty)
    if (!n || n <= 0) { toast.error('Quantité invalide'); return }
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
              <span>Stock: <strong className="text-foreground">{item.quantity}</strong></span>
            </div>
            {item.barcode && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">📷 {item.barcode}</p>}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qty-add" className="text-xs">Quantité à ajouter</Label>
            <Input id="qty-add" type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="text-2xl text-center font-bold h-14" autoFocus />
            <p className="text-[10px] text-muted-foreground">Nouveau stock : <strong>{item.quantity + (parseInt(qty) || 0)}</strong> unité(s)</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Ajout…</> : <><Plus className="h-4 w-4 mr-1" /> Ajouter au stock</>}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
