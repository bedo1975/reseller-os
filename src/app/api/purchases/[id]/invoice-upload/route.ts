import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * POST /api/purchases/[id]/invoice-upload
 * Auth — upload a supplier invoice PDF (or image) for a purchase (achat hors stock).
 *
 * Receives a FormData with a "file" field.
 * Saves to: public/uploads/purchase-invoices/invoice-{purchaseId}-{hash}.{ext}
 * Returns: { path: "/api/uploads/purchase-invoices/...", filename: "original-name.pdf" }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Purchases are attached to the admin; admin can edit any, staff only their own
    const existing = await db.purchase.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'purchase-invoices')
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

    // If there's an existing invoice, delete the old file
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

    const publicPath = `/api/uploads/purchase-invoices/${filename}`
    return NextResponse.json({ path: publicPath, filename: file.name })
  } catch (error) {
    console.error('POST /api/purchases/[id]/invoice-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * DELETE /api/purchases/[id]/invoice-upload
 * Auth — delete the invoice file from disk + clear the DB reference.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await db.purchase.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Achat introuvable' }, { status: 404 })
    }

    if (existing.invoicePath) {
      const relativePath = existing.invoicePath.replace('/api/uploads/', '')
      const diskPath = path.join(process.cwd(), 'public', 'uploads', relativePath)
      try {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath)
      } catch (e) {
        console.error('[purchase-invoice-delete] Failed to delete file:', e)
      }
    }

    // Clear the DB reference
    await db.purchase.update({
      where: { id },
      data: { invoicePath: null, invoiceName: null },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('DELETE /api/purchases/[id]/invoice-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
