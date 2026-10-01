// Renders the app icon at whatever sizes PWA installability needs, by hand,
// pixel by pixel. No SVG rasterizer (rsvg-convert, cairosvg, Pillow) was
// available in this environment, and pulling in a native-binding canvas lib
// is a lot of weight for one icon — pngjs is pure JS and this shape (a
// disc golf basket: pole, chain cage, tray) is simple enough to describe as
// a few lines and ellipse tests.
//
// Flat black silhouette on white, no shading — a plain, high-contrast logo
// rather than a shaded 3D icon. The glyph is drawn inside the inner ~66%
// safe-zone circle Android's "maskable" icon spec expects, so the same
// PNGs work as both a plain and a maskable icon without a separate padded
// version.
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const WHITE = [255, 255, 255]
const BLACK = [17, 17, 17]

// Shortest distance from point (px,py) to the segment (x1,y1)-(x2,y2).
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = dx * dx + dy * dy
  let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0
  t = Math.max(0, Math.min(1, t))
  const cx = x1 + t * dx
  const cy = y1 + t * dy
  return Math.hypot(px - cx, py - cy)
}

function renderIcon(size) {
  const png = new PNG({ width: size, height: size })
  const cx = size / 2

  // Basket geometry, as fractions of the icon size.
  const apexY = size * 0.20       // where the chains converge, under the cap
  const trayY = size * 0.54       // the rim the chains hang down to
  const trayRx = size * 0.30
  const trayRy = size * 0.085
  const poleTopY = trayY
  const poleBottomY = size * 0.86
  const poleHalfWidth = Math.max(1.2, size * 0.032)
  const chainThickness = Math.max(0.9, size * 0.013)
  const trayRimThickness = Math.max(0.9, size * 0.014)
  const capRadius = Math.max(1.5, size * 0.035)

  const CHAIN_COUNT = 9
  const chainEndpoints = []
  for (let i = 0; i < CHAIN_COUNT; i++) {
    const t = -1 + (2 * i) / (CHAIN_COUNT - 1)
    chainEndpoints.push([cx + t * trayRx * 0.96, trayY])
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      let isBlack = false

      // Chain cage: a fan of straight lines from the apex down to the rim.
      if (!isBlack && y <= trayY + chainThickness) {
        for (const [ex, ey] of chainEndpoints) {
          if (distToSegment(x, y, cx, apexY, ex, ey) <= chainThickness) {
            isBlack = true
            break
          }
        }
      }

      // Tray rim — an ellipse outline (not filled), so the silhouette reads
      // as a basket's hoop rather than a solid disc.
      if (!isBlack) {
        const nx = (x - cx) / trayRx
        const ny = (y - trayY) / trayRy
        const e = nx * nx + ny * ny
        // Approximate a constant-width ring by testing distance-to-ellipse
        // in normalized space, scaled back by the local radius.
        const ringBandM = Math.abs(Math.sqrt(e) - 1) * Math.min(trayRx, trayRy)
        if (ringBandM <= trayRimThickness) isBlack = true
      }

      // Pole.
      if (!isBlack && x >= cx - poleHalfWidth && x <= cx + poleHalfWidth && y >= poleTopY && y <= poleBottomY) {
        isBlack = true
      }

      // Apex cap, where the chains gather under the mount.
      if (!isBlack && Math.hypot(x - cx, y - apexY) <= capRadius) {
        isBlack = true
      }

      const color = isBlack ? BLACK : WHITE
      png.data[idx] = color[0]
      png.data[idx + 1] = color[1]
      png.data[idx + 2] = color[2]
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
