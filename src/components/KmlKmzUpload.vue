<template>
  <div class="kmlkmz-upload-wrapper">
    <button
      type="button"
      class="kmlkmz-btn"
      :disabled="processing"
      title="Upload KML / KMZ"
      @click="triggerFileDialog"
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 16a1 1 0 0 1-1-1V7.41l-2.3 2.3a1 1 0 1 1-1.4-1.42l4-4a1 1 0 0 1 1.4 0l4 4a1 1 0 0 1-1.4 1.42L13 7.41V15a1 1 0 0 1-1 1Z" fill="currentColor"/>
        <path d="M5 20a3 3 0 0 1-3-3v-2a1 1 0 1 1 2 0v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2a1 1 0 1 1 2 0v2a3 3 0 0 1-3 3H5Z" fill="currentColor"/>
      </svg>
    </button>
    <input
      ref="fileInput"
      type="file"
      accept=".kml,.kmz"
      class="hidden-input"
      @change="onFileChange"
    />
    <!-- Optional layer list (hidden by default) -->
    <div v-if="showLayerList && layers.length" class="kmlkmz-layers">
      <h5 class="layers-title">Layer KML/KMZ</h5>
      <ul class="layers-list">
        <li v-for="l in layers" :key="l.id" class="layer-item">
          <span class="layer-name" @click="zoomLayer(l)">{{ l.name }}</span>
          <button type="button" class="layer-remove" @click="removeLayer(l)" :disabled="processing">×</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import JSZip from 'jszip'
import { kml as toGeoJsonKml } from '@tmcw/togeojson'

const props = defineProps({
  map: { type: Object, default: null },
  // Optional proxy base URL to bypass CORS, e.g. 'https://your-proxy.example/fetch?url='
  proxyUrl: { type: String, default: '' },
  // Control whether to show the layers list popover
  showLayerList: { type: Boolean, default: false },
})

const fileInput = ref(null)
const error = ref('')
const processing = ref(false)
const layers = ref([]) // [{ id, name, layer }]
const emit = defineEmits(['error', 'success'])
let layerCounter = 0
// Per-upload operation state to avoid duplicate errors/debug downloads
let currentOpId = 0
let opErrorEmitted = false
let opDebugDownloaded = false
let opSuccessEmitted = false

const resetError = () => { error.value = '' }

const triggerFileDialog = () => {
  resetError()
  if (fileInput.value) fileInput.value.click()
}

const onFileChange = async (e) => {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  e.target.value = '' // reset so same file can be re-selected
  await handleFile(file)
}

const handleFile = async (file) => {
  resetError()
  if (!props.map) { error.value = 'Map belum siap.'; emit('error', error.value); return }
  const name = file.name || 'file'
  const lower = name.toLowerCase()
  processing.value = true
  // initialize per-operation flags
  currentOpId++
  opErrorEmitted = false
  opDebugDownloaded = false
  opSuccessEmitted = false
  try {
    if (lower.endsWith('.kml')) {
      // Decode with proper encoding per XML header or BOM
      const arrayBuf = await file.arrayBuffer()
      const text = decodeKmlText(arrayBuf)
      await loadKmlText(text, name)
    } else if (lower.endsWith('.kmz')) {
      const arrayBuf = await file.arrayBuffer()
      await loadKmzArray(arrayBuf, name)
    } else {
      throw new Error('Format harus .kml atau .kmz')
    }
  } catch (err) {
    console.error('KML/KMZ load error:', err)
    error.value = err?.message || 'Gagal memuat file.'
    await emitOnceWithDebug(error.value, async () => {
      try { await downloadDebugFromFile(file, error.value) } catch (_) {}
    })
  } finally {
    processing.value = false
  }
}

const loadKmzArray = async (arrayBuf, originalName) => {
  let zip
  try {
    zip = await JSZip.loadAsync(arrayBuf)
  } catch (e) {
    throw new Error('File KMZ tidak valid.')
  }
  // Prefer doc.kml, else largest .kml
  const entries = Object.keys(zip.files).filter((p) => p.toLowerCase().endsWith('.kml'))
  if (!entries.length) throw new Error('Tidak ditemukan file .kml di dalam .kmz')
  let chosen = entries.find(p => /(^|\/)doc\.kml$/i.test(p))
  if (!chosen) {
    chosen = entries
      .map((p) => ({ p, size: zip.files[p] && zip.files[p]._data ? zip.files[p]._data.uncompressedSize : (zip.files[p]?.unzippedSize || 0) }))
      .sort((a,b) => b.size - a.size)[0].p
  }
  const kmlArray = await zip.file(chosen).async('arraybuffer')
  const kmlText = decodeKmlText(kmlArray)
  // Parse KML text
  await loadKmlText(kmlText, originalName || chosen)
  // Additionally process GroundOverlay images inside KMZ
  try {
    const xml = new DOMParser().parseFromString(kmlText, 'text/xml')
    await addGroundOverlaysFromKmz(zip, xml)
  } catch (_) { /* ignore overlay errors */ }
}

const loadKmlText = async (kmlText, displayName) => {
  let xml
  try {
    xml = new DOMParser().parseFromString(kmlText, 'text/xml')
  } catch (e) {
    throw new Error('Gagal parse XML KML')
  }
  if (!xml || !xml.documentElement) throw new Error('Dokumen KML kosong')
  let geojson
  let featureCount = 0
  try {
    geojson = toGeoJsonKml(xml)
    featureCount = Array.isArray(geojson?.features) ? geojson.features.length : 0
  } catch (e) {
    // continue to fallback / network links
  }
  if (!geojson || !geojson.features || geojson.features.length === 0) {
    // Fallback: manual KML parsing for Point/LineString/Polygon (common in Google Earth exports)
    geojson = kmlToGeoJsonFallback(xml)
    featureCount = Array.isArray(geojson?.features) ? geojson.features.length : 0
  }
  if (featureCount > 0) {
    addGeoJsonLayer(geojson, displayName)
  }
  // Process NetworkLinks: fetch external KMLs and render them
  let loadedLinks = 0
  try {
    loadedLinks = await loadNetworkLinks(xml)
  } catch (_) {}
  if (featureCount === 0 && loadedLinks === 0) {
    // Provide a precise error instead of a generic template
    throw new Error('KML tidak memiliki fitur lokal dan tidak ada NetworkLink yang berhasil dimuat')
  }
}

const addGeoJsonLayer = (geojson, layerName) => {
  const layer = L.geoJSON(geojson, {
    style: feature => ({
      color: '#ff6600',
      weight: 2,
      opacity: 0.9
    }),
    pointToLayer: (feature, latlng) => {
      // Use a visible marker style
      return L.circleMarker(latlng, { radius: 6, color: '#000', weight: 2, fillColor: '#fff', fillOpacity: 1 })
    },
    onEachFeature: (feature, lyr) => {
      const props = feature.properties || {}
      const title = props.name || props.Name || props.title || 'Feature'
      const desc = props.description || props.Description || ''
      const html = `<strong>${title}</strong>${desc ? '<br/>' + desc : ''}`
      if (html && lyr.bindPopup) lyr.bindPopup(html)
    }
  })
  layer.addTo(props.map)
  try {
    const b = layer.getBounds()
    if (b && b.isValid()) props.map.fitBounds(b, { padding: [40, 40] })
  } catch (_) {}
  layers.value.push({ id: ++layerCounter, name: layerName, layer })
  emitSuccessOnce('Layer KML/KMZ berhasil dimuat')
}

const removeLayer = (entry) => {
  if (!entry) return
  try { props.map.removeLayer(entry.layer) } catch (_) {}
  layers.value = layers.value.filter(l => l.id !== entry.id)
}

const zoomLayer = (entry) => {
  if (!entry || !entry.layer) return
  try {
    const b = entry.layer.getBounds && entry.layer.getBounds()
    if (b && b.isValid()) props.map.fitBounds(b, { padding: [40, 40] })
  } catch (_) {}
}

// Fallback converter: handle common KML elements manually
function kmlToGeoJsonFallback(xmlDoc) {
  const nsResolver = (prefix) => {
    const map = {
      'kml': 'http://www.opengis.net/kml/2.2',
      'gx': 'http://www.google.com/kml/ext/2.2'
    }
    return map[prefix] || null
  }
  const text = (node) => (node && node.textContent ? node.textContent.trim() : '')
  const coordToLngLat = (coordStr) => {
    // "lon,lat[,alt]" -> [lon, lat]
    const parts = coordStr.split(',').map(s => s.trim()).filter(Boolean)
    if (parts.length < 2) return null
    const lon = Number(parts[0])
    const lat = Number(parts[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    return [lon, lat]
  }
  const parseCoordinatesList = (coordsBlock) => {
    // space-separated list of lon,lat,alt
    const raw = text(coordsBlock)
    return raw
      .split(/\s+/)
      .map(s => coordToLngLat(s))
      .filter(Boolean)
  }

  const features = []
  // Collect placemarks from whole doc including nested Folders/Documents
  const placemarks = Array.from(xmlDoc.getElementsByTagName('Placemark'))
  placemarks.forEach(pm => {
    const name = text(pm.getElementsByTagName('name')[0])
    const desc = text(pm.getElementsByTagName('description')[0])
    // ExtendedData support (Data name/value)
    const extended = pm.getElementsByTagName('ExtendedData')[0]
    const dataProps = {}
    if (extended) {
      const datas = Array.from(extended.getElementsByTagName('Data'))
      datas.forEach(d => {
        const key = d.getAttribute('name') || ''
        const valNode = d.getElementsByTagName('value')[0]
        const val = text(valNode)
        if (key) dataProps[key] = val
      })
      const simpleDatas = Array.from(pm.getElementsByTagName('SimpleData'))
      simpleDatas.forEach(sd => {
        const key = sd.getAttribute('name') || ''
        const val = text(sd)
        if (key) dataProps[key] = val
      })
    }
    const point = pm.getElementsByTagName('Point')[0]
    const line = pm.getElementsByTagName('LineString')[0]
    const poly = pm.getElementsByTagName('Polygon')[0]
    const multi = pm.getElementsByTagName('MultiGeometry')[0]
    // gx:Track support (extract <gx:coord> lon lat alt)
    const gxTrack = pm.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'Track')[0]

    if (point) {
      const coordsNode = point.getElementsByTagName('coordinates')[0]
      const ll = coordToLngLat(text(coordsNode))
      if (ll) {
        features.push({
          type: 'Feature',
          properties: { name, description: desc, ...dataProps },
          geometry: { type: 'Point', coordinates: ll }
        })
      }
    } else if (line) {
      const coordsNode = line.getElementsByTagName('coordinates')[0]
      const ring = parseCoordinatesList(coordsNode)
      if (ring.length >= 2) {
        features.push({
          type: 'Feature',
          properties: { name, description: desc, ...dataProps },
          geometry: { type: 'LineString', coordinates: ring }
        })
      }
    } else if (poly) {
      const outer = poly.getElementsByTagName('outerBoundaryIs')[0]
      const linear = outer && outer.getElementsByTagName('LinearRing')[0]
      const coordsNode = linear && linear.getElementsByTagName('coordinates')[0]
      const ring = coordsNode ? parseCoordinatesList(coordsNode) : []
      // inner boundaries (holes)
      const inners = Array.from(poly.getElementsByTagName('innerBoundaryIs'))
        .map(inner => {
          const lr = inner.getElementsByTagName('LinearRing')[0]
          const cn = lr && lr.getElementsByTagName('coordinates')[0]
          return cn ? parseCoordinatesList(cn) : []
        }).filter(r => r && r.length >= 3)
      if (ring.length >= 3) {
        const coords = [ring]
        if (inners.length) coords.push(...inners)
        features.push({
          type: 'Feature',
          properties: { name, description: desc, ...dataProps },
          geometry: { type: 'Polygon', coordinates: coords }
        })
      }
    } else if (multi) {
      // MultiGeometry may contain Point/LineString/Polygon children
      const childPoints = Array.from(multi.getElementsByTagName('Point'))
      childPoints.forEach(pt => {
        const coordsNode = pt.getElementsByTagName('coordinates')[0]
        const ll = coordToLngLat(text(coordsNode))
        if (ll) features.push({ type: 'Feature', properties: { name, description: desc, ...dataProps }, geometry: { type: 'Point', coordinates: ll } })
      })
      const childLines = Array.from(multi.getElementsByTagName('LineString'))
      childLines.forEach(ls => {
        const coordsNode = ls.getElementsByTagName('coordinates')[0]
        const ring = parseCoordinatesList(coordsNode)
        if (ring.length >= 2) features.push({ type: 'Feature', properties: { name, description: desc, ...dataProps }, geometry: { type: 'LineString', coordinates: ring } })
      })
      const childPolys = Array.from(multi.getElementsByTagName('Polygon'))
      childPolys.forEach(pg => {
        const outer = pg.getElementsByTagName('outerBoundaryIs')[0]
        const linear = outer && outer.getElementsByTagName('LinearRing')[0]
        const coordsNode = linear && linear.getElementsByTagName('coordinates')[0]
        const ring = coordsNode ? parseCoordinatesList(coordsNode) : []
        const inners = Array.from(pg.getElementsByTagName('innerBoundaryIs'))
          .map(inner => {
            const lr = inner.getElementsByTagName('LinearRing')[0]
            const cn = lr && lr.getElementsByTagName('coordinates')[0]
            return cn ? parseCoordinatesList(cn) : []
          }).filter(r => r && r.length >= 3)
        if (ring.length >= 3) {
          const coords = [ring]
          if (inners.length) coords.push(...inners)
          features.push({ type: 'Feature', properties: { name, description: desc, ...dataProps }, geometry: { type: 'Polygon', coordinates: coords } })
        }
      })
    } else if (gxTrack) {
      const coords = Array.from(gxTrack.getElementsByTagNameNS('http://www.google.com/kml/ext/2.2', 'coord'))
        .map(n => {
          const parts = text(n).split(/\s+/)
          const lon = Number(parts[0]); const lat = Number(parts[1])
          if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
          return [lon, lat]
        }).filter(Boolean)
      if (coords.length) {
        features.push({
          type: 'Feature',
          properties: { name, description: desc, ...dataProps },
          geometry: { type: 'LineString', coordinates: coords }
        })
      }
    }
  })

  return { type: 'FeatureCollection', features }
}

// Decode ArrayBuffer to string respecting BOM or XML encoding header
function decodeKmlText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3))
  }
  // UTF-16 BOM LE/BE
  if (bytes.length >= 2) {
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2))
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2))
  }
  // Peek header to detect encoding
  const head = new TextDecoder('ascii').decode(bytes.subarray(0, Math.min(200, bytes.length)))
  const m = head.match(/encoding=["']([^"']+)["']/i)
  if (m) {
    const enc = m[1].toLowerCase()
    try { return new TextDecoder(enc).decode(bytes) } catch (_) { /* fall through */ }
  }
  return new TextDecoder('utf-8').decode(bytes)
}

// Add GroundOverlay from KMZ (image tiles with LatLonBox)
async function addGroundOverlaysFromKmz(zip, xmlDoc) {
  const overlays = Array.from(xmlDoc.getElementsByTagName('GroundOverlay'))
  for (const ov of overlays) {
    const icon = ov.getElementsByTagName('Icon')[0]
    const hrefNode = icon && icon.getElementsByTagName('href')[0]
    const href = hrefNode ? hrefNode.textContent.trim() : ''
    const box = ov.getElementsByTagName('LatLonBox')[0]
    if (!href || !box) continue
    const north = Number(box.getElementsByTagName('north')[0]?.textContent)
    const south = Number(box.getElementsByTagName('south')[0]?.textContent)
    const east = Number(box.getElementsByTagName('east')[0]?.textContent)
    const west = Number(box.getElementsByTagName('west')[0]?.textContent)
    if (![north,south,east,west].every(Number.isFinite)) continue
    // Normalize path in zip
    const key = Object.keys(zip.files).find(p => p.toLowerCase() === href.toLowerCase() || p.endsWith('/' + href) || href.endsWith('/' + p))
    if (!key) continue
    const blob = await zip.file(key).async('blob')
    const url = URL.createObjectURL(blob)
    const bounds = L.latLngBounds([[south, west], [north, east]])
    const imgLayer = L.imageOverlay(url, bounds, { opacity: 0.75 })
    imgLayer.addTo(props.map)
    layers.value.push({ id: ++layerCounter, name: `Overlay: ${href}`, layer: imgLayer })
    emitSuccessOnce('Layer KML/KMZ berhasil dimuat')
  }
}

// Fetch and render KMLs referenced by NetworkLink
async function loadNetworkLinks(xmlDoc) {
  const links = Array.from(xmlDoc.getElementsByTagName('NetworkLink'))
  let success = 0
  for (const nl of links) {
    const link = nl.getElementsByTagName('Link')[0] || nl.getElementsByTagName('Url')[0]
    if (!link) continue
    const hrefNode = link.getElementsByTagName('href')[0]
    const href = hrefNode ? hrefNode.textContent.trim() : ''
    if (!href) continue
    const refreshModeNode = link.getElementsByTagName('refreshMode')[0]
    const refreshIntervalNode = link.getElementsByTagName('refreshInterval')[0]
    const refreshMode = refreshModeNode ? refreshModeNode.textContent.trim() : ''
    const refreshInterval = refreshIntervalNode ? Number(refreshIntervalNode.textContent.trim()) : 0

    // Build URL with proxy if provided
    let url = href
    if (props.proxyUrl && props.proxyUrl.length) {
      const enc = encodeURIComponent(href)
      url = props.proxyUrl.endsWith('=') || props.proxyUrl.endsWith('/') ? props.proxyUrl + enc : props.proxyUrl + (props.proxyUrl.includes('?') ? '&url=' + enc : '?url=' + enc)
    }

    try {
      const res = await fetch(url, { mode: 'cors' })
      const buf = await res.arrayBuffer()
      const text = decodeKmlText(buf)
      await loadKmlText(text, href)
      success++
      // Optional: simple polling for onInterval
      if (refreshMode === 'onInterval' && Number.isFinite(refreshInterval) && refreshInterval > 0) {
        // Set a one-shot refresh to avoid uncontrolled loops; can be enhanced to re-add/replace
        setTimeout(async () => {
          try {
            const r2 = await fetch(url, { mode: 'cors' })
            const b2 = await r2.arrayBuffer()
            const t2 = decodeKmlText(b2)
            await loadKmlText(t2, href + ' (refresh)')
          } catch (_) {}
        }, Math.min(refreshInterval * 1000, 5 * 60 * 1000)) // cap at 5 minutes
      }
    } catch (e) {
      const msg = (e && e.message) ? e.message : 'Unknown error'
      // Emit only once per upload, immediately; also download a debug report once
      await emitOnceWithDebug(`Gagal fetch NetworkLink: ${href} (${msg})`, async () => {
        const report = [
          '[KML/KMZ Debug Report]',
          `Time: ${new Date().toISOString()}`,
          'Type: NetworkLink fetch failure',
          `URL: ${href}`,
          `Error: ${msg}`,
          props.proxyUrl ? `Proxy: ${props.proxyUrl}` : 'Proxy: (none)',
          '',
          'Hint: Jika ini terjadi di browser dan cURL berhasil, kemungkinan besar masalah CORS.'
        ].join('\n')
        triggerDownloadText(safeDebugName('networklink', 'error'), report)
      })
    }
  }
  return success
}

// Emit a single error per current upload operation and optionally run a one-time debug download
async function emitOnceWithDebug(message, debugFn) {
  if (!opErrorEmitted) {
    emit('error', message)
    opErrorEmitted = true
  }
  if (!opDebugDownloaded && typeof debugFn === 'function') {
    try { await debugFn() } finally { opDebugDownloaded = true }
  }
}

function emitSuccessOnce(message) {
  if (!opSuccessEmitted) {
    emit('success', message)
    opSuccessEmitted = true
  }
}

// ---- Debug helpers: when import fails, save a text report locally ----
async function downloadDebugFromFile(file, errMsg) {
  const name = (file && file.name) ? file.name : 'file'
  const lower = name.toLowerCase()
  try {
    const buf = await file.arrayBuffer()
    if (lower.endsWith('.kml')) {
      const text = decodeKmlText(buf)
      // Download EXACT original KML content as text (no modifications)
      triggerDownloadText(safeDebugName(name, 'kml'), text)
      return
    }
    if (lower.endsWith('.kmz')) {
      try {
        const zip = await JSZip.loadAsync(buf)
        const entries = Object.keys(zip.files)
        // choose doc.kml or largest kml
        const kmls = entries.filter(p => p.toLowerCase().endsWith('.kml'))
        if (kmls.length) {
          let chosen = kmls.find(p => /(^|\/)doc\.kml$/i.test(p))
          if (!chosen) chosen = kmls[0]
          const kmlArray = await zip.file(chosen).async('arraybuffer')
          const kmlText = decodeKmlText(kmlArray)
          // Download EXACT embedded KML content as text (no modifications)
          triggerDownloadText(safeDebugName(chosen, 'kmz_kml'), kmlText)
        } else {
          // No KML inside KMZ, provide hex preview as last resort
          const preview = hexPreview(new Uint8Array(buf), 512)
          triggerDownloadText(safeDebugName(name, 'kmz_hex'), preview)
        }
        return
      } catch (e) {
        // Not a valid zip; dump first bytes
        const preview = hexPreview(new Uint8Array(buf), 512)
        triggerDownloadText(safeDebugName(name, 'kmz_hex'), preview)
        return
      }
    }
    // Unknown extension, provide hex preview
    const preview = hexPreview(new Uint8Array(buf), 512)
    triggerDownloadText(safeDebugName(name, 'bin_hex'), preview)
  } catch (e) {
    // Fallback minimal report
    triggerDownloadText('kmlkmz_debug.txt', '(Failed to read file content)')
  }
}

function triggerDownloadText(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 0)
}

function safeDebugName(original, kind) {
  const base = (original || 'file').replace(/[^a-zA-Z0-9_.-]+/g, '_')
  return `debug_${kind}_${base}.txt`
}

function hexPreview(bytes, limit = 512) {
  const n = Math.min(bytes.length, limit)
  let out = ''
  for (let i = 0; i < n; i++) {
    const h = bytes[i].toString(16).padStart(2, '0')
    out += h + (i % 16 === 15 ? '\n' : ' ')
  }
  if (bytes.length > n) out += `\n... (+${bytes.length - n} bytes)`
  return out
}
</script>

<style scoped>
.kmlkmz-upload-wrapper {
  position: relative;
  display: inline-block;
  margin-left: 8px;
}
.kmlkmz-btn {
  background: #ffffff;
  color: #000000;
  border: 1px solid #e3e3e3;
  width: 56px;
  height: 56px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  transition: background .2s, box-shadow .2s;
}
.kmlkmz-btn:hover:not(:disabled) { background: #f8f9fa; box-shadow: 0 3px 10px rgba(0,0,0,0.16); }
.kmlkmz-btn:disabled { opacity: .5; cursor: not-allowed; }
.hidden-input { display: none; }
.kmlkmz-error { display: none; }
.kmlkmz-layers {
  position: absolute;
  top: 54px;
  left: 0;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 8px 10px;
  border-radius: 6px;
  width: 220px;
  max-height: 240px;
  overflow: auto;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 15;
}
.layers-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  color: #0f172a;
}
.layers-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 0;
  font-size: 12px;
  border-bottom: 1px solid #f1f5f9;
}
.layer-item:last-child { border-bottom: none; }
.layer-name {
  flex: 1;
  cursor: pointer;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.layer-name:hover { text-decoration: underline; }
.layer-remove {
  background: #ef4444;
  color: #fff;
  border: none;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  line-height: 20px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.layer-remove:hover { background: #dc2626; }
</style>
