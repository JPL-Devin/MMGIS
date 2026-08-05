/**
 * FleetRovers — a vector layer whose data comes from the FleetState backend
 * plugin rather than a url core can fetch. Everything else (drawing, picking,
 * filtering, both globes) is inherited via `extends: "vector"`.
 */
import { getFleet, decorate } from '../../lib/fleetApi'

async function fetch(layerObj, ctx) {
    const geojson = await getFleet()
    return decorate(geojson)
}

const FleetRovers = {
    source: { fetch },
}

export default FleetRovers
