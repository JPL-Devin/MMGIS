import TimeControl from '@basics/TimeControl_/TimeControl'

import { decide } from './logic'

const EventSeek = {
    use(ctx) {
        const window_ = decide(ctx.feature, ctx.layerData, ctx.config)
        if (window_ == null) return
        if (!TimeControl.enabled) return

        TimeControl.setTime(
            window_.startTime,
            window_.endTime,
            false,
            undefined,
            window_.currentTime
        )
        // Later interactions in the pipeline can see where the clock went.
        ctx.state.eventSeek = window_
    },
}

export default EventSeek
