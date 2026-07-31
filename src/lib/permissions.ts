import { db } from '@/lib/db'

// All modules that can have permissions
export const ALL_MODULES = [
  'dashboard',
  'stock',
  'sourcing',
  'publication',
  'sales',
  'parcels',
  'profitability',
  'taxes',
  'bi',
  'vinted',
  'product-trend',
  'photos',
  'boutique-admin',
  'statistics',
  'settings',
] as const

// All possible actions
export const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const

// Modules that only support "view" (no create/edit/delete)
export const VIEW_ONLY_MODULES = ['dashboard', 'bi', 'statistics']

// Default actions for each module when a staff user is created
export const DEFAULT_STAFF_ACTIONS: Record<string, string[]> = {
  dashboard: ['view'],
  stock: ['view', 'create', 'edit'],
  sourcing: ['view', 'create', 'edit'],
  publication: ['view', 'edit'],
  sales: ['view', 'create', 'edit', 'export'],
  parcels: ['view', 'edit'],
  profitability: ['view'],
  taxes: ['view', 'export'],
  bi: ['view'],
  vinted: ['view'],
  'product-trend': ['view'],
  photos: ['view', 'create', 'edit'],
  'boutique-admin': [],  // no access by default
  statistics: [],        // no access by default
  settings: [],          // no access by default
}

// Cache for permissions (per request)
const permCache = new Map<string, Record<string, string[]>>()

/**
 * Get all permissions for a user.
 * Returns a map: { module: [actions] }
 * Admins have all permissions on all modules.
 */
export async function getUserPermissions(userId: string, userRole: string): Promise<Record<string, string[]>> {
  // Admin = all permissions
  if (userRole === 'admin') {
    const allPerms: Record<string, string[]> = {}
    for (const m of ALL_MODULES) {
      allPerms[m] = VIEW_ONLY_MODULES.includes(m) ? ['view'] : [...ALL_ACTIONS]
    }
    return allPerms
  }

  // Check cache
  if (permCache.has(userId)) {
    return permCache.get(userId)!
  }

  // Load from DB
  const perms = await db.userPermission.findMany({
    where: { userId },
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
      // No explicit permission = use defaults
      result[m] = DEFAULT_STAFF_ACTIONS[m] || []
    }
  }

  // Cache for 30 seconds
  permCache.set(userId, result)
  setTimeout(() => permCache.delete(userId), 30000)

  return result
}

/**
 * Check if a user has a specific permission.
 * Usage: const can = await canUser(userId, role, 'stock', 'edit')
 */
export async function canUser(
  userId: string,
  userRole: string,
  module: string,
  action: string,
): Promise<boolean> {
  const perms = await getUserPermissions(userId, userRole)
  const actions = perms[module] || []
  return actions.includes(action)
}

/**
 * Check if a user can view a module (used to filter the sidebar).
 */
export async function canViewModule(
  userId: string,
  userRole: string,
  module: string,
): Promise<boolean> {
  return canUser(userId, userRole, module, 'view')
}

/**
 * Clear the permission cache for a user (call after updating permissions).
 */
export function clearPermissionCache(userId?: string) {
  if (userId) {
    permCache.delete(userId)
  } else {
    permCache.clear()
  }
}
