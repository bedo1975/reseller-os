import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    await requireAdmin()

    const dbPath = path.resolve(process.cwd(), 'db/custom.db')
    let stats: fs.Stats | null = null
    let exists = false
    try {
      stats = fs.statSync(dbPath)
      exists = true
    } catch {
      exists = false
    }

    const [
      usersCount, suppliersCount, stockItemsCount, salesCount,
      expensesCount, attributesCount, invoiceSettingsCount,
    ] = await Promise.all([
      db.user.count(),
      db.supplier.count(),
      db.stockItem.count(),
      db.sale.count(),
      db.expense.count(),
      db.attribute.count(),
      db.invoiceSettings.count(),
    ])

    const backupDir = path.resolve(process.cwd(), 'backups')
    let backups: { name: string; size: number; createdAt: string }[] = []
    try {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'))
      backups = files.map(f => {
        const st = fs.statSync(path.join(backupDir, f))
        return { name: f, size: st.size, createdAt: st.mtime.toISOString() }
      }).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    } catch {
      // dossier backups n'existe pas
    }

    return NextResponse.json({
      dbPath,
      dbExists: exists,
      dbSize: stats?.size || 0,
      dbLastModified: stats?.mtime?.toISOString() || null,
      counts: {
        users: usersCount, suppliers: suppliersCount, stockItems: stockItemsCount,
        sales: salesCount, expenses: expensesCount, attributes: attributesCount,
        invoiceSettings: invoiceSettingsCount,
      },
      backups,
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    console.error('GET /api/maintenance/info error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
