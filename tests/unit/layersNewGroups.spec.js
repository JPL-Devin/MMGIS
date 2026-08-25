import { test, expect } from '@playwright/test'

const {
    getHeaderDescendants,
    groupTogglePlan,
} = require('../../plugins/core/tools/LayersNew/groups')

test('group toggle remembers and restores only previously visible layers', () => {
    const rows = [
        { name: 'group', depth: 0, structural: true },
        { name: 'one', depth: 1, structural: false },
        { name: 'two', depth: 1, structural: false },
        { name: 'outside', depth: 0, structural: false },
    ]
    expect(getHeaderDescendants(rows, 'group').map((row) => row.name)).toEqual([
        'one',
        'two',
    ])
    const off = groupTogglePlan(
        rows,
        'group',
        [],
        { one: true, two: false }
    )
    expect(off).toEqual({
        names: ['one'],
        memory: ['one'],
        turningOn: false,
    })
    expect(
        groupTogglePlan(rows, 'group', off.memory, { one: false, two: false })
    ).toEqual({
        names: ['one'],
        memory: ['one'],
        turningOn: true,
    })
})
