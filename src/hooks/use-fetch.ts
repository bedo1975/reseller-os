'use client'

import { useState, useEffect, useCallback } from 'react'

export function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }, [url])

  useEffect(() => {
    refresh()
  }, [url, refreshKey])

  const forceRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return { data, loading, error, refresh: forceRefresh, setData }
}
