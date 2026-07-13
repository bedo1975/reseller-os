'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, User, Mail, Lock, Phone } from 'lucide-react'
import { toast } from 'sonner'

export default function ConnexionPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '',
  })

  useEffect(() => {
    // If already logged in, redirect to account
    fetch('/api/boutique/client/me').then(r => {
      if (r.ok) router.push('/boutique/compte')
    })
  }, [router])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/boutique/client/login' : '/api/boutique/client/register'
      const payload = mode === 'login'
        ? { email: form.email, password: form.password }
        : form

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        setLoading(false)
        return
      }
      toast.success(mode === 'login' ? 'Connexion réussie' : 'Compte créé')
      router.push('/boutique/compte')
      router.refresh()
    } catch {
      toast.error('Erreur réseau')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {mode === 'login' ? 'Connexion' : 'Créer un compte'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {mode === 'login'
            ? 'Accédez à votre compte et vos commandes.'
            : 'Profitez d\'une expérience d\'achat personnalisée.'}
        </p>

        {/* Toggle */}
        <div className="flex border border-gray-200 rounded-md mb-6">
          <button
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium rounded-l-md transition-colors ${
              mode === 'login' ? 'bg-[#007bff] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Connexion
          </button>
          <button
            onClick={() => setMode('register')}
            className={`flex-1 py-2 text-sm font-medium rounded-r-md transition-colors ${
              mode === 'register' ? 'bg-[#007bff] text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Inscription
          </button>
        </div>

        <div className="space-y-4">
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">Prénom *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={e => set('firstName', e.target.value)}
                    className="pl-9"
                    placeholder="Jean"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Nom *</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={e => set('lastName', e.target.value)}
                  placeholder="Dupont"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="pl-9"
                placeholder="jean@exemple.fr"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div className="space-y-1.5">
              <Label htmlFor="phone">Téléphone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={e => set('phone', e.target.value)}
                  className="pl-9"
                  placeholder="06 12 34 56 78"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe *</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                className="pl-9"
                placeholder="••••••••"
                onKeyDown={e => { if (e.key === 'Enter') submit() }}
              />
            </div>
            {mode === 'register' && (
              <p className="text-[11px] text-gray-400">6 caractères minimum</p>
            )}
          </div>

          <Button
            onClick={submit}
            disabled={loading}
            className="w-full h-11 bg-[#007bff] hover:bg-[#0056b3]"
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </Button>
        </div>

        <div className="mt-6 text-center">
          <Link href="/boutique" className="text-xs text-gray-500 hover:text-[#007bff]">
            ← Continuer sans compte
          </Link>
        </div>
      </div>
    </div>
  )
}
