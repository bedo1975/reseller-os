import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import { CARRIERS } from '@/lib/constants'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await req.json()

    // Verify existence (admin can edit any, staff can edit any too — permission checked in UI)
    const existingSale = await db.sale.findUnique({ where: { id } })
    if (!existingSale) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
    }

    const allowed = [
      'saleDate', 'platform', 'customerName', 'customerContact',
      'salePrice', 'shippingCost', 'carrierShippingCost', 'paymentFees', 'paymentMethod', 'platformFees', 'platformFixedFees',
      'carrier', 'trackingNumber', 'parcelStatus', 'notes',
    ]
    const updateData: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key]
    }

    // Convertit les chaînes en nombres pour les champs Float
    if ('salePrice' in updateData) updateData.salePrice = parseFloat(updateData.salePrice as string)
    if ('shippingCost' in updateData) updateData.shippingCost = parseFloat(updateData.shippingCost as string) || 0
    if ('carrierShippingCost' in updateData) updateData.carrierShippingCost = parseFloat(updateData.carrierShippingCost as string) || 0
    if ('paymentFees' in updateData) updateData.paymentFees = parseFloat(updateData.paymentFees as string) || 0
    if ('platformFees' in updateData) updateData.platformFees = parseFloat(updateData.platformFees as string) || 0
    if ('platformFixedFees' in updateData) updateData.platformFixedFees = parseFloat(updateData.platformFixedFees as string) || 0

    // Recalculer profit & marge si les montants changent
    const priceChanged = 'salePrice' in updateData || 'shippingCost' in updateData ||
                         'carrierShippingCost' in updateData || 'paymentFees' in updateData ||
                         'platformFees' in updateData || 'platformFixedFees' in updateData

    if (priceChanged) {
      const current = await db.sale.findUnique({ where: { id }, include: { stockItem: true } })
      if (current) {
        const price = 'salePrice' in updateData ? parseFloat(updateData.salePrice as string) : current.salePrice
        const shipping = 'shippingCost' in updateData ? parseFloat(updateData.shippingCost as string) : current.shippingCost
        const carrierShipping = 'carrierShippingCost' in updateData ? parseFloat(updateData.carrierShippingCost as string) : current.carrierShippingCost
        const payFees = 'paymentFees' in updateData ? parseFloat(updateData.paymentFees as string) : (current.paymentFees || 0)
        const fees = 'platformFees' in updateData ? parseFloat(updateData.platformFees as string) : current.platformFees
        const fixedFees = 'platformFixedFees' in updateData ? parseFloat(updateData.platformFixedFees as string) : (current.platformFixedFees || 0)
        const totalFees = (fees || 0) + (fixedFees || 0)
        // CA brut = prix de vente + frais port client
        // Profit = CA brut - frais bancaires - coût achat - frais plateforme - frais port transporteur
        const ca = price + (shipping || 0)
        const profit = ca - (payFees || 0) - current.stockItem.purchaseCost - totalFees - (carrierShipping || 0)
        updateData.profit = parseFloat(profit.toFixed(2))
        updateData.margin = parseFloat(((ca > 0 ? (profit / ca) * 100 : 0)).toFixed(1))
      }
    }

    if ('saleDate' in updateData) updateData.saleDate = new Date(updateData.saleDate as string)

    const sale = await db.sale.update({
      where: { id },
      data: updateData,
      include: { stockItem: true },
    })

    // ── Sync the linked BoutiqueOrder (if any) ──
    // When the user edits a sale (price, carrier, tracking, status, notes),
    // we mirror the changes on the auto-generated BoutiqueOrder linked by invoiceNumber.
    try {
      if (sale.invoiceNumber) {
        // Build the order update payload from the changed fields
        const orderUpdate: Record<string, unknown> = {}
        if ('salePrice' in updateData || 'shippingCost' in updateData) {
          orderUpdate.subtotal = parseFloat(sale.salePrice.toFixed(2))
          orderUpdate.total = parseFloat((sale.salePrice + sale.shippingCost).toFixed(2))
          orderUpdate.shippingCost = sale.shippingCost
          // Update items array with the new price
          orderUpdate.items = JSON.stringify([{
            sku: sale.stockItem.sku,
            brand: sale.stockItem.brand,
            category: sale.stockItem.category,
            size: sale.stockItem.size || null,
            color: sale.stockItem.color || null,
            price: sale.salePrice,
            qty: 1,
          }])
        }
        if ('carrier' in updateData) {
          // shippingMethod is the carrier's human label
          const c = CARRIERS.find(x => x.id === sale.carrier)
          orderUpdate.shippingMethod = c?.label || sale.carrier || 'Standard'
        }
        if ('paymentMethod' in updateData) {
          orderUpdate.paymentMethod = sale.paymentMethod || null
        }
        if ('platform' in updateData) {
          orderUpdate.platform = sale.platform || 'boutique'
        }
        if ('notes' in updateData) {
          orderUpdate.notes = sale.notes || null
        }
        // Derive the new order status from the sale's parcelStatus + trackingNumber
        if ('parcelStatus' in updateData || 'trackingNumber' in updateData) {
          const ps = sale.parcelStatus
          const tn = sale.trackingNumber
          if (ps === 'LIVRE') orderUpdate.status = 'delivered'
          else if (ps === 'EN_TRANSIT' || ps === 'A_DEPOSER') orderUpdate.status = 'shipped'
          else if (tn) orderUpdate.status = 'shipped'
          else if (ps === 'A_PREPARER' || ps === 'A_IMPRIMER') orderUpdate.status = 'preparation'
          else orderUpdate.status = 'paid'
        }

        if (Object.keys(orderUpdate).length > 0) {
          // Find the linked order by invoiceNumber (stored in invoiceNumbers JSON array)
          // We use findFirst with a JSON contains check (SQLite-compatible via string match)
          const allOrders = await db.boutiqueOrder.findMany({
            where: { invoiceNumbers: { contains: sale.invoiceNumber } },
          })
          for (const o of allOrders) {
            try {
              const invs = JSON.parse(o.invoiceNumbers) as string[]
              if (invs.includes(sale.invoiceNumber)) {
                await db.boutiqueOrder.update({ where: { id: o.id }, data: orderUpdate })
              }
            } catch {}
          }
        }
      }
    } catch (syncErr) {
      console.error('[sales] Failed to sync linked BoutiqueOrder on PATCH:', syncErr)
    }

    return NextResponse.json(sale)
  } catch (error) {
    console.error('PATCH /api/sales/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const sale = await db.sale.findUnique({ where: { id } })
    if (!sale) {
      return NextResponse.json({ error: 'Vente introuvable' }, { status: 404 })
    }
    await db.stockItem.update({
      where: { id: sale.stockItemId },
      data: {
        // Réincrémente le stock d'1 unité
        quantity: { increment: 1 },
        soldCount: { decrement: 1 },
        // Repasse en PUBLIE si la quantité est redevenue > 0
        status: 'PUBLIE',
      },
    })

    // ── Cancel/delete the linked BoutiqueOrder (if any) ──
    // We don't actually delete the order (it's a record), we just mark it as "cancelled"
    // so the user can see in Boutique Admin → Commandes that the sale was reverted.
    try {
      if (sale.invoiceNumber) {
        const linkedOrders = await db.boutiqueOrder.findMany({
          where: { invoiceNumbers: { contains: sale.invoiceNumber } },
        })
        for (const o of linkedOrders) {
          try {
            const invs = JSON.parse(o.invoiceNumbers) as string[]
            if (invs.includes(sale.invoiceNumber)) {
              await db.boutiqueOrder.update({
                where: { id: o.id },
                data: { status: 'cancelled' },
              })
            }
          } catch {}
        }
      }
    } catch (cancelErr) {
      console.error('[sales] Failed to cancel linked BoutiqueOrder on DELETE:', cancelErr)
    }

    await db.sale.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/sales/[id] error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
