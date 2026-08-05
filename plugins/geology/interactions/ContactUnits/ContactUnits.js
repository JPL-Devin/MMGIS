/**
 * ContactUnits interaction — on clicking a contact line, name the two units it
 * separates in a popup at the click point.
 *
 * The decision (which properties, what label) is in logic.js so it can be unit
 * tested; this handler is the thin adapter that draws the result. See
 * plugins/core/interactions/README.md.
 */
import { decide, escapeHtml } from './logic'

const leaflet = () => window.L

const ContactUnits = {
    use(ctx) {
        if (!ctx.feature) return
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        // Leave the answer for any later interaction in the pipeline.
        ctx.state.contactUnits = result

        const latlng = ctx.event?.latlng
        const map = ctx.Map_?.map
        const L = leaflet()
        if (!latlng || !map || !L) return

        L.popup({ className: 'contactUnitsPopup', autoPan: false })
            .setLatLng(latlng)
            .setContent(
                `<div class="contactUnits">` +
                    `<b>Geologic contact</b><br/>${escapeHtml(result.label)}` +
                    `</div>`
            )
            .openOn(map)
    },
}

export default ContactUnits
