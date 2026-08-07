'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

const DEFAULT_LEGAL = `<div class="space-y-6">
  <h2 class="text-xl font-bold mb-2">Éditeur du site</h2>
  <p>Le présent site est édité par [Nom de l'entreprise/raison sociale], immatriculée sous le numéro SIRET [numéro SIRET], dont le siège social est situé [adresse complète].</p>
  <p>Email : [email de contact] · Téléphone : [téléphone]</p>

  <h2 class="text-xl font-bold mb-2">Directeur de la publication</h2>
  <p>Le directeur de la publication est [Nom du responsable].</p>

  <h2 class="text-xl font-bold mb-2">Hébergement</h2>
  <p>Le site est hébergé par [Nom de l'hébergeur], dont le siège social est situé [adresse de l'hébergeur].</p>

  <h2 class="text-xl font-bold mb-2">Propriété intellectuelle</h2>
  <p>L'ensemble des éléments présents sur ce site (textes, images, logos, marques) est protégé par le droit de la propriété intellectuelle. Toute reproduction, représentation, modification ou exploitation, par quelque procédé que ce soit, sans autorisation préalable écrite, est interdite.</p>

  <h2 class="text-xl font-bold mb-2">Données personnelles</h2>
  <p>Les données collectées sur ce site sont traitées conformément au Règlement Général sur la Protection des Données (RGPD). Vous disposez d'un droit d'accès, de rectification, d'effacement et d'opposition. Pour exercer ces droits, contactez-nous à [email de contact].</p>

  <h2 class="text-xl font-bold mb-2">Cookies</h2>
  <p>Ce site utilise des cookies pour améliorer l'expérience utilisateur et mesurer l'audience. Vous pouvez à tout moment désactiver les cookies dans les paramètres de votre navigateur.</p>

  <h2 class="text-xl font-bold mb-2">Responsabilité</h2>
  <p>L'éditeur ne saurait être tenu responsable des erreurs, d'une indisponibilité du site ou de la présence de virus sur le site. Les informations fournies sont à titre indicatif et n'ont pas de valeur contractuelle.</p>
</div>`

export default function MentionsLegalesPage() {
  const settings = useBoutiqueSettings()
  const legalContent = settings.legalText || DEFAULT_LEGAL

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Mentions légales</h1>
      <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <div
        className="prose prose-sm max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: legalContent }}
      />

      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="outline">Retour à la boutique</Button>
        </Link>
      </div>
    </div>
  )
}
