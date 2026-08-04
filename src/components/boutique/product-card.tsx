'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'

interface ProductCardProps {
  product: {
    sku: string
    title?: string | null
    brand: string
    category: string
    size?: string | null
    color?: string | null
    condition?: string | null
    price: number | null
    hasVariants?: boolean
    variantCount?: number
    originalPrice?: number | null
    saleActive?: boolean
    mainPhoto?: string | null
    quantity?: number
  }
}

const CONDITION_LABELS: Record<string, string> = {
  'neuf': 'Neuf',
  'tres-bon': 'Très bon état',
  'bon': 'Bon état',
  'correct': 'Correct',
}

const CATEGORY_LABELS: Record<string, string> = {
  vetements: 'Vêtements',
  chaussures: 'Chaussures',
  accessoires: 'Accessoires',
  luxe: 'Luxe',
  maison: 'Maison',
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.quantity != null && product.quantity <= 0
  return (
    <Link
      href={`/boutique/produit/${product.sku}`}
      className={`group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#007bff] transition-all relative ${outOfStock ? 'opacity-75' : ''}`}
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.mainPhoto}
            alt={product.title || `${product.brand} ${product.category}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-gray-300">
            <Package className="h-12 w-12" />
          </div>
        )}
        {product.condition && (
          <span className="absolute top-2 left-2 bg-white/95 text-[10px] font-semibold px-2 py-1 rounded-full text-gray-700 uppercase">
            {CONDITION_LABELS[product.condition] || product.condition}
          </span>
        )}
        {outOfStock && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">
            Indisponible
          </span>
        )}
        {product.hasVariants && (
          <span className="absolute bottom-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">
            {product.variantCount} variantes
          </span>
        )}
      </div>
      <div className="p-3 space-y-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
          {product.brand}
        </p>
        <p className="text-sm font-medium text-gray-900 line-clamp-1">
          {product.title || (CATEGORY_LABELS[product.category] || product.category)}
          {product.size && ` · Taille ${product.size}`}
        </p>
        {product.color && (
          <p className="text-xs text-gray-500">{product.color}</p>
        )}
        <div className="flex items-center gap-2 pt-1">
          {product.saleActive && product.originalPrice ? (
            <>
              <p className="text-lg font-bold text-red-600">
                {product.price != null ? `${product.price.toFixed(2)} €` : '—'}
              </p>
              <p className="text-sm text-gray-400 line-through">
                {product.originalPrice.toFixed(2)} €
              </p>
            </>
          ) : (
            <p className="text-lg font-bold text-[#007bff]">
              {product.price != null ? `${product.price.toFixed(2)} €` : '—'}
            </p>
          )}
          {outOfStock && (
            <span className="text-[10px] text-red-600 font-medium ml-auto">Rupture de stock</span>
          )}
        </div>
      </div>
    </Link>
  )
}
