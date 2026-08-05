import ToolController_ from '@basics/ToolController_/ToolController_'

import { resolveMeta, extractSelection } from './logic'

const SpectraSelect = {
    use(ctx) {
        const meta = resolveMeta(ctx.layerVar, ctx.config)
        const selection = extractSelection(ctx.feature, ctx.layerName, meta)
        if (selection == null) return

        // How the tool learns what was selected: the tool module is statically
        // imported by src/pre/tools.js, so `getTool` returns it whether or not the
        // panel is open, and it owns the selection list. There is no plugin-to-plugin
        // bus, so this is the pattern core's own ChemistryUse uses
        // (`TC_.getTool('ChemistryTool').use(ctx.layer)`), plus a
        // `pluginDependencies` entry naming the tool.
        ToolController_.getTool('SpectraTool').addSelection?.(
            selection,
            meta.maxSelections
        )

        // Also on ctx.state, for anything later in this pipeline.
        ctx.state.spectraSelection = selection
    },
}

export default SpectraSelect
