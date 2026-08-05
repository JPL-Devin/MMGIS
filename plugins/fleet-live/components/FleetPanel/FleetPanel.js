import { getFleet, FLEET_PROPS, HEALTH_COLORS } from '../../lib/fleetApi'

import './FleetPanel.css'

const FleetPanel = {
    state: {
        el: null,
        interval: null,
        onChanged: null,
    },

    init: function (vars) {
        const refreshSeconds = vars?.refreshSeconds ?? 30

        const el = document.createElement('div')
        el.className = 'fleetPanel'
        el.innerHTML = `<div class='fleetPanelTitle'>Fleet</div><ul class='fleetPanelList'></ul>`
        document.body.appendChild(el)
        FleetPanel.state.el = el

        FleetPanel.refresh()
        FleetPanel.state.interval = setInterval(
            FleetPanel.refresh,
            refreshSeconds * 1000
        )
        // The interaction has no way to tell a component anything, so it
        // broadcasts a window event and we listen for it.
        FleetPanel.state.onChanged = () => FleetPanel.refresh()
        window.addEventListener(
            'fleet-live:changed',
            FleetPanel.state.onChanged
        )
    },

    refresh: async function () {
        const el = FleetPanel.state.el
        if (el == null) return
        let geojson = null
        try {
            geojson = await getFleet()
        } catch (err) {
            return
        }
        const list = el.querySelector('.fleetPanelList')
        if (list == null) return
        list.innerHTML = (geojson?.features || [])
            .map((f) => {
                const p = f.properties || {}
                const health = p[FLEET_PROPS.health]
                const color = HEALTH_COLORS[health] || '#888888'
                const battery =
                    p[FLEET_PROPS.battery] == null
                        ? '—'
                        : `${Math.round(p[FLEET_PROPS.battery])}%`
                const note = p[FLEET_PROPS.note]
                return `<li class='fleetPanelRover'>
                    <span class='fleetPanelDot' style='background:${color}'></span>
                    <span class='fleetPanelName'>${p[FLEET_PROPS.id]}</span>
                    <span class='fleetPanelBattery'>${battery}</span>
                    ${note ? `<span class='fleetPanelNote' title='${note}'>note</span>` : ''}
                </li>`
            })
            .join('')
    },

    destroy: function () {
        if (FleetPanel.state.interval) clearInterval(FleetPanel.state.interval)
        if (FleetPanel.state.onChanged)
            window.removeEventListener(
                'fleet-live:changed',
                FleetPanel.state.onChanged
            )
        FleetPanel.state.el?.remove()
        FleetPanel.state.el = null
    },
}

export default FleetPanel
