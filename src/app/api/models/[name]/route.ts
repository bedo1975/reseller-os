import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * GET /api/models/[name]
 * Serves model images from public/models/ directory.
 * This bypasses Next.js static file caching which 404s on files created after build.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params

    // Security: only allow .jpg, .jpeg, .png files
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png)$/i.test(name)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }

    const fullPath = path.join(process.cwd(), 'public', 'models', name)
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const buffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch (error) {
    console.error('GET /api/models/[name] error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}