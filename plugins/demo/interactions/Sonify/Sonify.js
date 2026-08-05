/**
 * Sonify — turns a clicked feature into a short, pleasant sound.
 *
 * A numeric property is mapped onto a pentatonic scale (so any sequence of
 * clicks stays consonant), played as a two-note arpeggio, and panned by the
 * feature's longitude. Clicking along a rover traverse or a set of samples
 * plays the dataset as a melody — a quick, eyes-free read of "is this value
 * high or low compared to the last one".
 */

// Semitone offsets of a major pentatonic scale over two octaves.
const PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]

const DEFAULTS = {
    property: null,
    min: 0,
    max: 1,
    baseHz: 261.63, // middle C
    scale: 'linear',
    duration: 0.45,
    waveform: 'triangle',
    pan: true,
}

/** Reads a dot-path out of a feature's properties. */
export const readProperty = (feature, path) => {
    if (!feature || !path) return null
    let value = feature.properties || {}
    for (const key of String(path).split('.')) {
        if (value == null || typeof value !== 'object') return null
        value = value[key]
    }
    const num = typeof value === 'string' ? parseFloat(value) : value
    return typeof num === 'number' && isFinite(num) ? num : null
}

/** Normalizes `value` into 0..1 across [min, max], linearly or logarithmically. */
export const normalize = (value, min, max, scale) => {
    if (value == null || !isFinite(value)) return null
    if (scale === 'log' && min > 0 && max > 0 && value > 0) {
        const t = (Math.log(value) - Math.log(min)) / (Math.log(max) - Math.log(min))
        return Math.min(1, Math.max(0, t))
    }
    if (max === min) return 0
    return Math.min(1, Math.max(0, (value - min) / (max - min)))
}

/** Quantizes 0..1 onto the pentatonic scale above `baseHz`. */
export const toHz = (t, baseHz) => {
    if (t == null) return null
    const index = Math.round(t * (PENTATONIC.length - 1))
    return baseHz * Math.pow(2, PENTATONIC[index] / 12)
}

/** -1..1 stereo position from a feature's longitude, or 0 when unknown. */
export const toPan = (feature) => {
    const coords = feature?.geometry?.coordinates
    if (!Array.isArray(coords)) return 0
    let first = coords
    while (Array.isArray(first[0])) first = first[0]
    const lng = first[0]
    if (typeof lng !== 'number' || !isFinite(lng)) return 0
    return Math.max(-1, Math.min(1, (((lng + 180) % 360) / 180) - 1))
}

let audioContext = null
const getContext = () => {
    if (audioContext) return audioContext
    const Ctor =
        typeof window !== 'undefined' &&
        (window.AudioContext || window.webkitAudioContext)
    if (!Ctor) return null
    audioContext = new Ctor()
    return audioContext
}

/** Plays a two-note arpeggio at `hz`. Returns false when there is no audio. */
export const play = (hz, { duration, waveform, pan }) => {
    const ctx = getContext()
    if (!ctx || hz == null) return false
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume()

    const now = ctx.currentTime
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.22, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

    let out = gain
    if (ctx.createStereoPanner) {
        const panner = ctx.createStereoPanner()
        panner.pan.setValueAtTime(pan, now)
        gain.connect(panner)
        out = panner
    }
    out.connect(ctx.destination)

    // Root, then a fifth above a beat later — enough to feel like a note, not a beep.
    ;[
        [hz, now],
        [hz * 1.5, now + duration * 0.35],
    ].forEach(([f, at]) => {
        const osc = ctx.createOscillator()
        osc.type = waveform
        osc.frequency.setValueAtTime(f, at)
        osc.connect(gain)
        osc.start(at)
        osc.stop(now + duration)
    })
    return true
}

const Sonify = {
    use(ctx) {
        const cfg = { ...DEFAULTS, ...(ctx.config || {}) }
        const value = readProperty(ctx.feature, cfg.property)
        if (value == null) return
        const hz = toHz(normalize(value, cfg.min, cfg.max, cfg.scale), cfg.baseHz)
        const played = play(hz, {
            duration: Math.max(0.05, cfg.duration),
            waveform: cfg.waveform,
            pan: cfg.pan ? toPan(ctx.feature) : 0,
        })
        ctx.state.sonify = { value, hz, played }
    },
}

export default Sonify
