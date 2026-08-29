import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/session'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'

const execAsync = promisify(exec)

/**
 * POST /api/admin/geoip-update
 * Admin — triggers the download-geolite2.sh script to update the GeoLite2-City.mmdb database.
 * Returns the file size + modification date on success.
 */
export async function POST() {
  try {
    await requireAdmin()

    // Find the script — look in the project root (next to package.json)
    const projectRoot = process.cwd()
    const scriptPath = path.join(projectRoot, 'download-geolite2.sh')

    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({ error: 'Script download-geolite2.sh introuvable' }, { status: 404 })
    }

    // Execute the script
    const { stdout, stderr } = await execAsync(`bash ${scriptPath}`, {
      cwd: projectRoot,
      timeout: 120000, // 2 minutes max
    })

    // Check the result
    const dbPath = path.join(projectRoot, 'data', 'GeoLite2-City.mmdb')
    if (!fs.existsSync(dbPath)) {
      return NextResponse.json({ error: 'Le téléchargement a échoué — fichier .mmdb introuvable' }, { status: 500 })
    }

    const stats = fs.statSync(dbPath)
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(1)
    const modDate = stats.mtime.toLocaleString('fr-FR')

    return NextResponse.json({
      ok: true,
      message: `Base GeoLite2 mise à jour (${sizeMB} MB, ${modDate})`,
      size: `${sizeMB} MB`,
      date: modDate,
      stdout: stdout.slice(0, 500),
    })
  } catch (error: any) {
    console.error('POST /api/admin/geoip-update error:', error)
    if (error instanceof Error && (error.message === 'UNAUTHORIZED' || error.message === 'FORBIDDEN')) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    return NextResponse.json({
      error: 'Erreur lors de la mise à jour',
      details: error?.message || 'Erreur inconnue',
    }, { status: 500 })
  }
}
