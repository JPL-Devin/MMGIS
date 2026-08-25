import { createLayersAdapter } from './layersAdapter'
import { createExportAdapter } from './exportAdapter'
import { createTimeAdapter } from './timeAdapter'
import { createLegendAdapter } from './legendAdapter'
import { createAttachmentsAdapter } from './attachmentsAdapter'

let runtimeAdapters

function runtimeDependencies() {
    const F_ = require('@basics/Formulae_/Formulae_').default
    const L_ = require('@basics/Layers_/Layers_').default
    const Map_ = require('@basics/Map_/Map_').default
    const Globe_ = require('@basics/Globe_/Globe_').default
    const Filtering = require('@basics/Layers_/Filtering/Filtering').default
    const LayerTypeRegistry = require(
        '@basics/Layers_/registry/LayerTypeRegistry'
    ).default
    const LayerAttachmentRegistry = require(
        '@basics/Layers_/registry/LayerAttachmentRegistry'
    ).default
    const TimeUI = require('@basics/TimeControl_/TimeUI').default
    const LegendTool = require('../../Legend/LegendTool').default
    const LayerInfoModal = require(
        '../../Layers/LayerInfoModal/LayerInfoModal'
    ).default
    const {
        deriveLegend,
        derivesLegend,
    } = require('@basics/Layers_/legend/LayerLegend')
    const {
        overrideDynamicStyle,
        restyleLayerDynamically,
    } = require('@basics/Layers_/render/dynamicStyleRuntime')
    const Toast = require('@design/components/Toast/Toast').default
    const calls = require('@pre/calls').default
    return {
        F_,
        L_,
        Map_,
        Globe_,
        Filtering,
        LayerTypeRegistry,
        LayerAttachmentRegistry,
        TimeUI,
        LegendTool,
        LayerInfoModal,
        deriveLegend,
        derivesLegend,
        overrideDynamicStyle,
        restyleLayerDynamically,
        Toast,
        calls,
    }
}

function getRuntimeAdapters() {
    if (!runtimeAdapters) {
        const {
            F_,
            L_,
            Map_,
            Globe_,
            Filtering,
            LayerTypeRegistry,
            LayerAttachmentRegistry,
            TimeUI,
            LegendTool,
            LayerInfoModal,
            deriveLegend,
            derivesLegend,
            overrideDynamicStyle,
            restyleLayerDynamically,
            Toast,
            calls,
        } = runtimeDependencies()
        const layersAdapter = createLayersAdapter({
            layers: L_,
            map: Map_,
            globe: Globe_,
            formulae: F_,
            filtering: Filtering,
            registry: LayerTypeRegistry,
            resetDynamicStyle: overrideDynamicStyle,
            restyleDynamicStyle: restyleLayerDynamically,
            toast: Toast,
            info: LayerInfoModal,
        })
        const exportAdapter = createExportAdapter({
            layers: L_,
            api: calls,
            convert: L_.convertGeoJSONLngLatsToPrimaryCoordinates.bind(L_),
        })
        const timeAdapter = createTimeAdapter({
            timeUI: TimeUI,
            toast: Toast,
        })
        const legendAdapter = createLegendAdapter({
            legend: LegendTool,
            derive: deriveLegend,
            canDerive: derivesLegend,
        })
        const attachmentsAdapter = createAttachmentsAdapter({
            layers: L_,
            registry: LayerAttachmentRegistry,
        })
        runtimeAdapters = {
            layers: layersAdapter,
            export: exportAdapter,
            time: timeAdapter,
            legend: legendAdapter,
            attachments: attachmentsAdapter,
        }
    }
    return runtimeAdapters
}

export const layersNewAdapters = {
    get layers() {
        return getRuntimeAdapters().layers
    },
    get export() {
        return getRuntimeAdapters().export
    },
    get time() {
        return getRuntimeAdapters().time
    },
    get legend() {
        return getRuntimeAdapters().legend
    },
    get attachments() {
        return getRuntimeAdapters().attachments
    },
}
