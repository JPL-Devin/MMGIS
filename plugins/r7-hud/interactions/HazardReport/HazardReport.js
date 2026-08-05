import { decide } from './logic'
import { HAZARD_EVENT } from '../../lib/hazard'

const HazardReport = {
    use(ctx) {
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return

        // Later interactions in the pipeline can read this.
        ctx.state.hazardReport = result

        // ...but a component is not in the pipeline and core offers no channel
        // to one, so this is the documented convention (see
        // plugins/core/components/README.md, "Talking to the rest of MMGIS"):
        // a CustomEvent on `document` under a namespaced name. Nothing in core
        // defines or guarantees it — it is an agreement between the two plugins
        // in this container.
        document.dispatchEvent(
            new CustomEvent(HAZARD_EVENT, {
                detail: { ...result, layerName: ctx.layerName },
            })
        )
    },
}

export default HazardReport
