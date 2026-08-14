import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import fs from 'fs'
import path from 'path'
import { ZipArchive } from 'archiver'
import { PassThrough } from 'stream'

/**
 * GET /api/photo-sessions/[id]/export
 * Exports all photos from a photo session as a ZIP file.
 *
 * The ZIP contains all photos with their original filenames, sanitized for cross-platform
 * compatibility (no accents, no special chars). If two photos have the same name, a suffix
 * is added to avoid collisions.
 *
 * Returns: a ZIP file (application/zip) with Content-Disposition attachment.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const session = await db.photoSession.findFirst({
      where: { id, userId: user.id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session introuvable' }, { status: 404 })
    }

    let photos: Array<{ id: string; path: string; filename: string; createdAt: string }> = []
    try { photos = JSON.parse(session.photos) } catch {}

    if (photos.length === 0) {
      return NextResponse.json({ error: 'Aucune photo à exporter' }, { status: 400 })
    }

    // Sanitize the session name for use as a folder name in the ZIP.
    // Remove accents, special chars, and replace spaces with underscores.
    const sanitizedSessionName = (session.name || 'session')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')  // remove accents
      .replace(/[^a-zA-Z0-9_-]+/g, '_')  // replace non-alphanumeric with _
      .replace(/^_+|_+$/g, '')          // trim leading/trailing _
      .toLowerCase() || 'session'

    // Create the ZIP archive in memory (streamed to the response).
    // We use a PassThrough stream to avoid buffering the whole ZIP in memory.
    const passthrough = new PassThrough()

    const archive = new ZipArchive({
      zlib: { level: 6 },  // compression level (0-9). 6 is a good balance.
    })

    archive.on('error', (err: any) => {
      console.error('Archive error:', err)
      passthrough.destroy(err)
    })

    archive.pipe(passthrough)

    // Track filenames to avoid collisions in the ZIP (rare but possible if two
    // photos had the same original filename).
    const usedNames = new Set<string>()

    let addedCount = 0
    for (const photo of photos) {
      // The photo.path is like "/uploads/sessions/{id}/{filename}"
      // We need to read the file from public/{path}
      const filePath = path.join(process.cwd(), 'public', photo.path)

      if (!fs.existsSync(filePath)) {
        console.warn(`Photo file not found, skipping: ${filePath}`)
        continue
      }

      // Use the original filename, but ensure uniqueness
      let outputName = photo.filename || `photo-${photo.id}.webp`
      let counter = 1
      while (usedNames.has(outputName)) {
        const ext = path.extname(outputName)
        const base = path.basename(outputName, ext)
        outputName = `${base}-${counter}${ext}`
        counter++
      }
      usedNames.add(outputName)

      // Add to archive under a folder named after the session
      archive.file(filePath, { name: `${sanitizedSessionName}/${outputName}` })
      addedCount++
    }

    if (addedCount === 0) {
      return NextResponse.json({ error: 'Aucun fichier photo trouvé sur le disque' }, { status: 404 })
    }

    // Finalize the archive — this triggers the stream to start emitting data.
    archive.finalize()

    // Convert the stream to a Web ReadableStream for the NextResponse.
    // Next.js 16 supports ReadableStream in the response body.
    const stream = new ReadableStream({
      start(controller) {
        passthrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk))
        })
        passthrough.on('end', () => {
          controller.close()
        })
        passthrough.on('error', (err: any) => {
          console.error('Stream error during export:', err)
          controller.error(err)
        })
      },
    })

    // Filename for the download (with timestamp to avoid collisions)
    const timestamp = new Date().toISOString().slice(0, 10)
    const downloadName = `${sanitizedSessionName}-${timestamp}.zip`

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('GET /api/photo-sessions/[id]/export error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
