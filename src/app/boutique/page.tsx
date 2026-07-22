'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useFetch } from '@/hooks/use-fetch'
import { useBoutiqueSettings } from '@/hooks/use-boutique-settings'
import { ProductCard } from '@/components/boutique/product-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowRight, Truck, Shield, RefreshCw, Headphones, Package, Star, Check, Clock } from 'lucide-react'

interface Product {
  sku: string
  brand: string
  category: string
  size?: string | null
  color?: string | null
  condition?: string | null
  price: number | null
  mainPhoto?: string | null
}

interface CategoryCard {
  slug: string
  label: string
  emoji: string
  backgroundImage: string | null
  bgColor: string | null
  bgOpacity: number
  order: number
}

// Fallback if API fails
const FALLBACK_CATEGORIES: CategoryCard[] = [
  { slug: 'vetements', label: 'Vêtements', emoji: '👕', backgroundImage: null, bgColor: '3b82f6', bgOpacity: 0.5, order: 0 },
  { slug: 'chaussures', label: 'Chaussures', emoji: '👟', backgroundImage: null, bgColor: '06b6d4', bgOpacity: 0.5, order: 1 },
  { slug: 'accessoires', label: 'Accessoires', emoji: '👜', backgroundImage: null, bgColor: '6366f1', bgOpacity: 0.5, order: 2 },
  { slug: 'luxe', label: 'Luxe', emoji: '💎', backgroundImage: null, bgColor: '8b5cf6', bgOpacity: 0.5, order: 3 },
  { slug: 'maison', label: 'Maison', emoji: '🏠', backgroundImage: null, bgColor: '14b8a6', bgOpacity: 0.5, order: 4 },
]

export default function BoutiqueHomePage() {
  const { data, loading } = useFetch<{ products: Product[]; count: number }>('/api/boutique/products?limit=20')
  const settings = useBoutiqueSettings()
  const [categories, setCategories] = useState<CategoryCard[]>(FALLBACK_CATEGORIES)
  const products = data?.products || []
  const featured = products.slice(0, 10)
  const newProducts = products.slice(0, 10)

  // Fetch categories from DB (top-level only for homepage cards)
  useEffect(() => {
    fetch('/api/boutique/categories')
      .then(r => r.json())
      .then(data => {
        if (data.categories && Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories)
        }
      })
      .catch(() => {})
  }, [])

  const primaryColor = '#' + settings.primaryColor
  const primaryDarkColor = '#' + settings.primaryDarkColor

  return (
    <div>
      {/* Hero */}
      <section
        className="relative text-white overflow-hidden"
        style={{
          background: settings.heroImage
            ? `linear-gradient(135deg, ${primaryColor}cc, ${primaryDarkColor}cc), url(${settings.heroImage}) center/cover`
            : `linear-gradient(135deg, ${primaryColor}, ${primaryDarkColor})`,
        }}
      >
        {!settings.heroImage && (
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 80%, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
        )}
        <div className="max-w-7xl mx-auto px-4 py-20 relative">
          <div className="max-w-2xl">
            <p className="text-blue-100 text-sm font-medium uppercase tracking-wider mb-3">
              Seconde main premium
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 leading-tight">
              {settings.heroTitle}
            </h1>
            <p className="text-blue-50 text-lg mb-8 leading-relaxed">
              {settings.heroSubtitle}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={settings.heroCtaLink || '#produits'}
                className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
                style={{ color: primaryColor }}
              >
                {settings.heroCtaLabel}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/boutique/categorie/vetements"
                className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-white font-semibold px-6 py-3 rounded-lg hover:bg-white/20 transition-colors border border-white/30"
              >
                Voir les vêtements
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: settings.trustBadge1Icon, title: settings.trustBadge1Title, desc: settings.trustBadge1Desc, url: '/boutique/livraison-rapide' },
              { icon: settings.trustBadge2Icon, title: settings.trustBadge2Title, desc: settings.trustBadge2Desc, url: '/boutique/paiement-securise' },
              { icon: settings.trustBadge3Icon, title: settings.trustBadge3Title, desc: settings.trustBadge3Desc, url: '/boutique/retours-14-jours' },
              { icon: settings.trustBadge4Icon, title: settings.trustBadge4Title, desc: settings.trustBadge4Desc, url: '/boutique/contact' },
            ].map((badge, i) => {
              const IconMap: Record<string, React.ElementType> = { truck: Truck, shield: Shield, refresh: RefreshCw, headphones: Headphones, package: Package, star: Star, check: Check, clock: Clock }
              const Icon = IconMap[badge.icon] || Truck
              return (
                <Link
                  key={i}
                  href={badge.url}
                  className="flex items-center gap-3 group hover:bg-blue-50/50 rounded-lg p-2 -m-2 transition-colors"
                  title={`En savoir plus : ${badge.title}`}
                >
                  <Icon className="h-8 w-8 shrink-0 group-hover:scale-110 transition-transform" style={{ color: primaryColor }} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900 group-hover:underline">{badge.title}</p>
                    <p className="text-xs text-gray-500">{badge.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{settings.categoriesTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">{settings.categoriesSubtitle}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {categories.map(c => {
            const bgColor = c.bgColor ? '#' + c.bgColor : primaryColor
            return (
              <Link
                key={c.slug}
                href={`/boutique/categorie/${c.slug}`}
                className="group relative rounded-xl overflow-hidden aspect-square flex items-end p-4 hover:shadow-lg transition-shadow"
                style={{ backgroundColor: bgColor }}
              >
                {/* Background image with opacity overlay */}
                {c.backgroundImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.backgroundImage}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ opacity: c.bgOpacity ?? 0.5 }}
                  />
                )}
                {/* Gradient overlay for better text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-4 right-4 text-4xl opacity-80 group-hover:scale-110 transition-transform">
                  {c.emoji}
                </div>
                <div className="relative z-10">
                  <p className="text-white font-bold text-lg leading-tight drop-shadow">{c.label}</p>
                  <p className="text-white/80 text-xs mt-1 flex items-center gap-1">
                    Découvrir <ArrowRight className="h-3 w-3" />
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Featured products */}
      <section id="produits" className="max-w-7xl mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{settings.newProductsTitle}</h2>
            <p className="text-sm text-gray-500 mt-1">{settings.newProductsSubtitle}</p>
          </div>
          <Link href="/boutique/categorie/vetements" className="text-sm font-medium text-[#007bff] hover:underline flex items-center gap-1">
            Tout voir <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-lg" />
            ))}
          </div>
        ) : newProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun produit disponible pour le moment.</p>
            <p className="text-sm text-gray-400 mt-1">Revenez bientôt découvrir nos nouveautés !</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {newProducts.map(p => (
              <ProductCard key={p.sku} product={p} />
            ))}
          </div>
        )}
      </section>

      {/* Newsletter / CTA */}
      <section className="text-white" style={{ background: `linear-gradient(to right, ${primaryColor}, ${primaryDarkColor})` }}>
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <h2 className="text-2xl font-bold mb-2">{settings.contactTitle}</h2>
          <p className="text-blue-100 mb-6">{settings.contactSubtitle}</p>
          <Link
            href="/boutique/contact"
            className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors"
            style={{ color: primaryColor }}
          >
            {settings.contactButtonText}
          </Link>
        </div>
      </section>
    </div>
  )
}
