import { explain } from './logic'

/**
 * ThermalExplain — on click, derive the feature's thermal inertia and show how
 * it was computed. A `main`-phase interaction; the layer type ships it with the
 * day/night property names via capabilities.defaultInteractions, so it reads
 * `ctx.config` and never learns whether the type or an admin configured it.
 *
 * The pure decision (which number, what wording) is in `logic.js`; this handler
 * only touches Leaflet, which is what keeps `logic.js` unit-testable.
 */
const ThermalExplain = {
    use(ctx) {
        const result = explain(ctx.feature, ctx.config)
        if (result == null) return

        // Leave the derivation for any later interaction in the pipeline.
        ctx.state.thermalExplain = result

        // Show it where the user clicked.
        const latlng = ctx.event?.latlng
        if (latlng && window.L) {
            window.L.popup({ className: 'thermalExplainPopup' })
                .setLatLng(latlng)
                .setContent(`<div>${result.text}</div>`)
                .openOn(ctx.Map_?.map)
        }
    },
}

export default ThermalExplain
