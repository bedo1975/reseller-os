'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'

const DEFAULT_CGV = `<div class="space-y-6">
  <h2 class="text-xl font-bold mb-2">Article 1 — Objet</h2>
  <p>Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles entre la boutique et tout utilisateur souhaitant acquérir des produits proposés sur le site.</p>

  <h2 class="text-xl font-bold mb-2">Article 2 — Produits</h2>
  <p>Les produits proposés sont des articles de seconde main. L'état de chaque article est clairement indiqué sur sa fiche produit : neuf avec étiquette, neuf sans étiquette, très bon état, bon état, ou état correct. Les photos des produits sont contractuelles.</p>

  <h2 class="text-xl font-bold mb-2">Article 3 — Prix</h2>
  <p>Les prix sont indiqués en euros toutes taxes comprises (TTC). Les frais de livraison sont indiqués lors du checkout et varient selon le mode d'expédition choisi.</p>

  <h2 class="text-xl font-bold mb-2">Article 4 — Commande</h2>
  <p>L'Acheteur sélectionne les produits, les ajoute à son panier, puis remplit le formulaire de commande. La validation de la commande vaut acceptation des présentes CGV.</p>

  <h2 class="text-xl font-bold mb-2">Article 5 — Paiement</h2>
  <p>Le paiement est effectué au moment de la commande. Les modes de paiement acceptés sont indiqués lors du checkout.</p>

  <h2 class="text-xl font-bold mb-2">Article 6 — Livraison</h2>
  <p>Les commandes sont expédiées sous 48h ouvrées. Les délais de livraison sont indicatifs : Standard (3-5 jours), Suivi (2-3 jours), Retrait sur place.</p>

  <h2 class="text-xl font-bold mb-2">Article 7 — Droit de rétractation</h2>
  <p>Conformément à l'article L221-18 du Code de la consommation, l'Acheteur dispose d'un délai de 14 jours à compter de la réception de sa commande pour exercer son droit de rétractation. Les frais de retour sont à la charge de l'Acheteur.</p>

  <h2 class="text-xl font-bold mb-2">Article 8 — Garantie</h2>
  <p>Compte tenu de la nature des produits (seconde main), aucune garantie légale de conformité n'est applicable. Le Vendeur s'engage néanmoins à rembourser ou remplacer tout produit non conforme à sa description.</p>

  <h2 class="text-xl font-bold mb-2">Article 9 — Données personnelles</h2>
  <p>Les données collectées lors de la commande sont utilisées uniquement pour le traitement et l'expédition de la commande. Conformément au RGPD, l'Acheteur dispose d'un droit d'accès, de rectification et de suppression de ses données.</p>

  <h2 class="text-xl font-bold mb-2">Article 10 — Droit applicable</h2>
  <p>Les présentes CGV sont soumises au droit français. Tout litige relèvera de la compétence des tribunaux français.</p>
</div>`

export default function CGVPage() {
  const settings = useBoutiqueSettings()
  const cgvContent = settings.cgvText || DEFAULT_CGV

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <div
        className="prose prose-sm max-w-none text-gray-700"
        dangerouslySetInnerHTML={{ __html: cgvContent }}
      />

      <div className="mt-8 text-center">
        <Link href="/">
          <Button variant="outline">Retour à la boutique</Button>
        </Link>
      </div>
    </div>
  )
}
