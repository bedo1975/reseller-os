'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface PermData {
  role: string
  permissions: Record<string, string[]>
  sidebar: Record<string, boolean>
}

/**
 * Hook to check permissions on the frontend.
 * Fetches permissions once on mount, then provides a `can()` function.
 *
 * Usage:
 *   const { can } = usePermissions()
 *   {can('stock', 'create') && <Button>Nouvel article</Button>}
 */
export function usePermissions() {
  const { data: session } = useSession()
  const [perms, setPerms] = useState<PermData | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetch('/api/auth/permissions')
        .then(r => r.json())
        .then(data => setPerms(data))
        .catch(() => setPerms(null))
    }
  }, [session])

  const can = useCallback((module: string, action: string): boolean => {
    if (!perms) return true // Default: allow while loading (admin sees everything)
    if (perms.role === 'admin') return true
    const actions = perms.permissions?.[module] || []
    return actions.includes(action)
  }, [perms])

  const canView = useCallback((module: string): boolean => {
    return can(module, 'view')
  }, [can])

  return { can, canView, perms, loading: !perms }
}
