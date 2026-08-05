/**
 * TelemetryScrub interaction.
 *
 * Clicking a telemetry feature scrubs the mission clock to that feature's
 * timestamp: the window is moved (its duration preserved) so the point becomes
 * the playhead. Moving the clock in turn drives the Telemetry layer type's
 * refilter and the TelemetryTrail attachment's fade — the three families share
 * only the mission clock (TimeControl) and the layer's core `time` config
 * (`layerData.time.startProp` / `endProp`), which is where a feature's
 * timestamp property is named.
 *
 * TimeControl is read off the window per call (`window.L_.TimeControl_`) rather
 * than imported: importing the singleton pulls jQuery and makes the module
 * un-importable in a Node unit test, and a dotted-path getter covers what F_
 * would here. The window access no-ops in Node, so the handler stays testable.
 */
import { readFeatureTime, computeScrubWindow } from './lib/scrub'

const timeControl = () => (typeof window !== 'undefined' ? window.L_?.TimeControl_ : null)

const TelemetryScrub = {
    use(ctx) {
        if (!ctx.feature) return
        const TimeControl = timeControl()
        // Moving time is a no-op when the mission has no clock — bail early.
        if (!TimeControl || !TimeControl.enabled) return

        const time = ctx.layerData?.time || {}
        const ts = readFeatureTime(ctx.feature, time.startProp, time.endProp)
        if (ts == null) return

        const { mode = 'center' } = ctx.config || {}
        const w = computeScrubWindow(
            TimeControl.getStartTime(),
            TimeControl.getEndTime(),
            ts,
            mode
        )
        if (!w) return

        TimeControl.setTime(w.start, w.end, false, '00:00:00', w.currentTime)

        // Let later interactions know the clock was scrubbed here.
        ctx.state.telemetryScrubbedTo = w.currentTime
    },
}

export default TelemetryScrub
