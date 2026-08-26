import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { CARRIERS } from '@/lib/constants'

export async function GET() {
  try {
    const user = await requireAuth()
    // All authenticated users can see all sales (permission-based visibility is handled in the UI)
    const sales = await db.sale.findMany({
      include: { stockItem: { include: { supplier: true } } },
      orderBy: { saleDate: 'desc' },
    })
    return NextResponse.json(sales)
  } catch (error) {
    console.error('GET /api/sales error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Helper: derive a BoutiqueOrder status from a Sale's parcelStatus + trackingNumber.
// Mapping:
//   - LIVRE → delivered
//   - EN_TRANSIT / A_DEPOSER (with tracking) → shipped
//   - A_PREPARER / A_IMPRIMER → preparation
//   - default → paid (the sale is recorded, money received)
function deriveOrderStatus(parcelStatus: string | null | undefined, trackingNumber: string | null | undefined): string {
  if (parcelStatus === 'LIVRE') return 'delivered'
  if (parcelStatus === 'EN_TRANSIT' || parcelStatus === 'A_DEPOSER') return 'shipped'
  if (trackingNumber) return 'shipped'
  if (parcelStatus === 'A_PREPARER' || parcelStatus === 'A_IMPRIMER') return 'preparation'
  return 'paid'
}

// Helper: convert a carrier code (e.g. "mondial_relay") to its human label (e.g. "Mondial Relay")
function carrierLabel(code: string | null | undefined): string {
  if (!code) return 'Standard'
  const c = CARRIERS.find(x => x.id === code)
  return c?.label || code
}

// Helper: split a customer name into first/last name for the customerSnapshot
function splitCustomerName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: 'Client', lastName: 'Marketplace' }
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const {
      stockItemId, saleDate, platform, paymentMethod, customerName, customerContact,
      salePrice, shippingCost, carrierShippingCost, paymentFees, platformFees, platformFixedFees,
      carrier, trackingNumber, parcelStatus, notes,
    } = body

    if (!stockItemId || !salePrice || !platform) {
      return NextResponse.json({ error: 'Article, prix et plateforme requis' }, { status: 400 })
    }

    const item = await db.stockItem.findUnique({ where: { id: stockItemId } })
    if (!item) return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    if (item.userId !== user.id) {
      return NextResponse.json({ error: 'Article introuvable' }, { status: 404 })
    }

    const price = parseFloat(salePrice)
    const shipping = parseFloat(shippingCost) || 0
    const carrierShipping = parseFloat(carrierShippingCost) || 0
    const payFees = parseFloat(paymentFees) || 0  // frais bancaires (déjà calculés par le frontend ou l'API checkout)
    const fees = parseFloat(platformFees) || 0
    const fixedFees = parseFloat(platformFixedFees) || 0
    const totalFees = fees + fixedFees
    // CA brut = prix de vente + frais de port facturés au client
    // Les frais bancaires (paymentFees) sont déduits du CA (charge déductible)
    // Profit = CA brut - frais bancaires - coût d'achat - frais plateforme - frais port transporteur
    const ca = price + shipping
    const profit = ca - payFees - item.purchaseCost - totalFees - carrierShipping
    const margin = ca > 0 ? (profit / ca) * 100 : 0

    const sale = await db.sale.create({
      data: {
        stockItemId,
        saleDate: saleDate ? new Date(saleDate) : new Date(),
        platform,
        paymentMethod: paymentMethod || null,
        customerName,
        customerContact,
        salePrice: price,
        shippingCost: shipping,
        carrierShippingCost: carrierShipping,
        paymentFees: payFees,
        platformFees: fees,
        platformFixedFees: fixedFees,
        profit: parseFloat(profit.toFixed(2)),
        margin: parseFloat(margin.toFixed(1)),
        carrier,
        trackingNumber,
        parcelStatus: parcelStatus || 'A_PREPARER',
        notes,
        userId: user.id,
      },
      include: { stockItem: true },
    })

    // Génère le numéro de facture séquentiel et l'attache à la vente
    let invoiceNumber: string | null = null
    try {
      const { generateInvoiceNumber } = await import('@/lib/invoice')
      const gen = await generateInvoiceNumber(user.id)
      invoiceNumber = gen.number
      await db.sale.update({
        where: { id: sale.id },
        data: { invoiceNumber },
      })
    } catch (invoiceErr) {
      console.error('Invoice number generation failed:', invoiceErr)
    }

    // Quand l'article est vendu : on garde uniquement la plateforme de vente effective
    // platform = plateforme de vente, platforms = [] (vide, plus aucune publication active)
    // Décrémente la quantité ; passe à VENDU seulement si plus de stock dispo.
    const newQty = (item.quantity || 1) - 1
    const newSoldCount = (item.soldCount || 0) + 1
    const newStatus = newQty <= 0 ? 'VENDU' : 'PUBLIE'
    await db.stockItem.update({
      where: { id: stockItemId },
      data: {
        quantity: Math.max(0, newQty),
        soldCount: newSoldCount,
        status: newStatus,
        // On ne touche à platform/platforms que si l'article est totalement vendu
        ...(newQty <= 0 ? { platform, platforms: JSON.stringify([]) } : {}),
      },
    })

    // ── Génère automatiquement une BoutiqueOrder liée à la vente ──
    // Toutes les ventes manuelles (Vinted, Leboncoin, boutique, etc.) sont maintenant
    // enregistrées dans Boutique Admin → Commandes, avec un orderId unique et la facture liée.
    // En cas d'échec, on ne bloque pas la vente — on log l'erreur et on continue.
    try {
      // Try to match a BoutiqueClient by email (if customerContact looks like an email)
      const emailMatch = customerContact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerContact)
      const matchedClient = emailMatch
        ? await db.boutiqueClient.findFirst({ where: { email: customerContact.toLowerCase() } })
        : null

      const { firstName, lastName } = splitCustomerName(customerName)
      const customerSnapshot = JSON.stringify({
        firstName,
        lastName,
        email: customerContact || '',
        phone: null,
        address: '',
        postalCode: '',
        city: '',
        country: 'France',
      })

      // Items: array of order line items (matching BoutiqueOrder.items JSON schema)
      const orderItems = [{
        sku: item.sku,
        brand: item.brand,
        category: item.category,
        size: item.size || null,
        color: item.color || null,
        price: price,
        qty: 1,
      }]

      const orderStatus = deriveOrderStatus(parcelStatus, trackingNumber)
      const orderId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

      await db.boutiqueOrder.create({
        data: {
          orderId,
          clientId: matchedClient?.id || null,
          customerSnapshot,
          items: JSON.stringify(orderItems),
          shippingMethod: carrierLabel(carrier),
          shippingCost: shipping,
          paymentMethod: paymentMethod || null,
          // The platform records where the sale happened (boutique / vinted / leboncoin / etc.)
          platform: platform || 'boutique',
          subtotal: parseFloat(price.toFixed(2)),
          total: parseFloat(ca.toFixed(2)),
          status: orderStatus,
          invoiceNumbers: JSON.stringify(invoiceNumber ? [invoiceNumber] : []),
          notes: notes || null,
        },
      })
    } catch (orderErr) {
      // Failure to create the linked BoutiqueOrder must NOT fail the sale itself.
      console.error('[sales] Failed to create linked BoutiqueOrder:', orderErr)
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error('POST /api/sales error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
