'use client'

import { usePathname } from 'next/navigation'
import { BoutiqueShell } from '@/components/boutique/boutique-shell'

/**
 * Conditionally wraps children in the boutique shell (header/footer/cart icon/etc.)
 * for public boutique routes, OR renders them raw for routes that have their own shell:
 * - /admin/*      → admin shell (defined in /admin/page.tsx)
 * - /login        → standalone login page
 * - /setup        → standalone setup wizard
 * - /scan         → standalone scanner page
 *
 * Everything else (/, /produit/xxx, /panier, /compte, /cgv, etc.) gets the boutique shell.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  // Routes that have their own shell — render children raw (no boutique header/footer)
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/setup') ||
    pathname?.startsWith('/scan')
  ) {
    return <>{children}</>
  }

  // All other routes (boutique storefront) get the boutique shell
  return <BoutiqueShell>{children}</BoutiqueShell>
}
