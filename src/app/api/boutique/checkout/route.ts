import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { generateInvoiceNumber } from '@/lib/invoice'
import { getClientFromToken } from '@/lib/boutique-client-auth'
import { getActiveShippingMethods, getBoutiqueSettings } from '@/lib/boutique-settings'
import { notifyNewOrder } from '@/lib/email'

/**
 * POST /api/boutique/checkout
 * Public (or with client cookie) — creates:
 *   - A Sale for each item (with invoice number)
 *   - A BoutiqueOrder grouping all items
 *   - Marks StockItems as VENDU
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customer, items, shippingMethodCode, paymentMethodCode, notes, relayId, relayName, relayAddress, shippingCost: clientShippingCost } = body

    if (!customer?.email || !customer?.firstName || !customer?.lastName || !customer?.address) {
      return NextResponse.json({ error: 'Coordonnées client incomplètes' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Panier vide' }, { status: 400 })
    }

    // If the selected shipping method is a relay one, a relay point MUST be chosen.
    const isRelayMethod = !!shippingMethodCode && /relay/i.test(shippingMethodCode)
    if (isRelayMethod && (!relayId || !relayName || !relayAddress)) {
      return NextResponse.json({ error: 'Veuillez sélectionner un point relais.' }, { status: 400 })
    }

    // Check if a client is logged in (optional)
    const clientToken = await getClientFromToken()

    // Find the admin user (to attach sales + invoice settings)
    const adminUser = await db.user.findFirst({ where: { role: 'admin' } })
    if (!adminUser) {
      return NextResponse.json({ error: 'Configuration incomplète (pas d\'admin)' }, { status: 500 })
    }

    const invoiceSettings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })

    // Get shipping methods from DB (or fallback to defaults)
    let shippingMethods = await getActiveShippingMethods()
    if (shippingMethods.length === 0) {
      // Auto-create defaults
      shippingMethods = await Promise.all([
        db.shippingMethod.create({ data: { code: 'standard', label: 'Standard (3-5j)', price: 3.50, delay: '3 à 5 jours ouvrés', active: true, order: 0 } }),
        db.shippingMethod.create({ data: { code: 'tracked', label: 'Suivi (2-3j)', price: 5.90, delay: '2 à 3 jours ouvrés', active: true, order: 1 } }),
        db.shippingMethod.create({ data: { code: 'pickup', label: 'Retrait (gratuit)', price: 0, delay: 'Sur rendez-vous', active: true, order: 2 } }),
        db.shippingMethod.create({ data: { code: 'relay', label: 'Point relais (Mondial Relay)', price: 3.20, delay: '3 à 6 jours ouvrés', active: true, order: 3 } }),
      ])
    }

    const shippingMethod = shippingMethods.find(m => m.code === shippingMethodCode) || shippingMethods[0]
    // Use the shipping cost from the frontend if provided (it was calculated via shipping-calculate API)
    // Otherwise fall back to base price, then recalculate from weight rules
    let shippingCost: number | null = typeof clientShippingCost === 'number' ? clientShippingCost : null

    // Get boutique settings (for free shipping threshold)
    const boutiqueSettings = await getBoutiqueSettings()

    // If frontend didn't send a shipping cost, calculate from weight rules
    if (shippingCost === null) {
      shippingCost = shippingMethod?.price || 0

      if (shippingMethod && shippingMethod.code) {
        const methodWithRules = await db.shippingMethod.findUnique({
          where: { code: shippingMethod.code },
          include: { weightRules: { orderBy: { weightMin: 'asc' } } },
        })
        if (methodWithRules && methodWithRules.weightRules.length > 0) {
          // Calculate total weight from items
          let totalWeight = 0
          for (const item of items) {
            const stockItem = await db.stockItem.findFirst({
              where: { sku: item.sku },
              select: { weight: true },
            })
            const itemWeight = stockItem?.weight || 0
            totalWeight += itemWeight * (item.qty || 1)
          }
          // Default: items without weight = 500g each
          if (totalWeight === 0 && items.length > 0) {
            totalWeight = items.reduce((s: number, i: any) => s + 500 * (i.qty || 1), 0)
          }
          // Find the matching weight rule
          const rule = methodWithRules.weightRules.find(r => totalWeight >= r.weightMin && totalWeight <= r.weightMax)
          if (rule) {
            shippingCost = rule.price
          } else {
            const highestRule = methodWithRules.weightRules[methodWithRules.weightRules.length - 1]
            if (highestRule && totalWeight > highestRule.weightMax) {
              shippingCost = highestRule.price
            }
          }
        }
      }
    }

    // Get payment method (for label)
    let paymentMethodLabel = paymentMethodCode || 'demo'
    try {
      if (paymentMethodCode) {
        const pm = await db.paymentMethod.findUnique({ where: { code: paymentMethodCode } })
        if (pm) paymentMethodLabel = pm.label
      }
    } catch {}

    // Generate order ID
    const orderId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    const invoiceNumbers: string[] = []
    let subtotal = 0
    const orderItems: any[] = []

    for (const item of items) {
      const stockItem = await db.stockItem.findFirst({
        where: { sku: item.sku, status: 'PUBLIE' },
      })
      if (!stockItem) continue

      const salePrice = Number(item.price) || 0
      subtotal += salePrice
      const purchaseCost = stockItem.purchaseCost || 0
      const itemShipping = shippingCost / items.length
      const profit = salePrice - purchaseCost - itemShipping
      const margin = purchaseCost > 0 ? (profit / purchaseCost) * 100 : (salePrice > 0 ? (profit / salePrice) * 100 : 0)

      // Generate invoice number
      const counter = (invoiceSettings?.invoiceCounter || 0) + invoiceNumbers.length + 1
      const padLength = invoiceSettings?.invoicePadLength || 3
      const paddedCounter = String(counter).padStart(padLength, '0')
      const prefix = (invoiceSettings?.invoicePrefix || 'F-{YEAR}-').replace('{YEAR}', String(new Date().getFullYear()))
      const invoiceNumber = `${prefix}${paddedCounter}`

      await db.sale.create({
        data: {
          saleDate: new Date(),
          salePrice,
          shippingCost: itemShipping,
          platformFees: 0,
          platformFixedFees: 0,
          platform: 'boutique',
          paymentMethod: paymentMethodLabel,
          customerName: `${customer.firstName} ${customer.lastName}`,
          customerContact: JSON.stringify({
            email: customer.email,
            phone: customer.phone || null,
            address: `${customer.address}, ${customer.postalCode} ${customer.city}, ${customer.country || 'France'}`,
          }),
          stockItemId: stockItem.id,
          userId: adminUser.id,
          invoiceNumber,
          profit: parseFloat(profit.toFixed(2)),
          margin: parseFloat(margin.toFixed(2)),
        },
      })

      await db.stockItem.update({
        where: { id: stockItem.id },
        data: { status: 'VENDU', platform: 'boutique' },
      })

      invoiceNumbers.push(invoiceNumber)
      orderItems.push({
        sku: item.sku,
        brand: stockItem.brand,
        category: stockItem.category,
        size: stockItem.size,
        color: stockItem.color,
        price: salePrice,
        qty: item.qty || 1,
      })
    }

    if (invoiceNumbers.length === 0) {
      return NextResponse.json({ error: 'Aucun article disponible' }, { status: 400 })
    }

    // Apply free shipping AFTER subtotal is known
    if (boutiqueSettings.freeShippingEnabled && subtotal >= (boutiqueSettings.freeShippingThreshold || 50)) {
      shippingCost = 0
    }

    const total = subtotal + shippingCost

    // Create the BoutiqueOrder
    const order = await db.boutiqueOrder.create({
      data: {
        orderId,
        clientId: clientToken?.id || null,
        customerSnapshot: JSON.stringify(customer),
        items: JSON.stringify(orderItems),
        shippingMethod: shippingMethod.label,
        shippingCost,
        paymentMethod: paymentMethodLabel,
        subtotal: parseFloat(subtotal.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        notes: notes || null,
        status: 'pending',
        invoiceNumbers: JSON.stringify(invoiceNumbers),
        relayId: isRelayMethod ? String(relayId) : null,
        relayName: isRelayMethod ? String(relayName) : null,
        relayAddress: isRelayMethod ? String(relayAddress) : null,
      },
    })

    // Increment invoice counter (single update)
    if (invoiceSettings) {
      await db.invoiceSettings.update({
        where: { id: invoiceSettings.id },
        data: { invoiceCounter: { increment: invoiceNumbers.length } },
      })
    }

    // Send email notifications (client + admin)
    await notifyNewOrder(customer.email, customer.firstName, orderId, total)

    return NextResponse.json({
      orderId,
      boutiqueOrderId: order.id,
      invoiceNumbers,
      totalAmount: parseFloat(total.toFixed(2)),
      shippingCost,
      subtotal: parseFloat(subtotal.toFixed(2)),
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
      itemCount: invoiceNumbers.length,
    })
  } catch (error) {
    console.error('POST /api/boutique/checkout error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la commande' }, { status: 500 })
  }
}
