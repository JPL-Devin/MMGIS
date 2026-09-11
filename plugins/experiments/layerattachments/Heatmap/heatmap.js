/**
 * Heatmap attachment — a canvas kernel-density heatmap of the host layer's
 * point features. Dependency-free (no leaflet.heat); the canvas layer is a
 * small L.Layer written here.
 *
 * See plugins/core/layerattachments/README.md.
 */

const leaflet = () => window.L

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const getIn = (obj, path) => {
    if (!obj || !path) return undefined
    return String(path)
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

const DEFAULT_GRADIENT = {
    0.4: 'blue',
    0.6: 'cyan',
    0.7: 'lime',
    0.8: 'yellow',
    1.0: 'red',
}

function parseGradient(g) {
    if (!g) return DEFAULT_GRADIENT
    if (typeof g === 'object') return g
    try {
        const parsed = JSON.parse(g)
        if (parsed && typeof parsed === 'object') return parsed
    } catch (e) {
        // "0.4:blue,0.6:cyan,1:red"
        const out = {}
        String(g)
            .split(',')
            .forEach((pair) => {
                const [stop, color] = pair.split(':').map((s) => s.trim())
                if (stop && color) out[parseFloat(stop)] = color
            })
        if (Object.keys(out).length > 0) return out
    }
    return DEFAULT_GRADIENT
}

function settings(config) {
    return {
        radius: Math.max(1, num(config?.radius, 25)),
        blur: Math.max(0, num(config?.blur, 15)),
        maxIntensity: num(config?.maxIntensity, 0),
        minOpacity: Math.min(1, Math.max(0, num(config?.minOpacity, 0.05))),
        weightProp: config?.weightProp || null,
        gradient: parseGradient(config?.gradient),
    }
}

function pointsOf(geojson, weightProp) {
    const pts = []
    ;(geojson?.features || []).forEach((f) => {
        const g = f.geometry
        if (!g) return
        let coords = []
        if (g.type === 'Point') coords = [g.coordinates]
        else if (g.type === 'MultiPoint') coords = g.coordinates
        else return
        let w = 1
        if (weightProp) {
            const v = parseFloat(getIn(f.properties, weightProp))
            w = Number.isFinite(v) ? v : 0
        }
        coords.forEach((c) => {
            if (Array.isArray(c) && c.length >= 2)
                pts.push({ lat: c[1], lng: c[0], w })
        })
    })
    return pts
}

// Simpleheat-style rendering: draw grayscale radial stamps with alpha
// proportional to weight, then colorize by mapping alpha to a gradient.
function makeStamp(radius, blur) {
    const r2 = radius + blur
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = r2 * 2
    const ctx = canvas.getContext('2d')
    ctx.shadowOffsetX = ctx.shadowOffsetY = r2 * 2
    ctx.shadowBlur = blur
    ctx.shadowColor = 'black'
    ctx.beginPath()
    ctx.arc(-r2, -r2, radius, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.fill()
    return { canvas, r: r2 }
}

function makeGradient(gradient) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    Object.keys(gradient)
        .map(parseFloat)
        .filter((k) => Number.isFinite(k))
        .sort((a, b) => a - b)
        .forEach((k) =>
            grad.addColorStop(Math.min(1, Math.max(0, k)), gradient[k])
        )
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1, 256)
    return ctx.getImageData(0, 0, 1, 256).data
}

function createHeatLayerClass() {
    const L = leaflet()
    if (L.MMGISHeatLayer) return L.MMGISHeatLayer

    L.MMGISHeatLayer = L.Layer.extend({
        initialize: function (points, options) {
            this._points = points || []
            this._opts = options
            this._opacity = 1
            L.setOptions(this, { pane: 'overlayPane' })
        },
        setPoints: function (points) {
            this._points = points || []
            this._redraw()
            return this
        },
        setSettings: function (opts) {
            this._opts = opts
            this._stamp = null
            this._grad = null
            this._redraw()
            return this
        },
        setOpacity: function (o) {
            this._opacity = o
            if (this._canvas) this._canvas.style.opacity = o
            return this
        },
        onAdd: function (map) {
            this._map = map
            if (!this._canvas) {
                this._canvas = L.DomUtil.create(
                    'canvas',
                    'leaflet-layer mmgis-heatmap-layer'
                )
                this._canvas.style.opacity = this._opacity
                this._canvas.style.pointerEvents = 'none'
            }
            this.getPane().appendChild(this._canvas)
            this._reset()
        },
        onRemove: function () {
            L.DomUtil.remove(this._canvas)
        },
        getEvents: function () {
            return {
                moveend: this._reset,
                zoom: this._onZoom,
                resize: this._reset,
                viewreset: this._reset,
            }
        },
        bringToFront: function () {
            if (this._canvas && this._canvas.parentNode)
                this._canvas.parentNode.appendChild(this._canvas)
            return this
        },
        _onZoom: function () {
            if (this._canvas) this._canvas.style.display = 'none'
        },
        _reset: function () {
            if (!this._map || !this._canvas) return
            const size = this._map.getSize()
            const topLeft = this._map.containerPointToLayerPoint([0, 0])
            L.DomUtil.setPosition(this._canvas, topLeft)
            this._canvas.width = size.x
            this._canvas.height = size.y
            this._canvas.style.display = ''
            this._redraw()
        },
        _redraw: function () {
            if (!this._map || !this._canvas) return
            const o = this._opts
            const ctx = this._canvas.getContext('2d')
            const w = this._canvas.width
            const h = this._canvas.height
            ctx.clearRect(0, 0, w, h)
            if (!this._points.length) return

            if (!this._stamp) this._stamp = makeStamp(o.radius, o.blur)
            if (!this._grad) this._grad = makeGradient(o.gradient)
            const { canvas: stamp, r } = this._stamp

            let max = o.maxIntensity
            if (!(max > 0)) {
                max = 1
                if (o.weightProp)
                    this._points.forEach((p) => (max = Math.max(max, p.w)))
            }

            const bounds = this._map.getBounds().pad(0.2)
            let drawn = 0
            this._points.forEach((p) => {
                if (!bounds.contains([p.lat, p.lng])) return
                const pt = this._map.latLngToContainerPoint([p.lat, p.lng])
                ctx.globalAlpha = Math.min(
                    Math.max(p.w / max, o.minOpacity),
                    1
                )
                ctx.drawImage(stamp, pt.x - r, pt.y - r)
                drawn++
            })
            if (!drawn) return

            const img = ctx.getImageData(0, 0, w, h)
            const px = img.data
            const grad = this._grad
            for (let i = 0; i < px.length; i += 4) {
                const j = px[i + 3] * 4
                if (j) {
                    px[i] = grad[j]
                    px[i + 1] = grad[j + 1]
                    px[i + 2] = grad[j + 2]
                }
            }
            ctx.putImageData(img, 0, 0)
        },
    })
    return L.MMGISHeatLayer
}

function make(ctx) {
    const s = settings(ctx.config)
    const HeatLayer = createHeatLayerClass()
    const layer = new HeatLayer(pointsOf(ctx.geojson, s.weightProp), s)

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'heatmap',
        geojson: ctx.geojson,
        layer,
    }
}

function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.geojson = geojson
    if (onlyClear) {
        attachment.layer.setPoints([])
        return
    }
    attachment.layer.setPoints(pointsOf(geojson, settings(config).weightProp))
}

function onConfigChange({ attachment, config }) {
    if (!attachment) return
    const s = settings(config)
    attachment.layer.setPoints(pointsOf(attachment.geojson, s.weightProp))
    attachment.layer.setSettings(s)
}

function setOpacity(attachment, opacity) {
    attachment.layer.setOpacity(opacity)
}

const Heatmap = {
    make,
    syncData,
    onConfigChange,
    setOpacity,
}

export default Heatmap
