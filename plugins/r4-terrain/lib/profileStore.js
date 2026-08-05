/**
 * Shared state channel for the TerrainProfile feature.
 *
 * The plugin system gives each family its own lifecycle but NO first-class way
 * for an interaction and a tool to talk to each other: an interaction's
 * `ctx.state` lives for one pipeline run, and there is no cross-plugin event
 * bus or shared store in the documented contract. So this feature invents one:
 * a tiny module, kept on `window` so a single instance is shared no matter how
 * webpack bundles the two plugins, exposing the picked endpoints plus a
 * subscribe/emit pair. The interaction pushes endpoints; the tool subscribes.
 *
 * This is the seam we most wanted the platform to provide.
 */
const KEY = '__terrainProfileStore__'

function create() {
    const listeners = new Set()
    return {
        endpoints: [], // [{ lat, lng, layerName, properties }]
        line: null, // a full picked LineString feature, if one was clicked
        subscribe(fn) {
            listeners.add(fn)
            return () => listeners.delete(fn)
        },
        emit() {
            listeners.forEach((fn) => {
                try {
                    fn(this)
                } catch (e) {
                    console.warn('TerrainProfile store listener failed', e)
                }
            })
        },
        addEndpoint(pt) {
            // Keep the two most recent picks (A then B).
            this.endpoints = [...this.endpoints, pt].slice(-2)
            this.emit()
        },
        setLine(feature) {
            this.line = feature
            this.emit()
        },
        clear() {
            this.endpoints = []
            this.line = null
            this.emit()
        },
    }
}

const store = window[KEY] || (window[KEY] = create())

export default store
