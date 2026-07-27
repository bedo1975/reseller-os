'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Mail, Send, Loader2, CheckCircle2, Gift } from 'lucide-react'
import { toast } from 'sonner'

interface ShareModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: {
    sku: string
    brand: string
    title?: string | null
    mainPhoto?: string | null
    price?: number | null
  }
  settings: {
    shareColor: string
    shareButtonText: string
    shareCollectEmails: boolean
  }
}

export function ShareModal({ open, onOpenChange, product, settings }: ShareModalProps) {
  const [friendEmail, setFriendEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)

  const accentColor = settings.shareColor || '#007bff'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!friendEmail.trim() || !friendEmail.includes('@')) {
      toast.error('Veuillez saisir un email valide pour votre ami')
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/boutique/share/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: product.sku,
          friendEmail: friendEmail.trim(),
          senderName: senderName.trim() || undefined,
          senderEmail: senderEmail.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur lors de l\'envoi')
        return
      }
      setSuccess(true)
      if (data.warning) {
        toast.warning(data.warning)
      } else {
        toast.success('Article partagé avec succès !')
      }
      // Reset for next time but keep success state visible
      setFriendEmail('')
      setSenderName('')
      setSenderEmail('')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset state when closing
      setTimeout(() => {
        setSuccess(false)
        setFriendEmail('')
        setSenderName('')
        setSenderEmail('')
      }, 200)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0" style={{ ['--share-color' as string]: accentColor }}>
        {/* Header with colored gradient */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)` }}
        >
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Gift className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">Partager cet article</DialogTitle>
                <DialogDescription className="text-white/80 text-xs">
                  Recommandez cet article à un ami par email
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Email envoyé !</h3>
            <p className="text-sm text-gray-500 mb-6">
              Votre ami recevra un email avec le lien vers cet article. Merci de partager !
            </p>
            <Button
              onClick={() => handleOpenChange(false)}
              className="w-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              Fermer
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
            {/* Product preview */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="h-14 w-14 rounded-md overflow-hidden bg-gray-200 shrink-0">
                {product.mainPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.mainPhoto} alt={product.brand} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gift className="h-5 w-5 text-gray-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">{product.brand}</p>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {product.title || product.brand}
                </p>
                {product.price != null && (
                  <p className="text-sm font-semibold" style={{ color: accentColor }}>
                    {product.price.toFixed(2)} €
                  </p>
                )}
              </div>
            </div>

            {/* Friend email (required) */}
            <div className="space-y-1.5">
              <Label htmlFor="friendEmail" className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" style={{ color: accentColor }} />
                Email de votre ami *
              </Label>
              <Input
                id="friendEmail"
                type="email"
                value={friendEmail}
                onChange={e => setFriendEmail(e.target.value)}
                placeholder="ami@email.com"
                required
                className="focus-visible:ring-1"
                style={{ ['--tw-ring-color' as string]: accentColor }}
                autoFocus
              />
            </div>

            {/* Sender info (optional) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="senderName" className="text-xs">Votre nom (optionnel)</Label>
                <Input
                  id="senderName"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="senderEmail" className="text-xs">Votre email (optionnel)</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="vous@email.com"
                />
              </div>
            </div>

            {/* Privacy notice */}
            {settings.shareCollectEmails && (
              <p className="text-[10px] text-gray-400 leading-relaxed">
                En utilisant ce formulaire, vous acceptez que l'email de votre ami soit collecté par notre boutique
                à des fins marketing. Vos informations ne seront pas utilisées à des fins commerciales sans consentement.
              </p>
            )}

            <DialogFooter className="gap-2 sm:gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={sending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={sending || !friendEmail.trim()}
                className="text-white gap-2"
                style={{ backgroundColor: accentColor, borderColor: accentColor }}
              >
                {sending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Envoi...</>
                ) : (
                  <><Send className="h-4 w-4" /> Envoyer</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
