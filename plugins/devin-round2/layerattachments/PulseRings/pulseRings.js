/**
 * PulseRings attachment — an animated "sonar ping" around each point feature.
 *
 * Expanding, fading rings radiate outward from every point in the host layer,
 * looping forever. Handy for drawing the eye to a sparse set of interesting
 * sites (active rover, a candidate landing spot, a live event feed) on an
 * otherwise busy map. It is an ordinary Leaflet overlay driven by a single
 * requestAnimationFrame loop, so `make` builds it, `syncData` rebuilds the
 * circles on new data, `onConfigChange` retunes color/speed in place, and
 * `destroy` cancels the loop.
 *
 * Config (variables.layerAttachments.pulseRings):
 *   enabled       : boolean  — the on switch
 *   color         : string   — CSS color of the rings (default '#4fd0ff')
 *   maxRadiusMeters: number  — how far a ring travels before fading (default 30000)
 *   periodMs      : number   — time for one ring to travel out (default 2500)
 *   count         : number   — how many concurrent rings per point (default 3)
 */

const L = window.L

// ---- pure helpers (unit-testable without a map) --------------------------

export function pointsOf(geojson) {
    return (geojson?.features || [])
        .filter((f) => f?.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            return [lat, lng]
        })
}

export function normalizeConfig(config) {
    const c = config || {}
    return {
        color: typeof c.color === 'string' ? c.color : '#4fd0ff',
        maxRadiusMeters: Number(c.maxRadiusMeters) > 0 ? Number(c.maxRadiusMeters) : 30000,
        periodMs: Number(c.periodMs) > 0 ? Number(c.periodMs) : 2500,
        count: Number.isFinite(Number(c.count)) && Number(c.count) > 0 ? Math.floor(Number(c.count)) : 3,
    }
}

/**
 * The state of one ring at time `elapsed` (ms), given its stagger offset.
 * Progress runs 0→1 across `periodMs`; radius scales linearly, opacity fades.
 * Returned as plain data so it can be asserted in a unit test.
 */
export function ringFrame(elapsed, offset, tuned) {
    const { periodMs, maxRadiusMeters } = tuned
    const phase = (((elapsed / periodMs) + offset) % 1 + 1) % 1
    return {
        radius: phase * maxRadiusMeters,
        opacity: Math.max(0, 1 - phase),
    }
}

// ---- attachment operations ------------------------------------------------

function buildRings(points, tuned) {
    // One circle per (point × ring index); the animation loop restyles them.
    const circles = []
    points.forEach(([lat, lng]) => {
        for (let i = 0; i < tuned.count; i++) {
            const circle = L.circle([lat, lng], {
                radius: 0,
                color: tuned.color,
                weight: 2,
                fill: false,
                interactive: false,
            })
            circle._pulseOffset = i / tuned.count
            circles.push(circle)
        }
    })
    return circles
}

function startAnimation(attachment) {
    if (!window.requestAnimationFrame) return
    const start = (window.performance && performance.now ? performance.now() : Date.now())
    const step = (now) => {
        const elapsed = now - start
        const tuned = attachment._tuned
        attachment._circles.forEach((circle) => {
            const { radius, opacity } = ringFrame(elapsed, circle._pulseOffset, tuned)
            circle.setRadius(radius)
            if (circle.setStyle) circle.setStyle({ opacity, color: tuned.color })
        })
        attachment._raf = window.requestAnimationFrame(step)
    }
    attachment._raf = window.requestAnimationFrame(step)
}

function make(ctx) {
    const tuned = normalizeConfig(ctx.config)
    const circles = buildRings(pointsOf(ctx.geojson), tuned)
    const layer = L.layerGroup(circles)

    const attachment = {
        on: ctx.config?.enabled !== false && ctx.config?.initialVisibility !== false,
        type: 'pulse_rings',
        geojson: ctx.geojson,
        layer,
        _circles: circles,
        _tuned: tuned,
        _raf: null,
    }
    startAnimation(attachment)
    return attachment
}

// New data: rebuild the derived circles (core's default re-adds GeoJSON, which
// would draw plain point markers instead of our rings).
function syncData(attachment, { geojson, onlyClear }) {
    if (attachment._raf) window.cancelAnimationFrame(attachment._raf)
    attachment.layer.clearLayers()
    attachment._circles = []
    if (onlyClear) return
    attachment.geojson = geojson
    attachment._circles = buildRings(pointsOf(geojson), attachment._tuned)
    attachment._circles.forEach((c) => attachment.layer.addLayer(c))
    startAnimation(attachment)
}

// Settings changed live: retune color/speed/size without rebuilding the host.
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return // fall back to core rebuild if we weren't handed one
    const tuned = normalizeConfig(ctx.config)
    const countChanged = tuned.count !== attachment._tuned.count
    attachment._tuned = tuned
    if (countChanged) {
        syncData(attachment, { geojson: attachment.geojson })
    }
}

// Host removed for good: stop the loop so we don't animate detached circles.
function destroy(attachment) {
    if (attachment && attachment._raf) window.cancelAnimationFrame(attachment._raf)
}

export default { make, syncData, onConfigChange, destroy }
