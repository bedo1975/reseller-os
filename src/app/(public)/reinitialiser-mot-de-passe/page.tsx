'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, ChevronRight, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('Lien de réinitialisation invalide')
      return
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    if (password !== confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/boutique/client/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Erreur')
        return
      }
      setDone(true)
      toast.success('Mot de passe modifié avec succès !')
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Mot de passe modifié !</h1>
          <p className="text-gray-600">
            Votre mot de passe a été modifié avec succès. Un email de confirmation vous a été envoyé.
          </p>
        </div>
        <div className="text-center">
          <Link href="/connexion">
            <Button className="bg-[#007bff] hover:bg-[#0056b3]">Se connecter</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-16 w-16 text-red-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h1>
        <p className="text-gray-500 mb-6">Ce lien de réinitialisation est invalide ou a expiré.</p>
        <Link href="/mot-de-passe-oublie">
          <Button variant="outline">Demander un nouveau lien</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <nav className="flex items-center gap-1 text-sm text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#007bff]">Accueil</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-gray-900">Réinitialiser le mot de passe</span>
      </nav>

      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <Lock className="h-8 w-8 text-[#007bff]" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Nouveau mot de passe</h1>
        <p className="text-gray-600 text-sm">Choisissez un nouveau mot de passe pour votre compte.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white border border-gray-200 rounded-lg p-6">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nouveau mot de passe *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Minimum 6 caractères</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmer le mot de passe *</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>
        <Button type="submit" className="w-full bg-[#007bff] hover:bg-[#0056b3]" disabled={loading}>
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Modification…</>
          ) : (
            <><Lock className="h-4 w-4 mr-2" /> Modifier mon mot de passe</>
          )}
        </Button>
      </form>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="max-w-md mx-auto px-4 py-12"><Skeleton className="h-64" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  )
}
