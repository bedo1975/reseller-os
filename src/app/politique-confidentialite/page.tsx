'use client'

import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import Link from 'next/link'
import { Shield } from 'lucide-react'

const DEFAULT_PRIVACY = `<div class="space-y-6">
  <h2 class="text-xl font-bold mb-2">Responsable du traitement</h2>
  <p>Le responsable du traitement des données personnelles collectées sur ce site est [Nom de l'entreprise/raison sociale], immatriculée sous le numéro SIRET [numéro SIRET], dont le siège social est situé [adresse complète].</p>
  <p>Email : [email de contact] · Téléphone : [téléphone]</p>

  <h2 class="text-xl font-bold mb-2">Données collectées</h2>
  <p>Nous collectons les données suivantes lors de votre inscription et de vos commandes :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li><strong>Identité</strong> : prénom, nom</li>
    <li><strong>Coordonnées</strong> : email, téléphone, adresse de livraison</li>
    <li><strong>Données de commande</strong> : historique des achats, factures</li>
    <li><strong>Données techniques</strong> : adresse IP, navigateur, système d'exploitation (à des fins de sécurité et de statistiques)</li>
  </ul>

  <h2 class="text-xl font-bold mb-2">Finalités du traitement</h2>
  <p>Vos données sont traitées pour les finalités suivantes :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li>Gestion des comptes clients et authentification</li>
    <li>Traitement et suivi des commandes</li>
    <li>Communication relative à vos commandes (emails de confirmation, suivi, etc.)</li>
    <li>Réponse à vos messages via la messagerie interne</li>
    <li>Établissement des factures et obligations comptables</li>
    <li>Prévention des fraudes et sécurisation du site</li>
    <li>Mesure d'audience et amélioration de l'expérience utilisateur</li>
  </ul>

  <h2 class="text-xl font-bold mb-2">Base légale</h2>
  <p>Le traitement de vos données est fondé sur :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li>L'<strong>exécution d'un contrat</strong> (article 6.1.b du RGPD) pour la gestion des commandes</li>
    <li>Votre <strong>consentement</strong> (article 6.1.a du RGPD) pour la newsletter et les communications marketing</li>
    <li>L'<strong>intérêt légitime</strong> (article 6.1.f du RGPD) pour la sécurité et l'amélioration du site</li>
    <li>L'<strong>obligation légale</strong> (article 6.1.c du RGPD) pour la facturation et la comptabilité</li>
  </ul>

  <h2 class="text-xl font-bold mb-2">Durée de conservation</h2>
  <p>Vos données sont conservées :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li><strong>Compte client</strong> : jusqu'à 3 ans après la dernière activité</li>
    <li><strong>Données de commande et factures</strong> : 10 ans (obligation légale comptable)</li>
    <li><strong>Messages de la messagerie interne</strong> : 2 ans après le dernier échange</li>
    <li><strong>Données techniques (IP, logs)</strong> : 13 mois maximum</li>
    <li><strong>Newsletter</strong> : jusqu'à votre désabonnement</li>
  </ul>

  <h2 class="text-xl font-bold mb-2">Destinataires des données</h2>
  <p>Vos données sont destinées exclusivement à [Nom de l'entreprise] et à ses prestataires techniques (hébergeur, processeur de paiement, transporteur). Elles ne sont jamais vendues ni cédées à des tiers à des fins commerciales.</p>
  <p>Les prestataires susceptibles d'accéder à certaines données :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li>Hébergeur du site (stockage et traitement des données)</li>
    <li>Prestataire de paiement (Stripe, PayPal — données bancaires traitées directement par eux, nous ne stockons pas vos numéros de carte)</li>
    <li>Transporteurs (Mondial Relay, Chronopost, Colissimo — nom, adresse pour la livraison)</li>
    <li>Prestataire d'envoi d'emails (pour les notifications de commande)</li>
  </ul>

  <h2 class="text-xl font-bold mb-2">Transfert hors UE</h2>
  <p>Vos données sont principalement hébergées au sein de l'Union Européenne. Toutefois, certains prestataires (ex: Google Analytics) peuvent traiter des données en dehors de l'UE. Dans ce cas, des garanties appropriées (clauses contractuelles types) sont mises en place pour assurer un niveau de protection adéquat.</p>

  <h2 class="text-xl font-bold mb-2">Vos droits</h2>
  <p>Conformément au RGPD, vous disposez des droits suivants :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li><strong>Droit d'accès</strong> : obtenir une copie de vos données personnelles</li>
    <li><strong>Droit de rectification</strong> : corriger des données inexactes ou incomplètes</li>
    <li><strong>Droit à l'effacement</strong> (« droit à l'oubli ») : demander la suppression de vos données</li>
    <li><strong>Droit à la limitation</strong> : restreindre le traitement de vos données</li>
    <li><strong>Droit à la portabilité</strong> : recevoir vos données dans un format structuré</li>
    <li><strong>Droit d'opposition</strong> : vous opposer au traitement de vos données</li>
    <li><strong>Droit de retirer votre consentement</strong> à tout moment (sans affecter la licéité du traitement antérieur)</li>
  </ul>
  <p>Pour exercer ces droits, contactez-nous à : [email de contact]</p>

  <h2 class="text-xl font-bold mb-2">Cookies</h2>
  <p>Ce site utilise des cookies pour :</p>
  <ul class="list-disc pl-6 space-y-1">
    <li><strong>Cookies essentiels</strong> : authentification, panier (sans consentement requis)</li>
    <li><strong>Cookies de mesure d'audience</strong> : statistiques de visites (avec votre consentement)</li>
    <li><strong>Cookies de fonctionnalité</strong> : préférences, langue (avec votre consentement)</li>
  </ul>
  <p>Vous pouvez gérer vos préférences via le bandeau cookies affiché lors de votre première visite.</p>

  <h2 class="text-xl font-bold mb-2">Réclamation</h2>
  <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire une réclamation auprès de la CNIL :</p>
  <p>Commission Nationale de l'Informatique et des Libertés (CNIL)<br/>
  3 Place de Fontenoy – TSA 80715 – 75334 PARIS CEDEX 07<br/>
  Téléphone : 01 53 73 22 22 · <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" class="text-[#007bff] underline">www.cnil.fr</a></p>

  <h2 class="text-xl font-bold mb-2">Mise à jour</h2>
  <p>Cette politique de confidentialité peut être mise à jour. La date de dernière mise à jour est indiquée ci-dessous.</p>
  <p class="text-sm text-gray-500">Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}</p>
</div>`

export default function PrivacyPolicyPage() {
  const settings = useBoutiqueSettings()

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#007bff]" />
          Politique de confidentialité
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Protection des données personnelles conformément au RGPD
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: DEFAULT_PRIVACY }}
        />
      </div>

      <div className="mt-6 text-center">
        <Link href="/mentions-legales" className="text-sm text-[#007bff] hover:underline">
          Mentions légales
        </Link>
        {' · '}
        <Link href="/cgv" className="text-sm text-[#007bff] hover:underline">
          CGV
        </Link>
        {' · '}
        <Link href="/" className="text-sm text-[#007bff] hover:underline">
          Retour à la boutique
        </Link>
      </div>
    </div>
  )
}
