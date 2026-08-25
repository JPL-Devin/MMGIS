import { test, expect } from '@playwright/test'

const {
    flattenLayerTree,
    filterLayerRows,
    layerHasActiveFilter,
    rowMatchesSearch,
} = require('../../plugins/core/tools/LayersNew/hooks/useLayerTree')
const { orderingHistoryString } = require('../../plugins/core/tools/LayersNew/store')
const {
    canDropRows,
    orderedLeafNames,
    replayOrderingHistory,
} = require('../../plugins/core/tools/LayersNew/ordering')

function adapter(data, filters = {}) {
    return {
        getLayerData: (name) => data[name],
        getLayerState: (name) => ({ on: data[name]?.on === true }),
        isStructural: (type) => type === 'header',
        isFilterable: (name) => data[name]?.type === 'vector',
        getFilters: () => filters,
    }
}

test.describe('LayersNew tree helpers', () => {
    test('flattens nested groups with depth and indentation source data', () => {
        const rows = flattenLayerTree(
            [
                {
                    name: 'group',
                    type: 'header',
                    display_name: 'Group',
                    variables: { expanded: true },
                    sublayers: [
                        { name: 'layer', type: 'vector', display_name: 'Layer' },
                    ],
                },
            ],
            adapter({
                group: { type: 'header' },
                layer: { type: 'vector' },
            })
        )
        expect(rows.map((row) => [row.name, row.depth])).toEqual([
            ['group', 0],
            ['layer', 1],
        ])
        expect(rows[0].defaultExpanded).toBe(true)
    })

    test('matches names, descriptions, and tags', () => {
        const row = {
            name: 'mars_dem',
            displayName: 'Mars elevation',
            description: 'A terrain raster',
            tags: ['terrain', 'science'],
            structural: false,
            type: 'data',
            on: true,
        }
        expect(rowMatchesSearch(row, 'elevation')).toBe(true)
        expect(rowMatchesSearch(row, 'terrain')).toBe(true)
        expect(rowMatchesSearch(row, '#science')).toBe(true)
        expect(rowMatchesSearch(row, '#missing')).toBe(false)
    })

    test('filters types, visibility, and active vector filters', () => {
        const data = {
            group: { type: 'header' },
            one: { type: 'vector', on: true, _filterEncoded: { filters: [] } },
            two: { type: 'tile', on: false },
        }
        const rows = flattenLayerTree(
            [
                {
                    name: 'group',
                    type: 'header',
                    sublayers: [
                        { name: 'one', type: 'vector' },
                        { name: 'two', type: 'tile' },
                    ],
                },
            ],
            adapter(data, { one: { values: [{ type: 'equals' }] } })
        )
        const state = {
            search: '',
            typeFilters: ['vector'],
            visibleOnly: true,
            activeFilterOnly: true,
            headerStates: {},
        }
        expect(filterLayerRows(rows, state, adapter(data, {
            one: { values: [{ type: 'equals' }] },
        })).map((row) => row.name)).toEqual(['group', 'one'])
        expect(layerHasActiveFilter('one', adapter(data, {
            one: { values: [{ type: 'equals' }] },
        }))).toBe(true)
    })

    test('replays subtree ordering and rejects descendant drops', () => {
        const rows = [
            { name: 'a', depth: 0, structural: false },
            { name: 'group', depth: 0, structural: true },
            { name: 'b', depth: 1, structural: false },
            { name: 'c', depth: 0, structural: false },
        ]
        expect(canDropRows(rows, 1, 2)).toBe(false)
        const moved = replayOrderingHistory(rows, [[1, 3, 0]])
        expect(orderedLeafNames(moved)).toEqual(['a', 'c', 'b'])
        expect(moved.map((row) => row.name)).toEqual([
            'a',
            'c',
            'group',
            'b',
        ])
    })

    test('round-trips ordering history through the URL format', () => {
        const history = [[1, 3, 0], [0, 2, 1]]
        const encoded = orderingHistoryString(history)
        const decoded = encoded.split('.').map((entry) =>
            entry.split('-').map((value) => Number(value))
        )
        expect(orderedLeafNames(replayOrderingHistory([
            { name: 'a', depth: 0, structural: false },
            { name: 'group', depth: 0, structural: true },
            { name: 'b', depth: 1, structural: false },
            { name: 'c', depth: 0, structural: false },
        ], decoded))).toEqual(['c', 'a', 'b'])
    })
})
