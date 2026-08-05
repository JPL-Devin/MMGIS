import { sectionAt } from './logic'

const StratSection = {
    use(ctx) {
        const section = sectionAt(ctx.feature, ctx.config, ctx.layerData)
        if (section == null) return

        // Left for the postamble (info:silent and friends) and for anything a
        // mission adds after us.
        ctx.state.stratSection = section
    },
}

export default StratSection
