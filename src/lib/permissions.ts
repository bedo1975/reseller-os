import { db } from '@/lib/db'

// All modules that can have permissions
export const ALL_MODULES = [
  'dashboard',
  'stock',
  'sourcing',
  'publication',
  'sales',
  'parcels',
  'preorders',
  'profitability',
  'taxes',
  'bi',
  'vinted',
  'product-trend',
  'photos',
  'boutique-admin',
  'boutique-admin:orders',
  'boutique-admin:clients',
  'boutique-admin:messages',
  'boutique-admin:appearance',
  'boutique-admin:shipping',
  'boutique-admin:payments',
  'boutique-admin:categories',
  'boutique-admin:coupons',
  'boutique-admin:share',
  'boutique-admin:newsletter',
  'statistics',
  'staff-messaging',
  'settings',
] as const

// All possible actions
export const ALL_ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'scan', 'purchase'] as const

// Modules that only support "view" (no create/edit/delete)
export const VIEW_ONLY_MODULES = ['dashboard', 'bi', 'statistics']

// Actions available per module (controls what's shown in the permission grid)
export const MODULE_ACTIONS: Record<string, string[]> = {
  dashboard: ['view'],
  stock: ['view', 'create', 'edit', 'delete', 'export', 'scan', 'purchase'],
  sourcing: ['view', 'create', 'edit', 'delete'],
  publication: ['view', 'edit', 'create'],
  sales: ['view', 'create', 'edit', 'delete', 'export'],
  parcels: ['view', 'edit'],
  preorders: ['view', 'create', 'edit', 'delete'],
  profitability: ['view', 'export'],
  taxes: ['view', 'export'],
  bi: ['view', 'export'],
  vinted: ['view', 'create'],
  'product-trend': ['view', 'create'],
  photos: ['view', 'create', 'edit', 'delete'],
  'boutique-admin': ['view', 'create', 'edit', 'delete', 'export'],
  // Sub-tabs of boutique-admin (mapped as separate permission keys)
  'boutique-admin:orders': ['view', 'edit', 'delete'],
  'boutique-admin:clients': ['view', 'edit', 'delete'],
  'boutique-admin:messages': ['view', 'edit'],
  'boutique-admin:appearance': ['view', 'edit'],
  'boutique-admin:shipping': ['view', 'edit', 'delete'],
  'boutique-admin:payments': ['view', 'edit', 'delete'],
  'boutique-admin:categories': ['view', 'edit', 'delete'],
  'boutique-admin:coupons': ['view', 'create', 'edit', 'delete'],
  'boutique-admin:share': ['view', 'edit'],
  'boutique-admin:newsletter': ['view', 'create', 'edit', 'delete'],
  statistics: ['view', 'export'],
  'staff-messaging': ['view', 'create', 'delete'],
  settings: ['view', 'edit'],
}

// Default actions for each module when a staff user is created
export const DEFAULT_STAFF_ACTIONS: Record<string, string[]> = {
  dashboard: ['view'],
  stock: ['view', 'create', 'edit', 'scan'],
  sourcing: ['view', 'create', 'edit'],
  publication: ['view', 'edit'],
  sales: ['view', 'create', 'edit', 'export'],
  parcels: ['view', 'edit'],
  preorders: ['view', 'create', 'edit'],
  profitability: ['view'],
  taxes: ['view', 'export'],
  bi: ['view'],
  vinted: ['view', 'create'],
  'product-trend': ['view', 'create'],
  photos: ['view', 'create', 'edit'],
  'boutique-admin': [],
  'boutique-admin:orders': ['view', 'edit'],
  'boutique-admin:clients': ['view'],
  'boutique-admin:messages': ['view'],
  'boutique-admin:appearance': [],
  'boutique-admin:shipping': [],
  'boutique-admin:payments': [],
  'boutique-admin:categories': [],
  'boutique-admin:coupons': [],
  'boutique-admin:share': [],
  'boutique-admin:newsletter': [],
  statistics: [],
  'staff-messaging': ['view', 'create'],
  settings: [],
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
      allPerms[m] = MODULE_ACTIONS[m] || ['view']
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
