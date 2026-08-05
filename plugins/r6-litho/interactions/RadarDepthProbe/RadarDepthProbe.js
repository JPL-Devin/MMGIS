import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'
import { decide } from './logic'

const RadarDepthProbe = {
    use(ctx) {
        if (ctx.feature == null) return
        // `ctx.event.latlng` is the map click. A click on the globe curtain
        // does not arrive here at all — see the report.
        const result = decide(ctx.feature, ctx.event?.latlng, ctx.config)
        if (result == null) return

        CursorInfo.update(result.message, 4000, true)
        // What a later interaction in the pipeline can read.
        ctx.state.radarDepthProbe = result.probe
    },
}

export default RadarDepthProbe
