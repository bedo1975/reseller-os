import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  // Public (no auth): API auth routes, public API endpoints, login, setup, scan, static assets,
  // uploads, ALL boutique storefront pages (now at the root — /, /produit/xxx, /panier, etc.),
  // and the (public) route group's pages.
  //
  // Protected (auth required): /admin and its sub-paths. Everything else falls through as public.
  //
  // Note: /api/cron/* and /api/vinted/scan are protected by CRON_SECRET (not by NextAuth)
  // Note: /api/uploads/* serves public photos (no auth needed — used for Vinted listings, etc.)
  // Note: /api/boutique/* (client/admin APIs) are public endpoints — they handle their own auth
  //       (admin endpoints check requireAdmin, client endpoints use a separate JWT cookie).
  // Note: /api/invoices/by-number/* is public (clients view their invoices via boutique account)
  matcher: ['/admin/:path*'],
}
