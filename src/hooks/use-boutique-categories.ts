'use client'

import { useState, useEffect } from 'react'

export interface BoutiqueCategoryItem {
  slug: string
  label: string
  parentId: string | null
  emoji: string
  backgroundImage: string | null
  bgColor: string | null
  bgOpacity: number
  order: number
}

export interface BoutiqueCategoryWithChildren extends BoutiqueCategoryItem {
  children: BoutiqueCategoryItem[]
}

/**
 * Hook that fetches the full category tree from BoutiqueCategory (single source of truth).
 * Returns top-level categories with their subcategories.
 */
export function useBoutiqueCategories() {
  const [categories, setCategories] = useState<BoutiqueCategoryWithChildren[]>([])
  const [allFlat, setAllFlat] = useState<BoutiqueCategoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/boutique/admin/categories')
      .then(r => r.json())
      .then(data => {
        const all: BoutiqueCategoryItem[] = data.categories || []
        setAllFlat(all)
        // Build tree: top-level categories with their children
        const top = all
          .filter(c => !c.parentId)
          .map(c => ({
            ...c,
            children: all
              .filter(s => s.parentId === c.slug)
              .sort((a, b) => a.order - b.order),
          }))
          .sort((a, b) => a.order - b.order)
        setCategories(top)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  /**
   * Get subcategories for a given parent slug
   */
  const getSubcategories = (parentSlug: string | null | undefined): BoutiqueCategoryItem[] => {
    if (!parentSlug) return []
    return allFlat.filter(c => c.parentId === parentSlug).sort((a, b) => a.order - b.order)
  }

  /**
   * Get the label for a slug
   */
  const getLabel = (slug: string | null | undefined): string => {
    if (!slug) return ''
    return allFlat.find(c => c.slug === slug)?.label || slug
  }

  return {
    categories,
    allFlat,
    loading,
    getSubcategories,
    getLabel,
  }
}
