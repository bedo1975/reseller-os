import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// GET /api/urssaf?year=2026&month=6
// Calcule le CA et les cotisations URSSAF sur le mois, le trimestre et l'année
// ADMIN ONLY
export async function GET(req: NextRequest) {
  try {
    const adminUser = await requireAdmin()
    const { searchParams } = new URL(req.url)
    const yearStr = searchParams.get('year')
    const year = yearStr ? parseInt(yearStr) : new Date().getFullYear()
    const monthStr = searchParams.get('month')
    const month = monthStr ? parseInt(monthStr) : null  // 1-12 ou null (toute l'année)

    // Récupère les paramètres de cotisation
    let taxSettings = await db.taxSettings.findUnique({ where: { userId: adminUser.id } })
    if (!taxSettings) {
      taxSettings = await db.taxSettings.create({
        data: { userId: adminUser.id, activityType: 'achat_revente', taxRate: 12.3 },
      })
    }
    const taxRate = taxSettings.taxRate

    // ─── CA du mois sélectionné ───
    const monthStart = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1)
    const monthEnd = month ? new Date(year, month, 0, 23, 59, 59, 999) : new Date(year, 11, 31, 23, 59, 59, 999)

    const monthSales = await db.sale.findMany({
      where: {
        saleDate: { gte: monthStart, lte: monthEnd },
        userId: adminUser.id,
      },
    })
    const monthCA = monthSales.reduce((s, x) => s + x.salePrice, 0)
    const monthCotisation = parseFloat((monthCA * taxRate / 100).toFixed(2))

    // ─── CA du trimestre (basé sur le mois sélectionné ou le mois courant) ───
    const refMonth = month || (new Date().getMonth() + 1)
    const trimStartMonth = Math.floor((refMonth - 1) / 3) * 3 + 1  // 1, 4, 7 ou 10
    const trimEndMonth = trimStartMonth + 2
    const trimStart = new Date(year, trimStartMonth - 1, 1)
    const trimEnd = new Date(year, trimEndMonth, 0, 23, 59, 59, 999)

    const trimSales = await db.sale.findMany({
      where: {
        saleDate: { gte: trimStart, lte: trimEnd },
        userId: adminUser.id,
      },
    })
    const trimCA = trimSales.reduce((s, x) => s + x.salePrice, 0)
    const trimCotisation = parseFloat((trimCA * taxRate / 100).toFixed(2))
    const trimLabel = `T${Math.floor((refMonth - 1) / 3) + 1} ${year}`

    // ─── CA de l'année ───
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999)

    const yearSales = await db.sale.findMany({
      where: {
        saleDate: { gte: yearStart, lte: yearEnd },
        userId: adminUser.id,
      },
    })
    const yearCA = yearSales.reduce((s, x) => s + x.salePrice, 0)
    const yearCotisation = parseFloat((yearCA * taxRate / 100).toFixed(2))

    // ─── Détail mensuel sur l'année (pour le tableau récap) ───
    const monthlyBreakdown: { month: string; monthNum: number; ca: number; cotisation: number; salesCount: number }[] = []
    for (let m = 0; m < 12; m++) {
      const mSales = yearSales.filter(s => new Date(s.saleDate).getMonth() === m)
      if (mSales.length > 0) {
        const ca = mSales.reduce((s, x) => s + x.salePrice, 0)
        monthlyBreakdown.push({
          month: new Date(year, m, 1).toLocaleDateString('fr-FR', { month: 'long' }),
          monthNum: m + 1,
          ca: parseFloat(ca.toFixed(2)),
          cotisation: parseFloat((ca * taxRate / 100).toFixed(2)),
          salesCount: mSales.length,
        })
      }
    }

    // ─── Trimestres ───
    const quarterlyBreakdown: { label: string; ca: number; cotisation: number; salesCount: number }[] = []
    for (let t = 0; t < 4; t++) {
      const tStart = t * 3
      const tSales = yearSales.filter(s => {
        const m = new Date(s.saleDate).getMonth()
        return m >= tStart && m < tStart + 3
      })
      if (tSales.length > 0) {
        const ca = tSales.reduce((s, x) => s + x.salePrice, 0)
        quarterlyBreakdown.push({
          label: `T${t + 1} ${year}`,
          ca: parseFloat(ca.toFixed(2)),
          cotisation: parseFloat((ca * taxRate / 100).toFixed(2)),
          salesCount: tSales.length,
        })
      }
    }

    const activityTypeLabels: Record<string, string> = {
      achat_revente: 'Achat / Revente',
      prestation_service: 'Prestation de services',
      autre_prestation: 'Autre prestation de services',
      profession_liberale: 'Profession libérale',
      location_meuble: 'Location de meublé saisonnier',
    }

    return NextResponse.json({
      activityType: taxSettings.activityType,
      activityTypeLabel: activityTypeLabels[taxSettings.activityType] || taxSettings.activityType,
      taxRate,
      selectedMonth: month,
      selectedYear: year,
      month: {
        label: month ? new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : `Année ${year}`,
        ca: parseFloat(monthCA.toFixed(2)),
        cotisation: monthCotisation,
        salesCount: monthSales.length,
      },
      trimester: {
        label: trimLabel,
        ca: parseFloat(trimCA.toFixed(2)),
        cotisation: trimCotisation,
        salesCount: trimSales.length,
      },
      year: {
        label: `Année ${year}`,
        ca: parseFloat(yearCA.toFixed(2)),
        cotisation: yearCotisation,
        salesCount: yearSales.length,
      },
      monthlyBreakdown,
      quarterlyBreakdown,
    })
  } catch (error) {
    console.error('GET /api/urssaf error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
