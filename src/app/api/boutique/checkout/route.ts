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
    const { customer, items, shippingMethodCode, paymentMethodCode, notes, relayId, relayName, relayAddress, shippingCost: clientShippingCost, couponCode, paidImmediately, paymentIntentId } = body

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
        db.shippingMethod.create({ data: { code: 'relay', label: 'Point relais (Mondial Relay)', price: 3.20, delay: '3 à 6 jours ouvrés', carrierCode: 'mondial_relay', active: true, order: 3 } }),
        db.shippingMethod.create({ data: { code: 'chronopost_relay', label: 'Point relais (Chronopost Shop2Shop)', price: 4.50, delay: '2 à 4 jours ouvrés', carrierCode: 'chronopost', active: true, order: 4 } }),
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

    // Get payment method (for label + fees config)
    let paymentMethodLabel = paymentMethodCode || 'demo'
    let paymentMethodConfig: { feesFixed: number; feesPercent: number } | null = null
    try {
      if (paymentMethodCode) {
        const pm = await db.paymentMethod.findUnique({ where: { code: paymentMethodCode } })
        if (pm) {
          paymentMethodLabel = pm.label
          paymentMethodConfig = { feesFixed: pm.feesFixed || 0, feesPercent: pm.feesPercent || 0 }
        }
      }
    } catch {}

    // Generate order ID
    const orderId = `CMD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`

    // ── Calcul du poids total + coût réel transporteur (carrierShippingCost) ──
    // Le carrierShippingCost est ce que le revendeur paie réellement au transporteur.
    // Il est calculé à partir des CarrierPricingRule (Settings → Transporteurs → Gérer les tranches)
    // en fonction du carrierCode du ShippingMethod choisi par le client.
    const carrierCode = shippingMethod?.carrierCode || null
    let totalOrderWeight = 0
    for (const item of items) {
      const stockItem = await db.stockItem.findFirst({
        where: { sku: item.sku },
        select: { weight: true },
      })
      const itemWeight = stockItem?.weight || 0
      totalOrderWeight += itemWeight * (Math.max(1, parseInt(item.qty) || 1))
    }
    // Default: items without weight = 500g each
    if (totalOrderWeight === 0 && items.length > 0) {
      totalOrderWeight = items.reduce((s: number, i: any) => s + 500 * (i.qty || 1), 0)
    }

    let carrierShippingCost = 0
    if (carrierCode) {
      const carrierRules = await db.carrierPricingRule.findMany({
        where: { carrierCode, active: true },
        orderBy: { weightMin: 'asc' },
      })
      if (carrierRules.length > 0) {
        const matchingRule = carrierRules.find(r => totalOrderWeight >= r.weightMin && totalOrderWeight <= r.weightMax)
        if (matchingRule) {
          carrierShippingCost = matchingRule.price
        } else {
          // If weight > max weight, use the highest tier
          const highest = carrierRules[carrierRules.length - 1]
          if (totalOrderWeight > highest.weightMax) {
            carrierShippingCost = highest.price
          }
        }
      }
    }

    // Generate ONE invoice number for the entire order — all articles in the
    // checkout will share this same invoiceNumber, so the generated invoice
    // will display all the order's articles on a single document.
    const { generateInvoiceNumber } = await import('@/lib/invoice')
    const { number: sharedInvoiceNumber } = await generateInvoiceNumber(adminUser.id)
    const invoiceNumbers: string[] = [sharedInvoiceNumber]

    let subtotal = 0
    const orderItems: any[] = []

    for (const item of items) {
      const qty = Math.max(1, parseInt(item.qty) || 1)
      const stockItem = await db.stockItem.findFirst({
        where: { sku: item.sku, status: 'PUBLIE', quantity: { gte: qty } },
      })
      if (!stockItem) continue

      const salePrice = Number(item.price) || 0
      subtotal += salePrice * qty
      const purchaseCost = stockItem.purchaseCost || 0
      const itemShipping = shippingCost / items.length
      // Coût réel transporteur au prorata de cet article (carrierShippingCost total / nb articles)
      const itemCarrierShipping = carrierShippingCost / items.length

      // Calcul des frais bancaires (Stripe, PayPal...) au prorata de cet article
      // paymentFees = feesFixed (prorata) + (CA item × feesPercent / 100)
      let itemPaymentFees = 0
      if (paymentMethodConfig) {
        const itemCa = salePrice + itemShipping
        const itemFeesFixed = paymentMethodConfig.feesFixed / items.length
        const itemFeesPercent = itemCa * (paymentMethodConfig.feesPercent / 100)
        itemPaymentFees = itemFeesFixed + itemFeesPercent
      }

      // CA brut = prix article × qty + frais port facturés client (part de cet article)
      // salePrice is the UNIT price — we store it as-is on the Sale.
      // profit is the LINE profit (unit profit × qty) so that sum(profit) in the
      // taxes module correctly reflects the total profit for multi-qty items.
      const ca = salePrice + itemShipping
      const unitProfit = ca - itemPaymentFees - purchaseCost - itemCarrierShipping
      const lineProfit = unitProfit * qty  // multiply by qty for the line total
      const margin = ca > 0 ? (unitProfit / ca) * 100 : 0  // margin is a ratio — same at unit or line level

      // Create one Sale per article — all sharing the SAME invoice number.
      // The Sale stores the UNIT price + qty so the invoice can render the line
      // total correctly (unit price × qty) without ambiguity.
      await db.sale.create({
        data: {
          saleDate: new Date(),
          salePrice,                                  // UNIT price
          qty,                                        // quantity ordered
          shippingCost: itemShipping,                 // line shipping share
          carrierShippingCost: parseFloat(itemCarrierShipping.toFixed(2)),
          paymentFees: parseFloat(itemPaymentFees.toFixed(2)),
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
          invoiceNumber: sharedInvoiceNumber,
          profit: parseFloat(lineProfit.toFixed(2)),  // LINE profit (already × qty)
          margin: parseFloat(margin.toFixed(2)),
        },
      })

      // Décrémente le stock. Passe à VENDU seulement si quantité = 0.
      const newQty = stockItem.quantity - qty
      const newSoldCount = stockItem.soldCount + qty
      const newStatus = newQty <= 0 ? 'VENDU' : 'PUBLIE'
      await db.stockItem.update({
        where: { id: stockItem.id },
        data: {
          quantity: Math.max(0, newQty),
          soldCount: newSoldCount,
          status: newStatus,
          // On ne touche à platform que si l'article est totalement vendu
          ...(newQty <= 0 ? { platform: 'boutique' } : {}),
        },
      })

      orderItems.push({
        sku: item.sku,
        brand: stockItem.brand,
        category: stockItem.category,
        size: stockItem.size,
        color: stockItem.color,
        price: salePrice,
        qty,
      })
    }

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'Aucun article disponible' }, { status: 400 })
    }

    // Apply free shipping AFTER subtotal is known
    if (boutiqueSettings.freeShippingEnabled && subtotal >= (boutiqueSettings.freeShippingThreshold || 50)) {
      shippingCost = 0
    }

    // ── Coupon de réduction (re-validation server-side) ─────────
    let discountAmount = 0
    let appliedCouponCode: string | null = null
    if (couponCode && typeof couponCode === 'string') {
      const coupon = await db.coupon.findUnique({
        where: { code: couponCode.trim().toUpperCase() },
      })
      if (coupon) {
        const now = new Date()
        const isStillActive = coupon.active
          && (!coupon.startsAt || now >= coupon.startsAt)
          && (!coupon.expiresAt || now <= coupon.expiresAt)
          && (coupon.maxUses === null || coupon.usedCount < coupon.maxUses)
          && subtotal >= coupon.minAmount
        if (isStillActive) {
          if (coupon.type === 'percent') {
            discountAmount = (subtotal * coupon.value) / 100
          } else {
            discountAmount = coupon.value
          }
          if (discountAmount > subtotal) discountAmount = subtotal
          discountAmount = Math.round(discountAmount * 100) / 100
          appliedCouponCode = coupon.code
        }
      }
    }

    const subtotalAfterDiscount = Math.max(0, subtotal - discountAmount)

    // Re-check free shipping with the discounted subtotal (consistent with frontend)
    if (boutiqueSettings.freeShippingEnabled && subtotalAfterDiscount >= (boutiqueSettings.freeShippingThreshold || 50)) {
      shippingCost = 0
    }

    const total = subtotalAfterDiscount + shippingCost

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
        platform: 'boutique',
        subtotal: parseFloat(subtotal.toFixed(2)),
        total: parseFloat(total.toFixed(2)),
        couponCode: appliedCouponCode,
        discountAmount: parseFloat(discountAmount.toFixed(2)),
        notes: notes || null,
        status: paidImmediately ? 'paid' : 'pending',
        invoiceNumbers: JSON.stringify(invoiceNumbers),
        relayId: isRelayMethod ? String(relayId) : null,
        relayName: isRelayMethod ? String(relayName) : null,
        relayAddress: isRelayMethod ? String(relayAddress) : null,
      },
    })

    // Link all Sales created in this checkout to the BoutiqueOrder.
    // This way the parcels module can group multiple articles of the same order into 1 colis.
    if (invoiceNumbers.length > 0) {
      await db.sale.updateMany({
        where: { invoiceNumber: { in: invoiceNumbers } },
        data: { boutiqueOrderId: order.id },
      })
    }

    // If paidImmediately (Stripe payment already succeeded), add the paymentIntentId to notes
    if (paidImmediately && paymentIntentId) {
      await db.boutiqueOrder.update({
        where: { id: order.id },
        data: {
          notes: (notes || '') + `\n[Stripe] Paiement confirmé — PI: ${paymentIntentId}`,
        },
      })
    }

    // Increment coupon usage counter (if a coupon was applied)
    if (appliedCouponCode) {
      try {
        await db.coupon.updateMany({
          where: { code: appliedCouponCode },
          data: { usedCount: { increment: 1 } },
        })
      } catch (e) {
        console.error('Failed to increment coupon usage:', e)
      }
    }

    // Note: invoice counter was already incremented by generateInvoiceNumber() above.
    // No need to increment again — we now use ONE shared invoice number per order
    // (not one per article, as before).

    // Send email notifications (client + admin)
    await notifyNewOrder(customer.email, customer.firstName, orderId, total)

    return NextResponse.json({
      orderId,
      boutiqueOrderId: order.id,
      invoiceNumbers,
      totalAmount: parseFloat(total.toFixed(2)),
      shippingCost,
      subtotal: parseFloat(subtotal.toFixed(2)),
      discountAmount: parseFloat(discountAmount.toFixed(2)),
      couponCode: appliedCouponCode,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
      },
      // itemCount = total physical articles in the cart (sum of qty across all line items)
      // This is what the customer expects to see ("3 articles" for a 2× + 1× order)
      itemCount: orderItems.reduce((sum, it) => sum + (it.qty || 1), 0),
    })
  } catch (error) {
    console.error('POST /api/boutique/checkout error:', error)
    return NextResponse.json({ error: 'Erreur serveur lors de la commande' }, { status: 500 })
  }
}
