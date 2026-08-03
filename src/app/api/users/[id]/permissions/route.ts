import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/session'
import { db } from '@/lib/db'
import { ALL_MODULES, ALL_ACTIONS, VIEW_ONLY_MODULES, DEFAULT_STAFF_ACTIONS, clearPermissionCache } from '@/lib/permissions'

/**
 * GET /api/users/[id]/permissions
 * Admin: get permissions for any user.
 * Staff: get own permissions only.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    // Staff can only see their own permissions
    if (user.role !== 'admin' && user.id !== id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    // Admin = all permissions
    if (user.role === 'admin' && user.id === id) {
      const allPerms: Record<string, string[]> = {}
      for (const m of ALL_MODULES) {
        allPerms[m] = VIEW_ONLY_MODULES.includes(m) ? ['view'] : [...ALL_ACTIONS]
      }
      return NextResponse.json({ permissions: allPerms, isAdmin: true })
    }

    // Load from DB
    const perms = await db.userPermission.findMany({
      where: { userId: id },
    })

    const result: Record<string, string[]> = {}
    for (const m of ALL_MODULES) {
      const p = perms.find(p => p.module === m)
      if (p) {
        try {
          result[m] = JSON.parse(p.actions)
        } catch {
          result[m] = []
        }
      } else {
        result[m] = DEFAULT_STAFF_ACTIONS[m] || []
      }
    }

    return NextResponse.json({ permissions: result, isAdmin: false })
  } catch (error) {
    console.error('GET /api/users/[id]/permissions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PUT /api/users/[id]/permissions
 * Admin only — update permissions for a user.
 *
 * Body: { permissions: { stock: ["view","create","edit"], sales: ["view"], ... } }
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await req.json()
    const { permissions } = body

    if (!permissions || typeof permissions !== 'object') {
      return NextResponse.json({ error: 'Format invalide' }, { status: 400 })
    }

    // Delete existing permissions for this user
    await db.userPermission.deleteMany({ where: { userId: id } })

    // Create new permissions — save ALL modules, even empty ones (actions: "[]")
    // This ensures that when we read them back, we get the saved value instead of
    // falling back to DEFAULT_STAFF_ACTIONS.
    for (const module of ALL_MODULES) {
      const actions = permissions[module]
      // Filter to only valid actions
      const validActions = Array.isArray(actions)
        ? actions.filter(a => ALL_ACTIONS.includes(a as any))
        : []
      await db.userPermission.create({
        data: {
          userId: id,
          module,
          actions: JSON.stringify(validActions),
        },
      })
    }

    // Clear cache
    clearPermissionCache(id)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('PUT /api/users/[id]/permissions error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
