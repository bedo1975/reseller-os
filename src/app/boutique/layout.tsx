'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ShoppingCart, Search, Menu, X, ChevronDown, User, LogOut } from 'lucide-react'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { GoogleAnalytics } from '@/components/boutique/google-analytics'

interface Subcat { code: string; value: string }
interface NavCategory { slug: string; label: string; emoji: string; subcategories: Subcat[] }

export default function BoutiqueLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [cartCount, setCartCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [client, setClient] = useState<{ firstName: string } | null>(null)
  const [categories, setCategories] = useState<NavCategory[]>([])
  const [hoveredCat, setHoveredCat] = useState<string | null>(null)
  const settings = useBoutiqueSettings()

  useEffect(() => {
    // Update cart count on mount and when localStorage changes
    const updateCartCount = () => {
      try {
        const cart = JSON.parse(localStorage.getItem('boutique_cart') || '[]')
        setCartCount(cart.reduce((s: number, i: any) => s + (i.qty || 1), 0))
      } catch {
        setCartCount(0)
      }
    }
    updateCartCount()
    window.addEventListener('storage', updateCartCount)
    window.addEventListener('cart-updated', updateCartCount)

    // Check if client is logged in
    fetch('/api/boutique/client/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setClient({ firstName: data.firstName }) })
      .catch(() => {})

    // Fetch nav categories + subcategories
    fetch('/api/boutique/nav')
      .then(r => r.json())
      .then(data => { if (data.nav) setCategories(data.nav) })
      .catch(() => {
        setCategories([
          { slug: 'vetements', label: 'Vêtements', emoji: '👕', subcategories: [] },
          { slug: 'chaussures', label: 'Chaussures', emoji: '👟', subcategories: [] },
          { slug: 'accessoires', label: 'Accessoires', emoji: '👜', subcategories: [] },
          { slug: 'luxe', label: 'Luxe', emoji: '💎', subcategories: [] },
          { slug: 'maison', label: 'Maison', emoji: '🏠', subcategories: [] },
        ])
      })

    return () => {
      window.removeEventListener('storage', updateCartCount)
      window.removeEventListener('cart-updated', updateCartCount)
    }
  }, [pathname])

  const logout = async () => {
    await fetch('/api/boutique/client/logout', { method: 'POST' })
    setClient(null)
    window.location.href = '/boutique'
  }

  const primaryColor = '#' + (settings?.primaryColor || '007bff')
  const primaryDarkColor = '#' + (settings?.primaryDarkColor || '0056b3')
  const headerBgColor = '#' + (settings?.headerBgColor || 'ffffff')
  const topbarBgColor = '#' + (settings?.topbarBgColor || '0a3d62')
  const footerBgColor = '#' + (settings?.footerBgColor || '0a3d62')
  const logoText = settings?.logoText || 'DBoxPro'
  const logoSubtitle = settings?.logoSubtitle || 'Boutique'
  const logoImage = settings?.logoImage || null
  const topBarText = settings?.topBarText || 'Livraison offerte dès 50€ d\'achat · Paiement sécurisé'
  const footerEmail = settings?.footerEmail || 'contact@dboxpro.fr'
  const footerPhone = settings?.footerPhone || ''
  const footerAbout = settings?.footerAbout || 'Votre boutique de vêtements et accessoires seconde main.'

  // Footer column titles
  const footerBoutiqueTitle = settings?.footerBoutiqueTitle || 'Boutique'
  const footerInfosTitle = settings?.footerInfosTitle || 'Informations'
  const footerContactTitle = settings?.footerContactTitle || 'Contact'

  // Parse footer links
  const footerBoutiqueLinks = (() => {
    try { return JSON.parse(settings?.footerBoutiqueLinksJson || '[]') } catch { return [] }
  })()
  const footerInfosLinks = (() => {
    try { return JSON.parse(settings?.footerInfosLinksJson || '[]') } catch { return [] }
  })()

  // Parse nav menu (if configured, use it instead of categories)
  const navMenuItems = (() => {
    try {
      const items = JSON.parse(settings?.navMenuJson || '[]')
      if (Array.isArray(items) && items.length > 0) {
        return items.filter((i: any) => i.visible !== false).sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
      }
    } catch {}
    return null // null = use categories as default
  })()

  return (
    <div className="bg-white text-gray-900 antialiased min-h-screen flex flex-col" style={{ ['--primary' as any]: primaryColor, ['--primary-dark' as any]: primaryDarkColor }}>
      <GoogleAnalytics />
      {/* Top bar */}
      <div className="text-white text-xs" style={{ backgroundColor: topbarBgColor }}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
          <p>{topBarText}</p>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/boutique/cgv" className="hover:text-blue-200 transition-colors">CGV</Link>
            <span>·</span>
            <span>Service client : {footerEmail}</span>
          </div>
        </div>
      </div>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-gray-200 shadow-sm" style={{ backgroundColor: headerBgColor }}>
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              {/* Logo */}
              <Link href="/boutique" className="flex items-center gap-2 shrink-0">
                {logoImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoImage} alt={logoText} className="h-12 w-auto max-w-[180px] object-contain" />
                ) : (
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xl" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryDarkColor})` }}>
                    {logoText[0]}
                  </div>
                )}
                <div className="hidden sm:block">
                  <p className="font-bold text-lg text-gray-900 leading-tight">{logoText}</p>
                  <p className="text-[10px] text-gray-500 leading-tight uppercase tracking-wider">{logoSubtitle}</p>
                </div>
              </Link>

              {/* Navigation desktop */}
              <nav className="hidden lg:flex items-center gap-1">
                <Link
                  href="/boutique"
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    pathname === '/boutique' ? 'text-[#007bff] bg-blue-50' : 'text-gray-700 hover:text-[#007bff] hover:bg-gray-50'
                  }`}
                >
                  Accueil
                </Link>
                {(navMenuItems ? navMenuItems : categories).map((item: any) => {
                  const slug = item.slug || item.url?.split('/').pop() || ''
                  const label = item.label || item.value || ''
                  const url = item.url || `/boutique/categorie/${item.slug}`
                  const subcats = item.subcategories || []
                  return (
                    <div
                      key={slug || url}
                      className="relative"
                      onMouseEnter={() => setHoveredCat(slug || url)}
                      onMouseLeave={() => setHoveredCat(null)}
                    >
                      <Link
                        href={url}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-1 ${
                          pathname === url ? 'text-[#007bff] bg-blue-50' : 'text-gray-700 hover:text-[#007bff] hover:bg-gray-50'
                        }`}
                      >
                        {label}
                        {subcats.length > 0 && <ChevronDown className="h-3 w-3" />}
                      </Link>
                      {subcats.length > 0 && hoveredCat === (slug || url) && (
                        <div className="absolute top-full left-0 mt-0 min-w-[200px] bg-white border border-gray-200 rounded-md shadow-lg py-2 z-50">
                          {subcats.map((s: any) => (
                            <Link
                              key={s.code}
                              href={`/boutique/categorie/${slug}?subcat=${s.code}`}
                              className="block px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-[#007bff] transition-colors"
                            >
                              {s.value}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </nav>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {client ? (
                  <Link
                    href="/boutique/compte"
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                    title="Mon compte"
                  >
                    <User className="h-5 w-5" />
                    <span className="hidden md:inline">{client.firstName}</span>
                  </Link>
                ) : (
                  <Link
                    href="/boutique/connexion"
                    className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
                    title="Connexion / Inscription"
                  >
                    <User className="h-5 w-5" />
                    <span className="hidden md:inline">Connexion</span>
                  </Link>
                )}
                <Link
                  href="/boutique/panier"
                  className="relative p-2 rounded-md hover:bg-gray-100 transition-colors"
                  title="Mon panier"
                >
                  <ShoppingCart className="h-6 w-6 text-gray-700" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 text-white text-[10px] font-bold rounded-full h-5 min-w-5 px-1 flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                      {cartCount}
                    </span>
                  )}
                </Link>
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 rounded-md hover:bg-gray-100"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>

            {/* Mobile menu */}
            {mobileMenuOpen && (
              <nav className="lg:hidden border-t border-gray-200 py-2 space-y-1">
                <Link
                  href="/boutique"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                >
                  Accueil
                </Link>
                {categories.map(c => (
                  <div key={c.slug}>
                    <Link
                      href={`/boutique/categorie/${c.slug}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-md"
                    >
                      {c.label}
                    </Link>
                    {c.subcategories.length > 0 && (
                      <div className="pl-8">
                        {c.subcategories.map(s => (
                          <Link
                            key={s.code}
                            href={`/boutique/categorie/${c.slug}?subcat=${s.code}`}
                            onClick={() => setMobileMenuOpen(false)}
                            className="block px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-50 rounded-md"
                          >
                            {s.value}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </nav>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="min-h-[60vh]">{children}</main>

        {/* Footer */}
        <footer className="text-white mt-16" style={{ backgroundColor: footerBgColor }}>
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {logoImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoImage} alt={logoText} className="h-12 w-auto max-w-[180px] object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white font-bold text-xl">
                      {logoText[0]}
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-lg leading-tight">{logoText}</p>
                    <p className="text-[10px] text-blue-200 uppercase tracking-wider leading-tight">{logoSubtitle}</p>
                  </div>
                </div>
                <p className="text-sm text-blue-100">{footerAbout}</p>
              </div>

              <div>
                <h3 className="font-semibold text-sm uppercase mb-4 text-blue-200">{footerBoutiqueTitle}</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link href="/boutique" className="text-blue-100 hover:text-white transition-colors">Tous les produits</Link></li>
                  {categories.map(c => (
                    <li key={c.slug}>
                      <Link href={`/boutique/categorie/${c.slug}`} className="text-blue-100 hover:text-white transition-colors">
                        {c.label}
                      </Link>
                    </li>
                  ))}
                  {footerBoutiqueLinks.map((l: any, i: number) => (
                    <li key={`b-${i}`}><Link href={l.url} className="text-blue-100 hover:text-white transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-sm uppercase mb-4 text-blue-200">{footerInfosTitle}</h3>
                <ul className="space-y-2 text-sm">
                  {footerInfosLinks.length > 0 ? (
                    footerInfosLinks.map((l: any, i: number) => (
                      <li key={`i-${i}`}><Link href={l.url} className="text-blue-100 hover:text-white transition-colors">{l.label}</Link></li>
                    ))
                  ) : (
                    <>
                      <li><Link href="/boutique/cgv" className="text-blue-100 hover:text-white transition-colors">CGV</Link></li>
                      <li><Link href="/boutique/panier" className="text-blue-100 hover:text-white transition-colors">Mon panier</Link></li>
                      <li><Link href="/boutique/contact" className="text-blue-100 hover:text-white transition-colors">Contact</Link></li>
                      <li><Link href="/" className="text-blue-100 hover:text-white transition-colors">Espace gestion</Link></li>
                    </>
                  )}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-sm uppercase mb-4 text-blue-200">{footerContactTitle}</h3>
                <ul className="space-y-2 text-sm text-blue-100">
                  <li>{footerEmail}</li>
                  {footerPhone && <li>Tél : {footerPhone}</li>}
                  {/* Horaires block — only render if master toggle is on */}
                  {settings?.hoursVisible !== false && settings?.hoursJson && (() => {
                    try {
                      const hours = JSON.parse(settings.hoursJson)
                      if (Array.isArray(hours) && hours.length > 0) {
                        // Only show entries that are not explicitly hidden (visible !== false)
                        const visibleHours = hours.filter((h: any) => h.visible !== false)
                        if (visibleHours.length > 0) {
                          return visibleHours.map((h: any, i: number) => (
                            <li key={i} className={h.closed ? 'opacity-50' : ''}>
                              {h.day} : {h.closed ? 'Fermé' : h.hours}
                            </li>
                          ))
                        }
                      }
                    } catch {}
                    return <li>Lun - Ven : 9h - 18h</li>
                  })()}
                </ul>
              </div>
            </div>

            <div className="border-t border-white/20 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-blue-200">
                © {new Date().getFullYear()} {logoText}. Tous droits réservés.
              </p>
              <div className="flex items-center gap-3 text-xs text-blue-200">
                <span>Paiement sécurisé</span>
                <span>·</span>
                <span>Livraison rapide</span>
                <span>·</span>
                <span>Satisfait ou remboursé 14j</span>
              </div>
            </div>
          </div>
        </footer>
    </div>
  )
}
