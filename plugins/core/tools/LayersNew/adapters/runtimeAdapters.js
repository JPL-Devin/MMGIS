import F_ from '@basics/Formulae_/Formulae_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import Globe_ from '@basics/Globe_/Globe_'
import Filtering from '@basics/Layers_/Filtering/Filtering'
import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import LayerAttachmentRegistry from '@basics/Layers_/registry/LayerAttachmentRegistry'
import TimeUI from '@basics/TimeControl_/TimeUI'
import LegendTool from '../../Legend/LegendTool'
import LayerInfoModal from '../../Layers/LayerInfoModal/LayerInfoModal'
import { deriveLegend, derivesLegend } from '@basics/Layers_/legend/LayerLegend'
import {
    overrideDynamicStyle,
    restyleLayerDynamically,
} from '@basics/Layers_/render/dynamicStyleRuntime'
import Toast from '@design/components/Toast/Toast'
import calls from '@pre/calls'

import { createLayersAdapter } from './layersAdapter'
import { createExportAdapter } from './exportAdapter'
import { createTimeAdapter } from './timeAdapter'
import { createLegendAdapter } from './legendAdapter'
import { createAttachmentsAdapter } from './attachmentsAdapter'

export const layersAdapter = createLayersAdapter({
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

export const exportAdapter = createExportAdapter({
    layers: L_,
    api: calls,
    convert: L_.convertGeoJSONLngLatsToPrimaryCoordinates.bind(L_),
})

export const timeAdapter = createTimeAdapter({ timeUI: TimeUI })

export const legendAdapter = createLegendAdapter({
    legend: LegendTool,
    derive: deriveLegend,
    canDerive: derivesLegend,
})

export const attachmentsAdapter = createAttachmentsAdapter({
    layers: L_,
    registry: LayerAttachmentRegistry,
})

export const layersNewAdapters = {
    layers: layersAdapter,
    export: exportAdapter,
    time: timeAdapter,
    legend: legendAdapter,
    attachments: attachmentsAdapter,
}
