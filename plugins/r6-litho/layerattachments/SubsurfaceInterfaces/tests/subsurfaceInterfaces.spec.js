/**
 * SubsurfaceInterfaces attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import SubsurfaceInterfaces, {
    depthColor,
    interfacesOf,
} from '../subsurfaceInterfaces.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('subsurface_interfaces')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.subsurfaceInterfaces')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof SubsurfaceInterfaces.make).toBe('function')
})

test('only hosts of the type that ships it @unit', () => {
    // The layer type declares this attachment in its defaultAttachments; that
    // is silently ignored if the type is not listed here.
    expect(manifest.applicableLayerTypes).toEqual(['radargram'])
})

const track = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [0, 0],
            [1, 1],
            [2, 2],
        ],
    },
    properties: {
        interfaces: [
            { traceIndex: 0, depth_m: 120 },
            { traceIndex: 2, depth_m: 900 },
            { traceIndex: 1 },
        ],
    },
}

const opts = {
    interfacesProp: 'interfaces',
    depthProp: 'depth_m',
    traceProp: 'traceIndex',
    maxDepthMeters: 3000,
    radius: 4,
}

test('interfaces are placed on the trace vertex they were detected in @unit', () => {
    const points = interfacesOf(track, opts)
    // The entry with no depth is dropped rather than drawn at 0 m.
    expect(points).toEqual([
        { lng: 0, lat: 0, depth: 120 },
        { lng: 2, lat: 2, depth: 900 },
    ])
})

test('a host with no interfaces property draws nothing @unit', () => {
    expect(interfacesOf({ geometry: track.geometry, properties: {} }, opts))
        .toEqual([])
    expect(interfacesOf(null, opts)).toEqual([])
})

test('depth colours saturate at the declared depth range @unit', () => {
    expect(depthColor(0, 3000)).toBe('rgb(255,220,120)')
    expect(depthColor(3000, 3000)).toBe('rgb(195,20,10)')
    expect(depthColor(9999, 3000)).toBe('rgb(195,20,10)')
})
