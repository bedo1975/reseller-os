'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'

function ValiderCompteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMessage('Lien de validation invalide — aucun token fourni.')
      return
    }

    const validate = async () => {
      try {
        const res = await fetch('/api/boutique/client/validate-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json()

        if (res.ok && data.ok) {
          setStatus('success')
        } else {
          setStatus('error')
          setErrorMessage(data.error || 'Lien de validation invalide ou expiré.')
        }
      } catch (e) {
        setStatus('error')
        setErrorMessage('Erreur réseau. Veuillez réessayer.')
      }
    }

    validate()
  }, [token])

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 text-[#007bff] animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Validation en cours…</h1>
            <p className="text-sm text-gray-500">Veuillez patienter pendant que nous validons votre compte.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Compte validé ! 🎉</h1>
            <p className="text-sm text-gray-600 mb-6">
              Votre adresse email a été validée avec succès. Vous pouvez maintenant vous connecter
              à votre compte et profiter de toutes nos fonctionnalités.
            </p>
            <Button
              onClick={() => router.push('/boutique/connexion')}
              className="w-full h-11 bg-[#007bff] hover:bg-[#0056b3]"
            >
              Se connecter
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h1>
            <p className="text-sm text-gray-600 mb-6">{errorMessage}</p>
            <div className="space-y-2">
              <Button
                onClick={() => router.push('/boutique/connexion')}
                variant="outline"
                className="w-full h-11"
              >
                Aller à la page de connexion
              </Button>
              <Link
                href="/boutique"
                className="block text-xs text-gray-500 hover:text-[#007bff] mt-3"
              >
                ← Retour à la boutique
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function ValiderComptePage() {
  return (
    <Suspense fallback={
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Loader2 className="h-8 w-8 text-[#007bff] animate-spin mx-auto" />
      </div>
    }>
      <ValiderCompteContent />
    </Suspense>
  )
}
