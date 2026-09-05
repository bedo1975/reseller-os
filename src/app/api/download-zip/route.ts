import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), 'download', 'reseller-os.zip')
    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Zip not found' }, { status: 404 })
    }
    const buffer = fs.readFileSync(zipPath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="reseller-os.zip"',
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 })
  }
}
