'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { Loader2, Send, Mail, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

export default function ContactPage() {
  const router = useRouter()
  const settings = useBoutiqueSettings()
  const [loggedIn, setLoggedIn] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ subject: '', body: '' })

  useEffect(() => {
    fetch('/api/boutique/client/me')
      .then(r => { setLoggedIn(r.ok); return r.ok ? r.json() : null })
      .then(() => {})
      .catch(() => {})
  }, [])

  const submit = async () => {
    if (!form.subject.trim() || !form.body.trim()) {
      toast.error('Sujet et message requis')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/boutique/client/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || 'Erreur')
        return
      }
      toast.success('Message envoyé ! Nous vous répondrons rapidement.')
      router.push('/compte/messages')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setSending(false)
    }
  }

  const primaryColor = '#' + settings.primaryColor

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Contact</span>
      </nav>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">{settings.contactTitle}</h1>
      <p className="text-gray-600 mb-8">{settings.contactSubtitle}</p>

      {loggedIn ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="subject">Sujet</Label>
            <Input
              id="subject"
              value={form.subject}
              onChange={e => setForm({ ...form, subject: e.target.value })}
              placeholder="Question sur ma commande, retour, etc."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="body">Message</Label>
            <Textarea
              id="body"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              rows={6}
              placeholder="Votre message..."
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={submit} disabled={sending} style={{ backgroundColor: primaryColor }}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {sending ? 'Envoi...' : 'Envoyer le message'}
            </Button>
          </div>
          <p className="text-xs text-gray-400 text-center">Votre message sera envoyé à notre équipe. Vous recevrez la réponse dans votre messagerie.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <Mail className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Connectez-vous pour envoyer un message</p>
          <p className="text-sm text-gray-400 mb-6">Vous devez avoir un compte pour utiliser le formulaire de contact.</p>
          <Link
            href="/connexion"
            className="inline-flex items-center gap-2 text-white font-semibold px-6 py-3 rounded-lg"
            style={{ backgroundColor: primaryColor }}
          >
            Se connecter / S'inscrire
          </Link>
        </div>
      )}
    </div>
  )
}
