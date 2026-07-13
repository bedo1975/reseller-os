'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Store, Loader2, ShieldCheck, Rocket, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function SetupPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/users/count', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if ((data.count ?? 0) > 0) {
          router.replace('/login')
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.password) {
      toast.error('Tous les champs sont requis')
      return
    }
    if (form.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }
    if (form.password !== form.confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/users/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la configuration')
      }
      toast.success('Administrateur créé avec succès ! Vous pouvez vous connecter.')
      setTimeout(() => router.push('/login'), 600)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 dark:from-emerald-950/30 dark:via-background dark:to-emerald-950/20 p-4">
      <div className="w-full max-w-md">
        {/* Logo header */}
        <div className="flex flex-col items-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-3">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Configuration initiale</h1>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Créez le compte administrateur pour démarrer avec Reseller OS.
          </p>
        </div>

        <Card className="border-emerald-100 dark:border-emerald-900/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Premier administrateur
            </CardTitle>
            <CardDescription>
              Ce compte aura accès à tous les modules, y compris la fiscalité et la rentabilité.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium">Nom complet</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Jean Dupont"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@reseller.fr"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Au moins 8 caractères"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
                <p className="text-[11px] text-muted-foreground">
                  8 caractères minimum. Choisissez un mot de passe robuste.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs font-medium">Confirmer le mot de passe</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  value={form.confirm}
                  onChange={e => setForm({ ...form, confirm: e.target.value })}
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Création...</>
                ) : (
                  <>Créer l&apos;administrateur <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t text-center">
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
                <Store className="h-3 w-3" />
                Reseller OS · Setup wizard
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
