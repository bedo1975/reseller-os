/**
 * Converts a stored photo path (e.g., "/uploads/sessions/.../photo.jpg")
 * to a URL that bypasses Next.js static file serving (which has caching issues
 * in production with files created after build).
 *
 * In production, /uploads/* is served by /api/uploads/* route (see src/app/api/uploads/[...path]/route.ts).
 * This avoids the aggressive Next.js cache (x-nextjs-cache: HIT returning stale 404s).
 *
 * External URLs (http://, https://, data:) are returned as-is.
 */
export function photoUrl(path: string | null | undefined): string {
  if (!path) return ''
  // External URLs and data URIs — return as-is
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path
  }
  // Local uploads — prefix with /api to use our custom route (bypasses Next.js static cache)
  if (path.startsWith('/uploads/')) {
    return `/api${path}`
  }
  // Other paths — return as-is
  return path
}
