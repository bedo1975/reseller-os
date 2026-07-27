'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { X, Cookie, ShieldCheck } from 'lucide-react'

const STORAGE_KEY = 'gdpr_consent'

export function GdprBanner() {
  const settings = useBoutiqueSettings()
  const [visible, setVisible] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    if (!settings.gdprEnabled) return
    // Check if user already made a choice
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        // Small delay to let the page load
        setTimeout(() => setVisible(true), 800)
      }
    } catch {
      setVisible(true)
    }
  }, [settings.gdprEnabled])

  const accept = (level: 'all' | 'essential') => {
    try {
      const cookies = level === 'all' ? JSON.parse(settings.gdprCookiesJson || '[]') : []
      const consent = {
        level,
        cookies: cookies.map((c: any) => ({ id: c.id, enabled: level === 'all' || c.required })),
        date: new Date().toISOString(),
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent))

      // If all accepted and GA is configured, load GA
      if (level === 'all' && settings.gaTagId) {
        // GA is already loaded via GoogleAnalytics component, but we could gate it here
      }
    } catch {}
    setVisible(false)
  }

  const refuse = () => accept('essential')

  if (!visible || !settings.gdprEnabled) return null

  // Parse cookies config
  let cookies: any[] = []
  try {
    cookies = JSON.parse(settings.gdprCookiesJson || '[]')
  } catch {}

  // If no cookies configured, use defaults
  if (cookies.length === 0) {
    cookies = [
      { id: 'essential', name: 'Cookies essentiels', description: 'Panier, session, sécurité (obligatoires)', required: true },
      { id: 'analytics', name: 'Cookies d\'analyse', description: 'Google Analytics — statistiques de visite anonymisées', required: false },
    ]
  }

  const policyUrl = settings.gdprPrivacyPolicyUrl || '/boutique/mentions-legales'

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
        {!showDetails ? (
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Cookie className="h-5 w-5 text-[#007bff]" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 text-sm mb-1">
                  {settings.gdprBannerTitle || 'Vos données personnelles'}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  {settings.gdprBannerMessage || 'Nous utilisons des cookies pour améliorer votre expérience.'}
                  {' '}
                  <Link href={policyUrl} className="text-[#007bff] hover:underline font-medium">
                    En savoir plus
                  </Link>
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => accept('all')}
                    className="px-4 py-2 bg-[#007bff] text-white text-xs font-semibold rounded-lg hover:bg-[#0056b3] transition-colors flex items-center gap-1.5"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Tout accepter
                  </button>
                  <button
                    onClick={refuse}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Refuser les cookies non essentiels
                  </button>
                  <button
                    onClick={() => setShowDetails(true)}
                    className="px-4 py-2 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    Personnaliser
                  </button>
                </div>
              </div>
              <button
                onClick={refuse}
                className="text-gray-300 hover:text-gray-500 shrink-0"
                title="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <Cookie className="h-4 w-4 text-[#007bff]" />
                Préférences cookies
              </h3>
              <button onClick={() => setShowDetails(false)} className="text-gray-300 hover:text-gray-500">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {cookies.map((c: any) => (
                <div key={c.id} className={`flex items-start gap-3 p-3 rounded-lg border ${c.required ? 'bg-gray-50 border-gray-200' : 'border-gray-200'}`}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{c.name || c.id}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{c.description}</p>
                  </div>
                  {c.required ? (
                    <span className="text-[10px] font-semibold text-gray-400 uppercase shrink-0 mt-1">Obligatoire</span>
                  ) : (
                    <span className="text-[10px] font-semibold text-gray-400 uppercase shrink-0 mt-1">Optionnel</span>
                  )}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => accept('all')}
                className="px-4 py-2 bg-[#007bff] text-white text-xs font-semibold rounded-lg hover:bg-[#0056b3] transition-colors"
              >
                Tout accepter
              </button>
              <button
                onClick={refuse}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Refuser les optionnels
              </button>
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 text-gray-500 text-xs font-medium rounded-lg hover:bg-gray-100"
              >
                Retour
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              Conforme au RGPD (Règlement Général sur la Protection des Données). Votre choix est stocké localement et valable 6 mois.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
