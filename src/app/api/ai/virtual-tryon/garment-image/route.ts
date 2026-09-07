import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

/**
 * GET /api/ai/virtual-tryon/garment-image?path=/uploads/sessions/xxx/photo.webp
 *
 * Reads a photo (possibly WebP) from disk, converts it to JPEG,
 * resizes it to the dimensions configured in AIConfig (default 768×1024),
 * and returns it as an image/jpeg response.
 *
 * This is needed because:
 * 1. The IDM-VTON model on Replicate can't handle WebP images
 * 2. The model expects a specific aspect ratio (portrait 768×1024) —
 *    sending a square image results in a "crushed" output
 *
 * NOTE: This endpoint is PUBLIC (no auth) because Replicate needs to download
 * the image without authentication.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const photoPath = searchParams.get('path')

    if (!photoPath) {
      return NextResponse.json({ error: 'Path required' }, { status: 400 })
    }

    // Normalize path
    let cleanPath = photoPath
    if (cleanPath.startsWith('public/')) cleanPath = cleanPath.slice('public/'.length)
    if (cleanPath.startsWith('/api/')) cleanPath = cleanPath.slice('/api/'.length)
    cleanPath = cleanPath.replace(/^\//, '')

    // Security: prevent path traversal
    if (cleanPath.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const fullPath = path.join(process.cwd(), 'public', cleanPath)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const rawBuffer = fs.readFileSync(fullPath)

    // Get the target dimensions from AIConfig (first admin with a Replicate key)
    let targetWidth = 768
    let targetHeight = 1024
    try {
      const config = await db.aIConfig.findFirst({
        where: { replicateApiKey: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { vtonImageWidth: true, vtonImageHeight: true },
      })
      if (config) {
        targetWidth = config.vtonImageWidth || 768
        targetHeight = config.vtonImageHeight || 1024
      }
    } catch {}

    // Resize to the target dimensions (cover — fills the frame, may crop slightly)
    // and convert to JPEG. This ensures the model receives the correct aspect ratio.
    const jpegBuffer = await sharp(rawBuffer)
      .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 95 })
      .toBuffer()

    return new NextResponse(jpegBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('GET /api/ai/virtual-tryon/garment-image error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

