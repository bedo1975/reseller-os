'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function CGVPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/boutique" className="text-sm text-[#007bff] hover:underline mb-4 inline-block">
        ← Retour à la boutique
      </Link>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Conditions Générales de Vente</h1>
      <p className="text-sm text-gray-500 mb-8">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}</p>

      <div className="prose prose-sm max-w-none space-y-6 text-gray-700">
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 1 — Objet</h2>
          <p>
            Les présentes Conditions Générales de Vente (CGV) régissent les relations contractuelles
            entre DBoxPro (ci-après « le Vendeur ») et tout utilisateur du site dboxpro.fr/boutique
            (ci-après « l'Acheteur ») souhaitant acquérir des produits proposés sur le site.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 2 — Produits</h2>
          <p>
            Les produits proposés sont des articles de seconde main (vêtements, chaussures, accessoires).
            L'état de chaque article est clairement indiqué sur sa fiche produit : neuf avec étiquette,
            neuf sans étiquette, très bon état, bon état, ou état correct.
          </p>
          <p>
            Les photos des produits sont contractuelles. Le Vendeur s'engage à livrer un produit
            conforme à la description et aux photos publiées.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 3 — Prix</h2>
          <p>
            Les prix sont indiqués en euros toutes taxes comprises (TTC). Le Vendeur est en franchise
            de TVA (article 293 B du CGI). Les frais de livraison sont indiqués lors du checkout et
            varient selon le mode d'expédition choisi.
          </p>
          <p>
            Une livraison offerte est proposée pour toute commande supérieure à 50€.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 4 — Commande</h2>
          <p>
            L'Acheteur sélectionne les produits sur le site, les ajoute à son panier, puis remplit
            le formulaire de commande avec ses coordonnées et son adresse de livraison. La validation
            de la commande vaut acceptation des présentes CGV.
          </p>
          <p>
            Une confirmation de commande est envoyée par email à l'Acheteur après validation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 5 — Paiement</h2>
          <p>
            Le paiement est effectué au moment de la commande. Les modes de paiement acceptés sont
            indiqués lors du checkout. La commande est traitée après confirmation du paiement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 6 — Livraison</h2>
          <p>
            Les commandes sont expédiées sous 48h ouvrées. Les délais de livraison sont indicatifs :
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Standard : 3 à 5 jours ouvrés</li>
            <li>Suivi : 2 à 3 jours ouvrés</li>
            <li>Retrait : sur rendez-vous</li>
          </ul>
          <p>
            Le Vendeur ne peut être tenu responsable des retards imputables au transporteur ou de
            perturbations indépendantes de sa volonté.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 7 — Droit de rétractation</h2>
          <p>
            Conformément à l'article L221-18 du Code de la consommation, l'Acheteur dispose d'un
            délai de 14 jours à compter de la réception de sa commande pour exercer son droit de
            rétractation, sans avoir à justifier de motifs ni à payer de pénalités.
          </p>
          <p>
            Les frais de retour sont à la charge de l'Acheteur. Le remboursement est effectué sous
            14 jours à compter de la réception du produit retourné, dans son état d'origine.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 8 — Garantie</h2>
          <p>
            Compte tenu de la nature des produits (seconde main), aucune garantie légale de
            conformité n'est applicable. Le Vendeur s'engage néanmoins à rembourser ou remplacer
            tout produit non conforme à sa description.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 9 — Données personnelles</h2>
          <p>
            Les données collectées lors de la commande (nom, email, adresse) sont utilisées
            uniquement pour le traitement et l'expédition de la commande. Elles ne sont jamais
            cédées à des tiers. Conformément au RGPD, l'Acheteur dispose d'un droit d'accès, de
            rectification et de suppression de ses données.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Article 10 — Droit applicable</h2>
          <p>
            Les présentes CGV sont soumises au droit français. Tout litige relèvera de la
            compétence des tribunaux français.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Contact</h2>
          <p>
            Pour toute question relative aux présentes CGV ou à votre commande :
          </p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li>Email : contact@dboxpro.fr</li>
            <li>Délai de réponse : 48h ouvrées</li>
          </ul>
        </section>
      </div>

      <div className="mt-8 text-center">
        <Link href="/boutique">
          <Button variant="outline">Retour à la boutique</Button>
        </Link>
      </div>
    </div>
  )
}
