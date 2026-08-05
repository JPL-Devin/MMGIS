import Toast from '@design/components/Toast/Toast'
import { decide } from './logic'

const PageReport = {
    use(ctx) {
        const result = decide(ctx.feature)
        if (result == null) return

        // Leave it for any later interaction in the pipeline...
        ctx.state.pageReport = result
        // ...and tell the user which page this feature streamed in on.
        Toast.info(result.label, 3000)
    },
}

export default PageReport
