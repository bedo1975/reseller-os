import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: removed "output: 'standalone'" — it requires a special deployment
  // setup (copying public/ and .next/static/ manually into .next/standalone/).
  // For our PM2 + Caddy setup, the default build output works better with `next start`.
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // 301 redirects for old /boutique/* URLs → new root-level URLs.
  // Matches /boutique, /boutique/produit/xxx, /boutique/panier, etc.
  // Does NOT match /api/boutique/* (the API routes stay where they are).
  async redirects() {
    return [
      // Exact /boutique → /
      {
        source: '/boutique',
        destination: '/',
        permanent: true,
      },
      // /boutique/:path* → /:path* (covers /boutique/produit/xxx, /boutique/panier, /boutique/categorie/vetements, etc.)
      {
        source: '/boutique/:path*',
        destination: '/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
