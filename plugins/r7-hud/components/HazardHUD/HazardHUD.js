import L_ from '@basics/Layers_/Layers_'

import {
    HAZARD_EVENT,
    HAZARD_TYPE_ID,
    SEVERITY_COLORS,
    readout,
} from '../../lib/hazard'

import './HazardHUD.css'

const SUB_ID = 'r7-hud-HazardHUD'

const HazardHUD = {
    state: { zones: [], report: null },
    el: null,

    init: function (vars) {
        const { corner = 'bottom-right', bottom = 40 } = vars || {}

        const el = document.createElement('div')
        el.className = `hazardHUD hazardHUD-${corner}`
        el.style.bottom = `${bottom}px`
        // 1600 is the band OperationsClock uses: above #bottomFloatingBar
        // (1500) and below the toolbar and its panel (2006).
        el.style.zIndex = 1600
        el.innerHTML =
            '<div class="hazardHUD-title">HAZARD HUD</div>' +
            '<div class="hazardHUD-zones"></div>' +
            '<div class="hazardHUD-status"></div>'
        document.body.appendChild(el)
        HazardHUD.el = el

        HazardHUD._refreshZones()
        HazardHUD._render()

        // A layer was toggled → recount the hazardzone layers that are on.
        L_.subscribeOnLayerToggle(SUB_ID, () => {
            HazardHUD._refreshZones()
            HazardHUD._render()
        })

        // The only channel from an interaction to a component: a namespaced
        // CustomEvent on `document`. Core defines nothing here.
        document.addEventListener(HAZARD_EVENT, HazardHUD._onHazard)

        // A component has no `destroy`, so this listener is owned for the life
        // of the page — deliberate, not a leak.
        window.addEventListener('resize', HazardHUD._render)
    },

    _onHazard: function (e) {
        HazardHUD.state.report = e.detail
        HazardHUD._render()
    },

    _refreshZones: function () {
        // `L_.layers.data` is the config of every layer and is documented as
        // safe to read. Whether one is *on* is not in the components README's
        // subscription table — there is no accessor, so this reads the
        // `layers.on` map directly (Layers_.js:38, "toggledArray").
        const data = (L_ && L_.layers && L_.layers.data) || {}
        const on = (L_ && L_.layers && L_.layers.on) || {}
        HazardHUD.state.zones = Object.keys(data).filter(
            (name) => data[name].type === HAZARD_TYPE_ID && on[name] === true
        )
    },

    _render: function () {
        const el = HazardHUD.el
        if (!el) return
        const r = readout(HazardHUD.state)
        el.querySelector('.hazardHUD-zones').textContent = r.zones
        const status = el.querySelector('.hazardHUD-status')
        status.textContent = r.status
        status.style.color = SEVERITY_COLORS[r.severity]
        el.style.borderColor = SEVERITY_COLORS[r.severity]
    },
}

export default HazardHUD
