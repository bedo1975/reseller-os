'use client'

import Link from 'next/link'
import { Shield } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { Skeleton } from '@/components/ui/skeleton'

export default function PaiementSecurisePage() {
  const settings = useBoutiqueSettings()

  const title = settings.trustPagePaymentTitle || 'Paiement sécurisé'
  const content = settings.trustPagePaymentContent || `<div class="space-y-6">
  <h2 class="text-2xl font-bold mb-4">Vos paiements sont 100% sécurisés</h2>
  <p class="text-gray-700">Nous utilisons les services de paiement les plus reconnus du marché pour protéger vos transactions. Toutes vos informations bancaires sont chiffrées et ne transitent jamais par nos serveurs.</p>
  <h3 class="text-xl font-semibold mt-6">Stripe</h3>
  <p class="text-gray-700">Stripe est certifié PCI DSS Level 1, le plus haut niveau de sécurité pour le traitement des paiements. Vos données de carte bancaire sont chiffrées en SSL et ne sont jamais stockées sur nos serveurs.</p>
  <h3 class="text-xl font-semibold mt-6">PayPal</h3>
  <p class="text-gray-700">PayPal protège vos achats jusqu'à 100% du montant de la transaction. Vous pouvez payer sans communiquer vos coordonnées bancaires au vendeur.</p>
  <h3 class="text-xl font-semibold mt-6">Virement bancaire</h3>
  <p class="text-gray-700">Pour les commandes importantes, le virement bancaire reste disponible. Les coordonnées vous sont communiquées après validation de votre panier.</p>
  <h3 class="text-xl font-semibold mt-6">Cryptographie SSL</h3>
  <p class="text-gray-700">Notre site utilise un certificat SSL 256 bits. Toutes les communications entre votre navigateur et notre serveur sont chiffrées et inviolables.</p>
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
    <p class="text-sm text-blue-800"><strong>Conseil :</strong> vérifiez toujours la présence du cadenas 🔒 dans la barre d'adresse de votre navigateur avant de saisir des informations sensibles.</p>
  </div>
</div>`

  if (!settings.trustPagePaymentTitle && !settings.trustPagePaymentContent) {
    // Still loading — show skeleton briefly
    // (we only show skeleton if we have NOTHING, otherwise we fall back to defaults)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/boutique" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <Shield className="h-6 w-6 text-[#007bff]" />
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
