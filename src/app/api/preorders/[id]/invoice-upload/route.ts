import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/session'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * POST /api/preorders/[id]/invoice-upload
 * Auth — upload a supplier invoice PDF (or image) for a validated/received pre-order.
 *
 * Receives a FormData with a "file" field.
 * Saves to: public/uploads/preorder-invoices/invoice-{preorderId}-{hash}.{ext}
 * Returns: { path: "/api/uploads/preorder-invoices/...", filename: "original-name.pdf" }
 *
 * The caller is responsible for PATCHing the pre-order to store the path/name.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Verify the pre-order exists and belongs to the user (or admin)
    const existing = await db.preOrder.findFirst({
      where: user.role === 'admin' ? { id } : { id, userId: user.id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Pré-commande introuvable' }, { status: 404 })
    }

    const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'preorder-invoices')
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    }

    const formData = await req.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucun fichier reçu' }, { status: 400 })
    }

    // Accept PDF and common image types
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Type de fichier non autorisé (${file.type}). Formats acceptés : PDF, JPG, PNG, WebP, GIF`,
      }, { status: 400 })
    }

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 10 Mo)' }, { status: 400 })
    }

    // Generate filename
    const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
    const hash = crypto.randomBytes(6).toString('hex')
    const filename = `invoice-${id}-${hash}.${ext}`
    const filePath = path.join(UPLOAD_DIR, filename)

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(filePath, buffer)

    const publicPath = `/api/uploads/preorder-invoices/${filename}`
    return NextResponse.json({ path: publicPath, filename: file.name })
  } catch (error) {
    console.error('POST /api/preorders/[id]/invoice-upload error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
