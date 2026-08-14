'use client'

import { useState, useEffect } from 'react'

export interface BoutiqueSettings {
  heroEyebrow: string
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
  faviconLetter: string
  faviconBgColor: string | null
  watermarkEnabled: boolean
  primaryColor: string
  primaryDarkColor: string
  headerBgColor: string
  topbarBgColor: string
  footerBgColor: string
  freeShippingEnabled: boolean
  freeShippingThreshold: number
  boutiqueClosed: boolean
  boutiqueClosedMessage: string
  emailDesign: string
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
  // Page explicative "Grades"
  gradePageTitle: string
  gradePageContent: string | null
  gaTagId: string | null
  seoTitle: string | null
  seoDescription: string | null
  stripePublicKey: string | null
  stripeSecretKey: string | null
  stripeWebhookSecret: string | null
  paypalClientId: string | null
  paypalSecret: string | null
  gdprEnabled: boolean
  gdprBannerTitle: string
  gdprBannerMessage: string
  gdprPrivacyPolicyUrl: string | null
  gdprCookiesJson: string
  // Partage (Share with friends)
  shareEnabled: boolean
  shareColor: string
  shareCollectEmails: boolean
  shareSiteUrl: string | null
  shareSubject: string
  shareMessage: string
  shareButtonText: string
  // Newsletter
  newsletterEnabled: boolean
  newsletterTitle: string
  newsletterSubtitle: string
  newsletterButtonText: string
  newsletterPlaceholder: string
  newsletterSuccessMessage: string
  newsletterColor: string
}

const DEFAULTS: BoutiqueSettings = {
  heroEyebrow: 'Seconde main premium',
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
  faviconLetter: 'B',
  faviconBgColor: null,
  watermarkEnabled: false,
  primaryColor: '007bff',
  primaryDarkColor: '0056b3',
  headerBgColor: 'ffffff',
  topbarBgColor: '0a3d62',
  footerBgColor: '0a3d62',
  freeShippingEnabled: false,
  freeShippingThreshold: 50,
  boutiqueClosed: false,
  boutiqueClosedMessage: 'La boutique est temporairement fermée. Revenez bientôt !',
  emailDesign: 'modern',
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
  gradePageTitle: 'Nos grades de qualité',
  gradePageContent: null,
  gaTagId: null,
  stripePublicKey: null,
  stripeSecretKey: null,
  stripeWebhookSecret: null,
  paypalClientId: null,
  paypalSecret: null,
  gdprEnabled: true,
  gdprBannerTitle: 'Vos données personnelles',
  gdprBannerMessage: 'Nous utilisons des cookies pour améliorer votre expérience, analyser le trafic et sécuriser les paiements. Vous pouvez accepter ou refuser les cookies non essentiels.',
  gdprPrivacyPolicyUrl: null,
  gdprCookiesJson: '[]',
  shareEnabled: true,
  shareColor: '#007bff',
  shareCollectEmails: true,
  shareSiteUrl: null,
  shareSubject: 'Un ami vous recommande cet article',
  shareMessage: 'Bonjour,\n\nJ\'ai trouvé cet article sur {SITE_NAME} et j\'ai pensé qu\'il pourrait vous plaire.\n\nDécouvrez-le ici : {URL}',
  shareButtonText: 'Partager cet article',
  newsletterEnabled: false,
  newsletterTitle: 'Newsletter',
  newsletterSubtitle: 'Recevez nos nouveautés et offres exclusives',
  newsletterButtonText: "S'inscrire",
  newsletterPlaceholder: 'Votre adresse email',
  newsletterSuccessMessage: "Merci ! Vous êtes maintenant inscrit(e) à notre newsletter.",
  newsletterColor: '#007bff',
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
