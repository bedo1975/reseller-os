#!/usr/bin/env python3
"""
Restructure routing: move all files from src/app/(public)/ to src/app/ directly.
- (public)/layout.tsx → src/app/boutique-layout.tsx (renamed to avoid conflict with root layout)
- (public)/page.tsx → src/app/page.tsx (home boutique)
- (public)/produit/ → src/app/produit/
- (public)/panier/ → src/app/panier/
- etc.

Wait — the issue is that (public)/layout.tsx is the boutique header/footer.
If we move all pages to src/app/, they'll all use the root layout (no header/footer).
We need the boutique layout to wrap them.

Two options:
A) Merge the boutique layout INTO the root layout, with conditional rendering based on pathname
   (if pathname starts with /admin → admin shell; else → boutique shell). 
   This is a big change to layout.tsx.

B) Keep (public) route group but ALSO have a page.tsx at src/app/ that re-exports (public)/page.tsx.
   This is hacky and might cause issues.

C) Simplest: keep (public) route group, BUT verify that Next.js 16 standalone supports it.
   The user reports /admin works (it's outside the route group) but / doesn't (inside route group).

The cleanest fix is option A: make the root layout smart — render the boutique shell for
non-admin paths, and let the admin page render its own shell.

But for now, let me just move everything out of the route group as a quick fix:
- src/app/(public)/layout.tsx → src/app/boutique-layout.tsx (rename, keep as a component)
- All (public)/X/page.tsx → src/app/X/page.tsx (no route group)
- Each page will need to import the boutique layout component and wrap itself
  OR we accept that pages don't have the boutique header/footer automatically

Actually, the BEST approach is to use a single root layout that conditionally renders:
- If pathname starts with /admin → render children (admin shell is in /admin/page.tsx)
- Else → render boutique shell (header/footer) + children

This way:
- /admin uses the admin shell (defined in /admin/page.tsx)
- /, /produit/xxx, /panier, etc. use the boutique shell (defined in root layout)
- No route group needed
- /api/* is unaffected (API routes don't use layouts)

Let me implement this approach.
"""
import shutil
from pathlib import Path

ROOT = Path('/home/z/my-project')
APP_DIR = ROOT / 'src/app'
PUBLIC_DIR = APP_DIR / '(public)'

if not PUBLIC_DIR.exists():
    print('No (public) directory found — nothing to do.')
    exit(0)

# Step 1: Read the boutique layout content
boutique_layout = PUBLIC_DIR / 'layout.tsx'
if not boutique_layout.exists():
    print(f'ERROR: {boutique_layout} not found')
    exit(1)

# Step 2: Move boutique layout to a component file
# We'll convert it to a React component that wraps children
components_dir = ROOT / 'src/components/boutique'
components_dir.mkdir(parents=True, exist_ok=True)
new_layout_component = components_dir / 'boutique-shell.tsx'

# Read the boutique layout
content = boutique_layout.read_text(encoding='utf-8')

# Convert from layout.tsx to a component
# - Change 'export default function BoutiqueLayout({ children })' 
# - Need to add 'use client' if not present
# - Need to import usePathname from 'next/navigation' (already there)
# - The component takes children as prop

# Replace the function signature
new_content = content.replace(
    'export default function BoutiqueLayout({ children }: { children: React.ReactNode })',
    'export function BoutiqueShell({ children }: { children: React.ReactNode })'
)

# Make sure 'use client' is at the top
if not new_content.startswith("'use client'"):
    new_content = "'use client'\n\n" + new_content

new_layout_component.write_text(new_content, encoding='utf-8')
print(f'Created: {new_layout_component.relative_to(ROOT)}')

# Step 3: Update the root layout (src/app/layout.tsx) to conditionally render the boutique shell
root_layout = APP_DIR / 'layout.tsx'
root_content = root_layout.read_text(encoding='utf-8')

# Add import for BoutiqueShell and usePathname
# We need to convert root layout to use client (or use a wrapper component)
# Actually, root layout should stay server-side for metadata. Let's create a separate client wrapper.

# Create a client wrapper component
client_wrapper = components_dir / 'layout-shell.tsx'
client_wrapper.write_text("""'use client'

import { usePathname } from 'next/navigation'
import { BoutiqueShell } from './boutique-shell'

/**
 * Conditionally wraps children in the boutique shell (header/footer)
 * for public routes, or renders them raw for /admin and other non-boutique routes.
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  
  // Admin and API routes don't get the boutique shell
  // (admin has its own shell in /admin/page.tsx)
  if (pathname?.startsWith('/admin') || pathname?.startsWith('/login') || pathname?.startsWith('/setup') || pathname?.startsWith('/scan')) {
    return <>{children}</>
  }
  
  // All other routes (/, /produit/xxx, /panier, /compte, etc.) get the boutique shell
  return <BoutiqueShell>{children}</BoutiqueShell>
}
""", encoding='utf-8')
print(f'Created: {client_wrapper.relative_to(ROOT)}')

# Update root layout to use the LayoutShell
new_root_content = '''import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster as SonnerToaster } from "sonner";
import { SessionProviderWrapper } from "@/components/providers/session-provider";
import { ConfirmProvider } from "@/components/shared/confirm-provider";
import { ServiceWorkerRegister } from "@/components/shared/sw-register";
import { LayoutShell } from "@/components/boutique/layout-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reseller OS — Gestion multi-plateformes",
  description: "Centralisez Vinted, Leboncoin, eBay, Vestiaire Collective, stock physique, comptabilité et rentabilité en une seule application.",
  keywords: ["reseller", "Vinted", "Leboncoin", "eBay", "Vestiaire Collective", "revente", "stock"],
  authors: [{ name: "Reseller OS" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Reseller OS",
  },
};

export const viewport = {
  themeColor: "#10b981",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SessionProviderWrapper>
          <ConfirmProvider>
            <LayoutShell>{children}</LayoutShell>
          </ConfirmProvider>
        </SessionProviderWrapper>
        <SonnerToaster position="top-right" richColors closeButton />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
'''
root_layout.write_text(new_root_content, encoding='utf-8')
print(f'Updated: {root_layout.relative_to(ROOT)}')

# Step 4: Move all subdirectories from (public) to src/app/
subdirs_to_move = [
    'produit', 'panier', 'compte', 'connexion', 'contact', 'confirmation',
    'retractation', 'mentions-legales', 'grade', 'paiement-securise',
    'valider-compte', 'retours-14-jours', 'livraison-rapide', 'cgv',
    'reinitialiser-mot-de-passe', 'categorie', 'mot-de-passe-oublie',
    'recherche', 'checkout',
]
for sub in subdirs_to_move:
    src = PUBLIC_DIR / sub
    if src.exists():
        dst = APP_DIR / sub
        if dst.exists():
            print(f'  WARNING: {dst} already exists, skipping')
            continue
        shutil.move(str(src), str(dst))
        print(f'  Moved: {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}')

# Step 5: Move the home page (public)/page.tsx → src/app/page.tsx
home_src = PUBLIC_DIR / 'page.tsx'
home_dst = APP_DIR / 'page.tsx'
if home_src.exists():
    if home_dst.exists():
        print(f'  WARNING: {home_dst} already exists, removing old one')
        home_dst.unlink()
    shutil.move(str(home_src), str(home_dst))
    print(f'  Moved: {home_src.relative_to(ROOT)} -> {home_dst.relative_to(ROOT)}')

# Step 6: Remove the now-empty (public) directory
try:
    PUBLIC_DIR.rmdir()
    print(f'Removed empty: {PUBLIC_DIR.relative_to(ROOT)}')
except OSError:
    shutil.rmtree(PUBLIC_DIR)
    print(f'Removed (rmtree): {PUBLIC_DIR.relative_to(ROOT)}')

print('\n=== DONE ===')
print('New structure:')
print('  src/app/layout.tsx — root layout (uses LayoutShell to conditionally render boutique shell)')
print('  src/app/page.tsx — boutique home (was (public)/page.tsx)')
print('  src/app/produit/[sku]/page.tsx — product page')
print('  src/app/admin/page.tsx — admin (unchanged)')
print('  src/components/boutique/boutique-shell.tsx — boutique header/footer component')
print('  src/components/boutique/layout-shell.tsx — conditional wrapper')
