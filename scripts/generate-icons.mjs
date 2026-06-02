// One-off icon generator for the KS Command PWA.
// Renders an SVG (navy background, amber upward sword, "KS" wordmark) to PNGs
// at every size referenced by public/manifest.json.
//
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ICONS_DIR = join(__dirname, '..', 'public', 'icons')

const NAVY = '#0f172a'
const AMBER = '#f59e0b'
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

// 512x512 master artwork. Centered upward-pointing sword with a "KS" wordmark.
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="512" height="512" rx="96" ry="96" fill="${NAVY}"/>
  <g fill="${AMBER}" stroke="${AMBER}" stroke-linejoin="round">
    <!-- Blade: pointed tip at top -->
    <path d="M256 60 L278 132 L278 286 L234 286 L234 132 Z" stroke-width="2"/>
    <!-- Center fuller highlight -->
    <rect x="252" y="120" width="8" height="160" fill="${NAVY}" stroke="none" opacity="0.35"/>
    <!-- Crossguard -->
    <rect x="190" y="286" width="132" height="22" rx="8" ry="8"/>
    <!-- Grip -->
    <rect x="245" y="308" width="22" height="58" rx="6" ry="6"/>
    <!-- Pommel -->
    <circle cx="256" cy="378" r="15"/>
  </g>
  <text x="256" y="468" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="86" font-weight="bold"
        fill="${AMBER}" letter-spacing="4">KS</text>
</svg>`

async function main() {
  await mkdir(ICONS_DIR, { recursive: true })
  const base = Buffer.from(svg)
  for (const size of SIZES) {
    const out = join(ICONS_DIR, `icon-${size}x${size}.png`)
    await sharp(base).resize(size, size).png().toFile(out)
    console.log('wrote', out)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
