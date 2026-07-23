'use client'

import { useState, useEffect } from 'react'

export interface BoutiqueSettings {
  heroTitle: string
  heroSubtitle: string
  heroCtaLabel: string
  heroCtaLink: string
  heroImage: string | null
  topBarText: string
  footerAbout: string
  footerEmail: string
  footerPhone: string | null
  logoText: string
  logoSubtitle: string
  logoImage: string | null
  primaryColor: string
  primaryDarkColor: string
  headerBgColor: string
  topbarBgColor: string
  footerBgColor: string
  freeShippingThreshold: number
  hoursJson: string
  hoursVisible: boolean
  cgvText: string | null
  legalText: string | null
  trustBadge1Icon: string
  trustBadge1Title: string
  trustBadge1Desc: string
  trustBadge2Icon: string
  trustBadge2Title: string
  trustBadge2Desc: string
  trustBadge3Icon: string
  trustBadge3Title: string
  trustBadge3Desc: string
  trustBadge4Icon: string
  trustBadge4Title: string
  trustBadge4Desc: string
  newProductsTitle: string
  newProductsSubtitle: string
  contactTitle: string
  contactSubtitle: string
  contactButtonText: string
  categoriesTitle: string
  categoriesSubtitle: string
  footerLinksJson: string
  footerBoutiqueTitle: string
  footerInfosTitle: string
  footerContactTitle: string
  footerBoutiqueLinksJson: string
  footerInfosLinksJson: string
  navMenuJson: string
  trustPagePaymentTitle: string
  trustPagePaymentContent: string | null
  trustPageShippingTitle: string
  trustPageShippingContent: string | null
  trustPageReturnsTitle: string
  trustPageReturnsContent: string | null
  gaTagId: string | null
  stripePublicKey: string | null
  stripeSecretKey: string | null
  paypalClientId: string | null
  paypalSecret: string | null
}

const DEFAULTS: BoutiqueSettings = {
  heroTitle: 'La mode responsable, accessible à tous',
  heroSubtitle: 'Des vêtements et accessoires soigneusement sélectionnés, à prix justes. Donnez une seconde vie aux pièces que vous aimez.',
  heroCtaLabel: 'Découvrir la collection',
  heroCtaLink: '#produits',
  heroImage: null,
  topBarText: 'Livraison offerte dès 50€ d\'achat · Paiement sécurisé',
  footerAbout: 'Votre boutique de vêtements et accessoires seconde main, soigneusement sélectionnés.',
  footerEmail: 'contact@dboxpro.fr',
  footerPhone: null,
  logoText: 'DBoxPro',
  logoSubtitle: 'Boutique',
  logoImage: null,
  primaryColor: '007bff',
  primaryDarkColor: '0056b3',
  headerBgColor: 'ffffff',
  topbarBgColor: '0a3d62',
  footerBgColor: '0a3d62',
  freeShippingThreshold: 50,
  hoursJson: '[]',
  hoursVisible: true,
  cgvText: null,
  legalText: null,
  trustBadge1Icon: 'truck', trustBadge1Title: 'Livraison rapide', trustBadge1Desc: 'Expédition sous 48h',
  trustBadge2Icon: 'shield', trustBadge2Title: 'Paiement sécurisé', trustBadge2Desc: 'Vos données protégées',
  trustBadge3Icon: 'refresh', trustBadge3Title: 'Retours 14 jours', trustBadge3Desc: 'Satisfait ou remboursé',
  trustBadge4Icon: 'headphones', trustBadge4Title: 'Service client', trustBadge4Desc: 'À votre écoute',
  newProductsTitle: 'Nos nouveautés',
  newProductsSubtitle: 'Les dernières pièces ajoutées à la boutique',
  contactTitle: 'Une question ?',
  contactSubtitle: 'Notre équipe est à votre écoute pour vous accompagner',
  contactButtonText: 'Nous contacter',
  categoriesTitle: 'Explorer par catégorie',
  categoriesSubtitle: 'Trouvez exactement ce que vous cherchez',
  footerLinksJson: '[]',
  footerBoutiqueTitle: 'Boutique',
  footerInfosTitle: 'Informations',
  footerContactTitle: 'Contact',
  footerBoutiqueLinksJson: '[]',
  footerInfosLinksJson: '[]',
  navMenuJson: '[]',
  trustPagePaymentTitle: 'Paiement sécurisé',
  trustPagePaymentContent: null,
  trustPageShippingTitle: 'Livraison rapide',
  trustPageShippingContent: null,
  trustPageReturnsTitle: 'Retours 14 jours',
  trustPageReturnsContent: null,
  gaTagId: null,
  stripePublicKey: null,
  stripeSecretKey: null,
  paypalClientId: null,
  paypalSecret: null,
}

let cache: BoutiqueSettings | null = null
const subscribers = new Set<(s: BoutiqueSettings) => void>()

export function useBoutiqueSettings() {
  const [settings, setSettings] = useState<BoutiqueSettings>(DEFAULTS)

  useEffect(() => {
    // Always fetch — no cache, so changes in admin are immediately visible
    fetch('/api/boutique/admin/settings')
      .then(r => r.json())
      .then(data => {
        const merged = { ...DEFAULTS, ...data }
        setSettings(merged)
      })
      .catch(() => {
        setSettings(DEFAULTS)
      })
  }, [])

  return settings
}

export function clearBoutiqueSettingsCache() {
  // No-op — kept for backward compatibility but cache is disabled
}
