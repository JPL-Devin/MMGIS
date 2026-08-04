// FeatureSonify — turn a clicked feature's data into sound.
//
// Planetary datasets are full of numbers you can't "see" at a glance:
// crater depth, elevation, temperature, methane concentration. This
// interaction sonifies a numeric property of the clicked feature so you
// can *hear* how big/small it is relative to the rest of the layer — a
// quick, delightful (and accessibility-friendly) way to sense a value
// without opening a panel.
//
// Optional per-layer config (layerData.variables.sonify):
//   {
//     "property": "elevation",   // feature property to sonify (auto-picked if omitted)
//     "min": 0,                  // value mapped to the lowest pitch (auto from layer if omitted)
//     "max": 5000,               // value mapped to the highest pitch (auto from layer if omitted)
//     "scale": "pentatonic",     // "pentatonic" (default, always pleasant) or "continuous"
//     "duration": 0.6            // seconds
//   }

// A2 -> A6 pentatonic (A minor pentatonic across ~4 octaves) — always sounds nice.
const PENTATONIC = []
;(function buildScale() {
    const base = 110 // A2
    const semis = [0, 3, 5, 7, 10] // minor pentatonic degrees
    for (let oct = 0; oct < 4; oct++) {
        for (const s of semis) {
            PENTATONIC.push(base * Math.pow(2, (oct * 12 + s) / 12))
        }
    }
})()

let _audioCtx = null
function getAudioCtx() {
    if (_audioCtx) return _audioCtx
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    _audioCtx = new AC()
    return _audioCtx
}

function firstNumericProperty(props) {
    if (!props) return null
    for (const key of Object.keys(props)) {
        const v = props[key]
        if (typeof v === 'number' && isFinite(v)) return key
        if (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)))
            return key
    }
    return null
}

// Scan sibling features on the same layer to auto-derive a value range so
// the pitch is meaningful relative to the rest of the dataset.
function autoRange(layer, property) {
    let min = Infinity
    let max = -Infinity
    const consider = (f) => {
        const v = Number(f?.properties?.[property])
        if (isFinite(v)) {
            if (v < min) min = v
            if (v > max) max = v
        }
    }
    try {
        if (layer && typeof layer.eachLayer === 'function') {
            layer.eachLayer((l) => {
                if (l.feature) consider(l.feature)
            })
        } else if (layer && typeof layer.getLayers === 'function') {
            layer.getLayers().forEach((l) => {
                if (l.feature) consider(l.feature)
            })
        }
    } catch (e) {
        /* best-effort */
    }
    if (!isFinite(min) || !isFinite(max)) return null
    return { min, max }
}

function playTone(freq, duration) {
    const ac = getAudioCtx()
    if (!ac) return false
    if (ac.state === 'suspended') ac.resume()
    const now = ac.currentTime
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    // gentle attack/decay so it reads as a "chime", not a click
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(now)
    osc.stop(now + duration + 0.05)
    return true
}

const FeatureSonify = {
    // Exposed for unit testing without a live AudioContext / DOM.
    _valueToFrequency(value, min, max, scale) {
        let t = 0.5
        if (isFinite(min) && isFinite(max) && max > min) {
            t = (value - min) / (max - min)
        }
        t = Math.max(0, Math.min(1, t))
        if (scale === 'continuous') {
            const lo = PENTATONIC[0]
            const hi = PENTATONIC[PENTATONIC.length - 1]
            // exponential interpolation — pitch is perceptually logarithmic
            return lo * Math.pow(hi / lo, t)
        }
        const idx = Math.round(t * (PENTATONIC.length - 1))
        return PENTATONIC[idx]
    },

    use(ctx) {
        const feature = ctx && ctx.feature
        if (!feature || !feature.properties) return

        const cfg = (ctx.layerVar && ctx.layerVar.sonify) || {}
        const property = cfg.property || firstNumericProperty(feature.properties)
        if (!property) return // nothing numeric to sonify

        const value = Number(feature.properties[property])
        if (!isFinite(value)) return

        let min = cfg.min
        let max = cfg.max
        if (min == null || max == null) {
            const range = autoRange(ctx.layer, property)
            if (range) {
                if (min == null) min = range.min
                if (max == null) max = range.max
            }
        }

        const scale = cfg.scale === 'continuous' ? 'continuous' : 'pentatonic'
        const duration = Number(cfg.duration) > 0 ? Number(cfg.duration) : 0.6

        const freq = FeatureSonify._valueToFrequency(value, min, max, scale)
        playTone(freq, duration)

        // Let anything listening (e.g. a HUD) know what we just played.
        try {
            document.dispatchEvent(
                new CustomEvent('featureSonified', {
                    detail: {
                        layerName: ctx.layerName,
                        property,
                        value,
                        min,
                        max,
                        frequency: freq,
                    },
                })
            )
        } catch (e) {
            /* CustomEvent unavailable — ignore */
        }
    },
}

export default FeatureSonify
