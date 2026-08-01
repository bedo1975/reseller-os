import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// GET /api/accounting?type=recettes|achats&year=2026&month=6
// Génère le livre des recettes ou le registre des achats au format légal
// ADMIN ONLY — données fiscales confidentielles
export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'recettes'
    const yearStr = searchParams.get('year')
    const year = yearStr ? parseInt(yearStr) : new Date().getFullYear()
    const monthStr = searchParams.get('month')
    const month = monthStr ? parseInt(monthStr) : null  // 1-12 ou null (toute l'année)

    // Construction du filtre de date
    let dateFilter: { gte: Date; lte: Date }
    if (month) {
      dateFilter = {
        gte: new Date(year, month - 1, 1, 0, 0, 0, 0),
        lte: new Date(year, month, 0, 23, 59, 59, 999),
      }
    } else {
      dateFilter = {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`),
      }
    }

    // Libellé période
    const periodLabel = month
      ? new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
      : `Année ${year}`

    if (type === 'recettes') {
      // Récupère les paramètres de facturation pour la mention TVA
      const adminUser = await requireAdmin()
      const invoiceSettings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
      const vatEnabled = invoiceSettings?.vatEnabled || false
      const vatExemptionText = invoiceSettings?.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base'

      const sales = await db.sale.findMany({
        where: { saleDate: dateFilter },
        include: { stockItem: true },
        orderBy: { saleDate: 'asc' },
      })

      const entries = sales.map((sale, idx) => {
        const platformLabels: Record<string, string> = {
          vinted: 'Vinted', leboncoin: 'Leboncoin', ebay: 'eBay', vestiaire: 'Vestiaire Collective',
          boutique: 'Boutique',
        }
        const platformPaymentMethods: Record<string, string> = {
          vinted: 'Virement (porte-monnaie Vinted)',
          leboncoin: 'Virement / Paiement LBC',
          ebay: 'Virement PayPal / eBay',
          vestiaire: 'Virement Vestiaire Collective',
        }
        // Pour les ventes boutique, utiliser le paymentMethod réel (CB, PayPal, etc.)
        // Pour les ventes marketplace, utiliser le mode de paiement par défaut de la plateforme
        const modePaiement = sale.paymentMethod || platformPaymentMethods[sale.platform] || 'Virement'
        return {
          numero: idx + 1,
          date: sale.saleDate,
          dateEncaissement: sale.saleDate,
          invoiceNumber: sale.invoiceNumber || '—',
          designation: `${sale.stockItem.brand} ${sale.stockItem.category} ${sale.stockItem.size || ''} ${sale.stockItem.color || ''}`.trim().replace(/\s+/g, ' '),
          client: sale.customerName || `Client ${platformLabels[sale.platform] || sale.platform}`,
          origine: platformLabels[sale.platform] || sale.platform,
          modePaiement,
          montantHT: parseFloat((sale.salePrice / 1.2).toFixed(2)),
          montantTTC: parseFloat(sale.salePrice.toFixed(2)),
          tva: 0,
          sku: sale.stockItem.sku,
        }
      })

      const totalTTC = entries.reduce((s, e) => s + e.montantTTC, 0)
      const totalHT = entries.reduce((s, e) => s + e.montantHT, 0)

      // Totaux par mois (toujours sur l'année complète pour le récap)
      const allYearSales = month
        ? await db.sale.findMany({
            where: { saleDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`), lte: new Date(`${year}-12-31T23:59:59.999Z`) } },
          })
        : sales
      const monthlyTotals: { month: string; monthNum: number; total: number; count: number }[] = []
      for (let m = 0; m < 12; m++) {
        const monthEntries = allYearSales.filter(s => new Date(s.saleDate).getMonth() === m)
        if (monthEntries.length > 0) {
          monthlyTotals.push({
            month: new Date(year, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            monthNum: m + 1,
            total: parseFloat(monthEntries.reduce((s, sal) => s + sal.salePrice, 0).toFixed(2)),
            count: monthEntries.length,
          })
        }
      }

      return NextResponse.json({
        type: 'recettes', year, month, periodLabel,
        regime: 'Micro-entreprise',
        vatEnabled,
        vatExemptionText,
        tvaRegime: vatEnabled
          ? `TVA applicable (taux ${invoiceSettings?.vatRate || 20}%)`
          : vatExemptionText,
        entries,
        totalTTC: parseFloat(totalTTC.toFixed(2)),
        totalHT: parseFloat(totalHT.toFixed(2)),
        monthlyTotals,
        count: entries.length,
      })
    }

    if (type === 'achats') {
      // Récupère les paramètres de facturation pour savoir si TVA est activé
      const adminUser = await requireAdmin()
      const invoiceSettings = await db.invoiceSettings.findUnique({ where: { userId: adminUser.id } })
      const vatEnabled = invoiceSettings?.vatEnabled || false
      const vatRate = invoiceSettings?.vatRate || 20.0
      const vatExemptionText = invoiceSettings?.vatExemptionText || 'TVA non applicable, art. 293 B du CGI — franchise en base'

      // TOUS les articles achetés sur la période (vendus ou non).
      // Le livre des achats enregistre les achats au moment de l'achat, pas de la revente.
      // EXCLUSION : les articles issus d'une pré-commande (preOrderId non null) sont exclus
      // car leur coût est déjà comptabilisé via le Purchase créé lors de la validation de la
      // pré-commande. Sans cette exclusion, le même achat serait compté deux fois.
      const items = await db.stockItem.findMany({
        where: {
          purchaseDate: dateFilter,
          preOrderId: null,  // exclure les articles issus de pré-commandes
        },
        include: { supplier: true, sales: { orderBy: { saleDate: 'desc' } } },
        orderBy: { purchaseDate: 'asc' },
      })

      const paymentMethodLabels: Record<string, string> = {
        especes: 'Espèces',
        carte_bancaire: 'Carte bancaire',
        virement: 'Virement',
        cheque: 'Chèque',
        paypal: 'PayPal',
      }

      const supplierLabels: Record<string, string> = {
        friperie: 'Friperie', grossiste: 'Grossiste', destockeur: 'Déstockeur',
        'vide-grenier': 'Vide-grenier', particulier: 'Particulier',
        fournisseur_divers: 'Fournisseur divers',
      }

      const entries = items.map((item, idx) => {
        // purchaseCost is the UNIT cost; multiply by quantity to get the total purchase amount.
        // Default quantity to 1 if not set (backward compat with old items).
        const qty = item.quantity || 1
        const montantTTC = item.purchaseCost * qty
        const montantHT = vatEnabled ? montantTTC / (1 + vatRate / 100) : montantTTC
        const firstSale = item.sales && item.sales.length > 0 ? item.sales[0] : null
        const designationBase = `${item.brand} ${item.category} ${item.size || ''} ${item.color || ''}`.trim().replace(/\s+/g, ' ')
        return {
          numero: idx + 1,
          date: item.purchaseDate,
          invoiceNumber: item.purchaseInvoiceNumber || firstSale?.invoiceNumber || '—',
          orderNumber: '—',  // les articles en stock n'ont pas de n° commande fournisseur
          designation: qty > 1 ? `${designationBase} (×${qty})` : designationBase,
          fournisseur: item.supplier?.name || '—',
          siret: item.supplier?.siret || null,
          typeFournisseur: item.supplier ? (supplierLabels[item.supplier.type] || item.supplier.type) : '—',
          lotReference: item.lotReference || '—',
          modePaiement: item.purchasePaymentMethod ? (paymentMethodLabels[item.purchasePaymentMethod] || item.purchasePaymentMethod) : '—',
          montant: parseFloat(montantTTC.toFixed(2)),
          montantHT: parseFloat(montantHT.toFixed(2)),
          sku: item.sku,
          prixVente: firstSale ? parseFloat(firstSale.salePrice.toFixed(2)) : null,
          vendu: !!firstSale,
          quantite: qty,
        }
      })

      const total = entries.reduce((s, e) => s + e.montant, 0)
      const totalHT = entries.reduce((s, e) => s + e.montantHT, 0)

      // Totaux par mois (sur l'année complète, tous les articles achetés)
      // Exclure aussi les articles issus de pré-commandes (preOrderId non null)
      const allYearItems = month
        ? await db.stockItem.findMany({
            where: {
              purchaseDate: { gte: new Date(`${year}-01-01T00:00:00.000Z`), lte: new Date(`${year}-12-31T23:59:59.999Z`) },
              preOrderId: null,
            },
          })
        : items
      const monthlyTotals: { month: string; monthNum: number; total: number; count: number }[] = []
      for (let m = 0; m < 12; m++) {
        const monthEntries = allYearItems.filter(i => new Date(i.purchaseDate).getMonth() === m)
        if (monthEntries.length > 0) {
          monthlyTotals.push({
            month: new Date(year, m, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            monthNum: m + 1,
            total: parseFloat(monthEntries.reduce((s, it) => s + it.purchaseCost * (it.quantity || 1), 0).toFixed(2)),
            count: monthEntries.length,
          })
        }
      }

      const bySupplierType: Record<string, { total: number; count: number }> = {}
      entries.forEach(e => {
        const t = e.typeFournisseur
        if (!bySupplierType[t]) bySupplierType[t] = { total: 0, count: 0 }
        bySupplierType[t].total += e.montant
        bySupplierType[t].count += 1
      })

      // ─── Achats hors stock (fournitures, emballages, outils...) ───
      const purchases = await db.purchase.findMany({
        where: { date: dateFilter, userId: adminUser.id },
        include: { supplier: true },
        orderBy: { date: 'asc' },
      })

      const purchaseCategoryLabels: Record<string, string> = {
        fourniture: 'Fourniture bureau',
        emballage: 'Emballage',
        outil: 'Outil',
        materiel: 'Matériel',
        precommande: 'Pré-commande fournisseur',
        autre: 'Autre',
      }

      const purchaseEntries = purchases.map((p, idx) => {
        const purchaseMontantTTC = p.amount
        const purchaseMontantHT = vatEnabled ? purchaseMontantTTC / (1 + vatRate / 100) : purchaseMontantTTC
        return {
          numero: entries.length + idx + 1,
          date: p.date,
          invoiceNumber: p.invoiceNumber || '—',
          orderNumber: p.orderNumber || '—',  // n° commande fournisseur (pour les pré-commandes)
          designation: p.designation,
          fournisseur: p.supplier?.name || p.supplierName || '—',
          siret: p.supplier?.siret || null,
          typeFournisseur: p.supplier ? (supplierLabels[p.supplier.type] || p.supplier.type) : (purchaseCategoryLabels[p.category] || 'Achat hors stock'),
          lotReference: '—',
          modePaiement: p.paymentMethod ? (paymentMethodLabels[p.paymentMethod] || p.paymentMethod) : '—',
          montant: parseFloat(purchaseMontantTTC.toFixed(2)),
          montantHT: parseFloat(purchaseMontantHT.toFixed(2)),
          sku: '—',
          prixVente: null,
          isHorsStock: true,
        }
      })

      // Fusionne les deux listes
      const allEntries = [...entries, ...purchaseEntries]
      const allTotal = allEntries.reduce((s, e) => s + e.montant, 0)
      const allTotalHT = allEntries.reduce((s, e) => s + e.montantHT, 0)

      // Recalcule bySupplierType avec les achats hors stock
      purchaseEntries.forEach(e => {
        const t = e.typeFournisseur
        if (!bySupplierType[t]) bySupplierType[t] = { total: 0, count: 0 }
        bySupplierType[t].total += e.montant
        bySupplierType[t].count += 1
      })

      return NextResponse.json({
        type: 'achats', year, month, periodLabel,
        regime: 'Micro-entreprise',
        vatEnabled,
        vatExemptionText,
        vatRate,
        tvaRegime: vatEnabled
          ? `TVA applicable — taux ${vatRate}%`
          : vatExemptionText,
        entries: allEntries,
        total: parseFloat(allTotal.toFixed(2)),
        totalHT: parseFloat(allTotalHT.toFixed(2)),
        monthlyTotals,
        bySupplierType: Object.entries(bySupplierType).map(([type, v]) => ({
          type, total: parseFloat(v.total.toFixed(2)), count: v.count,
        })),
        count: allEntries.length,
      })
    }

    return NextResponse.json({ error: 'Type invalide (recettes ou achats)' }, { status: 400 })
  } catch (error) {
    console.error('GET /api/accounting error:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
