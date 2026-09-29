// Renders the app icon at whatever sizes PWA installability needs, by hand,
// pixel by pixel. No SVG rasterizer (rsvg-convert, cairosvg, Pillow) was
// available in this environment, and pulling in a native-binding canvas lib
// is a lot of weight for one flying-disc icon — pngjs is pure JS and this
// shape is simple enough to describe as a couple of ellipse tests.
//
// The disc is drawn inside the inner ~66% safe-zone circle Android's
// "maskable" icon spec expects, so the same PNGs work as both a plain and a
// maskable icon without a separate padded version.
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const BG_TOP = [20, 184, 166]      // teal-500
const BG_BOTTOM = [15, 23, 42]     // slate-900
const DISC_FILL = [249, 115, 22]   // orange-500
const DISC_RIM = [194, 65, 12]     // orange-700
const DISC_HIGHLIGHT = [254, 215, 170] // orange-200

function lerp(a, b, t) { return a + (b - a) * t }
function lerpColor(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)] }

function renderIcon(size) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2
  const cy = size / 2
  // Flattened ellipse = a disc seen edge-on in flight, not a flat top-down
  // circle — reads as "flying disc" rather than "coin" at icon size.
  const rx = size * 0.40
  const ry = size * 0.19

  for (let y = 0; y < size; y++) {
    const t = y / size
    const bg = lerpColor(BG_TOP, BG_BOTTOM, t)
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const e = nx * nx + ny * ny

      let color = bg
      if (e <= 1) {
        if (e > 0.72) {
          color = DISC_RIM
        } else if (ny < -0.15 && e < 0.55) {
          // Sheen along the top-front edge, like light catching the plastic.
          const shineT = Math.max(0, 1 - e / 0.55)
          color = lerpColor(DISC_FILL, DISC_HIGHLIGHT, shineT * 0.8)
        } else {
          color = DISC_FILL
        }
      }

      png.data[idx] = Math.round(color[0])
      png.data[idx + 1] = Math.round(color[1])
      png.data[idx + 2] = Math.round(color[2])
      png.data[idx + 3] = 255
    }
  }
  return png
}

const outDir = path.join(__dirname, '..', 'site', 'icons')
fs.mkdirSync(outDir, { recursive: true })

const sizes = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['favicon-32.png', 32],
]

for (const [name, size] of sizes) {
  const png = renderIcon(size)
  const buf = PNG.sync.write(png)
  fs.writeFileSync(path.join(outDir, name), buf)
  console.log('wrote', name, `(${size}x${size})`)
}
