import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: { signIn: '/login' },
  callbacks: {
    authorized: ({ token }) => !!token,
  },
})

export const config = {
  // Protect everything except: API auth routes, public API endpoints, login, setup, scan, static, images, uploads, boutique (public storefront)
  // Note: /api/cron/* and /api/vinted/scan are protected by CRON_SECRET (not by NextAuth)
  // Note: /api/uploads/* serves public photos (no auth needed — used for Vinted listings, etc.)
  // Note: /boutique and /api/boutique are public storefront. /api/boutique/client/* uses client JWT cookie.
  // Note: /api/invoices/by-number/* is public (clients view their invoices via boutique account)
  matcher: ['/', '/((?!api/auth|api/users/count|api/users/setup|api/cron|api/vinted/scan|api/uploads|api/boutique|api/invoices/by-number|login|setup|scan|boutique|_next/static|_next/image|favicon.ico|logo.svg|robots.txt|uploads|manifest.json|sw.js|icon-|reseller-os\.zip).*)'],
}
