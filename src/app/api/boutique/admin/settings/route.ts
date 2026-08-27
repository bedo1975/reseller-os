import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { getBoutiqueSettings } from '@/lib/boutique-settings'

// GET — public (returns settings for the storefront)
export async function GET() {
  try {
    const settings = await getBoutiqueSettings()
    return NextResponse.json(settings)
  } catch (error) {
    console.error('GET /api/boutique/admin/settings error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — admin only
export async function PUT(req: NextRequest) {
  try {
    await requireAuth()
    const body = await req.json()
    const {
      heroEyebrow, heroTitle, heroSubtitle, heroCtaLabel, heroCtaLink, heroImage,
      topBarText, footerAbout, footerEmail, footerPhone,
      logoText, logoSubtitle, logoImage, faviconLetter, faviconBgColor, faviconTabText, watermarkEnabled, watermarkOffsetX, watermarkOffsetY, imagePaddingMode, primaryColor, primaryDarkColor,
      headerBgColor, topbarBgColor, footerBgColor,
      freeShippingEnabled, freeShippingThreshold, boutiqueClosed, boutiqueClosedMessage, emailDesign,
      hoursJson, hoursVisible, cgvText, legalText,
      trustBadge1Icon, trustBadge1Title, trustBadge1Desc,
      trustBadge2Icon, trustBadge2Title, trustBadge2Desc,
      trustBadge3Icon, trustBadge3Title, trustBadge3Desc,
      trustBadge4Icon, trustBadge4Title, trustBadge4Desc,
      newProductsTitle, newProductsSubtitle,
      contactTitle, contactSubtitle, contactButtonText,
      categoriesTitle, categoriesSubtitle, footerLinksJson,
      footerBoutiqueTitle, footerInfosTitle, footerContactTitle,
      footerBoutiqueLinksJson, footerInfosLinksJson,
      navMenuJson,
      trustPagePaymentTitle, trustPagePaymentContent,
      trustPageShippingTitle, trustPageShippingContent,
      trustPageReturnsTitle, trustPageReturnsContent,
      gradePageTitle, gradePageContent,
      gaTagId,
      stripePublicKey, stripeSecretKey, stripeWebhookSecret,
      paypalClientId, paypalSecret, paypalWebhookId,
      mondialRelayEnseigne, mondialRelayApiKey,
      chronopostAccountNumber, chronopostApiKey,
      seoTitle, seoDescription,
      gdprEnabled, gdprBannerTitle, gdprBannerMessage, gdprPrivacyPolicyUrl, gdprCookiesJson,
      shareEnabled, shareColor, shareCollectEmails, shareSiteUrl, shareSubject, shareMessage, shareButtonText,
      newsletterEnabled, newsletterTitle, newsletterSubtitle, newsletterButtonText, newsletterPlaceholder, newsletterSuccessMessage, newsletterColor,
      preparationSlipSubtitle, invoiceFooterText,
      makeOfferDiscounts, makeOfferAllowFreeOffer, makeOfferCartDurationHours,
    } = body

    const data: any = {}
    if (typeof heroEyebrow === 'string') data.heroEyebrow = heroEyebrow
    if (typeof heroTitle === 'string') data.heroTitle = heroTitle
    if (typeof heroSubtitle === 'string') data.heroSubtitle = heroSubtitle
    if (typeof heroCtaLabel === 'string') data.heroCtaLabel = heroCtaLabel
    if (typeof heroCtaLink === 'string') data.heroCtaLink = heroCtaLink
    if (heroImage !== undefined) data.heroImage = heroImage || null
    if (typeof topBarText === 'string') data.topBarText = topBarText
    if (typeof footerAbout === 'string') data.footerAbout = footerAbout
    if (typeof footerEmail === 'string') data.footerEmail = footerEmail
    if (typeof footerPhone === 'string') data.footerPhone = footerPhone || null
    if (typeof logoText === 'string') data.logoText = logoText
    if (typeof logoSubtitle === 'string') data.logoSubtitle = logoSubtitle
    if (logoImage !== undefined) data.logoImage = logoImage || null
    if (typeof faviconLetter === 'string') data.faviconLetter = faviconLetter.slice(0, 1)
    if (typeof faviconBgColor === 'string') data.faviconBgColor = faviconBgColor || null
    if (typeof faviconTabText === 'string') data.faviconTabText = faviconTabText.slice(0, 60)
    if (typeof watermarkEnabled === 'boolean') data.watermarkEnabled = watermarkEnabled
    if (typeof watermarkOffsetX === 'number') data.watermarkOffsetX = Math.max(5, Math.min(500, watermarkOffsetX))
    if (typeof watermarkOffsetY === 'number') data.watermarkOffsetY = Math.max(5, Math.min(500, watermarkOffsetY))
    if (typeof imagePaddingMode === 'string') data.imagePaddingMode = ['none', 'square-white'].includes(imagePaddingMode) ? imagePaddingMode : 'none'
    if (typeof primaryColor === 'string') data.primaryColor = primaryColor
    if (typeof primaryDarkColor === 'string') data.primaryDarkColor = primaryDarkColor
    if (typeof headerBgColor === 'string') data.headerBgColor = headerBgColor
    if (typeof topbarBgColor === 'string') data.topbarBgColor = topbarBgColor
    if (typeof footerBgColor === 'string') data.footerBgColor = footerBgColor
    if (typeof freeShippingThreshold === 'number') data.freeShippingThreshold = freeShippingThreshold
    if (typeof freeShippingEnabled === 'boolean') data.freeShippingEnabled = freeShippingEnabled
    if (typeof boutiqueClosed === 'boolean') data.boutiqueClosed = boutiqueClosed
    if (typeof boutiqueClosedMessage === 'string') data.boutiqueClosedMessage = boutiqueClosedMessage
    if (typeof emailDesign === 'string') data.emailDesign = emailDesign
    if (typeof hoursJson === 'string') data.hoursJson = hoursJson
    if (typeof hoursVisible === 'boolean') data.hoursVisible = hoursVisible
    if (typeof cgvText === 'string') data.cgvText = cgvText || null
    if (typeof legalText === 'string') data.legalText = legalText || null
    // Trust badges
    const badges = [
      ['trustBadge1Icon', trustBadge1Icon], ['trustBadge1Title', trustBadge1Title], ['trustBadge1Desc', trustBadge1Desc],
      ['trustBadge2Icon', trustBadge2Icon], ['trustBadge2Title', trustBadge2Title], ['trustBadge2Desc', trustBadge2Desc],
      ['trustBadge3Icon', trustBadge3Icon], ['trustBadge3Title', trustBadge3Title], ['trustBadge3Desc', trustBadge3Desc],
      ['trustBadge4Icon', trustBadge4Icon], ['trustBadge4Title', trustBadge4Title], ['trustBadge4Desc', trustBadge4Desc],
    ]
    badges.forEach(([key, val]) => { if (typeof val === 'string') data[key] = val })
    // Sections
    if (typeof newProductsTitle === 'string') data.newProductsTitle = newProductsTitle
    if (typeof newProductsSubtitle === 'string') data.newProductsSubtitle = newProductsSubtitle
    if (typeof contactTitle === 'string') data.contactTitle = contactTitle
    if (typeof contactSubtitle === 'string') data.contactSubtitle = contactSubtitle
    if (typeof contactButtonText === 'string') data.contactButtonText = contactButtonText
    if (typeof categoriesTitle === 'string') data.categoriesTitle = categoriesTitle
    if (typeof categoriesSubtitle === 'string') data.categoriesSubtitle = categoriesSubtitle
    if (typeof footerLinksJson === 'string') data.footerLinksJson = footerLinksJson
    if (typeof footerBoutiqueTitle === 'string') data.footerBoutiqueTitle = footerBoutiqueTitle
    if (typeof footerInfosTitle === 'string') data.footerInfosTitle = footerInfosTitle
    if (typeof footerContactTitle === 'string') data.footerContactTitle = footerContactTitle
    if (typeof footerBoutiqueLinksJson === 'string') data.footerBoutiqueLinksJson = footerBoutiqueLinksJson
    if (typeof footerInfosLinksJson === 'string') data.footerInfosLinksJson = footerInfosLinksJson
    if (typeof navMenuJson === 'string') data.navMenuJson = navMenuJson
    // Trust pages (Paiement sécurisé, Livraison rapide, Retours 14 jours)
    if (typeof trustPagePaymentTitle === 'string') data.trustPagePaymentTitle = trustPagePaymentTitle
    if (typeof trustPagePaymentContent === 'string') data.trustPagePaymentContent = trustPagePaymentContent || null
    if (typeof trustPageShippingTitle === 'string') data.trustPageShippingTitle = trustPageShippingTitle
    if (typeof trustPageShippingContent === 'string') data.trustPageShippingContent = trustPageShippingContent || null
    if (typeof trustPageReturnsTitle === 'string') data.trustPageReturnsTitle = trustPageReturnsTitle
    if (typeof trustPageReturnsContent === 'string') data.trustPageReturnsContent = trustPageReturnsContent || null
    if (typeof gradePageTitle === 'string') data.gradePageTitle = gradePageTitle
    if (typeof gradePageContent === 'string') data.gradePageContent = gradePageContent || null
    if (typeof gaTagId === 'string') data.gaTagId = gaTagId || null
    // Stripe
    if (typeof stripePublicKey === 'string') data.stripePublicKey = stripePublicKey || null
    if (typeof stripeSecretKey === 'string') data.stripeSecretKey = stripeSecretKey || null
    // PayPal
    if (typeof paypalClientId === 'string') data.paypalClientId = paypalClientId || null
    if (typeof paypalSecret === 'string') data.paypalSecret = paypalSecret || null
    // Mondial Relay
    if (typeof mondialRelayEnseigne === 'string') data.mondialRelayEnseigne = mondialRelayEnseigne || null
    if (typeof mondialRelayApiKey === 'string') data.mondialRelayApiKey = mondialRelayApiKey || null
    if (typeof chronopostAccountNumber === 'string') data.chronopostAccountNumber = chronopostAccountNumber || null
    if (typeof chronopostApiKey === 'string') data.chronopostApiKey = chronopostApiKey || null
    if (typeof seoTitle === 'string') data.seoTitle = seoTitle || null
    if (typeof seoDescription === 'string') data.seoDescription = seoDescription || null
    // RGPD
    if (typeof gdprEnabled === 'boolean') data.gdprEnabled = gdprEnabled
    if (typeof gdprBannerTitle === 'string') data.gdprBannerTitle = gdprBannerTitle
    if (typeof gdprBannerMessage === 'string') data.gdprBannerMessage = gdprBannerMessage
    if (typeof gdprPrivacyPolicyUrl === 'string') data.gdprPrivacyPolicyUrl = gdprPrivacyPolicyUrl || null
    if (typeof gdprCookiesJson === 'string') data.gdprCookiesJson = gdprCookiesJson
    // Partage (Share with friends)
    if (typeof shareEnabled === 'boolean') data.shareEnabled = shareEnabled
    if (typeof shareColor === 'string') data.shareColor = shareColor
    if (typeof shareCollectEmails === 'boolean') data.shareCollectEmails = shareCollectEmails
    if (typeof shareSiteUrl === 'string') {
      // Normalize: trim trailing slash, allow null/empty
      const url = shareSiteUrl.trim()
      data.shareSiteUrl = url ? url.replace(/\/+$/, '') : null
    }
    if (typeof shareSubject === 'string') data.shareSubject = shareSubject
    if (typeof shareMessage === 'string') data.shareMessage = shareMessage
    if (typeof shareButtonText === 'string') data.shareButtonText = shareButtonText
    // Newsletter
    if (typeof newsletterEnabled === 'boolean') data.newsletterEnabled = newsletterEnabled
    if (typeof newsletterTitle === 'string') data.newsletterTitle = newsletterTitle
    if (typeof newsletterSubtitle === 'string') data.newsletterSubtitle = newsletterSubtitle
    if (typeof newsletterButtonText === 'string') data.newsletterButtonText = newsletterButtonText
    if (typeof newsletterPlaceholder === 'string') data.newsletterPlaceholder = newsletterPlaceholder
    if (typeof newsletterSuccessMessage === 'string') data.newsletterSuccessMessage = newsletterSuccessMessage
    if (typeof newsletterColor === 'string') data.newsletterColor = newsletterColor
    // Documents
    if (typeof preparationSlipSubtitle === 'string') data.preparationSlipSubtitle = preparationSlipSubtitle
    if (typeof invoiceFooterText === 'string') data.invoiceFooterText = invoiceFooterText || null
    // Make an Offer configuration
    if (typeof makeOfferDiscounts === 'string') data.makeOfferDiscounts = makeOfferDiscounts
    if (makeOfferAllowFreeOffer !== undefined && makeOfferAllowFreeOffer !== null) {
      data.makeOfferAllowFreeOffer = makeOfferAllowFreeOffer === true || makeOfferAllowFreeOffer === 'true'
    }
    if (makeOfferCartDurationHours !== undefined && makeOfferCartDurationHours !== null) {
      const hours = typeof makeOfferCartDurationHours === 'string' ? parseInt(makeOfferCartDurationHours) : makeOfferCartDurationHours
      if (!Number.isNaN(hours)) data.makeOfferCartDurationHours = Math.max(1, Math.min(168, hours))
    }

    // Use update (not upsert) — the row is guaranteed to exist (created by getBoutiqueSettings on first access).
    // upsert fails because the create clause would need all required fields (companyName, address, city, etc.).
    let settings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
    if (!settings) {
      // Fallback: create with defaults if missing (shouldn't happen in practice)
      settings = await db.boutiqueSettings.create({ data: { id: 'default', ...data } })
    } else {
      settings = await db.boutiqueSettings.update({ where: { id: 'default' }, data })
    }

    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('PUT /api/boutique/admin/settings error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    // Return detailed error for debugging (field name, Prisma code, etc.)
    return NextResponse.json({
      error: 'Erreur serveur',
      details: error?.message || 'Erreur inconnue',
      code: error?.code,
      meta: error?.meta,
    }, { status: 500 })
  }
}
