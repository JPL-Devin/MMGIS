import $ from 'jquery'
import L_ from '../Layers_/Layers_'
import './MiniMap.css'

// Overview/inset map in a corner of the main 2D map.
// Enabled and configured via configData.look.minimap (bool or options object).
const MiniMap = {
    map: null,
    mainMap: null,
    rect: null,
    tileLayer: null,
    options: null,
    _syncing: false,
    _collapsed: false,
    _dragging: false,
    defaults: {
        width: 200,
        height: 150,
        zoomOffset: -4,
        position: 'bottomright',
        collapsed: false,
    },
    init: function (mainMap, config) {
        this.destroy()
        if (config == null || config === false) return
        this.mainMap = mainMap
        this.options = Object.assign(
            {},
            this.defaults,
            typeof config === 'object' ? config : {}
        )
        this.options.zoomOffset = parseInt(this.options.zoomOffset)
        if (isNaN(this.options.zoomOffset)) this.options.zoomOffset = -4
        this._collapsed = this.options.collapsed === true

        this._buildDom()

        this.map = L.map('mmgisMiniMap', {
            attributionControl: false,
            zoomControl: false,
            crs: mainMap.options.crs,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
            zoomSnap: 0,
            zoomAnimation: false,
            fadeAnimation: false,
        })

        this.refreshTileLayer()

        this.rect = L.rectangle(mainMap.getBounds(), {
            color: '#fff',
            weight: 2,
            fillColor: '#08f',
            fillOpacity: 0.2,
            interactive: true,
        }).addTo(this.map)

        this._attachEvents()
        this.sync()
    },
    _buildDom: function () {
        const o = this.options
        const pos = ['topleft', 'topright', 'bottomleft', 'bottomright'].includes(
            o.position
        )
            ? o.position
            : 'bottomright'
        const c = $(
            `<div id='mmgisMiniMapContainer' class='mmgis-minimap-${pos}${
                this._collapsed ? ' collapsed' : ''
            }'>` +
                `<div id='mmgisMiniMapToggle' title='Toggle MiniMap'><i class='mdi mdi-map-outline mdi-18px'></i></div>` +
                `<div id='mmgisMiniMap'></div>` +
                `</div>`
        )
        c.find('#mmgisMiniMap').css({
            width: parseInt(o.width) + 'px',
            height: parseInt(o.height) + 'px',
        })
        $('#map').append(c)
        c.find('#mmgisMiniMapToggle').on('click', () => this.toggle())
    },
    // Mirror the topmost visible tile layer from the main map
    refreshTileLayer: function () {
        if (this.map == null) return
        let source = null
        const ordered = L_._layersOrdered || []
        for (let i = ordered.length - 1; i >= 0; i--) {
            const name = ordered[i]
            const l = L_.layers.layer[name]
            if (
                L_.layers.on[name] === true &&
                l &&
                l._url != null &&
                l instanceof L.TileLayer
            ) {
                source = l
            }
        }
        if (source && this.tileLayer && this.tileLayer._url === source._url)
            return
        if (this.tileLayer) this.map.removeLayer(this.tileLayer)
        this.tileLayer = null
        if (source) {
            this.tileLayer = L.tileLayer(source._url, {
                tms: source.options.tms,
                minZoom: 0,
                maxZoom: source.options.maxZoom,
                maxNativeZoom: source.options.maxNativeZoom,
                bounds: source.options.bounds,
                continuousWorld: true,
            }).addTo(this.map)
            this.tileLayer.bringToBack()
        }
    },
    _attachEvents: function () {
        this.mainMap.on('move', this._onMainMove, this)
        this.mainMap.on('zoomend', this._onMainMove, this)
        this.map.on('click', this._onMiniClick, this)

        // Drag the viewport rectangle to pan the main map
        const el = this.map.getContainer()
        let last = null
        const onDown = (e) => {
            if (e.button !== 0) return
            this._dragging = true
            last = { x: e.clientX, y: e.clientY }
            L.DomEvent.stop(e)
        }
        const onMove = (e) => {
            if (!this._dragging || last == null) return
            const dx = e.clientX - last.x
            const dy = e.clientY - last.y
            last = { x: e.clientX, y: e.clientY }
            const c = this.map.latLngToContainerPoint(this.rect.getCenter())
            const nc = this.map.containerPointToLatLng([c.x + dx, c.y + dy])
            this._syncing = true
            this.mainMap.panTo(nc, { animate: false })
            this._syncing = false
            this.sync()
        }
        const onUp = () => {
            if (this._dragging) {
                this._dragging = false
                // Suppress the click that follows a drag
                this._justDragged = true
                setTimeout(() => (this._justDragged = false), 50)
            }
        }
        this.rect.on('mousedown', (e) => onDown(e.originalEvent))
        this._docMove = onMove
        this._docUp = onUp
        document.addEventListener('mousemove', onMove)
        document.addEventListener('mouseup', onUp)
        L.DomEvent.disableClickPropagation(el)

        this._layerToggleKey = 'MiniMap'
        if (L_._onLayerToggleSubscriptions)
            L_._onLayerToggleSubscriptions[this._layerToggleKey] = () =>
                this.refreshTileLayer()
    },
    _onMainMove: function () {
        if (this._syncing) return
        this.sync()
    },
    _onMiniClick: function (e) {
        if (this._justDragged) return
        this._syncing = true
        this.mainMap.panTo(e.latlng)
        this._syncing = false
        this.sync()
    },
    sync: function () {
        if (this.map == null || this._collapsed) return
        if (this.tileLayer == null) this.refreshTileLayer()
        const z = Math.max(
            0,
            this.mainMap.getZoom() + this.options.zoomOffset
        )
        this.map.setView(this.mainMap.getCenter(), z, { animate: false })
        this.rect.setBounds(this.mainMap.getBounds())
    },
    toggle: function (collapsed) {
        this._collapsed =
            typeof collapsed === 'boolean' ? collapsed : !this._collapsed
        $('#mmgisMiniMapContainer').toggleClass('collapsed', this._collapsed)
        if (!this._collapsed && this.map) {
            this.map.invalidateSize()
            this.sync()
        }
    },
    destroy: function () {
        if (this.mainMap) {
            this.mainMap.off('move', this._onMainMove, this)
            this.mainMap.off('zoomend', this._onMainMove, this)
        }
        if (this._docMove) document.removeEventListener('mousemove', this._docMove)
        if (this._docUp) document.removeEventListener('mouseup', this._docUp)
        if (L_._onLayerToggleSubscriptions && this._layerToggleKey)
            delete L_._onLayerToggleSubscriptions[this._layerToggleKey]
        if (this.map) this.map.remove()
        $('#mmgisMiniMapContainer').remove()
        this.map = null
        this.mainMap = null
        this.rect = null
        this.tileLayer = null
    },
}

export default MiniMap
