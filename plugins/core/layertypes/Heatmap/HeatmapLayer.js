// Leaflet canvas overlay that rasterizes weighted samples in the map's projected
// pixel space (via the active CRS), culled to a padded viewport, throttled on view changes.
import F_ from '@basics/Formulae_/Formulae_'
import HeatCanvas from './HeatCanvas'

let HeatmapLayerClass = null

export function getHeatmapLayerClass(L) {
    if (HeatmapLayerClass) return HeatmapLayerClass

    HeatmapLayerClass = L.Layer.extend({
        options: {
            radius: 25,
            blur: 15,
            radiusUnits: 'px',
            maxIntensity: null,
            minOpacity: 0.05,
            gradient: null,
            opacity: 1,
            pane: 'overlayPane',
            zIndex: 1,
            throttleMs: 50,
        },

        initialize: function (options) {
            L.setOptions(this, options)
            this._samples = []
            this._projectedCRS = null
            this._projected = new Float64Array(0)
            this._count = 0
            this._maxWeight = 1
            this._screen = new Float32Array(0)
            this.lastRenderMs = null
            this.lastDrawnCount = 0
            this._pendingDraw = null
        },

        onAdd: function (map) {
            this._map = map
            if (!this._canvas) {
                this._canvas = L.DomUtil.create(
                    'canvas',
                    'leaflet-layer mmgis-heatmap-layer'
                )
                this._canvas.style.pointerEvents = 'none'
                this._heat = new HeatCanvas(this._canvas)
                this._heat.gradient(this.options.gradient)
            }
            this._canvas.style.opacity = this.options.opacity
            this._canvas.style.zIndex = this.options.zIndex
            this.getPane().appendChild(this._canvas)
            map.on('moveend zoomend resize', this._onViewChange, this)
            map.on('zoomanim', this._onZoomAnim, this)
            map.on('movestart zoomstart', this._onMoveStart, this)
            if (this._projectedCRS !== map.options.crs) this._project()
            this._reset()
        },

        onRemove: function (map) {
            map.off('moveend zoomend resize', this._onViewChange, this)
            map.off('zoomanim', this._onZoomAnim, this)
            map.off('movestart zoomstart', this._onMoveStart, this)
            if (this._pendingDraw) clearTimeout(this._pendingDraw)
            this._pendingDraw = null
            L.DomUtil.remove(this._canvas)
        },

        // samples: [[lng, lat, weight], ...]. Projected once through the map's CRS.
        setSamples: function (samples) {
            this._samples = samples
            this._projectedCRS = null
            if (this._map) {
                this._project()
                this._reset()
            }
            return this
        },

        _project: function () {
            const crs = this._map.options.crs
            const samples = this._samples
            const n = samples.length
            const arr = new Float64Array(n * 3)
            let maxW = 0
            for (let i = 0; i < n; i++) {
                const s = samples[i]
                const p = crs.projection.project(L.latLng(s[1], s[0]))
                arr[i * 3] = p.x
                arr[i * 3 + 1] = p.y
                arr[i * 3 + 2] = s[2]
                if (s[2] > maxW) maxW = s[2]
            }
            this._projected = arr
            this._count = n
            this._maxWeight = maxW > 0 ? maxW : 1
            this._screen = new Float32Array(n * 3)
            this._projectedCRS = crs
        },

        setOptions: function (opts) {
            L.setOptions(this, opts)
            if (opts.gradient !== undefined && this._heat)
                this._heat.gradient(this.options.gradient)
            if (opts.opacity !== undefined && this._canvas)
                this._canvas.style.opacity = this.options.opacity
            if (this._map) this._reset()
            return this
        },

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

        bringToFront: function () {
            if (this._canvas && this._canvas.parentNode)
                this._canvas.parentNode.appendChild(this._canvas)
            return this
        },

        // Ground meters per screen pixel at the view center, in the active CRS.
        metersPerPixel: function () {
            const map = this._map
            const size = map.getSize()
            const c = L.point(size.x / 2, size.y / 2)
            const a = map.containerPointToLatLng(c)
            const b = map.containerPointToLatLng(c.add([100, 0]))
            const d = F_.lngLatDistBetween(a.lng, a.lat, b.lng, b.lat) / 100
            return Number.isFinite(d) && d > 0 ? d : 1
        },

        radiusInPixels: function () {
            const r = Math.max(0, parseFloat(this.options.radius) || 0)
            if (this.options.radiusUnits !== 'm') return r
            return r / this.metersPerPixel()
        },

        _onMoveStart: function () {
            if (this._pendingDraw) clearTimeout(this._pendingDraw)
            this._pendingDraw = null
        },

        _onZoomAnim: function (e) {
            if (!this._canvas || !this._map) return
            const scale = this._map.getZoomScale(e.zoom)
            const offset = this._map._latLngBoundsToNewLayerBounds(
                this._map.getBounds(),
                e.zoom,
                e.center
            ).min
            L.DomUtil.setTransform(this._canvas, offset, scale)
        },

        _onViewChange: function () {
            if (this._pendingDraw) clearTimeout(this._pendingDraw)
            this._pendingDraw = setTimeout(() => {
                this._pendingDraw = null
                this._reset()
            }, this.options.throttleMs)
        },

        _reset: function () {
            const map = this._map
            if (!map || !this._canvas) return
            const size = map.getSize()
            const topLeft = map.containerPointToLayerPoint([0, 0])
            L.DomUtil.setPosition(this._canvas, topLeft)
            this._heat.resize(size.x, size.y)
            this.redraw()
        },

        redraw: function () {
            const map = this._map
            if (!map || !this._heat) return
            const t0 = performance.now()
            const size = map.getSize()
            const radius = this.radiusInPixels()
            const blur = Math.max(0, parseFloat(this.options.blur) || 0)
            const pad = radius + blur
            // container = transformation(projected, scale) - pixelOrigin + mapPanePos
            const crs = map.options.crs
            const scale = crs.scale(map.getZoom())
            const tr = crs.transformation
            const origin = map.getPixelOrigin()
            const panePos = map._getMapPanePos()
            const offX = -origin.x + panePos.x
            const offY = -origin.y + panePos.y
            const src = this._projected
            const dst = this._screen
            const n = this._count
            const minX = -pad
            const minY = -pad
            const maxX = size.x + pad
            const maxY = size.y + pad
            let k = 0
            for (let i = 0; i < n; i++) {
                const o = i * 3
                const x = scale * (tr._a * src[o] + tr._b) + offX
                if (x < minX || x > maxX) continue
                const y = scale * (tr._c * src[o + 1] + tr._d) + offY
                if (y < minY || y > maxY) continue
                dst[k] = x
                dst[k + 1] = y
                dst[k + 2] = src[o + 2]
                k += 3
            }
            const max =
                this.options.maxIntensity != null &&
                this.options.maxIntensity !== ''
                    ? parseFloat(this.options.maxIntensity)
                    : this._maxWeight
            this._heat
                .data(dst, k / 3)
                .radius(radius, blur)
                .max(Number.isFinite(max) && max > 0 ? max : this._maxWeight)
                .draw(this.options.minOpacity)
            this.lastDrawnCount = k / 3
            this.lastRenderMs = performance.now() - t0
            this.fire('heatmaprender', {
                renderMs: this.lastRenderMs,
                drawn: this.lastDrawnCount,
                total: n,
            })
        },
    })

    return HeatmapLayerClass
}
