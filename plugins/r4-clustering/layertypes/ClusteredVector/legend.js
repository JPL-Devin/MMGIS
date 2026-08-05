/**
 * ClusteredVector — the `legend` surface.
 *
 * The legend is the render here: the bins are whatever the current zoom's
 * clustering produced, so they are computed in source.fetch and stashed on the
 * layer for `derive` to read (`derive` is handed the config, not the data).
 */
import { bins } from './lib/clustering'

function derive(layerObj) {
    const stats = layerObj?._clusterStats
    if (!stats || stats.mode !== 'cluster') return false

    const binList = layerObj._clusterBins || bins(stats.maxCount)
    layerObj._legend = binList.map((b) => ({
        color: b.color,
        strokecolor: b.color,
        shape: 'circle',
        value: b.min === b.max ? `${b.min}` : `${b.min}–${b.max}`,
    }))
    return true
}

export default { derive }
