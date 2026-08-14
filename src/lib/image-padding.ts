import sharp from 'sharp'
import { db } from '@/lib/db'

/**
 * Pad an image to a square with a white background.
 *
 * The image is resized to fit within a square canvas (preserving aspect ratio),
 * then centered on a white background. The result is a square image of the same
 * dimension as the longer side of the original.
 *
 * Example: a 900×1200 portrait photo becomes a 1200×1200 square with the photo
 * centered vertically and white margins on the left and right.
 *
 * Returns the original buffer unchanged if:
 *   - imagePaddingMode is "none" in BoutiqueSettings
 *   - the image is already square (no padding needed)
 *   - any error occurs (fail-open: we don't want a padding failure to break the upload)
 *
 * @param imageBuffer - the source image buffer (any format sharp can read)
 * @returns a Buffer with the (possibly padded) image
 */
export async function padToSquareIfNeeded(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Read padding mode from DB
    const settings = await db.boutiqueSettings.findUnique({ where: { id: 'default' } })
    const mode = settings?.imagePaddingMode || 'none'

    if (mode !== 'square-white') {
      return imageBuffer
    }

    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata()
    const width = metadata.width || 0
    const height = metadata.height || 0

    if (width === 0 || height === 0) {
      return imageBuffer
    }

    // Already square? No padding needed.
    if (width === height) {
      return imageBuffer
    }

    // Determine the square size (max of width/height).
    // We don't enlarge small images beyond their max dimension to avoid upscaling.
    const squareSize = Math.max(width, height)

    // Resize the image to fit inside the square (preserving aspect ratio),
    // then extend the canvas to squareSize×squareSize with a white background.
    // sharp's `extend` adds pixels around the image; we compute the top/left/bottom/right
    // padding to center the image in the square.
    const resized = await sharp(imageBuffer)
      .resize(squareSize, squareSize, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toBuffer()

    // Get the resized image's actual dimensions (may be smaller than squareSize if the
    // original was smaller than squareSize on the shorter side)
    const resizedMeta = await sharp(resized).metadata()
    const resizedW = resizedMeta.width || squareSize
    const resizedH = resizedMeta.height || squareSize

    const padX = Math.floor((squareSize - resizedW) / 2)
    const padY = Math.floor((squareSize - resizedH) / 2)

    // Use extend() to add white padding around the resized image.
    // Background defaults to white #FFFFFF (rgb(255,255,255)).
    const padded = await sharp(resized)
      .extend({
        top: padY,
        bottom: squareSize - resizedH - padY,
        left: padX,
        right: squareSize - resizedW - padX,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .toBuffer()

    return padded
  } catch (error) {
    console.error('[padToSquare] Failed to pad image, returning original:', error)
    return imageBuffer
  }
}
