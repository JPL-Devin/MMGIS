/**
 * DustStormFronts layer type — extends `vector`.
 *
 * Storm extents, one feature per storm per observation time. Drawing, picking,
 * filtering and both globes are inherited from `vector`; this type owns
 *
 *   source.fetch — acquire every observation once, hand the map only the ones in
 *                  the current time window
 *   config       — the property names the dataset uses, and time defaults
 *
 * The fetched observations are kept on the layer object (`layerObj._dustStorms`)
 * because the StormTrack interaction needs the storm's *other* extents, which
 * are by definition not on the map.
 */
import { DEFAULT_PROPS, inWindow } from '../../lib/storms'

/** The property names for this layer: its config on top of the defaults. */
function propsOf(layerObj) {
    const v = layerObj?.variables?.dustStorms || {}
    return {
        idProp: v.idProp || DEFAULT_PROPS.idProp,
        speedProp: v.speedProp || DEFAULT_PROPS.speedProp,
        headingProp: v.headingProp || DEFAULT_PROPS.headingProp,
        intensityProp: v.intensityProp || DEFAULT_PROPS.intensityProp,
        timeProp: layerObj?.time?.startProp || DEFAULT_PROPS.timeProp,
    }
}

async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    // A dust-storm archive is small and the interaction needs all of it, so the
    // whole set is fetched once and re-filtered on each time change.
    let all = layerObj._dustStorms?.all
    if (all == null || ctx.trigger === 'make' || ctx.trigger === 'view') {
        const res = await window.fetch(ctx.url, {
            headers: { Accept: 'application/geo+json' },
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        const geojson = await res.json()
        all = geojson?.features || (Array.isArray(geojson) ? geojson : [])
    }

    const props = propsOf(layerObj)
    // Left for the interaction to read: there is no way for one plugin to call
    // another, so the type leaves behind what the others need.
    layerObj._dustStorms = { all, props }

    return {
        type: 'FeatureCollection',
        features: inWindow(all, ctx.time?.start, ctx.time?.end, props),
    }
}

/**
 * Time is what this type is about, so a layer of it is time-enabled by default
 * and its features are timestamped by `time.startProp`.
 */
function normalize(layerObj) {
    layerObj.time = {
        enabled: true,
        type: 'local',
        startProp: DEFAULT_PROPS.timeProp,
        endProp: DEFAULT_PROPS.timeProp,
        ...(layerObj.time || {}),
    }
    return layerObj
}

const DustStormFronts = {
    source: { fetch },
    config: { normalize },
}

export default DustStormFronts
