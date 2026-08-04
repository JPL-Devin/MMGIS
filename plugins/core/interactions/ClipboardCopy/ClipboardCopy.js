const DEFAULT_TEMPLATE = '{name}'
const TOKEN = /\{([^{}]+)\}/g

/**
 * Resolve a dotted path against an object ('a.b.0.c').
 */
function at(obj, path) {
    return path
        .split('.')
        .reduce((o, k) => (o == null ? undefined : o[k]), obj)
}

function centroidOf(feature) {
    const g = feature?.geometry
    if (!g || !g.coordinates) return null
    let lng = 0
    let lat = 0
    let n = 0
    const walk = (c) => {
        if (typeof c[0] === 'number' && typeof c[1] === 'number') {
            lng += c[0]
            lat += c[1]
            n++
        } else if (Array.isArray(c)) c.forEach(walk)
    }
    walk(g.coordinates)
    return n === 0 ? null : { lng: lng / n, lat: lat / n }
}

/**
 * Fill {tokens} from feature properties, plus the built-ins {lat}, {lng},
 * {layer} and {index}. Unresolved tokens collapse to an empty string.
 */
export function render(template, ctx, precision) {
    const props = ctx.feature?.properties || {}
    const ll = ctx.event?.latlng || centroidOf(ctx.feature) || {}
    const fixed = (v) =>
        typeof v === 'number' ? v.toFixed(precision) : ''
    return template.replace(TOKEN, (_, token) => {
        const key = token.trim()
        switch (key) {
            case 'lat':
                return fixed(ll.lat)
            case 'lng':
            case 'lon':
                return fixed(ll.lng)
            case 'layer':
                return ctx.layerName || ''
            default: {
                const v = at(props, key)
                return v == null ? '' : String(v)
            }
        }
    })
}

function writeClipboard(text) {
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (nav?.clipboard?.writeText) return nav.clipboard.writeText(text)
    // execCommand fallback for insecure origins, where navigator.clipboard
    // is undefined.
    let el = null
    try {
        el = document.createElement('textarea')
        el.value = text
        el.style.position = 'fixed'
        el.style.opacity = '0'
        document.body.appendChild(el)
        el.select()
        const ok = document.execCommand('copy')
        return ok ? Promise.resolve() : Promise.reject(new Error('denied'))
    } catch (e) {
        return Promise.reject(e)
    } finally {
        try {
            if (el) document.body.removeChild(el)
        } catch (e) {
            /* never attached */
        }
    }
}

/**
 * CursorInfo pulls in jQuery at import time, which the plugin unit-test
 * harness can't stub, so it is resolved lazily and only when notifying.
 */
function notify(message) {
    try {
        const mod = require('@basics/UserInterface_/components/CursorInfo/CursorInfo')
        ;(mod.default || mod).update(message, 3000, true)
    } catch (e) {
        /* no map UI available (tests, headless) */
    }
}

const ClipboardCopy = {
    use(ctx) {
        // Opt-in: without the layer's own configPath subtree there is no
        // template to copy, so stay out of the way.
        const cfg = ctx.config
        if (!cfg || cfg.enabled === false) return
        if (!ctx.feature) return

        const precision = Number.isFinite(cfg.coordinatePrecision)
            ? cfg.coordinatePrecision
            : 5

        let text = render(cfg.template || DEFAULT_TEMPLATE, ctx, precision)
        if (!text.trim() && cfg.fallbackProperty)
            text = String(
                at(ctx.feature.properties || {}, cfg.fallbackProperty) ?? ''
            )
        if (!text.trim()) return

        if (cfg.appendToSelection && ctx.state) {
            const prior = ctx.state.clipboardCopySelection || []
            prior.push(text)
            ctx.state.clipboardCopySelection = prior
            text = prior.join(cfg.separator || '\n')
        }

        ctx.state = ctx.state || {}
        ctx.state.clipboardCopyText = text

        writeClipboard(text)
            .then(() => {
                if (cfg.notify === false) return
                notify(`Copied: ${text}`)
            })
            .catch(() => {
                if (cfg.notify === false) return
                notify('Clipboard copy blocked')
            })
    },
}

export default ClipboardCopy
