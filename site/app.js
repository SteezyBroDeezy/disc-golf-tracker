// Disc Golf Tracker — walks the distance from a start point to wherever you
// are now, live, using the phone's GPS. No accounts, no backend: everything
// lives in this tab.

const UNITS = {
  ft: { label: 'ft', fromMeters: (m) => m * 3.28084, decimals: 0 },
  m: { label: 'm', fromMeters: (m) => m, decimals: 0 },
  km: { label: 'km', fromMeters: (m) => m / 1000, decimals: 2 },
}

const els = {
  distanceValue: document.getElementById('distanceValue'),
  distanceUnit: document.getElementById('distanceUnit'),
  accuracyLine: document.getElementById('accuracyLine'),
  accuracyDot: document.getElementById('accuracyDot'),
  accuracyText: document.getElementById('accuracyText'),
  statusLine: document.getElementById('statusLine'),
  startBtn: document.getElementById('startBtn'),
  resetBtn: document.getElementById('resetBtn'),
  unitButtons: [...document.querySelectorAll('.unit-toggle button')],
}

let unit = localStorage.getItem('dgt-unit') || 'ft'
let watchId = null
let startPos = null // { lat, lon, accuracy }
let lastPos = null
let locking = false        // true while waiting for a tight-enough first fix
let lockDeadline = 0       // Date.now() past which we lock whatever we have
let bestLockCandidate = null

// A fix this loose (in meters) isn't worth locking the start point to if a
// better one might arrive in a couple more seconds — but we still lock
// *something* once LOCK_TIMEOUT_MS passes, so bad GPS (indoors, testing)
// doesn't leave the app stuck saying "locking" forever.
const LOCK_ACCURACY_M = 15
const LOCK_TIMEOUT_MS = 8000

function setUnit(next) {
  unit = next
  localStorage.setItem('dgt-unit', unit)
  els.unitButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.unit === unit))
  els.distanceUnit.textContent = UNITS[unit].label
  if (lastPos) render()
}

els.unitButtons.forEach(btn => btn.addEventListener('click', () => setUnit(btn.dataset.unit)))
setUnit(unit)

// Great-circle distance between two lat/lon points, in meters. Fine-grained
// enough for anything up to continental scale; a disc golf throw is a
// rounding error next to the approximations this makes.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters) {
  const { fromMeters, decimals } = UNITS[unit]
  const value = fromMeters(meters)
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function render() {
  if (!startPos || !lastPos) return
  const meters = haversineMeters(startPos.lat, startPos.lon, lastPos.lat, lastPos.lon)
  els.distanceValue.textContent = formatDistance(meters)

  // Both fixes carry their own GPS uncertainty; the true distance could be
  // off by roughly the sum of the two, which is the honest number to show
  // rather than pretending the reading is exact.
  const combinedAccuracyM = (startPos.accuracy || 0) + (lastPos.accuracy || 0)
  const accuracyDisplay = UNITS[unit].fromMeters(combinedAccuracyM)
  const accUnit = UNITS[unit].label
  els.accuracyText.textContent = `± ${accuracyDisplay.toLocaleString(undefined, { maximumFractionDigits: unit === 'km' ? 2 : 0 })} ${accUnit} accuracy`
  els.accuracyDot.className = 'accuracy-dot ' + (
    combinedAccuracyM <= 8 ? 'good' : combinedAccuracyM <= 20 ? 'warn' : 'bad'
  )
  els.accuracyLine.hidden = false
}

function setStatus(text, isError = false) {
  els.statusLine.textContent = text
  els.statusLine.classList.toggle('error', isError)
}

function geoErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied — enable it in your phone settings to track distance.'
    case err.POSITION_UNAVAILABLE:
      return "Can't get a GPS fix right now. Try moving to open sky."
    case err.TIMEOUT:
      return 'GPS is taking a while — still trying...'
    default:
      return 'Location error: ' + err.message
  }
}

function stopWatch() {
  if (watchId != null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
}

function reset() {
  stopWatch()
  startPos = null
  lastPos = null
  locking = false
  bestLockCandidate = null
  els.distanceValue.textContent = '0'
  els.accuracyLine.hidden = true
  els.resetBtn.hidden = true
  els.startBtn.hidden = false
  els.startBtn.disabled = false
  els.startBtn.textContent = 'Set Start Point'
  setStatus('')
}

function metersToUnitString(m) {
  const v = UNITS[unit].fromMeters(m)
  return `${v.toLocaleString(undefined, { maximumFractionDigits: unit === 'km' ? 2 : 0 })} ${UNITS[unit].label}`
}

// Runs on every fix while we're still choosing the start point. Locks in as
// soon as one comes in tight enough, or once LOCK_TIMEOUT_MS has passed —
// whichever happens first — using the best fix seen so far in the timeout
// case rather than whatever merely happened to be last.
function handleLockingFix(pos) {
  const candidate = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }
  if (!bestLockCandidate || candidate.accuracy < bestLockCandidate.accuracy) {
    bestLockCandidate = candidate
  }

  const goodEnough = candidate.accuracy <= LOCK_ACCURACY_M
  const timedOut = Date.now() >= lockDeadline
  if (!goodEnough && !timedOut) {
    setStatus(`Locking your start point... (± ${metersToUnitString(candidate.accuracy)} so far)`)
    return
  }

  locking = false
  startPos = bestLockCandidate
  lastPos = { ...bestLockCandidate }
  render()
  setStatus('Tracking — walk toward your target.')
  els.startBtn.hidden = true
  els.resetBtn.hidden = false
}

function beginTracking() {
  if (!('geolocation' in navigator)) {
    setStatus("This phone's browser doesn't support location.", true)
    return
  }

  els.startBtn.disabled = true
  els.startBtn.textContent = 'Locking GPS...'
  setStatus('Getting a GPS fix for your start point...')
  locking = true
  bestLockCandidate = null
  lockDeadline = Date.now() + LOCK_TIMEOUT_MS

  // One continuous watch for the whole session — the start point is just
  // the first fix from this same stream, not a separate call. Locking start
  // and every later reading to the same GPS session is what keeps a later
  // reading's noise from including the gap between two unrelated fixes.
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (locking) {
        handleLockingFix(pos)
        return
      }
      lastPos = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }
      render()
      setStatus('Tracking — walk toward your target.')
    },
    (err) => {
      setStatus(geoErrorMessage(err), true)
      if (locking) {
        els.startBtn.disabled = false
        els.startBtn.textContent = 'Set Start Point'
      }
    },
    { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
  )
}

els.startBtn.addEventListener('click', beginTracking)
els.resetBtn.addEventListener('click', reset)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {})
  })
}
