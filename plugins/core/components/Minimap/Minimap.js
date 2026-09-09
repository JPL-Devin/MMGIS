/**
 * Minimap - Small overview inset map that mirrors the main map's base tiles,
 * shows the current viewport as a draggable rectangle and recenters on click.
 */
/* global L */
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

import './Minimap.css'

const Minimap = {
    state: {
        map: null,
        rect: null,
        container: null,
        collapsed: false,
        syncing: false,
        tileLayer: null,
        toggleSubId: 'minimap',
    },
    config: {
        enabled: true,
        corner: 'bottomright',
        zoomOffset: 5,
        width: 200,
        height: 150,
        startCollapsed: false,
    },

    init: function (vars) {
        const v = vars || {}
        this.config.enabled = v.enabled !== false
        this.config.corner = v.corner || 'bottomright'
        this.config.zoomOffset = parseInt(v.zoomOffset ?? 5)
        this.config.width = parseInt(v.width ?? 200)
        this.config.height = parseInt(v.height ?? 150)
        this.config.startCollapsed = v.startCollapsed === true

        if (!this.config.enabled || !Map_.map) return

        this.createUI()
        this.createMap()
        this.attachMainMapEvents()
        this.syncBaseLayer()
        this.update()

        if (L_.subscribeOnLayerToggle)
            L_.subscribeOnLayerToggle(this.state.toggleSubId, () =>
                this.syncBaseLayer()
            )
    },

    createUI: function () {
        const c = document.createElement('div')
        c.id = 'mmgisMinimap'
        c.className = `mmgisMinimap ${this.config.corner}`
        c.style.width = `${this.config.width}px`
        c.style.height = `${this.config.height}px`
        c.innerHTML =
            '<div id="mmgisMinimapMap"></div>' +
            '<div id="mmgisMinimapToggle" title="Toggle Minimap">' +
            '<i class="mdi mdi-map-outline mdi-18px"></i></div>'
        document.body.appendChild(c)
        this.state.container = c

        c.querySelector('#mmgisMinimapToggle').addEventListener('click', () =>
            this.toggle()
        )
        if (this.config.startCollapsed) this.toggle()
    },

    createMap: function () {
        const main = Map_.map
        const mini = L.map('mmgisMinimapMap', {
            crs: main.options.crs,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            touchZoom: false,
            keyboard: false,
            zoomSnap: 0,
            fadeAnimation: false,
            zoomAnimation: false,
        })
        mini.setView(main.getCenter(), this.miniZoom())

        this.state.rect = L.rectangle(main.getBounds(), {
            color: '#ffb400',
            weight: 2,
            fillColor: '#ffb400',
            fillOpacity: 0.15,
            interactive: true,
        }).addTo(mini)

        mini.on('click', (e) => {
            if (this.state.dragging) return
            main.panTo(e.latlng)
        })
        this.enableRectDrag(mini)

        this.state.map = mini
    },

    // Manual drag of the viewport rectangle; pans the main map on release.
    enableRectDrag: function (mini) {
        const rect = this.state.rect
        let startLatLng = null
        let startBounds = null

        const onMove = (e) => {
            if (!startLatLng) return
            const dLat = e.latlng.lat - startLatLng.lat
            const dLng = e.latlng.lng - startLatLng.lng
            const sw = startBounds.getSouthWest()
            const ne = startBounds.getNorthEast()
            rect.setBounds([
                [sw.lat + dLat, sw.lng + dLng],
                [ne.lat + dLat, ne.lng + dLng],
            ])
        }
        const onUp = () => {
            if (!startLatLng) return
            startLatLng = null
            mini.off('mousemove', onMove)
            mini.off('mouseup', onUp)
            L.DomEvent.off(document, 'mouseup', onUp)
            Map_.map.panTo(rect.getBounds().getCenter())
            // Delay so the click that follows mouseup doesn't recenter again
            setTimeout(() => (this.state.dragging = false), 50)
        }
        rect.on('mousedown', (e) => {
            L.DomEvent.stop(e)
            this.state.dragging = true
            startLatLng = e.latlng
            startBounds = rect.getBounds()
            mini.on('mousemove', onMove)
            mini.on('mouseup', onUp)
            L.DomEvent.on(document, 'mouseup', onUp)
        })
    },

    attachMainMapEvents: function () {
        Map_.map.on('move zoom moveend zoomend', () => this.update())
    },

    miniZoom: function () {
        const z = Map_.map.getZoom() - this.config.zoomOffset
        const minZ = Map_.map.getMinZoom() ?? 0
        return Math.max(z, Number.isFinite(minZ) ? minZ : 0)
    },

    update: function () {
        const { map: mini, rect } = this.state
        if (!mini || this.state.collapsed) return
        const main = Map_.map
        rect.setBounds(main.getBounds())
        mini.setView(main.getCenter(), this.miniZoom(), { animate: false })
    },

    // Mirror the topmost visible tile layer of the main map into the minimap.
    syncBaseLayer: function () {
        const mini = this.state.map
        if (!mini) return
        const base = this.findBaseTileLayer()
        if (!base) return
        if (this.state.tileLayer && this.state.tileLayer._url === base._url)
            return
        if (this.state.tileLayer) mini.removeLayer(this.state.tileLayer)
        const opts = Object.assign({}, base.options, {
            pane: 'tilePane',
            opacity: 1,
        })
        this.state.tileLayer = L.tileLayer(base._url, opts).addTo(mini)
        this.state.rect.bringToFront()
    },

    findBaseTileLayer: function () {
        const ordered = L_._layersOrdered || []
        for (let i = ordered.length - 1; i >= 0; i--) {
            const name = ordered[i]
            const layer = L_.layers.layer[name]
            const data = L_.layers.data[name]
            if (
                L_.layers.on[name] &&
                data &&
                data.type === 'tile' &&
                layer &&
                layer._url
            )
                return layer
        }
        return null
    },

    toggle: function () {
        this.state.collapsed = !this.state.collapsed
        this.state.container.classList.toggle('collapsed', this.state.collapsed)
        if (!this.state.collapsed && this.state.map) {
            // Wait for the CSS size transition before re-measuring the map
            this.state.container.addEventListener(
                'transitionend',
                () => {
                    this.state.map.invalidateSize()
                    this.update()
                },
                { once: true }
            )
        }
    },
}

export default Minimap
