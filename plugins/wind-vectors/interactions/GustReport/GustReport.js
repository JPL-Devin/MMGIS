import { decide } from './logic'

const GustReport = {
    use(ctx) {
        const result = decide(ctx.feature, ctx.config)
        if (result == null) return
        // Later interactions in the pipeline can read the report.
        ctx.state.gustReport = result
        if (window.Notify?.info) window.Notify.info(result.message)
    },
}

export default GustReport
