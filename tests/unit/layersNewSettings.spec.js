import { test, expect } from '@playwright/test'

const { createTimeAdapter } = require('../../plugins/core/tools/LayersNew/adapters/timeAdapter')
const {
    createLayerSettingsApi,
} = require('../../plugins/core/tools/LayersNew/hooks/useLayerSettings')
const {
    moveRows,
    replayOrderingHistory,
    orderedLeafNames,
} = require('../../plugins/core/tools/LayersNew/ordering')
const {
    getSettingsPresentation,
} = require('../../plugins/core/tools/LayersNew/components/settingsPresentation')
const {
    handleSettingsDrawerKeyDown,
} = require('../../plugins/core/tools/LayersNew/components/Settings/SettingsDrawer')

test.describe('LayersNew settings', () => {
    test('switches to a page on mobile or narrow panels', () => {
        expect(getSettingsPresentation(false, false)).toBe('drawer')
        expect(getSettingsPresentation(true, false)).toBe('page')
        expect(getSettingsPresentation(false, true)).toBe('page')
    })

    test('closes on Escape and traps focus at the drawer edges', () => {
        const first = { focus: () => {} }
        const last = { focus: () => {} }
        const drawer = {
            querySelectorAll: () => [first, last],
        }
        const closeCalls = []
        const escape = {
            key: 'Escape',
            shiftKey: false,
            preventDefault: () => {},
        }
        handleSettingsDrawerKeyDown(escape, drawer, () =>
            closeCalls.push('escape')
        )
        expect(closeCalls).toEqual(['escape'])
        let prevented = false
        handleSettingsDrawerKeyDown(
            {
                key: 'Tab',
                shiftKey: true,
                preventDefault: () => {
                    prevented = true
                },
            },
            drawer,
            () => {},
            first
        )
        expect(prevented).toBe(true)
    })

    test('preserves the time extent notifications', () => {
        const calls = []
        const adapter = createTimeAdapter({
            timeUI: {
                updateTimes: (...args) => calls.push(['times', ...args]),
            },
            toast: {
                info: (...args) => calls.push(['info', ...args]),
                error: (...args) => calls.push(['error', ...args]),
            },
        })
        expect(
            adapter.setGlobalFromExtent({
                time: {
                    dataStartTime: '2024-01-01',
                    dataEndTime: '2024-01-02',
                },
            })
        ).toBe(true)
        expect(calls).toEqual([
            ['times', 1704067200000, 1704153600000, 1704153600000],
            ['info', 'Global time set to layer extent.', 3000],
        ])
        expect(adapter.setGlobalFromExtent({ time: {} })).toBe(false)
        expect(calls[2]).toEqual([
            'error',
            'Layer data extent not configured!',
            3000,
        ])
    })

    test('exposes the settings api through adapters', async () => {
        const calls = []
        const layer = {
            name: 'a',
            type: 'vector',
            variables: { value: 1 },
        }
        const layers = {
            getLayerState: () => ({ on: false, opacity: 0.5 }),
            toggleLayer: () => calls.push('toggle'),
            setOpacity: (...args) => calls.push(['opacity', ...args]),
            set: (...args) => calls.push(['set', ...args]),
            restyle: () => calls.push('restyle'),
            refreshLayer: (...args) => calls.push(['refresh', ...args]),
            resetSettings: (...args) => calls.push(['reset', ...args]),
            notify: (...args) => calls.push(['notify', ...args]),
            getLayerRuntime: () => ({ runtime: true }),
            globe: () => ({ globe: true }),
        }
        const api = createLayerSettingsApi(layer, 'a', {
            layers,
            legend: { refresh: (...args) => calls.push(['legend', ...args]) },
        })
        expect(api.get('variables.value')).toBe(1)
        api.set('variables.value', 2)
        expect(api.isOn()).toBe(false)
        await api.ensureOn()
        api.setOpacity(0.7)
        api.refreshLayer()
        api.refreshLegend()
        api.resetSettings()
        api.notify('info', 'ok')
        expect(calls).toEqual([
            ['set', 'a', 'variables.value', 2],
            'toggle',
            ['opacity', 'a', 0.7],
            ['refresh', 'a'],
            ['legend', layer],
            ['reset', 'a'],
            ['notify', 'info', 'ok'],
        ])
        expect(api.runtime()).toEqual({ runtime: true })
        expect(api.globe()).toEqual({ globe: true })
        expect(api.vars()).toEqual({ value: 1 })
    })

    test('replays after-header history without serializing depth', () => {
        const rows = [
            { name: 'a', depth: 0, structural: false },
            { name: 'group', depth: 0, structural: true },
            { name: 'b', depth: 1, structural: false },
            { name: 'c', depth: 0, structural: false },
        ]
        const moved = moveRows(rows, 3, 1, 2)
        expect(moved.map((row) => [row.name, row.depth])).toEqual([
            ['a', 0],
            ['c', 0],
            ['group', 0],
            ['b', 1],
        ])
        expect(
            orderedLeafNames(replayOrderingHistory(rows, [[1, 3, 1]]))
        ).toEqual(['a', 'c', 'b'])
    })
})
