import { decide } from './logic'

const WindReport = {
    use(ctx) {
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        // A Leaflet popup at the click, which needs nothing of `src/essence`.
        if (ctx.event?.latlng && ctx.Map_?.map && window.L) {
            window.L.popup({ className: 'windReportPopup' })
                .setLatLng(ctx.event.latlng)
                .setContent(`<b>Wind</b><br/>${result.text}`)
                .openOn(ctx.Map_.map)
        }

        // Leave it for anything later in the pipeline.
        ctx.state.windReport = result
    },
}

export default WindReport
