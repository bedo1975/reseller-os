'use client'

import Link from 'next/link'
import { Package } from 'lucide-react'

interface ProductCardProps {
  product: {
    sku: string
    brand: string
    category: string
    size?: string | null
    color?: string | null
    condition?: string | null
    price: number | null
    mainPhoto?: string | null
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
  return (
    <Link
      href={`/boutique/produit/${product.sku}`}
      className="group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg hover:border-[#007bff] transition-all"
    >
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {product.mainPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.mainPhoto}
            alt={`${product.brand} ${product.category}`}
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
      </div>
      <div className="p-3 space-y-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">
          {product.brand}
        </p>
        <p className="text-sm font-medium text-gray-900 line-clamp-1">
          {CATEGORY_LABELS[product.category] || product.category}
          {product.size && ` · Taille ${product.size}`}
        </p>
        {product.color && (
          <p className="text-xs text-gray-500">{product.color}</p>
        )}
        <p className="text-lg font-bold text-[#007bff] pt-1">
          {product.price != null ? `${product.price.toFixed(2)} €` : '—'}
        </p>
      </div>
    </Link>
  )
}
