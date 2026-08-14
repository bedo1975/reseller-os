import sharp from 'sharp'
import { db } from '@/lib/db'

/**
 * Watermark helper — overlays the boutique's logoText on product photos.
 *
 * Behaviour:
 *   - Reads BoutiqueSettings.watermarkEnabled from the DB.
 *   - If true, overlays the logoText in the bottom-right corner of the image.
 *   - If false (or any error reading settings), returns the image unmodified.
 *
 * Visual style:
 *   - White text, semi-transparent (opacity 0.7)
 *   - Drop shadow for readability on light backgrounds
 *   - Font size scales with image width (capped to avoid huge text on big images)
 *   - 2% padding from the bottom-right edge
 *
 * The watermark is rendered as an SVG overlay, then composited via sharp.
 * This is fast (no extra deps) and produces crisp text at any resolution.
 *
 * Usage:
 *   const buffer = await applyWatermark(originalBuffer)
 *   // → buffer is the watermarked image (or the original if watermark disabled)
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Read watermark settings from DB
    const settings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
    if (!settings?.watermarkEnabled) {
      return imageBuffer
    }

    // Use logoText as the watermark text. Fall back to "Boutique" if empty.
    const text = (settings.logoText || 'Boutique').trim()
    if (!text) return imageBuffer

    // Get image metadata to size the watermark proportionally
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 1200
    const height = metadata.height || 1200

    // Font size: 4% of image width, clamped between 16px and 64px.
    // This keeps the watermark readable on small images without being huge on large ones.
    const fontSize = Math.max(16, Math.min(64, Math.round(width * 0.04)))

    // Padding from edges — INTERPRETED AS A PERCENTAGE of image dimensions.
    // The admin stores a number (e.g. 20), which we interpret as "20 pixels on a 1200px image"
    // = ~1.67%. So for an image of size W, the actual pixel offset is (value/1200) * W.
    // This way, the watermark is positioned at the SAME RELATIVE SPOT on every image,
    // regardless of whether it's 502×502, 1200×1200, or 1920×1080.
    //
    // Without this proportional scaling, an offset of 220px would be ~18% of a 1200px image
    // but ~44% of a 502px image — making the watermark appear in very different places.
    const REFERENCE_SIZE = 1200  // reference size for the offset interpretation
    const offsetScaleX = width / REFERENCE_SIZE
    const offsetScaleY = height / REFERENCE_SIZE
    const offsetX = Math.round(Math.max(5, Math.min(500, settings.watermarkOffsetX ?? 20)) * offsetScaleX)
    const offsetY = Math.round(Math.max(5, Math.min(500, settings.watermarkOffsetY ?? 20)) * offsetScaleY)

    // Escape XML special chars in the text (the logoText could contain & < > etc.)
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')

    // Build the SVG overlay.
    // - The SVG canvas matches the image dimensions (so x/y coords are absolute pixels).
    // - text-anchor: end positions the text so its right edge is at (width - offsetX).
    // - The y coordinate is the baseline; subtract a small amount to account for descenders
    //   and ensure the text bottom is at (height - offsetY).
    // - A subtle dark drop shadow behind the white text ensures readability on any background.
    // - opacity 0.7 = visible but not overwhelming.
    const textX = width - offsetX
    const textY = height - offsetY - Math.round(fontSize * 0.2)

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>
  <text
    x="${textX}"
    y="${textY}"
    font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-size="${fontSize}"
    font-weight="700"
    fill="#ffffff"
    fill-opacity="0.7"
    text-anchor="end"
    filter="url(#shadow)"
  >${escapedText}</text>
</svg>`

    // Composite the SVG overlay on top of the original image.
    // sharp processes the pipeline: read buffer → overlay SVG → output buffer.
    const watermarked = await sharp(imageBuffer)
      .composite([{
        input: Buffer.from(svg),
        top: 0,
        left: 0,
        blend: 'over',
      }])
      .toBuffer()

    return watermarked
  } catch (error) {
    console.error('[watermark] Failed to apply watermark, returning original:', error)
    // Fail open: if anything goes wrong, return the original image unmodified.
    // We don't want a watermark failure to break the upload.
    return imageBuffer
  }
}
