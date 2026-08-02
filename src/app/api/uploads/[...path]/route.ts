import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * Serves files from the public/uploads/ directory.
 * This route bypasses Next.js static file serving (which has caching issues
 * with files created after build in production).
 *
 * URL: /api/uploads/sessions/{sessionId}/{filename}
 * File: public/uploads/sessions/{sessionId}/{filename}
 *
 * No auth required — these are public product photos (e.g., for Vinted listings).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const { path: segments } = await params

    // Security: ensure all segments are safe (no .. or absolute paths)
    const safeSegments = segments.map((s) => {
      if (s.includes('..') || s.includes('/') || s.includes('\\')) {
        throw new Error('Invalid path segment')
      }
      return s
    })

    const filePath = path.join(process.cwd(), 'public', 'uploads', ...safeSegments)

    // Security: ensure the resolved path is within public/uploads/
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(uploadsDir + path.sep) && resolved !== uploadsDir) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Determine MIME type from extension
    const ext = path.extname(filePath).toLowerCase()
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.avif': 'image/avif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    }
    const contentType = mimeTypes[ext] || 'application/octet-stream'

    const buffer = fs.readFileSync(filePath)

    // For PDFs and images, use Content-Disposition: inline so the browser displays them
    // instead of downloading. For other types, let the browser decide.
    const isInline = ext === '.pdf' || ext.startsWith('.jp') || ext === '.png' || ext === '.webp' || ext === '.gif' || ext === '.svg' || ext === '.avif'

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, immutable', // 1 day cache
        ...(isInline ? { 'Content-Disposition': 'inline' } : {}),
      },
    })
  } catch (error) {
    console.error('GET /api/uploads/[...path] error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
