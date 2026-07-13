import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/session'

// PATCH /api/users/[id] — ADMIN ONLY
// Update user (role, name, reset password).
// Note: cannot change email — too many session implications.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = await req.json()

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (typeof body.name === 'string' && body.name.trim()) {
      updateData.name = body.name.trim()
    }
    if (typeof body.role === 'string') {
      if (!['admin', 'staff'].includes(body.role)) {
        return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
      }
      // Prevent self-demotion (an admin cannot remove their own admin rights)
      if (target.id === admin.id && body.role !== 'admin') {
        return NextResponse.json(
          { error: 'Vous ne pouvez pas rétrograder votre propre compte administrateur' },
          { status: 400 }
        )
      }
      updateData.role = body.role
    }
    // Reset password (optional)
    if (typeof body.password === 'string' && body.password.length > 0) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: 'Le mot de passe doit contenir au moins 8 caractères' },
          { status: 400 }
        )
      }
      updateData.password = await bcrypt.hash(body.password, 10)
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie' }, { status: 400 })
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/users/[id] error:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// DELETE /api/users/[id] — ADMIN ONLY
// Prevent self-delete.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin()
    const { id } = await params

    if (id === admin.id) {
      return NextResponse.json(
        { error: 'Vous ne pouvez pas supprimer votre propre compte' },
        { status: 400 }
      )
    }

    const target = await db.user.findUnique({ where: { id } })
    if (!target) {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }

    // Count admins — prevent removing the last admin
    if (target.role === 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin' } })
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Impossible de supprimer le dernier administrateur' },
          { status: 400 }
        )
      }
    }

    // Unlink user's data (set userId to null) rather than delete it — preserves audit history
    await db.stockItem.updateMany({ where: { userId: id }, data: { userId: null } })
    await db.sale.updateMany({ where: { userId: id }, data: { userId: null } })
    await db.supplier.updateMany({ where: { userId: id }, data: { userId: null } })
    await db.expense.updateMany({ where: { userId: id }, data: { userId: null } })

    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/users/[id] error:', error)
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Accès refusé (admin requis)' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
