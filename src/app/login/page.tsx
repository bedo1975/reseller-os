'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from '@/components/ui/card'
import { Store, Loader2, LogIn, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [userCount, setUserCount] = useState<number | null>(null)

  useEffect(() => {
    // Check if any users exist — if not, redirect to /setup
    fetch('/api/users/count', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        setUserCount(data.count ?? 0)
        if ((data.count ?? 0) === 0) {
          router.replace('/setup')
        }
      })
      .catch(() => setUserCount(0))
      .finally(() => setChecking(false))
  }, [router])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      toast.error('Email et mot de passe requis')
      return
    }
    setLoading(true)
    try {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        toast.error('Identifiants incorrects')
      } else if (res?.ok) {
        toast.success('Connexion réussie')
        router.push('/')
        router.refresh()
      } else {
        toast.error('Erreur de connexion')
      }
    } catch {
      toast.error('Erreur réseau')
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
            <Store className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Reseller OS</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-plateformes · Vinted, Leboncoin, eBay, Vestiaire</p>
        </div>

        <Card className="border-emerald-100 dark:border-emerald-900/50 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <LogIn className="h-5 w-5 text-emerald-600" />
              Connexion
            </CardTitle>
            <CardDescription>
              Entrez vos identifiants pour accéder à votre espace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.fr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Mot de passe</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connexion...</>
                ) : (
                  <>Se connecter <ArrowRight className="h-4 w-4 ml-2" /></>
                )}
              </Button>
            </form>

            {userCount === 0 && (
              <div className="mt-4 pt-4 border-t text-center">
                <p className="text-xs text-muted-foreground">
                  Premier lancement ?{' '}
                  <Link href="/setup" className="text-emerald-600 hover:text-emerald-700 font-medium">
                    Configurer l&apos;administrateur
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground mt-6">
          v1.0 · Next.js 16 · Prisma · NextAuth
        </p>
      </div>
    </div>
  )
}
