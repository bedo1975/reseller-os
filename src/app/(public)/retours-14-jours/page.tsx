'use client'

import Link from 'next/link'
import { RefreshCw } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

export default function Retours14JoursPage() {
  const settings = useBoutiqueSettings()

  const title = settings.trustPageReturnsTitle || 'Retours 14 jours'
  const content = settings.trustPageReturnsContent || `<div class="space-y-6">
  <h2 class="text-2xl font-bold mb-4">Satisfait ou remboursé sous 14 jours</h2>
  <p class="text-gray-700">Conformément à l'article L221-18 du Code de la consommation, vous disposez d'un délai de 14 jours à compter de la réception de votre commande pour exercer votre droit de rétractation, sans avoir à justifier de motifs ni à payer de pénalités.</p>

  <h3 class="text-xl font-semibold mt-6">Comment retourner un article ?</h3>
  <ol class="list-decimal list-inside space-y-2 text-gray-700">
    <li>Connectez-vous à votre compte client</li>
    <li>Rendez-vous dans "Mes commandes"</li>
    <li>Sélectionnez la commande concernée et cliquez sur "Demander un retour"</li>
    <li>Indiquez le motif du retour</li>
    <li>Imprimez l'étiquette de retour (fournie par email)</li>
    <li>Déposez le colis en point relais ou bureau de poste</li>
  </ol>

  <h3 class="text-xl font-semibold mt-6">Conditions de retour</h3>
  <ul class="list-disc list-inside space-y-2 text-gray-700">
    <li>L'article doit être dans son état d'origine (non porté, non lavé)</li>
    <li>Les étiquettes doivent être encore attachées</li>
    <li>L'emballage d'origine doit être conservé si possible</li>
    <li>Les frais de retour sont à la charge de l'acheteur</li>
  </ul>

  <h3 class="text-xl font-semibold mt-6">Remboursement</h3>
  <p class="text-gray-700">Le remboursement est effectué sous 14 jours à compter de la réception du produit retourné, dans son état d'origine. Le remboursement s'effectue via le même moyen de paiement que celui utilisé lors de la commande.</p>

  <h3 class="text-xl font-semibold mt-6">Exceptions</h3>
  <p class="text-gray-700">Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux :</p>
  <ul class="list-disc list-inside space-y-2 text-gray-700">
    <li>Articles personnalisés ou sur mesure</li>
    <li>Articles hygiène (sous-vêtements, maillots de bain) pour des raisons d'hygiène</li>
    <li>Produits scellés ouverts après livraison</li>
  </ul>

  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
    <p class="text-sm text-blue-800"><strong>Question ?</strong> Contactez-nous via le formulaire de contact ou la messagerie interne de votre compte client. Nous répondons sous 48h ouvrées.</p>
  </div>
</div>`

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
          <RefreshCw className="h-6 w-6 text-[#007bff]" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      </div>

      <div
        className="prose prose-sm max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <div className="mt-8 text-center">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 border rounded-md text-sm font-medium hover:bg-muted">
          Retour à la boutique
        </Link>
      </div>
    </div>
  )
}
