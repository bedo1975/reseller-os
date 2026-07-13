'use client'

import Link from 'next/link'
import { Truck } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

export default function LivraisonRapidePage() {
  const settings = useBoutiqueSettings()

  const title = settings.trustPageShippingTitle || 'Livraison rapide'
  const content = settings.trustPageShippingContent || `<div class="space-y-6">
  <h2 class="text-2xl font-bold mb-4">Expédition rapide et soignée</h2>
  <p class="text-gray-700">Toutes nos commandes sont préparées et expédiées sous 48h ouvrées (du lundi au vendredi). Vous recevez un email avec le numéro de suivi dès l'expédition de votre colis.</p>

  <h3 class="text-xl font-semibold mt-6">Modes de livraison</h3>
  <ul class="list-disc list-inside space-y-2 text-gray-700">
    <li><strong>Standard (3 à 5 jours ouvrés)</strong> — lettre suivie ou Colissimo, selon le poids</li>
    <li><strong>Suivi (2 à 3 jours ouvrés)</strong> — Colissimo suivi, remis en boîte aux lettres ou en point relais</li>
    <li><strong>Retrait sur place</strong> — sur rendez-vous, gratuit</li>
  </ul>

  <h3 class="text-xl font-semibold mt-6">Frais de livraison</h3>
  <p class="text-gray-700">Les frais sont calculés automatiquement selon le poids de votre commande et affichés lors du checkout. Livraison offerte dès 50€ d'achat.</p>

  <h3 class="text-xl font-semibold mt-6">Préparation de votre colis</h3>
  <p class="text-gray-700">Chaque article est soigneusement inspecté, plié et emballé dans un emballage adapté. Nous ajoutons un bon de préparation détaillé pour vous permettre de vérifier votre commande facilement.</p>

  <h3 class="text-xl font-semibold mt-6">Suivi de commande</h3>
  <p class="text-gray-700">Dès l'expédition, vous recevez un email contenant votre numéro de suivi. Vous pouvez suivre votre colis en temps réel sur le site du transporteur.</p>

  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
    <p class="text-sm text-blue-800"><strong>Bon à savoir :</strong> les délais sont indicatifs et peuvent varier en période de fêtes ou de promotions. Nous vous tenons informé en cas de retard.</p>
  </div>
</div>`

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/boutique" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <Truck className="h-6 w-6 text-[#007bff]" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>

      <div
        className="prose prose-sm max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <div className="mt-8 text-center">
        <Link href="/boutique" className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted">
          Retour à la boutique
        </Link>
      </div>
    </div>
  )
}
