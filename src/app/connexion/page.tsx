'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, User, Mail, Lock, Phone, MailCheck, CheckCircle2, XCircle, Shield } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'



function ConnexionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', phone: '',
  })

  const [rgpdAccepted, setRgpdAccepted] = useState(false)
  const [rgpdPopupOpen, setRgpdPopupOpen] = useState(false)


  // When set: show the "check your email" panel instead of the form
  const [pendingValidationEmail, setPendingValidationEmail] = useState<string | null>(null)
  // Validation result from the email link (GET /api/boutique/client/validate-account redirects here)
  const [validationResult, setValidationResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    // Read validation result from URL params (set by the GET validate-account API)
    const validated = searchParams.get('validated')
    const validationError = searchParams.get('validation_error')
    if (validated === '1') {
      setValidationResult('success')
      toast.success('Votre compte a été validé avec succès ! Vous pouvez maintenant vous connecter.')
      // Clean the URL (remove the query param) so a refresh doesn't re-trigger the toast
      router.replace('/connexion')
    } else if (validationError === '1') {
      setValidationResult('error')
      toast.error('Lien de validation invalide ou déjà utilisé.')
      router.replace('/connexion')
    }
  }, [searchParams, router])

  useEffect(() => {
    // If already logged in, redirect to account
    fetch('/api/boutique/client/me').then(r => {
      if (r.ok) router.push('/compte')
    })
  }, [router])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const submit = async () => {

      if (mode === 'register' && !rgpdAccepted) {
      toast.error('Vous devez accepter la politique de confidentialité pour vous inscrire.')
      return
    }

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
        // Special case: account not validated
        if (data.needsValidation && data.clientEmail) {
          setPendingValidationEmail(data.clientEmail)
          setMode('login')
        }
        toast.error(data.error || 'Erreur')
        setLoading(false)
        return
      }

      if (mode === 'register') {
        // Registration succeeded — show "check your email" panel for confirmation,
        // but the account is already usable (login will auto-validate).
        if (data.needsValidation) {
          setPendingValidationEmail(data.clientEmail || form.email)
          toast.success('Compte créé ! Un email de confirmation vous a été envoyé.')
        } else {
          toast.success('Compte créé')
          router.push('/compte')
          router.refresh()
        }
      } else {
        toast.success('Connexion réussie')
        router.push('/compte')
        router.refresh()
      }
    } catch {
      toast.error('Erreur réseau')
      setLoading(false)
    }
  }

  const resendValidation = async () => {
    if (!pendingValidationEmail) return
    setResending(true)
    try {
      const res = await fetch('/api/boutique/client/resend-validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingValidationEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        toast.success('Email de validation renvoyé ! Vérifiez votre boîte de réception (et vos spams).')
      } else {
        toast.error(data.error || 'Erreur lors de l\'envoi')
      }
    } catch {
      toast.error('Erreur réseau')
    } finally {
      setResending(false)
    }
  }

  // ── Validation success screen ──────────────────────────────────────────
  if (validationResult === 'success') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
          <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Compte validé ! 🎉</h1>
          <p className="text-sm text-gray-600 mb-6">
            Votre adresse email a été validée avec succès. Vous pouvez maintenant vous connecter
            à votre compte.
          </p>
          <Button
            onClick={() => setValidationResult(null)}
            className="w-full h-11 bg-[#007bff] hover:bg-[#0056b3]"
          >
            Se connecter
          </Button>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-gray-500 hover:text-[#007bff]">
              ← Continuer sans compte
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Validation error screen ────────────────────────────────────────────
  if (validationResult === 'error') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-sm text-gray-600 mb-6">
            Le lien de validation est invalide, a déjà été utilisé, ou a expiré.
            Si vous n&apos;arrivez pas à valider votre compte, vous pouvez renvoyer un email de validation.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => {
                setValidationResult(null)
                setMode('register')
              }}
              variant="outline"
              className="w-full h-11"
            >
              Renvoyer un email de validation
            </Button>
            <Button
              onClick={() => setValidationResult(null)}
              variant="ghost"
              className="w-full h-11"
            >
              Retour à la connexion
            </Button>
          </div>
          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-gray-500 hover:text-[#007bff]">
              ← Continuer sans compte
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Pending validation screen ──────────────────────────────────────────
  if (pendingValidationEmail) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center">
          <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <MailCheck className="h-10 w-10 text-[#007bff]" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Vérifiez vos emails</h1>
          <p className="text-sm text-gray-600 mb-6">
            Un email de confirmation a été envoyé à :
          </p>
          <p className="text-sm font-semibold text-gray-900 mb-4 break-all">{pendingValidationEmail}</p>
          <p className="text-sm text-gray-600 mb-6">
            Cliquez sur le lien dans l&apos;email pour confirmer votre adresse. Vous pouvez aussi
            vous connecter directement avec vos identifiants — votre compte est déjà actif.
          </p>

          <div className="space-y-2">
            <Button
              onClick={() => {
                setPendingValidationEmail(null)
                setForm(prev => ({ ...prev, password: '' }))
              }}
              className="w-full h-11 bg-[#007bff] hover:bg-[#0056b3]"
            >
              Se connecter maintenant
            </Button>
            <Button
              onClick={resendValidation}
              disabled={resending}
              variant="outline"
              className="w-full h-11"
            >
              {resending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {resending ? 'Envoi…' : 'Renvoyer l\'email de confirmation'}
            </Button>
          </div>

          <div className="mt-6 text-center">
            <Link href="/" className="text-xs text-gray-500 hover:text-[#007bff]">
              ← Continuer sans compte
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Standard login/register form ───────────────────────────────────────
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Mot de passe *</Label>
              {mode === 'login' && (
                <Link href="/mot-de-passe-oublie" className="text-xs text-[#007bff] hover:underline">
                  Mot de passe oublié ?
                </Link>
              )}
            </div>
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
              <p className="text-[11px] text-gray-400">
                6 caractères minimum. Un email de confirmation vous sera envoyé à l&apos;inscription.
              </p>
            )}
          </div>
       
          {mode === 'register' && (
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rgpdAccepted}
                  onChange={e => setRgpdAccepted(e.target.checked)}
                  className="rounded mt-0.5 shrink-0"
                />
                <span>
                  J'ai lu et j'accepte la{' '}
                  <button
                    type="button"
                    onClick={() => setRgpdPopupOpen(true)}
                    className="text-[#007bff] underline inline-flex items-center gap-0.5"
                  >
                    <Shield className="h-3 w-3" /> politique de confidentialité
                  </button>{' '}
                  et le traitement de mes données personnelles conformément au RGPD.
                </span>
              </label>
            </div>
          )}

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
          <Link href="/" className="text-xs text-gray-500 hover:text-[#007bff]">
            ← Continuer sans compte
          </Link>
        </div>
      </div>

            <Dialog open={rgpdPopupOpen} onOpenChange={setRgpdPopupOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#007bff]" />
              Protection de vos données — RGPD
            </DialogTitle>
            <DialogDescription>
              Informations sur le traitement de vos données personnelles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600 py-2">
            <p><strong>Inscription et compte client :</strong> vos données (prénom, nom, email, téléphone) sont utilisées pour gérer votre compte, traiter vos commandes et vous contacter si nécessaire.</p>
            <p><strong>Commandes :</strong> votre adresse de livraison est transmise au transporteur pour l'expédition. Vos données bancaires sont traitées directement par notre prestataire de paiement — nous ne stockons jamais vos numéros de carte.</p>
            <p><strong>Statistiques :</strong> nous collectons anonymement des données de visite pour améliorer notre boutique.</p>
            <p><strong>Cookies :</strong> cookies essentiels (panier, authentification) et cookies de mesure d'audience (avec votre consentement).</p>
            <p><strong>Vos droits :</strong> accès, rectification, effacement, opposition, portabilité.</p>
            <p><strong>Conservation :</strong> 3 ans après votre dernière activité (10 ans pour les factures).</p>
            <div className="pt-2 border-t">
              <Link href="/politique-confidentialite" target="_blank" className="text-[#007bff] underline font-medium">
                Politique de confidentialité complète →
              </Link>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" size="sm" onClick={() => setRgpdPopupOpen(false)}>Fermer</Button>
            <Button size="sm" onClick={() => { setRgpdAccepted(true); setRgpdPopupOpen(false) }} className="bg-[#007bff]">
              J'accepte
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function ConnexionPage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <Loader2 className="h-8 w-8 text-[#007bff] animate-spin mx-auto" />
      </div>
    }>
      <ConnexionPageContent />
    </Suspense>
  )
}
