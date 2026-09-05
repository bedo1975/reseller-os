// Quick test: simulate the upload pipeline for various image dimensions
// to find out what dimensions the final image has.
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function simulateUpload(inputBuffer, label) {
  const meta = await sharp(inputBuffer).metadata()
  console.log(`\n=== ${label} ===`)
  console.log(`Input: ${meta.width}×${meta.height} (${meta.format})`)

  // Step 1: compress to WebP, max 1200×1200, fit: inside, no enlargement
  const MAX_WIDTH = 1200
  const MAX_HEIGHT = 1200
  const WEBP_QUALITY = 82

  const compressed = await sharp(inputBuffer)
    .resize(MAX_WIDTH, MAX_HEIGHT, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer()

  const compressedMeta = await sharp(compressed).metadata()
  console.log(`After compress: ${compressedMeta.width}×${compressedMeta.height}`)

  // Step 2: pad to square if not already square (squareSize = max(w, h))
  const width = compressedMeta.width
  const height = compressedMeta.height
  if (width === height) {
    console.log(`Already square — no padding needed`)
    return
  }

  const squareSize = Math.max(width, height)
  console.log(`squareSize = max(${width}, ${height}) = ${squareSize}`)

  const resized = await sharp(compressed)
    .resize(squareSize, squareSize, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toBuffer()

  const resizedMeta = await sharp(resized).metadata()
  console.log(`After resize to fit in ${squareSize}×${squareSize}: ${resizedMeta.width}×${resizedMeta.height}`)

  const padX = Math.floor((squareSize - resizedMeta.width) / 2)
  const padY = Math.floor((squareSize - resizedMeta.height) / 2)
  console.log(`padX = ${padX}, padY = ${padY}`)

  const padded = await sharp(resized)
    .extend({
      top: padY,
      bottom: squareSize - resizedMeta.height - padY,
      left: padX,
      right: squareSize - resizedMeta.width - padX,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .toBuffer()

  const paddedMeta = await sharp(padded).metadata()
  console.log(`Final padded image: ${paddedMeta.width}×${paddedMeta.height}`)
}

async function main() {
  // Test with the available image
  const img1 = fs.readFileSync('/home/z/my-project/upload/Sans titre.png')
  await simulateUpload(img1, 'Sans titre.png (1316×584)')

  console.log('\n\n=== Creating synthetic test images ===')

  // Test 1: 795×1000 (portrait — user's failing case)
  const test1 = await sharp({
    create: {
      width: 795,
      height: 1000,
      channels: 3,
      background: { r: 100, g: 150, b: 200 }
    }
  }).png().toBuffer()
  await simulateUpload(test1, 'Synthetic 795×1000 (portrait — failing)')

  // Test 2: 1024×600 (landscape, user said this works)
  const test2 = await sharp({
    create: {
      width: 1024,
      height: 600,
      channels: 3,
      background: { r: 200, g: 100, b: 50 }
    }
  }).png().toBuffer()
  await simulateUpload(test2, 'Synthetic 1024×600 (landscape — works)')

  // Test 3: 900×1200 (portrait mobile — works)
  const test3 = await sharp({
    create: {
      width: 900,
      height: 1200,
      channels: 3,
      background: { r: 50, g: 200, b: 100 }
    }
  }).png().toBuffer()
  await simulateUpload(test3, 'Synthetic 900×1200 (portrait mobile — works)')
}

main().catch(console.error)
