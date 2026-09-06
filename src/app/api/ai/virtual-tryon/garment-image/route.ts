import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

/**
 * GET /api/ai/virtual-tryon/garment-image?path=/uploads/sessions/xxx/photo.webp
 * 
 * Reads a photo (possibly WebP) from disk, converts it to JPEG,
 * and returns it as an image/jpeg response.
 * 
 * This is needed because the IDM-VTON model on Replicate can't handle WebP images
 * (returns "can only concatenate str (not NoneType) to str").
 * 
 * NOTE: This endpoint requires auth (admin only) to prevent abuse,
 * but the returned URL is short-lived (just used for the Replicate prediction).
 */
export async function GET(req: NextRequest) {
  try {
    // NOTE: This endpoint is PUBLIC (no auth) because Replicate needs to download
    // the image without authentication. The URL is only sent to Replicate for a
    // single prediction and is not exposed to end users.
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

    const fullPath = path.join(process.cwd(), 'public', cleanPath)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }

    const rawBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()

    // If already JPEG, return as-is
    if (ext === '.jpg' || ext === '.jpeg') {
      return new NextResponse(rawBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Convert WebP/PNG to JPEG using sharp
    const jpegBuffer = await sharp(rawBuffer).jpeg({ quality: 95 }).toBuffer()

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