import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * POST /api/expenses/[id]/invoice-upload
 * Auth — upload a supplier invoice PDF (or image) for an expense.
 *
 * Saves to: public/uploads/expense-invoices/invoice-{expenseId}-{hash}.{ext}
 * Returns: { path, filename }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.expense.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'expense-invoices')
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Type non autorisé (${file.type}). Acceptés : PDF, JPG, PNG, WebP, GIF`,
      }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    // Delete old invoice file if any
    if (existing.invoicePath) {
      try {
        const oldRel = existing.invoicePath.replace('/api/uploads/', '')
        const oldDisk = path.join(process.cwd(), 'public', 'uploads', oldRel)
        if (fs.existsSync(oldDisk)) fs.unlinkSync(oldDisk)
      } catch {}
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const hash = crypto.randomBytes(6).toString('hex')
    const filename = `invoice-${id}-${hash}.${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const publicPath = `/api/uploads/expense-invoices/${filename}`

    // Save to DB
    await db.expense.update({
      where: { id },
      data: { invoicePath: publicPath, invoiceName: file.name },
    })

    return NextResponse.json({ path: publicPath, filename: file.name })
  } catch (error) {
    console.error('POST /api/expenses/[id]/invoice-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/expenses/[id]/invoice-upload
 * Auth — delete the invoice file from disk + clear the DB reference.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.expense.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
    }

    if (existing.invoicePath) {
      const relativePath = existing.invoicePath.replace('/api/uploads/', '')
      const diskPath = path.join(process.cwd(), 'public', 'uploads', relativePath)
      try {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath)
      } catch (e) {
        console.error('[expense-invoice-delete] Failed to delete file:', e)
      }
    }

    await db.expense.update({
      where: { id },
      data: { invoicePath: null, invoiceName: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/expenses/[id]/invoice-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
