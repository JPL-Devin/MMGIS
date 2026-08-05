/**
 * ClusterExpand interaction — unit tests.
 *
 * `use(ctx)` takes a plain object, so the handler is testable here with a fake
 * Map_ standing in for Leaflet.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ClusterExpand, { planFor } from '../ClusterExpand.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const clusterFeature = (count, bounds, members) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: {
        _clusterCount: count,
        _clusterBounds: bounds,
        ...(members ? { _clusterMembers: members } : {}),
    },
})

const fakeCtx = (feature, config) => {
    const calls = []
    return {
        ctx: {
            eventType: 'click',
            feature,
            config,
            state: {},
            stop: false,
            layerData: {},
            Map_: { map: { fitBounds: (b, o) => calls.push([b, o]) } },
        },
        calls,
    }
}

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('cluster:expand')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents).toContain('click')
    // The interaction only makes sense on the layer type that emits clusters.
    expect(manifest.applicableLayerTypes).toEqual(['clusteredvector'])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('use() tolerates an event with no feature @unit', () => {
    const { ctx } = fakeCtx(null, null)
    ClusterExpand.use(ctx)
    expect(ctx.stop).toBe(false)
})

test('a single-point feature is left to the rest of the pipeline @unit', () => {
    const { ctx, calls } = fakeCtx(clusterFeature(1, [0, 0, 0, 0]), null)
    ClusterExpand.use(ctx)
    expect(calls).toEqual([])
    expect(ctx.stop).toBe(false)
})

test('a cluster zooms to its bounds and halts the pipeline @unit', () => {
    const { ctx, calls } = fakeCtx(clusterFeature(12, [1, 2, 3, 4]), null)
    ClusterExpand.use(ctx)
    expect(calls[0][0]).toEqual([
        [2, 1],
        [4, 3],
    ])
    expect(ctx.stop).toBe(true)
    expect(ctx.state.clusterExpand.count).toBe(12)
})

test('a zero-area cluster is padded so fitBounds still zooms @unit', () => {
    const { ctx, calls } = fakeCtx(clusterFeature(3, [5, 5, 5, 5]), {
        padDegrees: 0.01,
    })
    ClusterExpand.use(ctx)
    const [[sLat, wLng], [nLat, eLng]] = calls[0][0]
    expect(nLat).toBeGreaterThan(sLat)
    expect(eLng).toBeGreaterThan(wLng)
})

test('list mode publishes the members instead of zooming @unit', () => {
    const members = [{ type: 'Feature' }, { type: 'Feature' }]
    const { ctx, calls } = fakeCtx(clusterFeature(2, [0, 0, 1, 1], members), {
        mode: 'list',
    })
    ClusterExpand.use(ctx)
    expect(calls).toEqual([])
    expect(ctx.layerData._clusterExpanded).toHaveLength(2)
})

test('planFor honours a configured minimum count @unit', () => {
    expect(planFor(clusterFeature(5, [0, 0, 1, 1]), { minCount: 10 }).action).toBe(
        'none'
    )
})
