import { decide } from './logic'

const VertexProbe = {
    use(ctx) {
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        // Leave the answer for whatever runs after us in the pipeline.
        ctx.state.vertexProbe = result

        const html = `<div class="vertexProbe">
            <strong>${result.label}</strong><br/>
            ${result.vertices} vertices${result.counted ? '' : ' (counted here)'}
        </div>`

        // The Leaflet layer the feature is drawn as — a popup is the whole
        // behaviour, so there is nothing here that needs a singleton.
        ctx.layer?.bindPopup?.(html)?.openPopup?.(ctx.event?.latlng)
    },
}

export default VertexProbe
