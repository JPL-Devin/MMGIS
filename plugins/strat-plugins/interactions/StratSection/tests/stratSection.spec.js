/**
 * StratSection — unit tests over the pure logic, plus the manifest contract.
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
import { sectionAt } from '../logic.js'
import { parseUnitTable, stackUnits } from '../../../lib/unitTable.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const layerObj = {
    variables: {
        stratColumn: {
            unitTable: '# top first\nShale,#7a6a53,10\nSandstone,#d8c27a,5\n\nBasalt,#333,20',
            markerHorizons: [
                { label: 'Ash A', depth: 8, color: '#f00' },
                { label: 'Ash B', depth: 40, color: '#0f0' },
            ],
        },
    },
}

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('strat:section')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableLayerTypes).toEqual(['stratcolumn'])
    // Every config field must sit inside configPath or the runner never reads it.
    manifest.config.rows.forEach((row) =>
        row.components.forEach((c) =>
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
        )
    )
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the unit table parses and stacks, comments and blanks ignored @unit', () => {
    const units = stackUnits(parseUnitTable(layerObj.variables.stratColumn.unitTable))
    expect(units.map((u) => u.name)).toEqual(['Shale', 'Sandstone', 'Basalt'])
    expect(units.map((u) => [u.top, u.base])).toEqual([
        [0, 10],
        [10, 15],
        [15, 35],
    ])
})

test('an event with no feature decides nothing @unit', () => {
    expect(sectionAt(null, null, layerObj)).toBe(null)
})

test('a section is clipped to the outcrop depth @unit', () => {
    const feature = { properties: { measured_depth_m: 12 } }
    const section = sectionAt(feature, null, layerObj)
    expect(section.depthMetres).toBe(12)
    expect(section.units.map((u) => [u.name, u.base])).toEqual([
        ['Shale', 10],
        ['Sandstone', 12],
    ])
    expect(section.markers.map((m) => m.label)).toEqual(['Ash A'])
})

test("the admin's depth unit converts, and markers can be switched off @unit", () => {
    const feature = { properties: { depth_ft: 100 } }
    const section = sectionAt(
        feature,
        { depthProp: 'depth_ft', depthUnit: 'ft', includeMarkers: false },
        layerObj
    )
    expect(Math.round(section.depthMetres)).toBe(30)
    expect(section.markers).toEqual([])
})

test('an unconfigured layer yields nothing rather than throwing @unit', () => {
    expect(sectionAt({ properties: {} }, null, {})).toBe(null)
})
