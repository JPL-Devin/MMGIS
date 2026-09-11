// Dependency-free canvas heatmap. Samples are binned into a (downsampled) density grid,
// blurred with separable box passes (~gaussian), normalized so a lone sample of weight
// `max` peaks at 1, then colorized through a 256-step gradient lookup.
export default class HeatCanvas {
    constructor(canvas) {
        this._canvas = canvas
        this._ctx = canvas.getContext('2d')
        this._width = canvas.width
        this._height = canvas.height
        this._max = 1
        this._data = []
        this._count = 0
        this._r = 25
        this._blur = 15
        this._grad = null
        this._grid = null
        this._tmp = null
        this._gw = 0
        this._gh = 0
        this._cell = 1
        this._offscreen = document.createElement('canvas')
        this._offCtx = this._offscreen.getContext('2d')
        this.gradient({
            0.4: 'blue',
            0.6: 'cyan',
            0.7: 'lime',
            0.8: 'yellow',
            1.0: 'red',
        })
    }

    // data: flat Float32Array/Array of [x, y, weight, ...]
    data(flat, count) {
        this._data = flat
        this._count = count
        return this
    }

    max(max) {
        this._max = max > 0 ? max : 1
        return this
    }

    resize(w, h) {
        if (this._canvas.width !== w) this._canvas.width = w
        if (this._canvas.height !== h) this._canvas.height = h
        this._width = w
        this._height = h
        return this
    }

    radius(r, blur) {
        this._r = Math.max(0.5, r || 0.5)
        this._blur = Math.max(0, blur === undefined ? 15 : blur)
        return this
    }

    gradient(stops) {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const gradient = ctx.createLinearGradient(0, 0, 0, 256)
        canvas.width = 1
        canvas.height = 256
        const keys = Object.keys(stops || {})
            .map(Number)
            .filter((k) => Number.isFinite(k))
            .sort((a, b) => a - b)
        if (keys.length === 0)
            return this.gradient({ 0.4: 'blue', 0.65: 'lime', 1: 'red' })
        for (const k of keys)
            gradient.addColorStop(Math.min(1, Math.max(0, k)), stops[k])
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 1, 256)
        this._grad = ctx.getImageData(0, 0, 1, 256).data
        return this
    }

    clear() {
        this._ctx.clearRect(0, 0, this._width, this._height)
        return this
    }

    // Box-pass half-widths (grid cells): two radius passes (round-ish core), two blur passes.
    _passes() {
        const c = this._cell
        const r = Math.round(this._r / c / 2)
        const b = Math.round(this._blur / c / 2)
        return [r, r, b, b]
    }

    draw(minOpacity) {
        const w = this._width
        const h = this._height
        const ctx = this._ctx
        ctx.clearRect(0, 0, w, h)
        if (w === 0 || h === 0) return this

        const full = this._r + this._blur
        const cell = Math.min(4, Math.max(1, Math.floor(full / 8)))
        this._cell = cell
        const pad = Math.ceil(full / cell)
        const gw = Math.ceil(w / cell) + pad * 2
        const gh = Math.ceil(h / cell) + pad * 2
        if (this._gw !== gw || this._gh !== gh) {
            this._grid = new Float32Array(gw * gh)
            this._tmp = new Float32Array(gw * gh)
            this._gw = gw
            this._gh = gh
            this._offscreen.width = gw
            this._offscreen.height = gh
        }
        const grid = this._grid
        grid.fill(0)

        const d = this._data
        const n = this._count != null ? this._count : d.length / 3
        const inv = 1 / cell
        for (let i = 0; i < n; i++) {
            const o = i * 3
            const gx = Math.floor(d[o] * inv) + pad
            const gy = Math.floor(d[o + 1] * inv) + pad
            if (gx < 0 || gy < 0 || gx >= gw || gy >= gh) continue
            grid[gy * gw + gx] += d[o + 2]
        }

        const passes = this._passes()
        for (const hw of passes) {
            if (hw > 0) {
                boxBlurH(grid, this._tmp, gw, gh, hw)
                boxBlurV(this._tmp, grid, gw, gh, hw)
            }
        }
        const scale = 1 / impulsePeak1D(passes) ** 2 / this._max

        const img = this._offCtx.createImageData(gw, gh)
        this._colorize(img.data, grid, scale, minOpacity)
        this._offCtx.putImageData(img, 0, 0)
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(
            this._offscreen,
            -pad * cell,
            -pad * cell,
            gw * cell,
            gh * cell
        )
        return this
    }

    _colorize(pixels, grid, scale, minOpacity) {
        const grad = this._grad
        const minA = minOpacity === undefined ? 0.05 : minOpacity
        for (let i = 0, len = grid.length; i < len; i++) {
            const v = grid[i] * scale
            if (v <= 0.002) continue
            const t = v >= 1 ? 255 : (v * 255) | 0
            const j = t * 4
            const p = i * 4
            pixels[p] = grad[j]
            pixels[p + 1] = grad[j + 1]
            pixels[p + 2] = grad[j + 2]
            pixels[p + 3] = Math.max(t, minA * 255)
        }
    }
}

// Running-sum box blur (average), horizontal then vertical; src -> dst.
function boxBlurH(src, dst, w, h, r) {
    const norm = 1 / (2 * r + 1)
    for (let y = 0; y < h; y++) {
        const row = y * w
        let sum = 0
        for (let x = -r; x <= r; x++) if (x >= 0 && x < w) sum += src[row + x]
        for (let x = 0; x < w; x++) {
            dst[row + x] = sum * norm
            const add = x + r + 1
            const sub = x - r
            if (add < w) sum += src[row + add]
            if (sub >= 0) sum -= src[row + sub]
        }
    }
}

function boxBlurV(src, dst, w, h, r) {
    const norm = 1 / (2 * r + 1)
    for (let x = 0; x < w; x++) {
        let sum = 0
        for (let y = -r; y <= r; y++) if (y >= 0 && y < h) sum += src[y * w + x]
        for (let y = 0; y < h; y++) {
            dst[y * w + x] = sum * norm
            const add = y + r + 1
            const sub = y - r
            if (add < h) sum += src[add * w + x]
            if (sub >= 0) sum -= src[sub * w + x]
        }
    }
}

// Peak of a unit impulse after the given 1D box passes (2D peak is its square).
function impulsePeak1D(passes) {
    const half = passes.reduce((a, b) => a + b, 0) + 1
    const len = half * 2 + 1
    let a = new Float32Array(len)
    let b = new Float32Array(len)
    a[half] = 1
    for (const r of passes) {
        if (r <= 0) continue
        const norm = 1 / (2 * r + 1)
        for (let i = 0; i < len; i++) {
            let s = 0
            for (let k = -r; k <= r; k++) {
                const idx = i + k
                if (idx >= 0 && idx < len) s += a[idx]
            }
            b[i] = s * norm
        }
        ;[a, b] = [b, a]
    }
    return a[half]
}
