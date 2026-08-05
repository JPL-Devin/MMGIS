/**
 * profile:pick — pick the endpoints of a terrain profile from feature clicks.
 *
 * On each click of a feature it records a point: if the clicked feature is a
 * LineString it hands the whole line to the tool (the profile is that line);
 * otherwise it treats the click as one endpoint and keeps the two most recent
 * (A then B), so two clicks on point features define a segment.
 *
 * It shares those picks with the TerrainProfile tool through the feature's
 * shared store (../../lib/profileStore) — see that file for why the store had
 * to be invented.
 */
import store from '../../lib/profileStore'

const ProfilePick = {
    use(ctx) {
        if (!ctx.feature) return

        const geomType = ctx.feature.geometry?.type
        if (geomType === 'LineString' || geomType === 'MultiLineString') {
            store.setLine({
                ...ctx.feature,
                _layerName: ctx.layerName,
            })
            ctx.state.terrainProfileLine = ctx.layerName
            return
        }

        // Non-line feature: use the click location (falls back to the feature's
        // first coordinate) as one endpoint.
        const latlng = ctx.event?.latlng
        let lat = latlng?.lat
        let lng = latlng?.lng
        if ((lat == null || lng == null) && geomType === 'Point') {
            lng = ctx.feature.geometry.coordinates[0]
            lat = ctx.feature.geometry.coordinates[1]
        }
        if (lat == null || lng == null) return

        store.addEndpoint({
            lat,
            lng,
            layerName: ctx.layerName,
            properties: ctx.feature.properties || {},
        })
        ctx.state.terrainProfileEndpoints = store.endpoints.length
    },
}

export default ProfilePick
