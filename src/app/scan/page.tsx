'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { QrCode, ArrowLeft, Package, TrendingUp, Euro, MapPin, Camera, X } from 'lucide-react'
import { formatEUR } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface StockItem {
  id: string
  sku: string
  barcode: string | null
  brand: string
  category: string
  size: string | null
  color: string | null
  condition: string
  purchaseCost: number
  suggestedPrice: number | null
  status: string
  platform: string | null
  photos: string
  warehouse: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  sale?: { salePrice: number; profit: number } | null
}

export default function ScanPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [scanning, setScanning] = useState(false)
  const [foundItem, setFoundItem] = useState<StockItem | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manualSku, setManualSku] = useState('')
  const scannerDivId = 'qr-reader'
  const html5QrCodeRef = useRef<unknown>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/scan')
    }
  }, [status, router])

  // Démarre le scan
  const startScan = async () => {
    setError(null)
    setFoundItem(null)
    setScanning(true)

    // Import dynamique côté client uniquement
    const { Html5Qrcode } = await import('html5-qrcode')

    setTimeout(() => {
      const html5QrCode = new Html5Qrcode(scannerDivId)
      html5QrCodeRef.current = html5QrCode

      html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // QR code détecté !
          html5QrCode.stop().then(() => {
            setScanning(false)
            searchItem(decodedText)
          })
        },
        () => {} // ignore les erreurs de scan en continu
      ).catch((err) => {
        setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
        setScanning(false)
      })
    }, 100)
  }

  // Arrête le scan
  const stopScan = () => {
    const html5QrCode = html5QrCodeRef.current as { stop: () => Promise<void> } | null
    if (html5QrCode) {
      html5QrCode.stop().catch(() => {})
    }
    setScanning(false)
  }

  // Recherche l'article par SKU ou code-barres
  const searchItem = async (code: string) => {
    setError(null)
    try {
      const res = await fetch('/api/stock')
      if (!res.ok) throw new Error('Erreur')
      const items: StockItem[] = await res.json()
      const found = items.find(i =>
        i.sku === code ||
        i.sku.toLowerCase() === code.toLowerCase() ||
        i.barcode === code
      )
      if (found) {
        setFoundItem(found)
      } else {
        setError(`Aucun article trouvé pour : ${code}`)
      }
    } catch {
      setError('Erreur lors de la recherche')
    }
  }

  const searchManual = () => {
    if (manualSku.trim()) {
      searchItem(manualSku.trim())
    }
  }

  if (status === 'loading') {
    return <div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>
  }

  if (!session) return null

  return (
    <div className="min-h-screen bg-background p-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-600" />
            Scan QR Code
          </h1>
          <p className="text-xs text-muted-foreground">Scannez un article en friperie</p>
        </div>
      </div>

      {/* Zone de scan */}
      {!foundItem && (
        <Card className="mb-4">
          <CardContent className="p-4">
            {!scanning ? (
              <div className="text-center py-8">
                <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-4">
                  <Camera className="h-10 w-10 text-emerald-600" />
                </div>
                <p className="text-sm font-medium mb-1">Scannez le QR code d'un article</p>
                <p className="text-xs text-muted-foreground mb-4">
                  La caméra s'ouvre pour lire le QR code collé sur l'article
                </p>
                <Button onClick={startScan} size="lg" className="w-full">
                  <Camera className="h-5 w-5 mr-2" /> Démarrer le scan
                </Button>
              </div>
            ) : (
              <div>
                <div id={scannerDivId} className="w-full rounded-lg overflow-hidden bg-black mb-3" style={{ minHeight: '300px' }} />
                <Button variant="outline" onClick={stopScan} className="w-full">
                  <X className="h-4 w-4 mr-2" /> Annuler
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Saisie manuelle */}
      {!foundItem && !scanning && (
        <Card className="mb-4">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-2">Ou saisissez le SKU manuellement :</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualSku}
                onChange={e => setManualSku(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchManual()}
                placeholder="RL-POLO-00125"
                className="flex-1 px-3 py-2 rounded-md border bg-background text-sm font-mono"
              />
              <Button onClick={searchManual}>Rechercher</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Erreur */}
      {error && (
        <Card className="border-rose-300 dark:border-rose-800 mb-4">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-rose-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => { setError(null); setManualSku('') }}>
              Réessayer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Résultat — Article trouvé */}
      {foundItem && (
        <div className="space-y-4">
          {/* Photo */}
          {(() => {
            try {
              const photos = JSON.parse(foundItem.photos)
              return photos[0] ? (
                <div className="aspect-[4/3] w-full rounded-xl overflow-hidden bg-muted">
                  <img src={photos[0]} alt={foundItem.brand} className="w-full h-full object-cover" />
                </div>
              ) : null
            } catch { return null }
          })()}

          {/* Infos principales */}
          <Card className="border-emerald-300 dark:border-emerald-800">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{foundItem.sku}</p>
                  <h2 className="text-2xl font-bold">{foundItem.brand}</h2>
                  <p className="text-sm text-muted-foreground">
                    {foundItem.category} · {foundItem.size} · {foundItem.color}
                  </p>
                </div>
                <Badge className={cn(
                  'text-xs',
                  foundItem.status === 'VENDU' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                )}>
                  {foundItem.status}
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 text-center">
                  <Package className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase">Coût achat</p>
                  <p className="text-lg font-bold">{formatEUR(foundItem.purchaseCost)}</p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-center">
                  <Euro className="h-4 w-4 mx-auto text-emerald-600 mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase">Prix conseillé</p>
                  <p className="text-lg font-bold text-emerald-600">
                    {foundItem.suggestedPrice ? formatEUR(foundItem.suggestedPrice) : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-950/30 text-center">
                  <TrendingUp className="h-4 w-4 mx-auto text-violet-600 mb-1" />
                  <p className="text-[10px] text-muted-foreground uppercase">Profit estimé</p>
                  <p className="text-lg font-bold text-violet-600">
                    {foundItem.suggestedPrice
                      ? formatEUR(foundItem.suggestedPrice - foundItem.purchaseCost)
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Emplacement */}
              {foundItem.rack && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                  <MapPin className="h-3 w-3" />
                  <span>{foundItem.warehouse} · {foundItem.rack} · Ét. {foundItem.shelf} · Bac {foundItem.bin}</span>
                </div>
              )}

              {/* Vente si vendu */}
              {foundItem.sales && foundItem.sales.length > 0 && (
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 uppercase font-semibold mb-1">
                    Vendu ({foundItem.sales.length} unité{foundItem.sales.length > 1 ? 's' : ''})
                  </p>
                  <div className="flex justify-between text-sm">
                    <span>Prix de vente (dernier)</span>
                    <span className="font-bold">{formatEUR(foundItem.sales[0].salePrice)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Bénéfice total</span>
                    <span className="font-bold text-emerald-600">{formatEUR(foundItem.sales.reduce((s: number, sl: any) => s + sl.profit, 0))}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => { setFoundItem(null); setManualSku('') }}>
              <QrCode className="h-4 w-4 mr-2" /> Scanner un autre
            </Button>
            <Button className="flex-1" onClick={() => router.push('/')}>
              Retour au dashboard
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
