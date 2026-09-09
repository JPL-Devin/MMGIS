/**
 * Heatmap attachment — a density canvas over its host's point features.
 *
 * The overlay is an L.Layer of our own rather than a GeoJSON layer, so the
 * points are rasterized per view change instead of drawn per feature.
 */

import F_ from '@basics/Formulae_/Formulae_'
import { settings, pointsOf, intensityRange, normalize } from './logic'

const leaflet = () => window.L

const readProp = (properties, prop) => F_.getIn(properties, prop, 0)

const points = (geojson, options) => pointsOf(geojson, options, readProp)

// 256 rgba stops read by density, the gradient's colors spaced evenly.
const makePalette = (colors) => {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    colors.forEach((color, i) => {
        grad.addColorStop(i / (colors.length - 1), color)
    })
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 1, 256)
    return ctx.getImageData(0, 0, 1, 256).data
}

// One point's alpha falloff, stamped per point and colorized afterwards.
const makeStamp = (radius, blur) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = radius * 2
    const ctx = canvas.getContext('2d')
    const grad = ctx.createRadialGradient(
        radius,
        radius,
        Math.max(0, radius - blur),
        radius,
        radius,
        radius
    )
    grad.addColorStop(0, 'rgba(0,0,0,1)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, radius * 2, radius * 2)
    return canvas
}

const heatLayerClass = () => {
    const L = leaflet()
    if (!L?.Layer) return null

    return L.Layer.extend({
        initialize(pts, options) {
            this._points = pts || []
            this.setOptions(options)
        },
        setOptions(options) {
            this._options = options
            this._palette = null
            this._stamp = null
            this._applyOpacity()
            return this
        },
        setPoints(pts) {
            this._points = pts || []
            this._draw()
            return this
        },
        // The host layer's opacity scales the configured one.
        setHostOpacity(opacity) {
            this._hostOpacity = opacity
            this._applyOpacity()
            return this
        },
        _applyOpacity() {
            if (this._canvas)
                this._canvas.style.opacity =
                    this._options.opacity * (this._hostOpacity ?? 1)
        },
        onAdd(map) {
            this._map = map
            if (!this._canvas) {
                this._canvas = L.DomUtil.create(
                    'canvas',
                    'leaflet-heatmap-attachment leaflet-layer'
                )
                this._canvas.style.pointerEvents = 'none'
            }
            this._applyOpacity()
            map.getPanes().overlayPane.appendChild(this._canvas)
            map.on('moveend zoomend resize viewreset', this._reset, this)
            this._reset()
            return this
        },
        onRemove(map) {
            if (this._canvas?.parentNode)
                this._canvas.parentNode.removeChild(this._canvas)
            map.off('moveend zoomend resize viewreset', this._reset, this)
            this._map = null
            return this
        },
        _reset() {
            if (!this._map || !this._canvas) return
            const size = this._map.getSize()
            this._canvas.width = size.x
            this._canvas.height = size.y
            L.DomUtil.setPosition(
                this._canvas,
                this._map.containerPointToLayerPoint([0, 0])
            )
            this._draw()
        },
        _draw() {
            if (!this._map || !this._canvas) return
            const { radius, blur, gradient } = this._options
            const ctx = this._canvas.getContext('2d')
            ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
            if (!this._points.length) return

            if (!this._palette) this._palette = makePalette(gradient)
            if (!this._stamp) this._stamp = makeStamp(radius, blur)
            const range = intensityRange(this._points, this._options)

            const pad = radius * 1.5
            this._points.forEach((p) => {
                const pt = this._map.latLngToContainerPoint([p[0], p[1]])
                if (
                    pt.x < -pad ||
                    pt.y < -pad ||
                    pt.x > this._canvas.width + pad ||
                    pt.y > this._canvas.height + pad
                )
                    return
                ctx.globalAlpha = normalize(p[2], range)
                ctx.drawImage(this._stamp, pt.x - radius, pt.y - radius)
            })
            ctx.globalAlpha = 1
            this._colorize(ctx)
        },
        // Alpha accumulated by the stamps becomes the gradient's color.
        _colorize(ctx) {
            const image = ctx.getImageData(
                0,
                0,
                this._canvas.width,
                this._canvas.height
            )
            const pixels = image.data
            const palette = this._palette
            for (let i = 3; i < pixels.length; i += 4) {
                const j = pixels[i] * 4
                if (j) {
                    pixels[i - 3] = palette[j]
                    pixels[i - 2] = palette[j + 1]
                    pixels[i - 1] = palette[j + 2]
                }
            }
            ctx.putImageData(image, 0, 0)
        },
    })
}

function make(ctx) {
    const options = settings(ctx.config)
    const pts = points(ctx.geojson, options)
    const HeatLayer = heatLayerClass()
    if (!HeatLayer || pts.length === 0) return false

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'heatmap',
        geojson: ctx.geojson,
        layer: new HeatLayer(pts, options),
    }
}

// The default rebuilds a GeoJSON layer; ours holds its own reprojected points.
function syncData(attachment, ctx = {}) {
    const options = settings(ctx.config)
    attachment.geojson = ctx.geojson
    attachment.layer.setOptions(options)
    attachment.layer.setPoints(ctx.onlyClear ? [] : points(ctx.geojson, options))
}

// Retune in place instead of paying for core's default host rebuild.
function onConfigChange(ctx = {}) {
    if (!ctx.attachment?.layer) return
    const options = settings(ctx.config)
    ctx.attachment.layer.setOptions(options)
    ctx.attachment.layer.setPoints(points(ctx.attachment.geojson, options))
}

function setOpacity(attachment, opacity) {
    attachment.layer.setHostOpacity(opacity)
}

const Heatmap = {
    make,
    syncData,
    onConfigChange,
    setOpacity,
}

export default Heatmap
