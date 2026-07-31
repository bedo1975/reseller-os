import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { getUserPermissions, ALL_MODULES } from '@/lib/permissions'

/**
 * GET /api/auth/permissions
 * Returns the permissions for the current user.
 * Used by the frontend to filter the sidebar and module access.
 */
export async function GET() {
  try {
    const user = await requireAuth()
    const perms = await getUserPermissions(user.id, user.role)

    // Return as a simple map of module → canView (boolean) for the sidebar
    const sidebarAccess: Record<string, boolean> = {}
    for (const m of ALL_MODULES) {
      const actions = perms[m] || []
      sidebarAccess[m] = actions.includes('view')
    }

    return NextResponse.json({
      role: user.role,
      permissions: perms,
      sidebar: sidebarAccess,
    })
  } catch (error) {
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
