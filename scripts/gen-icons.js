// Renders the app icon at whatever sizes PWA installability needs, by hand,
// pixel by pixel. No SVG rasterizer (rsvg-convert, cairosvg, Pillow) was
// available in this environment, and pulling in a native-binding canvas lib
// is a lot of weight for one icon — pngjs is pure JS and this shape (a
// disc golf basket: pole, chain cage, tray) is simple enough to describe as
// a few lines and ellipse tests.
//
// The glyph is drawn inside the inner ~66% safe-zone circle Android's
// "maskable" icon spec expects, so the same PNGs work as both a plain and a
// maskable icon without a separate padded version.
const fs = require('fs')
const path = require('path')
const { PNG } = require('pngjs')

const BG_TOP = [20, 184, 166]        // teal-500
const BG_BOTTOM = [15, 23, 42]       // slate-900
const METAL = [226, 232, 240]        // slate-200 — chains, pole, tray body
const METAL_DARK = [100, 116, 139]   // slate-500 — rim/shadow side
const ACCENT = [249, 115, 22]        // orange-500 — brand accent band on the tray

function lerp(a, b, t) { return a + (b - a) * t }
function lerpColor(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)] }

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
  const chainThickness = Math.max(0.8, size * 0.011)
  const capRadius = Math.max(1.5, size * 0.035)

  const CHAIN_COUNT = 9
  const chainEndpoints = []
  for (let i = 0; i < CHAIN_COUNT; i++) {
    const t = -1 + (2 * i) / (CHAIN_COUNT - 1)
    chainEndpoints.push([cx + t * trayRx * 0.96, trayY])
  }

  for (let y = 0; y < size; y++) {
    const bgT = y / size
    const bg = lerpColor(BG_TOP, BG_BOTTOM, bgT)
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2
      let color = bg

      // Chain cage: a fan of straight lines from the apex down to the rim.
      if (y <= trayY + chainThickness) {
        for (const [ex, ey] of chainEndpoints) {
          if (distToSegment(x, y, cx, apexY, ex, ey) <= chainThickness) {
            color = METAL_DARK
            break
          }
        }
      }

      // Tray (the basket itself) — a flattened ellipse, shaded like the
      // flying-disc icon before it: darker rim, lighter top sheen, with a
      // thin orange band as a brand accent.
      const nx = (x - cx) / trayRx
      const ny = (y - trayY) / trayRy
      const e = nx * nx + ny * ny
      if (e <= 1) {
        if (e > 0.82) {
          color = METAL_DARK
        } else if (e > 0.60) {
          color = ACCENT
        } else if (ny < -0.15 && e < 0.45) {
          const shineT = Math.max(0, 1 - e / 0.45)
          color = lerpColor(METAL, [255, 255, 255], shineT * 0.6)
        } else {
          color = METAL
        }
      }

      // Pole, drawn last so it sits in front of the tray's lower edge.
      if (x >= cx - poleHalfWidth && x <= cx + poleHalfWidth && y >= poleTopY && y <= poleBottomY) {
        color = METAL_DARK
      }

      // Apex cap, where the chains gather under the mount.
      if (Math.hypot(x - cx, y - apexY) <= capRadius) {
        color = METAL_DARK
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
