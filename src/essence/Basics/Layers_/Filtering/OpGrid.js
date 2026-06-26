/**
 * OpGrid – Compact 4×3 grid operator selector for LayersTool Filtering.
 * Replaces the Dropy dropdown with an inline grid popup.
 */
import $ from 'jquery'
import './OpGrid.css'

const OPERATORS = [
    { key: '=',          icon: `<i class='mdi mdi-equal mdi-14px'></i>`,         label: 'Equals' },
    { key: '!=',         icon: `<span>!=</span>`,                                label: 'Not Equals' },
    { key: '<',          icon: `<i class='mdi mdi-less-than mdi-14px'></i>`,     label: 'Less Than' },
    { key: '>',          icon: `<i class='mdi mdi-greater-than mdi-14px'></i>`,  label: 'Greater Than' },
    { key: '<=',         icon: `<i class='mdi mdi-less-than-or-equal mdi-14px'></i>`,  label: 'Less Than or Equal' },
    { key: '>=',         icon: `<i class='mdi mdi-greater-than-or-equal mdi-14px'></i>`, label: 'Greater Than or Equal' },
    { key: ',',          icon: `<span>in</span>`,                                label: 'Comma-separated List' },
    { key: 'contains',   icon: `<i class='mdi mdi-contain mdi-14px'></i>`,       label: 'Contains' },
    { key: 'beginswith', icon: `<i class='mdi mdi-contain-start mdi-14px'></i>`, label: 'Begins With' },
    { key: 'endswith',   icon: `<i class='mdi mdi-contain-end mdi-14px'></i>`,   label: 'Ends With' },
    { key: 'isnull',     icon: `<span>∅</span>`,                                 label: 'Is Null' },
    { key: 'isnotnull',  icon: `<span>∅̸</span>`,                                label: 'Is Not Null' },
]

const OpGrid = {
    /**
     * Build the trigger + grid markup.
     * @param {string} selectedOp – initial operator key (e.g. '=')
     * @returns {string} HTML string
     */
    construct(selectedOp) {
        const selIdx = Math.max(OPERATORS.findIndex(o => o.key === selectedOp), 0)
        const selected = OPERATORS[selIdx]

        const cells = OPERATORS.map((op, i) =>
            `<div class="opGrid_cell${i === selIdx ? ' opGrid_active' : ''}" data-op="${op.key}" title="${op.label}">${op.icon}</div>`
        ).join('')

        // prettier-ignore
        return [
            `<div class="opGrid">`,
                `<div class="opGrid_trigger" title="${selected.label}">${selected.icon}</div>`,
                `<div class="opGrid_popup">`,
                    `<div class="opGrid_grid">${cells}</div>`,
                `</div>`,
            `</div>`,
        ].join('')
    },

    /**
     * Attach events to an already-rendered OpGrid inside `containerElm`.
     * @param {jQuery} containerElm – jQuery element wrapping the opGrid
     * @param {function} onChange – callback(opKey) when selection changes
     */
    init(containerElm, onChange) {
        const $grid = containerElm.find('.opGrid')
        const $trigger = $grid.find('.opGrid_trigger')
        const $popup = $grid.find('.opGrid_popup')

        // Toggle popup
        $trigger.on('click', function (e) {
            e.stopPropagation()
            // Close any other open grids first
            $('.opGrid_popup.opGrid_open').not($popup).removeClass('opGrid_open')
            $popup.toggleClass('opGrid_open')
        })

        // Cell click
        $grid.find('.opGrid_cell').on('click', function (e) {
            e.stopPropagation()
            const opKey = $(this).attr('data-op')
            const op = OPERATORS.find(o => o.key === opKey)
            if (!op) return

            // Update active state
            $grid.find('.opGrid_cell').removeClass('opGrid_active')
            $(this).addClass('opGrid_active')

            // Update trigger
            $trigger.html(op.icon).attr('title', op.label)

            // Close popup
            $popup.removeClass('opGrid_open')

            if (typeof onChange === 'function') onChange(opKey)
        })

        // Close on outside click
        $(document).on('click.opGrid', function (e) {
            if (!$(e.target).closest('.opGrid').length) {
                $('.opGrid_popup.opGrid_open').removeClass('opGrid_open')
            }
        })
    },

    /** Return the ordered list of operator keys (for external reference). */
    getOperators() {
        return OPERATORS.map(o => o.key)
    },
}

export default OpGrid
