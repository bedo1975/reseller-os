/**
 * Vinted API client (read-only catalog search).
 *
 * Strategy:
 *  1. Try curl-impersonate if available (Linux binary in /bin folder) — bypasses Cloudflare.
 *  2. Fallback to native fetch with browser headers + cookie jar.
 *
 * All requests go through vintedFetch() which handles session init, cookies, retries.
 */

import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'

const DOMAIN = process.env.VINTED_DOMAIN || 'https://www.vinted.fr'
const API_BASE = `${DOMAIN}/api/v2/catalog/items`
const CURL_BIN = path.join(process.cwd(), 'bin', 'curl-impersonate-chrome')

// In-memory cookie jar (resets on server restart — that's fine for our use case)
let cookieJar: Record<string, string> = {}

export const STATUS_MAP: Record<string, number> = {
  new_with_tags: 1,
  new_without_tags: 3,
  very_good: 4,
  good: 5,
  satisfactory: 6,
}

const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
  Referer: `${DOMAIN}/`,
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'same-origin',
  'x-requested-with': 'XMLHttpRequest',
}

function parseCookies(setCookie: string | null) {
  if (!setCookie) return
  setCookie.split(',').forEach((c) => {
    const m = c.match(/^([^=]+)=([^;]+)/)
    if (m) cookieJar[m[1].trim()] = m[2].trim()
  })
}

function formatCookies(): string {
  return Object.entries(cookieJar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

async function initSession() {
  try {
    const res = await fetch(DOMAIN, {
      headers: {
        'User-Agent': BROWSER_HEADERS['User-Agent'],
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    } as RequestInit)
    // Headers.getSetCookie() returns array on modern Node
    const setCookieArr = (res.headers as any).getSetCookie?.() ?? null
    const setCookieStr = setCookieArr ? setCookieArr.join(', ') : res.headers.get('set-cookie')
    parseCookies(setCookieStr)
  } catch {
    // ignore — session init is best-effort
  }
}

async function nodeFetchJson(url: string): Promise<any> {
  if (Object.keys(cookieJar).length === 0) {
    await initSession()
  }
  try {
    const headers = { ...BROWSER_HEADERS, Cookie: formatCookies() }
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    } as RequestInit)
    const setCookieArr = (res.headers as any).getSetCookie?.() ?? null
    const setCookieStr = setCookieArr ? setCookieArr.join(', ') : res.headers.get('set-cookie')
    parseCookies(setCookieStr)

    if (!res.ok) {
      // Retry once on 403/503 (Cloudflare block)
      if (res.status === 403 || res.status === 503) {
        await initSession()
        headers.Cookie = formatCookies()
        const retry = await fetch(url, {
          headers,
          signal: AbortSignal.timeout(20000),
          redirect: 'follow',
        } as RequestInit)
        if (!retry.ok) return { error: `HTTP ${retry.status}` }
        const retrySetCookie = (retry.headers as any).getSetCookie?.() ?? null
        parseCookies(retrySetCookie ? retrySetCookie.join(', ') : retry.headers.get('set-cookie'))
        return await retry.json()
      }
      return { error: `HTTP ${res.status}` }
    }
    return await res.json()
  } catch (err: any) {
    return { error: err?.message || 'fetch failed' }
  }
}

function curlFetchJson(url: string): any | null {
  let cmd: { bin: string; flag: boolean } | null = null

  // Prefer the bundled curl-impersonate binary (Linux)
  if (process.platform === 'linux' && fs.existsSync(CURL_BIN)) {
    cmd = { bin: CURL_BIN, flag: true }
  } else {
    // Try system curl
    const r = spawnSync('curl', ['--version'], { timeout: 5000, encoding: 'utf-8' })
    if (r.status === 0) cmd = { bin: 'curl', flag: false }
  }

  if (!cmd) return null

  const args = ['-s', '-L', '--max-time', '20']
  if (cmd.flag) args.push('--impersonate', 'chrome120')
  Object.entries(BROWSER_HEADERS).forEach(([k, v]) => args.push('-H', `${k}: ${v}`))
  if (formatCookies()) args.push('-H', `Cookie: ${formatCookies()}`)
  args.push(url)

  const r = spawnSync(cmd.bin, args, { timeout: 30000, encoding: 'utf-8' })
  if (r.error || r.status !== 0) return null
  try {
    const data = JSON.parse(r.stdout || '{}')
    // Try to grab a Set-Cookie from stderr (curl -v style) — best effort
    const setCookie = (r.stderr || '').match(/Set-Cookie:\s*([^=\s]+)=([^\s;]+)/)
    if (setCookie) cookieJar[setCookie[1]] = setCookie[2]
    return data
  } catch {
    return null
  }
}

/**
 * Try curl-impersonate first (Cloudflare bypass), then fall back to node fetch.
 */
export async function vintedFetch(url: string): Promise<any> {
  if (Object.keys(cookieJar).length === 0) {
    await initSession()
  }
  const data = curlFetchJson(url)
  if (data) return data
  const fallback = await nodeFetchJson(url)
  return fallback || { error: 'Failed to fetch from Vinted' }
}

export function buildCatalogUrl(qs: Record<string, any>): string {
  const parts: string[] = []
  Object.entries(qs).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return
    if (Array.isArray(v)) {
      // IMPORTANT: do NOT URL-encode the key — Vinted expects raw `status_ids[]` not `status_ids%5B%5D`
      // URLSearchParams encodes [] as %5B%5D which Vinted silently rejects, causing params (incl. order) to be ignored.
      v.forEach((item) => parts.push(`${k}=${encodeURIComponent(String(item))}`))
    } else {
      // Same here: keep the key raw, only encode the value
      parts.push(`${k}=${encodeURIComponent(String(v))}`)
    }
  })
  return `${API_BASE}?${parts.join('&')}`
}

/**
 * Fetch full details for a single Vinted item (includes creation date).
 * Endpoint: /api/v2/items/{id}
 * Response shape: { item: { id, title, created_dte, ... } }
 *
 * In-memory cache (5 min TTL) to avoid re-fetching the same item across searches.
 *
 * Note: Vinted aggressively rate-limits this endpoint (~30 req/min).
 * Callers should use low concurrency + delays via fetchItemsDetailsBatch().
 */
const itemDetailsCache = new Map<string, { data: any; ts: number }>()
const ITEM_CACHE_TTL = 5 * 60 * 1000

export async function fetchItemDetails(id: string): Promise<any | null> {
  const cached = itemDetailsCache.get(id)
  if (cached && Date.now() - cached.ts < ITEM_CACHE_TTL) {
    return cached.data
  }

  const DOMAIN = process.env.VINTED_DOMAIN || 'https://www.vinted.fr'
  const data = await vintedFetch(`${DOMAIN}/api/v2/items/${id}`)
  if (!data || data.error) return null

  // Vinted error responses look like { code: 106, message: "Request rate limit exceeded" }
  if (data.code || data.message_code) {
    console.log(`[Vinted items/${id}] error response:`, data.message || data.message_code)
    return null
  }

  // Real response wraps the item in { item: {...} }
  const item = data.item || data
  // Sanity check: a real item must have an id and title
  if (!item.id || !item.title) {
    console.log(`[Vinted items/${id}] unexpected response shape (no item.id/title)`)
    return null
  }

  itemDetailsCache.set(id, { data: item, ts: Date.now() })
  return item
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch details for multiple items in parallel (with concurrency limit + delay).
 *
 * IMPORTANT: Vinted rate-limits the /items/{id} endpoint aggressively.
 * Defaults are conservative: concurrency=2, batchDelay=800ms.
 *
 * @param ids          List of Vinted item IDs
 * @param concurrency  Max parallel requests per batch (default 2 — stay polite!)
 * @param batchDelay   Delay between batches in ms (default 800)
 */
export async function fetchItemsDetailsBatch(
  ids: string[],
  concurrency = 2,
  batchDelay = 800,
): Promise<Map<string, any>> {
  const results = new Map<string, any>()
  for (let i = 0; i < ids.length; i += concurrency) {
    const batch = ids.slice(i, i + concurrency)
    const settled = await Promise.allSettled(
      batch.map(async (id) => {
        const details = await fetchItemDetails(id)
        return { id, details }
      }),
    )
    settled.forEach((s) => {
      if (s.status === 'fulfilled' && s.value.details) {
        results.set(s.value.id, s.value.details)
      }
    })
    // Wait between batches (except after the last one)
    if (i + concurrency < ids.length) {
      await sleep(batchDelay)
    }
  }
  return results
}

export interface VintedItem {
  id: string
  title: string
  price: number | null
  currency: string | null
  url: string
  image: string | null
  condition: string | null
  likes: number
  views: number
  brand: string | null
  size: string | null
  seller: { username: string | null }
  createdAt: number | null  // ms timestamp (null if unknown)
  createdAtRaw: string | null  // raw field value for debug
}

/**
 * Extract a creation/upload timestamp from a raw Vinted catalog item.
 * Returns ms since epoch, or null if no known field is present.
 */
export function extractTimestamp(item: any): { ms: number | null; raw: string | null } {
  // 1) Unix timestamp in seconds (most common Vinted field)
  if (item.created_timestamp_ts != null) {
    const n = Number(item.created_timestamp_ts)
    if (!isNaN(n) && n > 0) {
      // Detect ms vs seconds: Vinted uses seconds (10 digits in 2024)
      const ms = n > 1e12 ? n : n * 1000
      return { ms, raw: String(item.created_timestamp_ts) }
    }
  }
  // 2) ISO date strings — try every known field name
  const isoFields = [
    'created_dte',
    'upload_date_dte',
    'created_at',
    'posted_at',
    'publication_date',
    'upload_date',
  ]
  for (const f of isoFields) {
    const v = item[f]
    if (typeof v === 'string' && v) {
      const t = Date.parse(v)
      if (!isNaN(t)) return { ms: t, raw: `${f}=${v}` }
    }
  }
  return { ms: null, raw: null }
}

export function formatItems(
  raw: any[] | undefined,
  opts: { minLikes?: number; maxLikes?: number; sizeFilter?: string; maxAgeMs?: number } = {},
): VintedItem[] {
  const { minLikes, maxLikes, sizeFilter, maxAgeMs } = opts
  const now = Date.now()
  return (raw || []).reduce<VintedItem[]>((acc, item) => {
    const likes = item.favourite_count || 0
    if (minLikes !== undefined && likes < minLikes) return acc
    if (maxLikes !== undefined && likes > maxLikes) return acc
    if (sizeFilter && item.size_title && !item.size_title.toLowerCase().includes(sizeFilter.toLowerCase())) return acc

    const { ms: createdAt, raw: createdAtRaw } = extractTimestamp(item)
    // Age filter: exclude items older than maxAgeMs (keep if unknown — don't penalize)
    if (maxAgeMs && maxAgeMs > 0 && createdAt !== null && (now - createdAt) > maxAgeMs) return acc

    acc.push({
      id: String(item.id),
      title: item.title || '',
      price: item.price?.amount != null ? Number(item.price.amount) : null,
      currency: item.price?.currency_code || null,
      url: item.url || '',
      image: item.photo?.url || null,
      condition: item.status || null,
      likes,
      views: item.view_count || 0,
      brand: item.brand_title || null,
      size: item.size_title || null,
      seller: { username: item.user?.login || null },
      createdAt,
      createdAtRaw,
    })
    return acc
  }, [])
}
