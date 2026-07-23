import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
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
    await requireAdmin()
    const body = await req.json()
    const {
      heroTitle, heroSubtitle, heroCtaLabel, heroCtaLink, heroImage,
      topBarText, footerAbout, footerEmail, footerPhone,
      logoText, logoSubtitle, logoImage, primaryColor, primaryDarkColor,
      headerBgColor, topbarBgColor, footerBgColor,
      freeShippingThreshold, freeShippingEnabled, hoursJson, hoursVisible, cgvText, legalText,
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
      gaTagId,
      stripePublicKey, stripeSecretKey, stripeWebhookSecret,
      paypalClientId, paypalSecret, paypalWebhookId,
    } = body

    const data: any = {}
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
    if (typeof primaryColor === 'string') data.primaryColor = primaryColor
    if (typeof primaryDarkColor === 'string') data.primaryDarkColor = primaryDarkColor
    if (typeof headerBgColor === 'string') data.headerBgColor = headerBgColor
    if (typeof topbarBgColor === 'string') data.topbarBgColor = topbarBgColor
    if (typeof footerBgColor === 'string') data.footerBgColor = footerBgColor
    if (typeof freeShippingThreshold === 'number') data.freeShippingThreshold = freeShippingThreshold
    if (typeof freeShippingEnabled === 'boolean') data.freeShippingEnabled = freeShippingEnabled
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
    if (typeof gaTagId === 'string') data.gaTagId = gaTagId || null
    // Stripe
    if (typeof stripePublicKey === 'string') data.stripePublicKey = stripePublicKey || null
    if (typeof stripeSecretKey === 'string') data.stripeSecretKey = stripeSecretKey || null
    // PayPal
    if (typeof paypalClientId === 'string') data.paypalClientId = paypalClientId || null
    if (typeof paypalSecret === 'string') data.paypalSecret = paypalSecret || null

    const settings = await db.boutiqueSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', ...data },
      update: data,
    })

    return NextResponse.json(settings)
  } catch (error) {
    console.error('PUT /api/boutique/admin/settings error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
