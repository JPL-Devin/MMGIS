/**
 * EventTimeline — unit tests of the window selection it renders.
 *
 * The tool module itself imports MMGIS singletons and so cannot be imported in
 * Node; the selection it draws lives in `lib/` and is what is tested here.
 */
import { test, expect } from '@playwright/test'
import { eventsInWindow } from '../../../lib/eventsInWindow.js'
import { eventDurationSec, eventProgress, windowForEvent } from '../../../lib/eventTime.js'

const layer = {
    layerName: 'Events',
    layerObj: { time: { startProp: 'start_time', endProp: 'end_time' } },
    geojson: {
        features: [
            {
                properties: {
                    id: 'b',
                    name: 'Drill',
                    start_time: '2024-01-02T00:00:00Z',
                    end_time: '2024-01-02T01:00:00Z',
                    durationSec: 3600,
                },
            },
            {
                properties: {
                    id: 'a',
                    name: 'Drive',
                    start_time: '2024-01-01T00:00:00Z',
                    end_time: '2024-01-01T00:10:00Z',
                    durationSec: 600,
                },
            },
        ],
    },
}

test('events are selected by window overlap and sorted by start @unit', () => {
    const all = eventsInWindow([layer], '2024-01-01T00:00:00Z', '2024-01-03T00:00:00Z')
    expect(all.map((r) => r.label)).toEqual(['Drive', 'Drill'])

    // A window inside an event's span still contains it.
    const mid = eventsInWindow([layer], '2024-01-02T00:30:00Z', '2024-01-02T00:31:00Z')
    expect(mid.map((r) => r.label)).toEqual(['Drill'])

    const none = eventsInWindow([layer], '2023-01-01T00:00:00Z', '2023-01-02T00:00:00Z')
    expect(none).toEqual([])
})

test('duration, progress and the seek window @unit', () => {
    expect(eventDurationSec('2024-01-01T00:00:00Z', '2024-01-01T00:10:00Z')).toBe(600)
    expect(eventDurationSec('2024-01-01T00:00:00Z', null)).toBe(0)

    expect(
        eventProgress('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z', '2024-01-01T00:30:00Z')
    ).toBeCloseTo(0.5)
    // Before it starts there is nothing to draw.
    expect(
        eventProgress('2024-01-01T00:00:00Z', '2024-01-01T01:00:00Z', '2023-12-31T00:00:00Z')
    ).toBe(null)

    expect(windowForEvent('2024-01-01T00:10:00Z', '2024-01-01T00:20:00Z', 60)).toEqual({
        startTime: '2024-01-01T00:09:00.000Z',
        endTime: '2024-01-01T00:21:00.000Z',
        currentTime: '2024-01-01T00:10:00.000Z',
    })
})
