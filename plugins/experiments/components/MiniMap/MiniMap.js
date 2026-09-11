import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'

import './MiniMap.css'

const MiniMap = {
    state: {
        miniMap: null,
        rect: null,
        tile: null,
        collapsed: false,
        dragging: false,
    },
    config: {
        width: 200,
        height: 150,
        zoomOffset: 4,
        position: 'bottom-right',
        startCollapsed: false,
    },

    init: function (vars) {
        Object.assign(this.config, vars || {})
        if (!Map_.map) return
        this.build()
        this.attachTileLayer()
        this.setupInteractions()
        this.sync()
        Map_.map.on('move zoom', () => this.sync())
        L_.subscribeOnLayerToggle('MiniMap', () => this.attachTileLayer())
        // Layers are made asynchronously after components init; poll until a basemap exists.
        const poll = setInterval(() => {
            this.attachTileLayer()
            if (this.state.tile) clearInterval(poll)
        }, 500)
    },

    build: function () {
        const c = this.config
        const wrap = document.createElement('div')
        wrap.id = 'MiniMap'
        wrap.className = `minimap-${c.position}`
        wrap.innerHTML = `
            <div id="MiniMapMap" style="width:${c.width}px;height:${c.height}px;"></div>
            <div id="MiniMapToggle" title="Toggle minimap">
                <i class="mdi mdi-chevron-down-right mdi-18px"></i>
            </div>`
        document.getElementById('map').appendChild(wrap)

        this.state.miniMap = L.map('MiniMapMap', {
            crs: Map_.map.options.crs,
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
            zoomSnap: 0,
        })

        this.state.rect = L.rectangle(Map_.map.getBounds(), {
            color: '#fff',
            weight: 2,
            fillColor: '#08f',
            fillOpacity: 0.25,
            interactive: true,
            bubblingMouseEvents: false,
        }).addTo(this.state.miniMap)

        document
            .getElementById('MiniMapToggle')
            .addEventListener('click', () => this.toggle())
        if (c.startCollapsed) this.toggle()
    },

    // Mirror the topmost visible tile layer of the main map.
    attachTileLayer: function () {
        const s = this.state
        const ordered = L_._layersOrdered || []
        let source = null
        for (let i = 0; i < ordered.length; i++) {
            const name = ordered[i]
            const data = L_.layers.data[name]
            const layer = L_.layers.layer[name]
            if (
                data &&
                data.type === 'tile' &&
                layer &&
                Map_.map.hasLayer(layer) &&
                layer._url
            ) {
                source = layer
                break
            }
        }
        if (source && source === s.source) {
            this.syncTileOptions()
            return
        }
        if (s.tile) {
            s.miniMap.removeLayer(s.tile)
            s.tile = null
        }
        s.source = source
        if (!source) return
        // Same layer class/options as the main map so WMS/STAC/COG/time requests match.
        s.tile = L.tileLayer
            .colorFilter(source._url, { ...source.options, minZoom: 0 })
            .addTo(s.miniMap)
        s.tile.bringToBack()
    },

    // Time params are stamped onto the live source layer in place; mirror them.
    syncTileOptions: function () {
        const s = this.state
        let changed = false
        for (const k of ['time', 'starttime', 'endtime']) {
            if (s.tile.options[k] !== s.source.options[k]) {
                s.tile.options[k] = s.source.options[k]
                changed = true
            }
        }
        if (changed) s.tile.redraw()
    },

    setupInteractions: function () {
        const s = this.state
        const mini = s.miniMap
        const map = Map_.map

        mini.on('click', (e) => {
            if (!s.dragging) map.panTo(e.latlng)
        })

        let dragOffset = null
        s.rect.on('mousedown', (e) => {
            s.dragging = true
            const c = map.getCenter()
            dragOffset = [c.lat - e.latlng.lat, c.lng - e.latlng.lng]
            L.DomEvent.stop(e)
            const el = document.getElementById('MiniMapMap')
            el.classList.add('minimap-grabbing')
            const move = (ev) => {
                const ll = mini.mouseEventToLatLng(ev)
                map.panTo([ll.lat + dragOffset[0], ll.lng + dragOffset[1]], {
                    animate: false,
                })
            }
            const up = () => {
                document.removeEventListener('mousemove', move)
                document.removeEventListener('mouseup', up)
                el.classList.remove('minimap-grabbing')
                setTimeout(() => (s.dragging = false), 0)
            }
            document.addEventListener('mousemove', move)
            document.addEventListener('mouseup', up)
        })
    },

    sync: function () {
        const s = this.state
        if (!s.miniMap || s.collapsed) return
        const map = Map_.map
        this.attachTileLayer()
        s.rect.setBounds(map.getBounds())
        const z = Math.max(0, map.getZoom() - this.config.zoomOffset)
        s.miniMap.setView(map.getCenter(), z, { animate: false })
    },

    toggle: function () {
        const s = this.state
        s.collapsed = !s.collapsed
        document
            .getElementById('MiniMap')
            .classList.toggle('minimap-collapsed', s.collapsed)
        if (!s.collapsed) {
            s.miniMap.invalidateSize()
            this.sync()
        }
    },
}

export default MiniMap
