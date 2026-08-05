/**
 * Telemetry layer type — the `source` surface.
 *
 * Telemetry is a `vector` (it `extends` it in plugin.json, so drawing, picking,
 * styling, filtering and both globes are inherited) whose meaning is time: as
 * the mission clock's window moves, only the features inside that window should
 * be shown. Core re-acquires a time-enabled layer's data whenever the window
 * moves, calling this `fetch` again with the current window in `ctx.time`, so
 * refiltering here is all that is needed — no renderer, no time.js, no manual
 * subscription.
 *
 * The full dataset is fetched once and cached on the layer's (mutable, lives as
 * long as the layer) config object; every subsequent acquisition just refilters
 * that cache to the window. See plugins/core/layertypes/README.md (`source`).
 */
import F_ from '@basics/Formulae_/Formulae_'
import { filterFeaturesByWindow } from './lib/timeWindow'

async function fetch(layerObj, ctx = {}) {
    const url = ctx.url

    // Acquire the full dataset once, then serve every window from the cache.
    if (!layerObj._telemetryAll && url) {
        const res = await window.fetch(url)
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        layerObj._telemetryAll = await res.json()
    }

    const all = layerObj._telemetryAll
    if (!all) return null

    // Time off, or the layer isn't time-enabled: show everything.
    if (!ctx.time) return all

    return filterFeaturesByWindow(
        all,
        ctx.time.start,
        ctx.time.end,
        ctx.time.startProp,
        ctx.time.endProp,
        (obj, path) => F_.getIn(obj, path)
    )
}

// NOTE: the default export must be an object literal — the plugin module
// validator static-parses it and cannot follow a named const, though eslint
// would prefer one.
export default { fetch }
