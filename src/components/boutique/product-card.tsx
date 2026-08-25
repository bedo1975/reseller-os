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
    grade?: string | null
    price: number | null
    hasVariants?: boolean
    variantCount?: number
    isLot?: boolean
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

// Grade badges — same colors as on the product page (Grade A = green, B = yellow, C = orange)
const GRADE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  A: { label: 'Grade A', bg: 'bg-emerald-500', text: 'text-white' },
  B: { label: 'Grade B', bg: 'bg-yellow-400', text: 'text-yellow-950' },
  C: { label: 'Grade C', bg: 'bg-orange-500', text: 'text-white' },
}

export function ProductCard({ product }: ProductCardProps) {
  const outOfStock = product.quantity != null && product.quantity <= 0
  const grade = product.grade && GRADE_CONFIG[product.grade] ? GRADE_CONFIG[product.grade] : null
  return (
    <Link
      href={`/produit/${product.sku}`}
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
        {/* Top-left: condition + grade badges stacked vertically */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
          {product.condition && (
            <span className="bg-white/95 text-[10px] font-semibold px-2 py-1 rounded-full text-gray-700 uppercase">
              {CONDITION_LABELS[product.condition] || product.condition}
            </span>
          )}
          {grade && (
            <span
              className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${grade.bg} ${grade.text}`}
              title="En savoir plus sur nos grades"
            >
              {grade.label}
            </span>
          )}
        </div>
        {outOfStock && (
          <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">
            Indisponible
          </span>
        )}
        {product.isLot && (
          <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase">
            LOT
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
