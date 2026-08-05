import React from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import { IconButton } from '@design/components'

import { extentOf, polylinePoints, colorFor } from './plot'
import './SpectraTool.css'

const BOX = {
    width: 300,
    height: 200,
    padLeft: 38,
    padRight: 8,
    padTop: 8,
    padBottom: 24,
}

function SpectraPlot({ selections }) {
    const extent = extentOf(selections)
    if (extent == null)
        return (
            <div className='spectraTool_empty'>
                Click a point on a SpectraPoints layer to compare its spectrum.
            </div>
        )
    const units = selections[0]?.units || 'nm'
    return (
        <div>
            <svg
                className='spectraTool_plot'
                viewBox={`0 0 ${BOX.width} ${BOX.height}`}
                width='100%'
            >
                <rect
                    x={BOX.padLeft}
                    y={BOX.padTop}
                    width={BOX.width - BOX.padLeft - BOX.padRight}
                    height={BOX.height - BOX.padTop - BOX.padBottom}
                    fill='none'
                    stroke='var(--color-c)'
                />
                {selections.map((s, i) => (
                    <polyline
                        key={s.id}
                        points={polylinePoints(s, extent, BOX)}
                        fill='none'
                        stroke={colorFor(i)}
                        strokeWidth='1.5'
                    />
                ))}
                <text x={BOX.padLeft} y={BOX.height - 6} fontSize='9'>
                    {`${Math.round(extent.minX)} ${units}`}
                </text>
                <text
                    x={BOX.width - BOX.padRight}
                    y={BOX.height - 6}
                    fontSize='9'
                    textAnchor='end'
                >
                    {`${Math.round(extent.maxX)} ${units}`}
                </text>
                <text x='2' y={BOX.padTop + 8} fontSize='9'>
                    {extent.maxY.toFixed(2)}
                </text>
                <text x='2' y={BOX.height - BOX.padBottom} fontSize='9'>
                    {extent.minY.toFixed(2)}
                </text>
            </svg>
            <ul className='spectraTool_legend'>
                {selections.map((s, i) => (
                    <li key={s.id}>
                        <span
                            className='spectraTool_swatch'
                            style={{ background: colorFor(i) }}
                        />
                        <span className='spectraTool_label'>{s.label}</span>
                        <IconButton
                            size='sm'
                            title='Remove'
                            onClick={() => SpectraTool.removeSelection(s.id)}
                        >
                            <i className='mdi mdi-close mdi-18px' />
                        </IconButton>
                    </li>
                ))}
            </ul>
        </div>
    )
}

let SpectraTool = {
    height: 0,
    width: 340,
    made: false,
    _root: null,
    // The comparison set lives on the tool module, which is statically imported
    // and therefore alive whether or not the panel is open. This is what the
    // SpectraSelect interaction writes into.
    selections: [],

    /**
     * Called by the SpectraSelect interaction. Re-clicking a selected point
     * removes it; past `max` the oldest is dropped.
     */
    addSelection: function (selection, max = 4) {
        if (selection == null) return
        const existing = SpectraTool.selections.filter(
            (s) => s.id !== selection.id
        )
        if (existing.length !== SpectraTool.selections.length) {
            SpectraTool.selections = existing
        } else {
            const out = [...existing, selection]
            SpectraTool.selections = out.slice(Math.max(0, out.length - max))
        }
        SpectraTool._render()
    },

    removeSelection: function (id) {
        SpectraTool.selections = SpectraTool.selections.filter(
            (s) => s.id !== id
        )
        SpectraTool._render()
    },

    clearSelections: function () {
        SpectraTool.selections = []
        SpectraTool._render()
    },

    _render: function () {
        if (SpectraTool._root == null) return
        SpectraTool._root.render(
            <div className='spectraTool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>Spectra</div>
                        </div>
                        <div>
                            <IconButton
                                size='sm'
                                onClick={() => SpectraTool.clearSelections()}
                                title='Clear Selections'
                            >
                                <i className='mdi mdi-delete-outline mdi-18px' />
                            </IconButton>
                            <IconButton
                                size='sm'
                                onClick={() =>
                                    ToolController_.closeActiveTool()
                                }
                                title='Close Tool'
                            >
                                <i className='mdi mdi-close mdi-18px' />
                            </IconButton>
                        </div>
                    </div>
                </div>
                <div className='spectraTool_content'>
                    <SpectraPlot selections={SpectraTool.selections} />
                </div>
            </div>
        )
    },

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        SpectraTool._root = createRoot(toolPanel)
        SpectraTool.made = true
        SpectraTool._render()
    },

    destroy: function () {
        if (SpectraTool._root) {
            SpectraTool._root.unmount()
            SpectraTool._root = null
        }
        SpectraTool.made = false
        // The selections deliberately survive a close/open of the panel.
    },
}

export default SpectraTool
