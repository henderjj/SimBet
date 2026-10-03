// Rasterises public/icons/icon.svg into the PNGs the manifest and iOS need.
// Run with `npm run icons` after changing the SVG; the PNGs are committed.
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const dir = new URL('../public/icons/', import.meta.url)
const svg = await readFile(new URL('icon.svg', dir), 'utf8')
// Maskable and iOS icons get cropped by the OS, so they need a full-bleed background.
const fullBleed = svg.replace('rx="112"', 'rx="0"')

const outputs = [
  ['icon-192.png', svg, 192],
  ['icon-512.png', svg, 512],
  ['icon-maskable-512.png', fullBleed, 512],
  ['apple-touch-icon.png', fullBleed, 180],
]

for (const [name, source, size] of outputs) {
  await sharp(Buffer.from(source), { density: 300 }).resize(size, size).png().toFile(fileURLToPath(new URL(name, dir)))
  console.log(name)
}
