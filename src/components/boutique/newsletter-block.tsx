'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, CheckCircle2, Loader2 } from 'lucide-react'

interface NewsletterBlockProps {
  settings: {
    newsletterTitle: string
    newsletterSubtitle: string
    newsletterButtonText: string
    newsletterPlaceholder: string
    newsletterSuccessMessage: string
    newsletterColor: string
  }
}

export function NewsletterBlock({ settings }: NewsletterBlockProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      setError('Veuillez saisir un email valide')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/boutique/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur')
        return
      }

      setSuccess(true)
      setEmail('')
      setTimeout(() => setSuccess(false), 5000)
    } catch {
      setError('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  const accentColor = settings.newsletterColor || '#007bff'

  return (
    <div className="w-full py-12 px-4" style={{ backgroundColor: `${accentColor}0d` }}>
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon */}
        <div
          className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
          style={{ backgroundColor: `${accentColor}1a` }}
        >
          <Mail className="h-7 w-7" style={{ color: accentColor }} />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {settings.newsletterTitle}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {settings.newsletterSubtitle}
        </p>

        {/* Form */}
        {success ? (
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200 max-w-md mx-auto">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-700 font-medium">
              {settings.newsletterSuccessMessage}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-2 max-w-md mx-auto">
            <Input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }}
              placeholder={settings.newsletterPlaceholder}
              className="flex-1 h-11"
              disabled={loading}
              required
            />
            <Button
              type="submit"
              disabled={loading}
              className="h-11 px-6 text-white"
              style={{ backgroundColor: accentColor, borderColor: accentColor }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                settings.newsletterButtonText
              )}
            </Button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}

        {/* RGPD note */}
        <p className="text-[11px] text-gray-400 mt-4 max-w-md mx-auto">
          En vous inscrivant, vous acceptez de recevoir nos emails. Vous pouvez vous désinscrire à tout moment via le lien présent dans chaque email.
        </p>
      </div>
    </div>
  )
}
