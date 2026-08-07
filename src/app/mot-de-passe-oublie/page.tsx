'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !email.includes('@')) {
      toast.error('Veuillez saisir un email valide')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/client/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      setSent(true)
      toast.success('Email envoyé si le compte existe')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email envoyé !</h1>
          <p className="text-gray-600">
            Si un compte existe avec l'email <strong>{email}</strong>, vous recevrez un lien de réinitialisation.
          </p>
          <p className="text-sm text-gray-400 mt-2">Vérifiez votre dossier spam si vous ne recevez rien.</p>
        </div>
        <div className="text-center">
          <Link href="/connexion">
            <Button variant="outline">Retour à la connexion</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/connexion" className="hover:text-[#007bff]">Connexion</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Mot de passe oublié</span>
      </nav>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Mail className="h-8 w-8 text-[#007bff]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe oublié</h1>
        <p className="text-gray-600 text-sm">
          Saisissez votre adresse email. Vous recevrez un lien pour réinitialiser votre mot de passe.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-1.5">
          <Label htmlFor="email">Adresse email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="votre@email.com"
            required
            autoFocus
          />
        </div>
        <Button type="submit" className="w-full bg-[#007bff] hover:bg-[#0056b3]" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Envoi en cours…</>
          ) : (
            <><Mail className="h-4 w-4 mr-2" /> Envoyer le lien</>
          )}
        </Button>
      </form>

      <p className="text-center mt-4 text-sm text-gray-500">
        <Link href="/connexion" className="text-[#007bff] hover:underline">← Retour à la connexion</Link>
      </p>
    </div>
  )
}
