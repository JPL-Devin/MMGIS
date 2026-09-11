// Canvas density heatmap derived from another vector layer's features.
// Stamp + colorize approach after simpleheat (MIT); reimplemented, no dependency added.
import F_ from '../Formulae_/Formulae_'
import L_ from './Layers_'

const L = window.L

const DEFAULTS = {
    radius: 25,
    blur: 15,
    maxIntensity: 1,
    minOpacity: 0.05,
    gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' },
    lineSampleSpacingMeters: 5,
    radiusUnits: 'px',
    weightProperty: null,
    weightMin: null,
    weightMax: null,
    maxSamplesPerFeature: 2000,
    // Rasterize this many viewport-widths beyond the visible area so panning stays filled
    viewportPadding: 0.5,
    renderDebounceMs: 60,
    // Raster at 1/internalScale screen resolution; coarsened until cells x kernel <= workBudget
    internalScale: 2,
    workBudget: 24e6,
}

L.HeatmapLayer = L.Layer.extend({
    options: Object.assign({ opacity: 1, zIndex: 1 }, DEFAULTS),

    initialize: function (layerObj, options, map) {
        L.setOptions(this, options)
        this._mapRef = map
        this._layerObj = layerObj
        this._layerName = layerObj.name
        this._sourceName = null
        this._sourceGeoJSON = null
        this._samples = null // Float64Array [x, y, w, ...] in projected CRS units
        this._sampleCount = 0
        this._sourceProperties = []
        this._lastRenderMs = null
        this._renderTimeout = null
        this._gradientLUT = null
        this._kernel = null
    },

    // ---- Leaflet lifecycle ----
    onAdd: function (map) {
        this._map = map
        if (!this._canvas) this._initCanvas()
        map.getPanes().overlayPane.appendChild(this._canvas)
        map.on('moveend zoomend viewreset resize', this._onViewChange, this)
        if (map.options.zoomAnimation && L.Browser.any3d)
            map.on('zoomanim', this._animateZoom, this)
        if (this._samples == null && this._sourceGeoJSON) this._resample()
        this._reset()
    },
    onRemove: function (map) {
        L.DomUtil.remove(this._canvas)
        map.off('moveend zoomend viewreset resize', this._onViewChange, this)
        map.off('zoomanim', this._animateZoom, this)
        if (this._renderTimeout) clearTimeout(this._renderTimeout)
    },
    addTo: function (map) {
        map.addLayer(this)
        return this
    },

    // ---- Public API (used by Layers_ / LayersTool) ----
    setOpacity: function (opacity) {
        this.options.opacity = opacity
        if (this._canvas) this._canvas.style.opacity = opacity
        return this
    },
    setZIndex: function (z) {
        this.options.zIndex = z
        if (this._canvas) this._canvas.style.zIndex = z
        return this
    },
    // Live-updates render options (radius, blur, maxIntensity, gradient, weightProperty, ...)
    setOptions: function (opts) {
        const needsResample =
            (opts.weightProperty !== undefined &&
                opts.weightProperty !== this.options.weightProperty) ||
            (opts.weightMin !== undefined &&
                opts.weightMin !== this.options.weightMin) ||
            (opts.weightMax !== undefined &&
                opts.weightMax !== this.options.weightMax) ||
            (opts.lineSampleSpacingMeters !== undefined &&
                opts.lineSampleSpacingMeters !==
                    this.options.lineSampleSpacingMeters)
        if (opts.gradient !== undefined) this._gradientLUT = null
        if (opts.radius !== undefined || opts.blur !== undefined)
            this._kernel = null
        L.setOptions(this, opts)
        if (needsResample) this._resample()
        this.requestRender(true)
        return this
    },
    getSourceProperties: function () {
        return this._sourceProperties
    },
    getSampleCount: function () {
        return this._sampleCount
    },
    getLastRenderMs: function () {
        return this._lastRenderMs
    },

    // ---- Source layer hookup ----
    // Reads the source vector layer's currently loaded features (respects local time filtering)
    syncFromSource: function () {
        const sourceName = L_.asLayerUUID(
            F_.getIn(this._layerObj, 'variables.sourceLayer')
        )
        this._sourceName = sourceName
        const source = sourceName ? L_.layers.layer[sourceName] : null
        if (source && source._sourceGeoJSON) {
            this.setSourceGeoJSON(source._sourceGeoJSON)
            return true
        }
        return false
    },
    setSourceGeoJSON: function (geojson) {
        this._sourceGeoJSON = geojson
        this._sourceProperties = collectNumericProperties(geojson)
        this._resample()
        this.requestRender(true)
    },

    // ---- Rendering ----
    requestRender: function (immediate) {
        if (!this._map) return
        if (this._renderTimeout) clearTimeout(this._renderTimeout)
        if (immediate) {
            this._renderTimeout = null
            this._render()
        } else {
            this._renderTimeout = setTimeout(() => {
                this._renderTimeout = null
                this._render()
            }, this.options.renderDebounceMs)
        }
    },

    _initCanvas: function () {
        const canvas = (this._canvas = L.DomUtil.create(
            'canvas',
            'leaflet-heatmap-layer leaflet-layer'
        ))
        canvas.style.pointerEvents = 'none'
        canvas.style.opacity = this.options.opacity
        canvas.style.zIndex = this.options.zIndex
        const animated = this._map.options.zoomAnimation && L.Browser.any3d
        canvas.style.position = 'absolute'
        L.DomUtil.addClass(
            canvas,
            'leaflet-zoom-' + (animated ? 'animated' : 'hide')
        )
        this._ctx = canvas.getContext('2d')
    },
    _onViewChange: function () {
        this._reset()
    },
    // Repositions the canvas over the padded viewport and re-renders (debounced)
    _reset: function () {
        const size = this._map.getSize()
        const pad = this.options.viewportPadding
        this._padX = Math.round(size.x * pad)
        this._padY = Math.round(size.y * pad)
        const w = size.x + 2 * this._padX
        const h = size.y + 2 * this._padY
        if (this._canvas.width !== w || this._canvas.height !== h) {
            this._canvas.width = w
            this._canvas.height = h
        }
        const topLeft = this._map.containerPointToLayerPoint([
            -this._padX,
            -this._padY,
        ])
        L.DomUtil.setPosition(this._canvas, topLeft)
        this._canvasOrigin = topLeft
        this._canvasZoom = this._map.getZoom()
        this.requestRender(false)
    },
    _animateZoom: function (e) {
        const scale = this._map.getZoomScale(e.zoom)
        const offset = this._map
            ._latLngBoundsToNewLayerBounds(
                this._map.getBounds(),
                e.zoom,
                e.center
            )
            .min.subtract([this._padX * scale, this._padY * scale])
        L.DomUtil.setTransform(this._canvas, offset, scale)
    },

    // Pixel radius: constant px, or meters converted with the CRS resolution at this zoom
    _radiusPx: function () {
        const r = parseFloat(this.options.radius) || DEFAULTS.radius
        if (this.options.radiusUnits === 'm') {
            const mpp = metersPerPixel(this._map)
            return mpp > 0 ? Math.max(1, r / mpp) : r
        }
        return r
    },

    // Bin samples to a 1/step grid, splat an additive kernel per occupied cell, colorize, upscale.
    // Cost is bounded by occupied cells x kernel area, not by sample count.
    _render: function () {
        if (!this._map || !this._canvas) return
        const t0 = performance.now()
        const ctx = this._ctx
        const w = this._canvas.width
        const h = this._canvas.height
        ctx.clearRect(0, 0, w, h)

        const count = this._sampleCount
        if (!count) {
            this._lastRenderMs = performance.now() - t0
            this._drawnCount = 0
            return
        }

        const radius = this._radiusPx()
        const blur = Math.max(0, parseFloat(this.options.blur) || 0)
        const max = Math.max(
            1e-9,
            parseFloat(this.options.maxIntensity) || DEFAULTS.maxIntensity
        )
        const minOpacity = this.options.minOpacity

        // Projected CRS -> canvas pixel (CRS agnostic: works for L.Proj polar CRSs)
        const map = this._map
        const crs = map.options.crs
        const scale = crs.scale(map.getZoom())
        const tr = crs.transformation
        const pixelOrigin = map.getPixelOrigin()
        const panePos = map._getMapPanePos()
        const offX = -pixelOrigin.x + panePos.x + this._padX
        const offY = -pixelOrigin.y + panePos.y + this._padY
        const s = this._samples

        // Coarsen the grid until occupied cells x kernel area fits the work budget
        let step = this.options.internalScale
        let W, H, acc, occupied, kernel, kw, drawn
        for (;;) {
            W = Math.ceil(w / step)
            H = Math.ceil(h / step)
            kernel = this._getKernel(radius / step, blur / step)
            kw = kernel.size
            const kr = kernel.half
            const PW = W + 2 * kr
            acc = this._getBuffer('_acc', PW * (H + 2 * kr))
            occupied = 0
            drawn = 0
            for (let i = 0; i < count; i++) {
                const j = i * 3
                // Inlined L.Transformation.transform, then to grid cells
                const gx = ((scale * (tr._a * s[j] + tr._b) + offX) / step) | 0
                const gy =
                    ((scale * (tr._c * s[j + 1] + tr._d) + offY) / step) | 0
                // Cull to padded canvas (projected/pixel-space bounds)
                if (gx < -kr || gy < -kr || gx >= W + kr || gy >= H + kr)
                    continue
                const idx = (gy + kr) * PW + (gx + kr)
                if (acc[idx] === 0) occupied++
                acc[idx] += s[j + 2]
                drawn++
            }
            if (occupied * kw * kw <= this.options.workBudget || step >= 16)
                break
            acc.fill(0)
            step *= 2
        }
        this._drawnCount = drawn
        if (drawn === 0) {
            this._lastRenderMs = performance.now() - t0
            return
        }

        // Splat kernel from each occupied (padded) cell into the density grid
        const kr = kernel.half
        const PW = W + 2 * kr
        const PH = H + 2 * kr
        const dens = this._getBuffer('_dens', W * H)
        const k = kernel.data
        let bx0 = W,
            by0 = H,
            bx1 = -1,
            by1 = -1
        for (let py = 0; py < PH; py++) {
            const y0 = py - 2 * kr // top row of the kernel footprint in grid space
            for (let px = 0; px < PW; px++) {
                const wgt = acc[py * PW + px]
                if (wgt === 0) continue
                const x0 = px - 2 * kr
                const ya = Math.max(0, -y0)
                const yb = Math.min(kw, H - y0)
                const xa = Math.max(0, -x0)
                const xb = Math.min(kw, W - x0)
                if (ya >= yb || xa >= xb) continue
                for (let ky = ya; ky < yb; ky++) {
                    const row = (y0 + ky) * W + x0
                    const krow = ky * kw
                    for (let kx = xa; kx < xb; kx++)
                        dens[row + kx] += wgt * k[krow + kx]
                }
                if (x0 + xa < bx0) bx0 = x0 + xa
                if (y0 + ya < by0) by0 = y0 + ya
                if (x0 + xb - 1 > bx1) bx1 = x0 + xb - 1
                if (y0 + yb - 1 > by1) by1 = y0 + yb - 1
            }
        }
        acc.fill(0)

        // Colorize touched region into the internal canvas, then upscale
        const lut = this._getGradientLUT()
        const rw = bx1 - bx0 + 1
        const rh = by1 - by0 + 1
        const img = this._getImageData(rw, rh)
        const px = img.data
        let o = 0
        for (let y = by0; y <= by1; y++) {
            let d = y * W + bx0
            for (let x = 0; x < rw; x++, d++, o += 4) {
                let a = dens[d] / max
                dens[d] = 0
                if (a <= 0) {
                    px[o + 3] = 0
                    continue
                }
                if (a > 1) a = 1
                else if (a < minOpacity) a = minOpacity
                const c = (a * 255) | 0
                const l = c * 4
                px[o] = lut[l]
                px[o + 1] = lut[l + 1]
                px[o + 2] = lut[l + 2]
                px[o + 3] = c
            }
        }
        const inner = this._getInnerCanvas(rw, rh)
        inner.getContext('2d').putImageData(img, 0, 0)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(
            inner,
            0,
            0,
            rw,
            rh,
            bx0 * step,
            by0 * step,
            rw * step,
            rh * step
        )

        this._lastRenderMs = performance.now() - t0
        this._lastRenderStep = step
        if (window.mmgisglobal && window.mmgisglobal.heatmapDebug)
            console.log(
                `[heatmap] ${this._layerName}: ${drawn}/${count} samples, ${occupied} cells @1/${step} in ${this._lastRenderMs.toFixed(1)}ms`
            )
    },

    // Zeroed, reusable Float32 scratch buffer (callers clear the cells they touch)
    _getBuffer: function (key, size) {
        let buf = this[key]
        if (!buf || buf.length < size) buf = this[key] = new Float32Array(size)
        return buf
    },
    _getImageData: function (w, h) {
        if (!this._img || this._img.width !== w || this._img.height !== h)
            this._img = this._ctx.createImageData(w, h)
        return this._img
    },
    _getInnerCanvas: function (w, h) {
        if (!this._inner) this._inner = document.createElement('canvas')
        if (this._inner.width !== w || this._inner.height !== h) {
            this._inner.width = w
            this._inner.height = h
        }
        return this._inner
    },

    // Blurred-disk kernel (simpleheat stamp) sampled to a normalized Float32 grid
    _getKernel: function (radius, blur) {
        radius = Math.max(0.5, radius)
        const key = radius + '_' + blur
        if (this._kernel && this._kernel.key === key) return this._kernel
        const r2 = radius + blur
        const half = Math.ceil(r2)
        const size = half * 2 + 1
        const c = document.createElement('canvas')
        c.width = c.height = size
        const cx = c.getContext('2d')
        cx.shadowOffsetX = cx.shadowOffsetY = size
        cx.shadowBlur = blur
        cx.shadowColor = 'black'
        cx.beginPath()
        cx.arc(half - size, half - size, radius, 0, Math.PI * 2, true)
        cx.closePath()
        cx.fill()
        const a = cx.getImageData(0, 0, size, size).data
        const data = new Float32Array(size * size)
        for (let i = 0; i < data.length; i++) data[i] = a[i * 4 + 3] / 255
        this._kernel = { key, size, half, data }
        return this._kernel
    },
    _getGradientLUT: function () {
        if (this._gradientLUT) return this._gradientLUT
        let grad = this.options.gradient
        if (typeof grad === 'string') {
            try {
                grad = JSON.parse(grad)
            } catch (e) {
                grad = null
            }
        }
        if (
            grad == null ||
            typeof grad !== 'object' ||
            !Object.keys(grad).length
        )
            grad = DEFAULTS.gradient
        const c = document.createElement('canvas')
        c.width = 1
        c.height = 256
        const cx = c.getContext('2d')
        const g = cx.createLinearGradient(0, 0, 0, 256)
        Object.keys(grad).forEach((stop) => {
            const s = parseFloat(stop)
            if (s >= 0 && s <= 1) {
                try {
                    g.addColorStop(s, grad[stop])
                } catch (e) {}
            }
        })
        cx.fillStyle = g
        cx.fillRect(0, 0, 1, 256)
        this._gradientLUT = cx.getImageData(0, 0, 1, 256).data
        return this._gradientLUT
    },

    // ---- Sampling ----
    // Converts source features to weighted sample points in projected CRS units
    _resample: function () {
        const geojson = this._sourceGeoJSON
        const map = this._map || this._mapRef
        if (!geojson || !geojson.features || !map) {
            this._samples = null
            this._sampleCount = 0
            return
        }
        const t0 = performance.now()
        const crs = map.options.crs
        const project = (lng, lat) => crs.projection.project(L.latLng(lat, lng))
        const spacing = Math.max(
            0.01,
            parseFloat(this.options.lineSampleSpacingMeters) ||
                DEFAULTS.lineSampleSpacingMeters
        )
        const weightProp = this.options.weightProperty || null
        const wMin =
            this.options.weightMin != null && this.options.weightMin !== ''
                ? parseFloat(this.options.weightMin)
                : null
        const wMax =
            this.options.weightMax != null && this.options.weightMax !== ''
                ? parseFloat(this.options.weightMax)
                : null
        const maxPerFeature = this.options.maxSamplesPerFeature

        const out = []
        const push = (p, w) => {
            out.push(p.x, p.y, w)
        }

        const features = geojson.features
        for (let i = 0; i < features.length; i++) {
            const f = features[i]
            if (!f || !f.geometry) continue
            let w = 1
            if (weightProp) {
                const v = parseFloat(F_.getIn(f.properties, weightProp))
                if (!isFinite(v)) continue
                w = v
            }
            if (wMin != null && w < wMin) w = wMin
            if (wMax != null && w > wMax) w = wMax
            if (wMin != null && wMax != null && wMax > wMin)
                w = (w - wMin) / (wMax - wMin)
            if (w <= 0) continue
            sampleGeometry(f.geometry, w, project, spacing, maxPerFeature, push)
        }
        this._samples = Float64Array.from(out)
        this._sampleCount = out.length / 3
        this._lastSampleMs = performance.now() - t0
    },
})

// Meters (projected CRS units) per screen pixel at the current zoom; valid for any Leaflet CRS
export function metersPerPixel(map) {
    const crs = map.options.crs
    const a = Math.abs(crs.transformation._a)
    return 1 / (crs.scale(map.getZoom()) * a)
}

function sampleGeometry(geom, w, project, spacing, maxPerFeature, push) {
    switch (geom.type) {
        case 'Point':
            push(project(geom.coordinates[0], geom.coordinates[1]), w)
            break
        case 'MultiPoint':
            geom.coordinates.forEach((c) => push(project(c[0], c[1]), w))
            break
        case 'LineString':
            sampleLine(
                geom.coordinates,
                w,
                project,
                spacing,
                maxPerFeature,
                push
            )
            break
        case 'MultiLineString':
            geom.coordinates.forEach((line) =>
                sampleLine(line, w, project, spacing, maxPerFeature, push)
            )
            break
        case 'Polygon':
            samplePolygon(
                geom.coordinates,
                w,
                project,
                spacing,
                maxPerFeature,
                push
            )
            break
        case 'MultiPolygon':
            geom.coordinates.forEach((poly) =>
                samplePolygon(poly, w, project, spacing, maxPerFeature, push)
            )
            break
        case 'GeometryCollection':
            ;(geom.geometries || []).forEach((g) =>
                sampleGeometry(g, w, project, spacing, maxPerFeature, push)
            )
            break
        default:
            break
    }
}

// Densifies a line: geodesic length picks the step count, interpolation happens in projected space
function sampleLine(coords, w, project, spacing, maxPerFeature, push) {
    if (!coords || coords.length === 0) return
    const pts = coords.map((c) => project(c[0], c[1]))
    if (pts.length === 1) {
        push(pts[0], w)
        return
    }
    let total = 0
    const segLens = []
    for (let i = 1; i < coords.length; i++) {
        const d = F_.lngLatDistBetween(
            coords[i - 1][0],
            coords[i - 1][1],
            coords[i][0],
            coords[i][1]
        )
        segLens.push(d)
        total += d
    }
    // Enforce a per-feature cap by widening the spacing
    let step = spacing
    if (total / step > maxPerFeature) step = total / maxPerFeature

    push(pts[0], w)
    let carry = step
    for (let i = 1; i < pts.length; i++) {
        const len = segLens[i - 1]
        if (len <= 0) continue
        const a = pts[i - 1]
        const b = pts[i]
        let d = carry
        while (d < len) {
            const t = d / len
            push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, w)
            d += step
        }
        carry = d - len
    }
    push(pts[pts.length - 1], w)
}

// Polygon: sampled boundary rings + interior grid samples (in projected space), centroid fallback
function samplePolygon(rings, w, project, spacing, maxPerFeature, push) {
    if (!rings || rings.length === 0) return
    const boundaryBudget = Math.floor(maxPerFeature / 2)
    rings.forEach((ring) =>
        sampleLine(ring, w, project, spacing, boundaryBudget, push)
    )

    const outer = rings[0].map((c) => project(c[0], c[1]))
    const holes = rings.slice(1).map((r) => r.map((c) => project(c[0], c[1])))
    const upm = unitsPerMeter(rings[0][0], project)
    let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
    outer.forEach((p) => {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
    })
    const area = Math.abs(shoelace(outer))
    if (!(area > 0)) return

    // Interior grid: spacing scaled so at most ~maxPerFeature/2 interior samples
    let gridStep = spacing * 2 * upm
    const interiorBudget = Math.max(1, Math.floor(maxPerFeature / 2))
    const estimated = ((maxX - minX) * (maxY - minY)) / (gridStep * gridStep)
    if (estimated > interiorBudget)
        gridStep = Math.sqrt(((maxX - minX) * (maxY - minY)) / interiorBudget)

    let interior = 0
    for (let y = minY + gridStep / 2; y < maxY; y += gridStep) {
        for (let x = minX + gridStep / 2; x < maxX; x += gridStep) {
            if (
                pointInRing(x, y, outer) &&
                !holes.some((h) => pointInRing(x, y, h))
            ) {
                push({ x: x, y: y }, w)
                interior++
            }
        }
    }
    if (interior === 0) {
        const c = centroid(outer)
        push(c, w)
    }
}

// Local projected-units-per-meter near a lng/lat (1 for meter CRSs; ~1/111km for degree CRSs)
function unitsPerMeter(c, project) {
    const dLat = c[1] > 89 ? -0.001 : 0.001
    const a = project(c[0], c[1])
    const b = project(c[0], c[1] + dLat)
    const meters = F_.lngLatDistBetween(c[0], c[1], c[0], c[1] + dLat)
    const units = Math.hypot(b.x - a.x, b.y - a.y)
    return meters > 0 && isFinite(units) && units > 0 ? units / meters : 1
}

function shoelace(pts) {
    let a = 0
    for (let i = 0, n = pts.length; i < n; i++) {
        const p = pts[i]
        const q = pts[(i + 1) % n]
        a += p.x * q.y - q.x * p.y
    }
    return a / 2
}
function centroid(pts) {
    let x = 0,
        y = 0
    pts.forEach((p) => {
        x += p.x
        y += p.y
    })
    return { x: x / pts.length, y: y / pts.length }
}
function pointInRing(x, y, ring) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i].x,
            yi = ring[i].y,
            xj = ring[j].x,
            yj = ring[j].y
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside
    }
    return inside
}

// Numeric top-level property names found in the (first 500) source features
function collectNumericProperties(geojson) {
    const seen = {}
    const features = (geojson && geojson.features) || []
    const n = Math.min(features.length, 500)
    for (let i = 0; i < n; i++) {
        const props = features[i] && features[i].properties
        if (!props) continue
        Object.keys(props).forEach((k) => {
            const v = props[k]
            if (
                (typeof v === 'number' && isFinite(v)) ||
                (typeof v === 'string' && v !== '' && isFinite(parseFloat(v)))
            )
                seen[k] = true
        })
    }
    return Object.keys(seen).sort()
}

export default L.HeatmapLayer
