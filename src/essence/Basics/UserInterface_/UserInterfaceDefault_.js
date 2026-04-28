import $ from 'jquery'
import F_ from '../Formulae_/Formulae_'
import L_ from '../Layers_/Layers_'
import ToolController_ from '../ToolController_/ToolController_'
import Login from '../../Ancillary/Login/Login'

import BottomBar from './BottomBar'
import LayerUpdatedControl from './LayerUpdatedControl'
import UserInterfaceBridge from './UserInterfaceBridge'
import { refreshThemeDOM } from '../../../design-system/themeApplier'
import { getCurrentTheme } from '../../../design-system/useTheme'

import './UserInterfaceDefault_.css'

var Viewer_ = null
var Map_ = null
var Globe_ = null

var UserInterface = {
    splitterSize: 0,
    splitterSizeHidden: 17,
    topSize: 40,
    fullSizeViews: false, //Experimental!!!
    pxIsViewer: null,
    pxIsMap: null,
    pxIsGlobe: null,
    pxIsTools: null,
    pxIsToolsInit: null,
    topBar: null,
    topBarRight: null,
    splitscreens: null,
    mainWidth: null,
    mainHeight: null,
    vmgScreen: null,
    viewerScreen: null,
    viewerToolBar: null,
    viewerSplit: null,
    hasViewer: true,
    mapScreen: null,
    mapToolBar: null,
    mapTopBar: null,
    mapSplit: null,
    mapSplitInner: null,
    hasMap: true,
    globeScreen: null,
    globeToolBar: null,
    globeSplit: null,
    globeSplitInner: null,
    hasGlobe: true,
    tScreen: null,
    toolsScreen: null,
    toolsSplit: null,
    toolbar: null,
    toolPanel: null,
    toolPanelDrag: null,
    helpOn: true,
    layerUpdatedControl: null,
    init: function () {
        UserInterfaceBridge.init(UserInterface)
        //Other stylings in mmgis.css

        // prettier-ignore
        var logoURL = 'public/images/logos/logo.png'

        // prettier-ignore
        const topBarMarkup = [
            "<div id='topBar'>",
                "<div id='topBarLeft' class='hideScrollbar'>",
                    "<div id='topBarMain'>",
                        "<div id='topBarTitle'>",
                            `<div id='topBarTitleName' tabindex='200'>`,
                                window.mmgisglobal.name,
                            "</div>",
                        "</div>",
                    "</div>",
                    "<div id='topBarSecondary'>",
                        "<div class='mainDescription' title='Go to active item'>",
                        "</div>",
                        "<div class='mainInfo' title='Go to featured item'>",
                        "</div>",
                    "</div>",
                "</div>",
                "<div id='topBarRight'>",
                    "<div class='Search'>",
                    "</div>",
                "</div>",
            "</div>"
        ].join('\n')
        //TopBar
        $('#main-container').append(topBarMarkup)

        $('#topBarLeft').on('wheel', function (e) {
            e.preventDefault()
            this.scrollLeft += e.originalEvent.deltaY
        })

        this.rightPanel = $('<div>').attr('id', 'uiRightPanel').css({
            position: 'absolute',
            top: '0px',
            right: '0px',
            display: 'none',
            width: '0px',
            height: '100vh',
            background: '#000',
        })
        $('body').append(this.rightPanel)

        Login.init()

        this.barBottom = $('<div>').attr('id', 'barBottom').css({
            position: 'absolute',
            width: '40px',
            bottom: '0px',
            left: '0px',
            display: 'flex',
            'flex-flow': 'column',
            'z-index': '1005',
        })
        $('#main-container').append(this.barBottom)

        BottomBar.init('barBottom', this)

        this.toolPanel = $('<div>')
            .attr('id', 'toolPanel')
            .css({
                position: 'absolute',
                width: '0px',
                top: (this.topSize + 12) + 'px',
                height: 'calc(100% - ' + (this.topSize + 24) + 'px)',
                left: (this.topSize + 12) + 'px',
                background: getCurrentTheme().alpha('--color-a', 0.88),
                'border': '1px solid transparent',
                'border-radius': '10px',
                'backdrop-filter': 'blur(20px)',
                '-webkit-backdrop-filter': 'blur(20px)',
                transition: 'width 0.2s ease-out, opacity 0.2s ease-out, border-color 0.2s ease-out',
                overflow: 'hidden',
                'z-index': '1400',
                'box-shadow': 'none',
                opacity: '0',
            })
        $('#main-container').append(this.toolPanel)
        // Right-edge resize strip for the vertical tool panel
        this.toolPanelDrag = $('<div>').attr('id', 'toolPanelDrag').css({
            position: 'absolute',
            width: '6px',
            top: (this.topSize + 12) + 'px',
            height: 'calc(100% - ' + (this.topSize + 24) + 'px)',
            cursor: 'col-resize',
            display: 'none',
            'z-index': '1401',
            background: 'transparent',
        })
        $('#main-container').append(this.toolPanelDrag)
        // Hover highlight
        this.toolPanelDrag.on('mouseenter', function () {
            $(this).css('background', getCurrentTheme().alpha('--color-c', 0.3))
        }).on('mouseleave', function () {
            if (!UserInterface._toolDragActive)
                $(this).css('background', 'transparent')
        })

        UserInterface._toolDragActive = false
        UserInterface.handleToolDragDragging = function (e) {
            const newWidth = e.pageX - UserInterface.topSize - 12
            $('body').css('user-select', 'none')
            UserInterface.toolPanelDrag.css('background', getCurrentTheme().alpha('--color-c', 0.5))
            // Live resize
            const clamped = Math.max(
                Math.min(newWidth, window.innerWidth / 2),
                ToolController_.getTool(ToolController_.activeToolName)?.width || 300
            )
            UserInterface.toolPanel.css('width', clamped + 'px')
            UserInterface.toolPanelDrag.css('left', (clamped + UserInterface.topSize + 12) + 'px')
        }

        UserInterface.handleToolDragMouseup = function () {
            UserInterface._toolDragActive = false
            $('body')
                .off('mousemove', UserInterface.handleToolDragDragging)
                .off('mouseup', UserInterface.handleToolDragMouseup)
            const currentWidth = parseInt(UserInterface.toolPanel.css('width'))
            UserInterface.resizeToolPanel(currentWidth)
            $('body').css('user-select', 'auto')
            UserInterface.toolPanelDrag.css('background', 'transparent')
        }
        UserInterface.handleToolDragMousedown = function (e) {
            UserInterface._toolDragActive = true
            e.preventDefault()
            $('body')
                .on('mouseup', UserInterface.handleToolDragMouseup)
                .on('mousemove', UserInterface.handleToolDragDragging)
        }
        $('#toolPanelDrag').on('mousedown', this.handleToolDragMousedown)

        // Top-edge resize strip for the floating bottom bar (horizontal tools)
        this.bottomBarDrag = $('<div>').attr('id', 'bottomBarDrag').css({
            position: 'absolute',
            height: '6px',
            left: '0',
            right: '0',
            top: '-3px',
            cursor: 'row-resize',
            'z-index': '1004',
            background: 'transparent',
            display: 'none',
        })
        // Hover highlight
        this.bottomBarDrag.on('mouseenter', function () {
            $(this).css('background', getCurrentTheme().alpha('--color-c', 0.3))
        }).on('mouseleave', function () {
            if (!UserInterface._bottomDragActive)
                $(this).css('background', 'transparent')
        })

        UserInterface._bottomDragActive = false
        UserInterface.handleBottomDragDragging = function (e) {
            $('body').css('user-select', 'none')
            UserInterface.bottomBarDrag.css('background', getCurrentTheme().alpha('--color-c', 0.5))
            const bar = $('#bottomFloatingBar')
            const barBottom = bar.offset().top + bar.outerHeight()
            const timeUIDockH = $('#timeUIDock').outerHeight() || 0
            let newToolsH = barBottom - e.pageY - timeUIDockH
            const minH = 100
            const maxH = window.innerHeight * 0.6
            newToolsH = Math.max(minH, Math.min(maxH, newToolsH))
            $('#toolsWrapper').css('height', newToolsH + 'px')
            UserInterface.pxIsTools = newToolsH
            UserInterface._syncBottomBarHeight()
            UserInterface._updateBottomBarDependents()
        }

        UserInterface.handleBottomDragMouseup = function () {
            UserInterface._bottomDragActive = false
            $('body')
                .off('mousemove', UserInterface.handleBottomDragDragging)
                .off('mouseup', UserInterface.handleBottomDragMouseup)
            $('body').css('user-select', 'auto')
            UserInterface.bottomBarDrag.css('background', 'transparent')
        }
        UserInterface.handleBottomDragMousedown = function (e) {
            UserInterface._bottomDragActive = true
            e.preventDefault()
            $('body')
                .on('mouseup', UserInterface.handleBottomDragMouseup)
                .on('mousemove', UserInterface.handleBottomDragDragging)
        }
        this.bottomBarDrag.on('mousedown', UserInterface.handleBottomDragMousedown)

        //Main container div
        this.splitscreens = $('<div>')
            .attr('id', 'splitscreens')
            .css({
                position: 'absolute',
                top: (this.fullSizeViews ? '0' : this.topSize) + 'px',
                width: 'calc( 100% - ' + 40 + 'px )',
                height:
                    'calc( 100% - ' +
                    (this.fullSizeViews ? '0' : this.topSize) +
                    'px )',
                left: 40 + 'px',
            })
        $('#main-container').append(this.splitscreens)

        this.hide()
        this.mainWidth = $('#splitscreens').width()
        this.mainHeight = $('#splitscreens').height()

        this.pxIsViewer = 0
        this.pxIsMap = 0
        this.pxIsGlobe = 0
        this.pxIsTools = 0
        this.pxIsToolsInit = this.splitterSize / 4

        this.pxIsMap = this.mainWidth - this.pxIsViewer - this.pxIsGlobe
        //the 'top' three panels
        this.vmgScreen = $('<div>').attr('id', 'vmgScreen')
        this.splitscreens.append(this.vmgScreen)

        //The viewer screen
        this.viewerScreen = $('<div>')
            .attr('id', 'viewerScreen')
            .css({
                position: 'absolute',
                width: this.pxIsViewer + 'px',
                height: this.mainHeight + 'px',
                top: '0px',
                overflow: 'hidden',
                left: 0 + 'px',
            })
        this.vmgScreen.append(this.viewerScreen)

        const viewerDiv = $('<div>').attr('id', 'viewer').css({
            position: 'absolute',
            'background-color': 'var(--color-a-5)',
            width: '100%',
            height: '100%',
        })
        this.viewerScreen.append(viewerDiv)
        this.viewerToolBar = $('<div>').attr('id', 'viewerToolBar').css({
            position: 'absolute',
            top: `40px`,
            width: '100%',
            height: '48px',
            'pointer-events': 'none',
            'z-index': '5',
        })
        this.viewerScreen.append(this.viewerToolBar)

        //The viewer slider
        this.viewerSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'viewerSplit')
            .css({
                width: this.splitterSize + 'px',
                height: this.mainHeight + 'px',
                left: -this.splitterSize + 'px',
                cursor: 'default',
            })
        this.vmgScreen.append(this.viewerSplit)

        //The map screen
        this.mapScreen = $('<div>')
            .attr('id', 'mapScreen')
            .css({
                position: 'absolute',
                width: this.pxIsMap - this.splitterSize * 2 + 'px',
                height: this.mainHeight + 'px',
                top: '0px',
                left: this.pxIsViewer + this.splitterSize + 'px',
            })
        this.vmgScreen.append(this.mapScreen)
        const mapDiv = $('<div>').attr('id', 'map').css({
            position: 'absolute',
            'background-color': 'var(--color-a-5)',
            width: '100%',
            height: '100%',
            //'height': 'calc( 100% - ' + this.splitterSize + 'px )'
        })
        this.mapScreen.append(mapDiv)
        this.mapToolBar = $('<div>').attr('id', 'mapToolBar').css({
            position: 'absolute',
            bottom: '0px',
            width: '100%',
            height: '40px',
            'pointer-events': 'none',
            overflow: 'hidden',
            'z-index': '1003',
            transition: 'bottom 0.2s ease-out, height 0.2s ease-out',
        })
        this.mapScreen.append(this.mapToolBar)

        this.mapTopBar = $('<div>')
            .attr('id', 'mapTopBar')
            .css({
                'z-index': '400',
                display: 'flex',
                'justify-content': 'space-between',
                position: 'absolute',
                top: '0px',
                'pointer-events': 'none',
                width: '100%',
                height: this.topSize + 'px',
                left: '0px',
                background: 'transparent',
                'font-family': 'sans-serif',
                'font-size': '24px',
                padding: '5px',
            })
        this.mapScreen.append(this.mapTopBar)

        //The map slider
        this.mapSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'mapSplit')
            .css({
                width: this.splitterSizeHidden + 'px',
                height: this.mainHeight + 'px',
                left: this.pxIsViewer - this.splitterSizeHidden / 2 + 'px',
            })
        this.vmgScreen.append(this.mapSplit)

        // Splitter arrow buttons removed — panel selection is via TopBar toggles

        //The globe screen
        this.globeScreen = $('<div>')
            .attr('id', 'globeScreen')
            .css({
                position: 'absolute',
                width: this.pxIsGlobe + 'px',
                height: this.mainHeight + 'px',
                top: '0px',
                overflow: 'hidden',
                left: this.pxIsViewer + this.pxIsMap + 'px',
                'z-index': '401',
            })
        this.vmgScreen.append(this.globeScreen)

        const globeDiv = $('<div>').attr('id', 'globe').css({
            position: 'absolute',
            'background-color': 'var(--color-a1)',
            width: '100%',
            height: '100%',
        })
        this.globeScreen.append(globeDiv)

        this.globeToolBar = $('<div>')
            .attr('id', 'globeToolBar')
            .css({
                position: 'absolute',
                top: `40px`,
                width: '100%',
                'padding-right': this.fullSizeViews ? '70px' : '0px',
                height: '40px',
                'pointer-events': 'none',
                'z-index': '5',
            })
        this.globeScreen.append(this.globeToolBar)

        //The globe slider
        this.globeSplit = $('<div>')
            .attr('class', 'splitterV')
            .attr('id', 'globeSplit')
            .css({
                width: this.splitterSizeHidden + 'px',
                height: this.mainHeight + 'px',
                left:
                    this.pxIsViewer +
                    this.pxIsMap -
                    this.splitterSizeHidden / 2 +
                    'px',
            })
        this.vmgScreen.append(this.globeSplit)

        // Globe splitter arrow buttons removed — panel selection is via TopBar toggles

        //The 'bottom' tools panel
        this.tScreen = $('<div>').attr('id', 'tScreen')
        this.splitscreens.append(this.tScreen)

        // Floating bottom bar — wraps horizontal tool content + TimeUI
        this.bottomFloatingBar = $('<div>')
            .attr('id', 'bottomFloatingBar')
            .css({
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                right: '12px',
                'z-index': '1003',
                'border-radius': '10px',
                border: `1px solid ${getCurrentTheme()['--color-a1']}`,
                background: getCurrentTheme().alpha('--color-a', 0.92),
                'backdrop-filter': 'blur(20px)',
                '-webkit-backdrop-filter': 'blur(20px)',
                overflow: 'hidden',
                'pointer-events': 'auto',
                'max-height': 'calc(100% - 24px)',
                transition: 'height 0.3s ease-out',
            })
        this.splitscreens.append(this.bottomFloatingBar)

        //The tools screen (horizontal tool content — expands upward)
        this.toolsScreen = $('<div>')
            .attr('id', 'toolsWrapper')
            .css({
                height: '0px',
                width: '100%',
                margin: '0',
                background: getCurrentTheme().alpha('--color-a', 0.95),
                overflow: 'hidden',
                'border-bottom': '1px solid transparent',
                transition: 'height 0.3s ease-out',
            })
        this.bottomFloatingBar.append(this.toolsScreen)

        const toolsDiv = $('<div>').attr('id', 'tools').css({
            position: 'relative',
            height: '100%',
            'padding-bottom': '0px',
            width: '100%',
        })
        this.toolsScreen.append(toolsDiv)

        // TimeUI dock — #timeUI will be reparented here after creation
        this.timeUIDock = $('<div>')
            .attr('id', 'timeUIDock')
            .css({
                width: '100%',
                'min-height': '0px',
            })
        this.bottomFloatingBar.append(this.timeUIDock)

        // Append the top-edge drag strip to the floating bar
        this.bottomFloatingBar.css('position', 'absolute')
        this.bottomFloatingBar.append(this.bottomBarDrag)

        // Initially hide the floating bar (shown when TimeUI activates or horizontal tool opens)
        this.bottomFloatingBar.css('display', 'none')

        // Watch for #timeUI being added to the DOM and reparent it into the floating bar.
        // IMPORTANT: observe only direct children (subtree:false) and disconnect
        // once #timeUI is found to avoid infinite observer loops (DOM mutations
        // inside the callback would re-trigger a subtree observer).
        const timeUIDock = this.timeUIDock
        const observer = new MutationObserver(function (mutations, obs) {
            for (let i = 0; i < mutations.length; i++) {
                const added = mutations[i].addedNodes
                for (let j = 0; j < added.length; j++) {
                    const node = added[j]
                    if (node.id === 'timeUI' || (node.querySelector && node.querySelector('#timeUI'))) {
                        const timeUI = node.id === 'timeUI' ? node : node.querySelector('#timeUI')
                        // Stop observing before any DOM changes to prevent re-entry
                        obs.disconnect()
                        // Reparent #timeUI into the floating bottom bar
                        timeUIDock.append(timeUI)
                        $(timeUI).css({
                            position: 'relative',
                            bottom: 'auto',
                            left: 'auto',
                            width: '100%',
                        })
                        UserInterface._updateBottomBarVisibility()
                        UserInterface._updateBottomBarDependents()

                        // Watch for TimeUI class changes (active/expanded)
                        const timeUIObserver = new MutationObserver(function () {
                            UserInterface._updateBottomBarVisibility()
                            setTimeout(function () {
                                UserInterface._updateBottomBarDependents()
                            }, 350)
                        })
                        timeUIObserver.observe(timeUI, { attributes: true, attributeFilter: ['class'] })
                        return
                    }
                }
            }
        })
        observer.observe(this.splitscreens[0], { childList: true, subtree: true })
        //The toolbar
        this.toolbar = $('<div>')
            .attr('id', 'toolbar')
            .css({
                width: this.topSize + 'px',
                top: this.topSize + 'px',
                height: 'calc(100% - ' + this.topSize + 'px)',
            })
        $('#main-container').append(this.toolbar)

        this.toolbarLogo = $('<div>')
            .attr('id', 'mmgislogo')
            .css({
                display: 'inherit',
                padding: '9px 6px',
                cursor: 'pointer',
                width: '40px',
                height: '40px',
                position: 'absolute',
                top: '0px',
                left: '0px',
                'z-index': '2005',
                'image-rendering': 'pixelated',
            })
            .html(
                `<svg width="27" height="27" viewBox="0 0 231 137" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M0.222266 9.21339C-0.277832 14.7126 0.222266 133.713 0.222266 133.713H26.2223V45.7134C26.2223 45.7134 100.722 127.712 106.222 132.713C109.171 135.395 112.12 136.782 115.222 136.645C118.325 136.782 121.274 135.395 124.222 132.713C129.722 127.712 204.222 45.7134 204.222 45.7134V133.713H230.222C230.222 133.713 230.722 14.7126 230.222 9.21339C229.722 3.71413 218.222 -3.28766 210.222 1.71339C202.222 6.71444 115.222 104.713 115.222 104.713C115.222 104.713 28.2224 6.71444 20.2223 1.71339C12.2222 -3.28766 0.722363 3.71413 0.222266 9.21339Z" fill="${getCurrentTheme()['--color-mmgis']}"></path>
</svg>`
            )
            .on('click', F_.toHostForceLanding)
        $('#main-container').append(this.toolbarLogo)

        this.dataLoadingSpinner = $('<div>')
            .attr('id', 'dataLoadingSpinner')
            .css({
                opacity: 0,
                transition: 'opacity 0.3s ease-in-out',
                'pointer-events': 'none',
                width: '40px',
                height: '40px',
                background: 'var(--color-a)',
                position: 'absolute',
                top: '0px',
                left: '0px',
                'z-index': '2005',
            })
        $('#main-container').append(this.dataLoadingSpinner)
        const dataLoadingSpinnerInner = $('<div>')
            .attr('class', 'mmgis-spinner2')
            .css({
                position: 'absolute',
                top: '6px',
                left: '6px',
            })
        this.dataLoadingSpinner.append(dataLoadingSpinnerInner)

        //ViewerSplit is immovable
        //$( '#viewerSplit' ).mousedown( viewerSplitOnMouseDown );
        $('#mapSplit').mousedown(mapSplitOnMouseDown)
        $('#globeSplit').mousedown(globeSplitOnMouseDown)
        $('#toolsSplit').mousedown(toolsSplitOnMouseDown)

        $('#mapSplit').on('touchstart', mapSplitOnMouseDown)
        $('#globeSplit').on('touchstart', globeSplitOnMouseDown)
        $('#toolsSplit').on('touchstart', toolsSplitOnMouseDown)

        window.addEventListener('resize', windowresize, false)

        shouldRotateSplitterText()
    },
    resize: function () {
        windowresize()
    },
    hide: function () {
        $('#main-container').css('opacity', '0')
    },
    show: function () {
        $('#main-container').animate(
            {
                opacity: 1,
            },
            1000
        )
    },
    openRightPanel: function (width) {
        if (UserInterface.rightPanelOpen != null) return

        $('#CoordinatesDiv').css('right', width + 'px')
        $('#main-container').css('width', `calc(100% - ${width}px)`)

        UserInterface.mainWidth = $('#splitscreens').width()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        $('#uiRightPanel').css({ display: 'inherit', width: width })

        UserInterface.rightPanelOpen = true
    },
    closeRightPanel: function () {
        if (UserInterface.rightPanelOpen == null) return

        $('#CoordinatesDiv').css('right', '0px')
        $('#main-container').css('width', `100%`)

        UserInterface.mainWidth = $('#splitscreens').width()
        const pp = UserInterface.getPanelPercents()
        UserInterface.setPanelPercents(pp.viewer, pp.map, pp.globe)
        $('#uiRightPanel').css({ display: 'none', width: 0 })

        UserInterface.rightPanelOpen = null
    },
    openToolPanel: function (width) {
        UserInterface.toolPanel.empty()
        $('#tools').empty()
        UserInterface.toolPanel.css({
            width: width + 'px',
            opacity: '1',
            'border-color': getCurrentTheme()['--color-a1'],
            'box-shadow': '0 8px 32px rgba(0,0,0,0.4)',
        })
        UserInterface.toolPanelDrag.css({
            left: (width + UserInterface.topSize + 12) + 'px',
            display: 'block',
        })
        UserInterface._repositionSeparatedContent(width)
        UserInterface._updateBottomBarDependents()
        refreshThemeDOM()
    },
    resizeToolPanel: function (width) {
        width = Math.max(
            Math.min(width, window.innerWidth / 2),
            ToolController_.getTool(ToolController_.activeToolName)?.width ||
                300
        )
        UserInterface.toolPanel.css('width', width + 'px')
        UserInterface.toolPanelDrag.css({
            left: (width + UserInterface.topSize + 12) + 'px',
            display: 'block',
        })
        UserInterface._repositionSeparatedContent(width)
        UserInterface._updateBottomBarDependents()
    },
    closeToolPanel: function () {
        UserInterface.toolPanel.empty()
        UserInterface.toolPanel.css({
            width: '0',
            opacity: '0',
            'border-color': 'transparent',
            'box-shadow': 'none',
        })
        UserInterface.toolPanelDrag.css('display', 'none')
        UserInterface._repositionSeparatedContent(0)
        UserInterface._updateBottomBarDependents()
        refreshThemeDOM()
    },
    // can also be 'full'
    setToolHeight: function (pxHeight, shouldntAnimate) {
        if (pxHeight == 'full') {
            UserInterface.pxIsTools =
                this.mainHeight - this.splitterSize - this.topSize
        } else if (pxHeight == 'threefourths') {
            UserInterface.pxIsTools = parseInt(
                0.75 * (this.mainHeight - this.splitterSize - this.topSize)
            )
        } else if (pxHeight == 'half') {
            UserInterface.pxIsTools = parseInt(
                0.5 * (this.mainHeight - this.splitterSize - this.topSize)
            )
        } else {
            UserInterface.pxIsTools = pxHeight
        }

        if (UserInterface.pxIsTools < UserInterface.splitterSize / 4) {
            UserInterface.pxIsTools = UserInterface.splitterSize / 4
        }
        if (
            UserInterface.pxIsTools >
            UserInterface.mainHeight - UserInterface.splitterSize
        ) {
            UserInterface.pxIsTools =
                UserInterface.mainHeight - UserInterface.splitterSize
        }

        if (pxHeight == 0) {
            UserInterface.pxIsTools = 0
        }

        // Use CSS transition for smooth animation (set on toolsWrapper init)
        if (shouldntAnimate) {
            $('#toolsWrapper').css('transition', 'none')
        } else {
            $('#toolsWrapper').css('transition', 'height 0.3s ease-out')
        }

        // Set height — CSS transition handles smooth animation
        $('#toolsWrapper').css({
            height: UserInterface.pxIsTools + 'px',
            'border-bottom': UserInterface.pxIsTools > 0 ? `1px solid ${getCurrentTheme()['--color-a1']}` : '1px solid transparent',
        })

        // Also update the floating bar visibility
        UserInterface._updateBottomBarVisibility()
        UserInterface._updateBottomBarDependents()

        // Update dependents again after transition completes
        if (!shouldntAnimate) {
            setTimeout(function () {
                UserInterface._updateBottomBarDependents()
            }, 350)
        }
    },
    setToolWidth(newWidth, alignment) {
        // In the floating bottom bar, toolsWrapper always spans 100% of the bar
        // The bar itself handles positioning (left: toolbar+12, right: 12)
        $('#toolsWrapper').css({
            width: '100%',
        })
    },
    _updateBottomBarVisibility: function () {
        const bar = $('#bottomFloatingBar')
        if (!bar.length) return

        let timeUIActive = false
        if ($('#timeUI').length) {
            timeUIActive = $('#timeUI').hasClass('active')
        }
        const hasToolContent = UserInterface.pxIsTools > 0
        if (timeUIActive || hasToolContent) {
            bar.css('display', 'block')
            UserInterface._syncBottomBarHeight()
            // Show top-edge drag strip only when a horizontal tool is open
            $('#bottomBarDrag').css('display', hasToolContent ? 'block' : 'none')
        } else {
            bar.css('display', 'none')
            $('#bottomBarDrag').css('display', 'none')
        }
    },
    _repositionSeparatedContent: function (toolPanelWidth) {
        const sepContent = $('#toolcontroller_sep_content')
        if (!sepContent.length) return

        // Offset = toolPanel width + gap (24px for drag handle + margin)
        const offset = toolPanelWidth > 0 ? (toolPanelWidth + 24) : 0
        sepContent.css({
            'left': (12 + offset) + 'px',
            'transition': 'left 0.2s ease-out',
        })
    },
    _syncBottomBarHeight: function () {
        const bar = $('#bottomFloatingBar')
        if (!bar.length) return

        const twH = $('#toolsWrapper').outerHeight() || 0
        const tdH = $('#timeUIDock').outerHeight() || 0
        bar.css('height', (twH + tdH) + 'px')
    },
    _updateBottomBarDependents: function () {
        const bar = $('#bottomFloatingBar')
        if (!bar.length) return

        UserInterface._syncBottomBarHeight()

        // Total height of the floating bar from bottom edge of viewport
        const barHeight = bar.outerHeight() || 0
        const barBottom = 12 // matches the bar's bottom offset
        const totalOffset = barHeight + barBottom

        // Only offset map controls if the bar is visible
        const isVisible = bar.css('display') !== 'none'
        const offset = isVisible ? totalOffset : 0

        // Get current tool panel width for left offset of map controls
        const toolPanelWidth = parseInt(UserInterface.toolPanel?.css('width')) || 0
        const leftBase = toolPanelWidth > 0 ? (toolPanelWidth + UserInterface.topSize + 24) : 0

        $('#mapToolBar').css({ bottom: offset + 'px', left: leftBase + 'px', transition: 'bottom 0.2s ease-out, left 0.2s ease-out' })
        $('.leaflet-control-scalefactor').css({ bottom: (offset + 28) + 'px', left: leftBase + 'px', transition: 'bottom 0.2s ease-out, left 0.2s ease-out' })
        $('#mmgis-attributions').css({ bottom: offset + 'px' })
        if (
            $('#mmgis-attributions').length === 0 ||
            $('#mmgis-attributions').text().trim().length === 0
        ) {
            $('#mmgis-map-compass').css({ bottom: (offset + 38) + 'px', left: (leftBase + 8) + 'px', transition: 'bottom 0.2s ease-out, left 0.2s ease-out' })
        } else {
            $('#mmgis-map-compass').css({ bottom: (offset + 58) + 'px', left: (leftBase + 8) + 'px', transition: 'bottom 0.2s ease-out, left 0.2s ease-out' })
        }
        $('.leaflet-bottom.leaflet-right').css({ bottom: offset + 'px' })
        $('#CoordinatesDiv').css({ bottom: offset + 'px' })

        // Adjust vertical tool panel height so it doesn't overlap the bottom bar
        if (UserInterface.toolPanel) {
            const panelBottom = offset > 0 ? (offset + 12) : 12
            UserInterface.toolPanel.css('height', 'calc(100% - ' + (UserInterface.topSize + 12 + panelBottom) + 'px)')
            UserInterface.toolPanelDrag.css('height', 'calc(100% - ' + (UserInterface.topSize + 12 + panelBottom) + 'px)')
        }
    },
    getPanelPercents: function () {
        // Account for the splitterSize that was subtracted when setting pxIsViewer
        var adjustedPxIsViewer =
            UserInterface.pxIsViewer + UserInterface.splitterSize / 2
        var vp = (adjustedPxIsViewer / UserInterface.mainWidth) * 100
        var gp = (UserInterface.pxIsGlobe / UserInterface.mainWidth) * 100
        var mp = 100 - vp - gp
        return {
            viewer: vp,
            map: mp,
            globe: gp,
        }
    },
    setPanelPercents: function (viewerPercent, mapPercent, globePercent) {
        //normalize input
        viewerPercent = parseFloat(viewerPercent)
        mapPercent = parseFloat(mapPercent)
        globePercent = parseFloat(globePercent)

        if (!UserInterface.hasViewer && viewerPercent != 0) return
        if (!UserInterface.hasGlobe && globePercent != 0) return
        if (viewerPercent + mapPercent + globePercent != 100) return

        // Check if Globe is being opened for the first time
        const wasGlobeClosed = UserInterface.pxIsGlobe === 0
        const isGlobeOpening = globePercent > 0

        UserInterface.pxIsViewer =
            UserInterface.mainWidth * (viewerPercent / 100) -
            UserInterface.splitterSize / 2
        UserInterface.pxIsGlobe = UserInterface.mainWidth * (globePercent / 100)
        UserInterface.pxIsMap =
            UserInterface.mainWidth -
            UserInterface.pxIsViewer -
            UserInterface.pxIsGlobe

        //The viewer screen
        UserInterface.viewerScreen.css('width', UserInterface.pxIsViewer + 'px')
        //The map screen
        UserInterface.mapScreen.css({
            width:
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px',
            left: UserInterface.pxIsViewer + UserInterface.splitterSize + 'px',
        })
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen.css({
            width: UserInterface.pxIsGlobe + 'px',
            left: UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px',
        })
        //The globe slider
        UserInterface.globeSplit.css(
            'left',
            UserInterface.pxIsViewer +
                UserInterface.pxIsMap -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        resize()

        if (wasGlobeClosed && isGlobeOpening && Globe_ != null) {
            if (!Globe_.hasBeenOpened) {
                Globe_.hasBeenOpened = true
                // Only sync to map center if no globe coordinates were specified in URL
                if (L_.FUTURES.globeView == null) {
                    // Use setTimeout to ensure resize completes first
                    setTimeout(() => {
                        Globe_.syncToMapCenter()
                    }, 100)
                }
            }
        }
    },
    openViewerPanel() {
        var pp = UserInterface.getPanelPercents()
        if (pp.map == 0) {
            UserInterface.setPanelPercents(
                pp.viewer + pp.globe / 2,
                0,
                pp.globe - pp.globe / 2
            )
        } else {
            UserInterface.setPanelPercents(
                pp.viewer + pp.map / 2,
                pp.map - pp.map / 2,
                pp.globe
            )
        }
    },
    // minimalist() removed — splitscreens, toolbar, and toolPanel now use their
    // default positioning (below topBar, beside toolbar) so they never underlap.
    fullHide(is) {
        if (is) {
            UserInterface.topBar.css('display', 'none')
            UserInterface.mapSplit.css('display', 'none')
            UserInterface.globeSplit.css('display', 'none')
            UserInterface.toolbar.css('display', 'none')
            UserInterface.toolsScreen.css('display', 'none')
            $('.mouseLngLat').css('display', 'none')
        } else {
            UserInterface.topBar.css('display', 'flex')
            UserInterface.mapSplit.css('display', 'flex')
            UserInterface.globeSplit.css('display', 'flex')
            UserInterface.toolbar.css('display', 'inherit')
            UserInterface.toolsScreen.css('display', 'inherit')
            $('.mouseLngLat').css('display', 'flex')
        }
    },
    //finalize so we can get the resize function
    fina: function (l_, viewer_, map_, globe_) {
        ToolController_.init(l_.tools)
        ToolController_.fina(this)
        Viewer_ = viewer_
        Map_ = map_
        this.Map_ = map_
        Globe_ = globe_
        this.hasViewer = l_.hasViewer
        this.hasGlobe = l_.hasGlobe

        // Mount React UI overlay (design system, panel toggles, theming)
        UserInterfaceBridge.fina(l_, this)

        $('#topBarTitleName').on('click', L_.home)

        // Apply configured default panel widths (if present)
        if (l_.configData.panels && l_.configData.panels.defaultWidths) {
            const dw = l_.configData.panels.defaultWidths
            const viewer = dw.viewer != null ? dw.viewer : 0
            const map = dw.map != null ? dw.map : 100
            const globe = dw.globe != null ? dw.globe : 0

            // Validate sum equals 100 before applying
            if (viewer + map + globe === 100) {
                UserInterface.setPanelPercents(viewer, map, globe)
            } else {
                console.warn(
                    `Panel default widths (${viewer}%, ${map}%, ${globe}%) do not sum to 100. ` +
                        `Using system defaults.`
                )
            }
        }

        // Deeplinks override config defaults
        if (l_.FUTURES.panelPercents != null)
            UserInterface.setPanelPercents(
                l_.FUTURES.panelPercents[0],
                l_.FUTURES.panelPercents[1],
                l_.FUTURES.panelPercents[2]
            )

        clearUnwantedPanels(this.hasViewer, true, this.hasGlobe)
        if (l_.configData.look) {
            if (
                l_.configData.look.pagename == null ||
                l_.configData.look.pagename == ''
            )
                $('#topBarTitleName').css({ display: 'none' })
            else $('#topBarTitleName').html(l_.configData.look.pagename)
        }

        //Disable toolbar presets when needed
        if (l_.configData.look && l_.configData.look.copylink != null)
            $('#topBarLink').css({
                display: l_.configData.look.copylink ? 'inherit' : 'none',
            })

        if (l_.configData.look && l_.configData.look.screenshot != null)
            $('#topBarScreenshot').css({
                display: l_.configData.look.screenshot ? 'inherit' : 'none',
            })

        if (l_.configData.look && l_.configData.look.fullscreen != null)
            $('#topBarFullscreen').css({
                display: l_.configData.look.fullscreen ? 'inherit' : 'none',
            })

        if (l_.configData.look && l_.configData.look.settings != null)
            $('#bottomBarSettings').css({
                display: l_.configData.look.settings ? 'inherit' : 'none',
            })

        if (
            l_.configData.look &&
            l_.configData.look.info != null &&
            l_.configData.look.infourl != ''
        ) {
            $('#topBarInfo').css({
                display: l_.configData.look.info ? 'inherit' : 'none',
            })
        } else {
            $('#topBarInfo').css({
                display: 'none',
            })
        }

        if (
            l_.configData.look &&
            l_.configData.look.help != null &&
            l_.configData.look.helpurl != ''
        ) {
            $('#topBarHelp').css({
                display: l_.configData.look.help ? 'inherit' : 'none',
            })
        } else {
            $('#topBarHelp').css({
                display: 'none',
            })
        }

        if (l_.configData.look && l_.configData.look.topbar === false)
            BottomBar.changeUIVisibility('topbar', false)
        if (l_.configData.look && l_.configData.look.toolbar === false)
            BottomBar.changeUIVisibility('toolbars', false)
        if (l_.configData.look && l_.configData.look.scalebar === false)
            BottomBar.changeUIVisibility('scalebar', false)
        if (l_.configData.look && l_.configData.look.coordinates === false)
            BottomBar.changeUIVisibility('coordinates', false)
        if (l_.configData.look && l_.configData.look.miscellaneous === false)
            BottomBar.changeUIVisibility('miscellaneous', false)

        BottomBar.fina()
        UserInterface.show()
    },
    updateLayerUpdateButton: function (type) {
        if (UserInterface.layerUpdatedControl) {
            UserInterface.removeLayerUpdateButton()
        }

        if (Map_) {
            UserInterface.layerUpdatedControl = new LayerUpdatedControl({
                position: 'topright',
                type,
            })
            UserInterface.layerUpdatedControl.addTo(Map_.map)
        }
    },
    removeLayerUpdateButton: function () {
        if (UserInterface.layerUpdatedControl && Map_) {
            UserInterface.layerUpdatedControl.remove(Map_.map)
            UserInterface.layerUpdatedControl = null
        }
    },
}

var threshold = 1
var dragThreshold = 0
var mouseIsDown = false

function mapSplitOnMouseDown(e) {
    $('#main-container').mouseup(mainContainerOnMouseUp)
    $('#main-container').mouseleave(mainContainerOnMouseOut)
    $('#main-container').mousemove(mapSplitOnMouseMove)

    $('#main-container').on('touchend', mainContainerOnMouseUp)
    $('#main-container').on('touchleave', mainContainerOnMouseOut)
    $('#main-container').on('touchmove', mapSplitOnMouseMove)

    dragThreshold = 0
    mouseIsDown = true
    return false
}
function globeSplitOnMouseDown(e) {
    $('#main-container').mouseup(mainContainerOnMouseUp)
    $('#main-container').mouseleave(mainContainerOnMouseOut)
    $('#main-container').mousemove(globeSplitOnMouseMove)

    $('#main-container').on('touchend', mainContainerOnMouseUp)
    $('#main-container').on('touchleave', mainContainerOnMouseOut)
    $('#main-container').on('touchmove', globeSplitOnMouseMove)

    dragThreshold = 0
    mouseIsDown = true
    return false
}
function toolsSplitOnMouseDown(e) {
    $('#main-container').mouseup(mainContainerOnMouseUp)
    $('#main-container').mouseleave(mainContainerOnMouseOut)
    $('#main-container').mousemove(toolsSplitOnMouseMove)

    $('#main-container').on('touchend', mainContainerOnMouseUp)
    $('#main-container').on('touchleave', mainContainerOnMouseOut)
    $('#main-container').on('touchmove', toolsSplitOnMouseMove)

    dragThreshold = 0
    mouseIsDown = true
    return false
}
function mainContainerOnMouseUp(e) {
    dragThreshold = 0
    mouseIsDown = false
    //Clear stuff up
    $('#main-container').off('mouseup', mainContainerOnMouseUp)
    $('#main-container').off('mouseleave', mainContainerOnMouseOut)
    $('#main-container').off('mousemove', mapSplitOnMouseMove)
    $('#main-container').off('mousemove', globeSplitOnMouseMove)
    $('#main-container').off('mousemove', toolsSplitOnMouseMove)

    $('#main-container').off('touchend', mainContainerOnMouseUp)
    $('#main-container').off('touchleave', mainContainerOnMouseOut)
    $('#main-container').off('touchmove', mapSplitOnMouseMove)
    $('#main-container').off('touchmove', globeSplitOnMouseMove)
    $('#main-container').off('touchmove', toolsSplitOnMouseMove)
    return false
}
function mainContainerOnMouseOut(e) {
    dragThreshold = 0
    mouseIsDown = false
    //Clear stuff up
    $('#main-container').off('mouseup', mainContainerOnMouseUp)
    $('#main-container').off('mouseleave', mainContainerOnMouseOut)
    $('#main-container').off('mousemove', mapSplitOnMouseMove)
    $('#main-container').off('mousemove', globeSplitOnMouseMove)
    $('#main-container').off('mousemove', toolsSplitOnMouseMove)

    $('#main-container').off('touchend', mainContainerOnMouseUp)
    $('#main-container').off('touchleave', mainContainerOnMouseOut)
    $('#main-container').off('touchmove', mapSplitOnMouseMove)
    $('#main-container').off('touchmove', globeSplitOnMouseMove)
    $('#main-container').off('touchmove', toolsSplitOnMouseMove)
    return false
}

//The splitter between viewer and map
function mapSplitOnMouseMove(e) {
    if (dragThreshold > threshold) {
        //For touches
        if (!e.clientX && e.originalEvent && e.originalEvent.touches)
            e.clientX = e.originalEvent.touches[0].clientX

        e.clientX -= UserInterface.splitterSize

        e.clientX -= 40 //Left toolbar

        e.clientX -= $('#toolPanel').width()

        if (e.clientX >= UserInterface.mainWidth - 5) {
            e.clientX = UserInterface.mainWidth
        } else if (e.clientX <= 5) {
            e.clientX = 0
        }

        UserInterface.pxIsViewer = e.clientX - UserInterface.splitterSize / 2
        UserInterface.pxIsMap =
            UserInterface.mainWidth -
            e.clientX +
            UserInterface.splitterSize / 2 -
            UserInterface.pxIsGlobe
        UserInterface.pxIsGlobe =
            UserInterface.mainWidth -
            UserInterface.pxIsViewer -
            UserInterface.pxIsMap

        if (UserInterface.pxIsViewer < 0) {
            UserInterface.pxIsViewer = 0
            UserInterface.pxIsMap =
                UserInterface.mainWidth - UserInterface.pxIsGlobe
        }
        if (
            UserInterface.pxIsViewer >
            UserInterface.mainWidth - UserInterface.splitterSize * 2
        ) {
            UserInterface.pxIsViewer =
                UserInterface.mainWidth - UserInterface.splitterSize * 2
        }
        if (UserInterface.pxIsGlobe <= 0) {
            UserInterface.pxIsGlobe = 0
        }
        if (UserInterface.pxIsMap < UserInterface.splitterSize * 2) {
            UserInterface.pxIsMap = UserInterface.splitterSize * 2
            UserInterface.pxIsGlobe =
                UserInterface.mainWidth -
                UserInterface.pxIsViewer -
                UserInterface.pxIsMap
        }
        if (UserInterface.pxIsMap > UserInterface.mainWidth) {
            UserInterface.pxIsMap = UserInterface.mainWidth
        }

        //The viewer screen
        UserInterface.viewerScreen.css('width', UserInterface.pxIsViewer + 'px')
        //The map screen
        UserInterface.mapScreen.css({
            width:
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px',
            left: UserInterface.pxIsViewer + UserInterface.splitterSize + 'px',
        })
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen.css({
            width: UserInterface.pxIsGlobe + 'px',
            left: UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px',
        })
        //The globe slider
        UserInterface.globeSplit.css(
            'left',
            UserInterface.pxIsViewer +
                UserInterface.pxIsMap -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        resize()

        return false
    }
    if (mouseIsDown) {
        dragThreshold++
    }
}

//The splitter between map and globe
function globeSplitOnMouseMove(e) {
    if (dragThreshold > threshold) {
        //For touches
        if (!e.clientX && e.originalEvent && e.originalEvent.touches)
            e.clientX = e.originalEvent.touches[0].clientX

        e.clientX -= 40 //Left toolbar

        e.clientX -= $('#toolPanel').width()

        if (UserInterface.hasViewer !== false) {
            e.clientX -= UserInterface.splitterSize
        }

        if (e.clientX >= UserInterface.mainWidth - 5) {
            e.clientX = UserInterface.mainWidth
        } else if (e.clientX <= 5) {
            e.clientX = 0
        }

        UserInterface.pxIsGlobe =
            UserInterface.mainWidth - e.clientX - UserInterface.splitterSize / 2
        UserInterface.pxIsMap =
            e.clientX -
            UserInterface.pxIsViewer +
            UserInterface.splitterSize / 2
        UserInterface.pxIsViewer =
            UserInterface.mainWidth -
            UserInterface.pxIsGlobe -
            UserInterface.pxIsMap

        if (UserInterface.pxIsGlobe <= 0) {
            UserInterface.pxIsGlobe = 0 //UserInterface.splitterSize;
            UserInterface.pxIsMap =
                UserInterface.mainWidth - UserInterface.pxIsViewer
        }
        if (UserInterface.pxIsMap < UserInterface.splitterSize * 2) {
            UserInterface.pxIsMap = UserInterface.splitterSize * 2
            UserInterface.pxIsViewer =
                UserInterface.mainWidth -
                UserInterface.pxIsGlobe -
                UserInterface.pxIsMap
        }
        if (
            UserInterface.pxIsGlobe >
            UserInterface.mainWidth - UserInterface.splitterSize * 2
        ) {
            UserInterface.pxIsGlobe =
                UserInterface.mainWidth - UserInterface.splitterSize * 2
            UserInterface.pxIsViewer = 0
            UserInterface.pxIsMap = UserInterface.splitterSize * 2
        }

        //The viewer screen
        UserInterface.viewerScreen.css('width', UserInterface.pxIsViewer + 'px')

        //The map screen
        UserInterface.mapScreen.css({
            width:
                UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px',
            left: UserInterface.pxIsViewer + UserInterface.splitterSize + 'px',
        })
        //The map slider
        UserInterface.mapSplit.css(
            'left',
            UserInterface.pxIsViewer -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        //The globe screen
        UserInterface.globeScreen.css({
            width: UserInterface.pxIsGlobe + 'px',
            left: UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px',
        })
        //The globe slider
        UserInterface.globeSplit.css(
            'left',
            UserInterface.pxIsViewer +
                UserInterface.pxIsMap -
                UserInterface.splitterSizeHidden / 2 +
                'px'
        )

        resize()

        return false
    }
    if (mouseIsDown) {
        dragThreshold++
    }
}

function toolsSplitOnMouseMove(e) {
    if (dragThreshold > threshold) {
        //For touches
        if (!e.clientY && e.originalEvent && e.originalEvent.touches)
            e.clientY = e.originalEvent.touches[0].clientY

        UserInterface.pxIsTools =
            UserInterface.mainHeight -
            e.clientY +
            UserInterface.splitterSize / 4
        if (UserInterface.pxIsTools < UserInterface.splitterSize / 4) {
            UserInterface.pxIsTools = UserInterface.splitterSize / 4
        }
        if (
            UserInterface.pxIsTools >
            UserInterface.mainHeight -
                (UserInterface.splitterSize + UserInterface.topSize)
        ) {
            UserInterface.pxIsTools =
                UserInterface.mainHeight -
                (UserInterface.splitterSize + UserInterface.topSize)
        }

        //The viewer slider
        UserInterface.viewerSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The map slider
        UserInterface.mapSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The globe slider
        UserInterface.globeSplit.css(
            'height',
            UserInterface.mainHeight -
                UserInterface.pxIsTools -
                UserInterface.topSize +
                'px'
        )

        //The tools screen
        UserInterface.toolsScreen.css('height', UserInterface.pxIsTools + 'px')
        //The tools slider
        UserInterface.toolsSplit.css(
            'bottom',
            UserInterface.pxIsTools - UserInterface.splitterSize / 2 + 'px'
        )

        resize()
        return false
    }
    if (mouseIsDown) {
        dragThreshold++
    }
}

function resize() {
    //resize viewer
    if (Viewer_ != null) Viewer_.invalidateSize()
    //resize map
    if (Map_ != null) Map_.map.invalidateSize()
    //resize globe
    if (Globe_ != null) Globe_.litho.invalidateSize()

    shouldRotateSplitterText()

    // Update TimeUI positions when layout changes
    if (
        L_.TimeControl_ &&
        L_.TimeControl_.timeUI &&
        typeof L_.TimeControl_.timeUI.alignPopovers === 'function'
    ) {
        L_.TimeControl_.timeUI.alignPopovers()
    }
}
function windowresize() {
    //Could've just used percents overall but oh well
    //converts from px to percent, finds new dimensions, then converts back to px
    //Don't let them get smaller than the splitter size
    if (UserInterface.pxIsViewer != UserInterface.splitterSize)
        UserInterface.pxIsViewer =
            (UserInterface.pxIsViewer / UserInterface.mainWidth) *
            $('#splitscreens').width()
    if (UserInterface.pxIsMap != UserInterface.splitterSize)
        UserInterface.pxIsMap =
            (UserInterface.pxIsMap / UserInterface.mainWidth) *
            $('#splitscreens').width()
    if (UserInterface.pxIsGlobe != UserInterface.splitterSize)
        UserInterface.pxIsGlobe =
            (UserInterface.pxIsGlobe / UserInterface.mainWidth) *
            $('#splitscreens').width()

    //Update these
    UserInterface.mainWidth = $('#splitscreens').width()
    UserInterface.mainHeight = $('#splitscreens').height()

    //Resize widest panel so that their sum is the screen width
    const widest = Math.max(
        UserInterface.pxIsViewer,
        UserInterface.pxIsMap,
        UserInterface.pxIsGlobe
    )
    if (UserInterface.pxIsMap == widest)
        UserInterface.pxIsMap =
            UserInterface.mainWidth -
            UserInterface.pxIsViewer -
            UserInterface.pxIsGlobe
    else if (UserInterface.pxIsViewer == widest)
        UserInterface.pxIsViewer =
            UserInterface.mainWidth -
            UserInterface.pxIsMap -
            UserInterface.pxIsGlobe
    else if (UserInterface.pxIsGlobe == widest)
        UserInterface.pxIsGlobe =
            UserInterface.mainWidth -
            UserInterface.pxIsViewer -
            UserInterface.pxIsMap

    //Update their sizes now
    //The viewer screen
    UserInterface.viewerScreen.css({
        width: UserInterface.pxIsViewer + 'px',
        height: UserInterface.mainHeight + 'px',
    })
    //The viewer slider
    UserInterface.viewerSplit.css('height', UserInterface.mainHeight + 'px')
    //resize viewer
    if (Viewer_ != null) Viewer_.invalidateSize()

    //The map screen
    UserInterface.mapScreen.css({
        width: UserInterface.pxIsMap - UserInterface.splitterSize * 2 + 'px',
        height: UserInterface.mainHeight + 'px',
        left: UserInterface.pxIsViewer + UserInterface.splitterSize + 'px',
    })
    //The map slider
    UserInterface.mapSplit.css({
        height: UserInterface.mainHeight + 'px',
        left:
            UserInterface.pxIsViewer -
            UserInterface.splitterSizeHidden / 2 +
            'px',
    })

    //The globe screen
    UserInterface.globeScreen.css({
        width: UserInterface.pxIsGlobe + 'px',
        height: UserInterface.mainHeight + 'px',
        left: UserInterface.pxIsViewer + UserInterface.pxIsMap + 'px',
    })
    //The globe slider
    UserInterface.globeSplit.css({
        height: UserInterface.mainHeight + 'px',
        left:
            UserInterface.pxIsViewer +
            UserInterface.pxIsMap -
            UserInterface.splitterSizeHidden / 2 +
            'px',
    })

    //Don't let tools exceed max
    if (
        UserInterface.pxIsTools >
        UserInterface.mainHeight -
            UserInterface.splitterSize -
            UserInterface.topSize
    ) {
        UserInterface.setToolHeight('full', true)
    }

    shouldRotateSplitterText()
}

function shouldRotateSplitterText() {
    //How wide must the panel be to move text to top
    var boundary = 100
    if (UserInterface.pxIsViewer >= boundary) {
        if (!$('#viewerSplitText').hasClass('active'))
            $('#viewerSplitText').addClass('active')
    } else {
        if ($('#viewerSplitText').hasClass('active'))
            $('#viewerSplitText').removeClass('active')
    }

    if (UserInterface.pxIsMap >= boundary) {
        if (!$('#mapSplitText').hasClass('active'))
            $('#mapSplitText').addClass('active')
    } else {
        if ($('#mapSplitText').hasClass('active'))
            $('#mapSplitText').removeClass('active')
    }

    if (UserInterface.pxIsGlobe >= boundary) {
        if (!$('#globeSplitText').hasClass('active'))
            $('#globeSplitText').addClass('active')
    } else {
        if ($('#globeSplitText').hasClass('active'))
            $('#globeSplitText').removeClass('active')
    }
}

//Currently can't remove map
function clearUnwantedPanels(hasViewer, hasMap, hasGlobe) {
    if (!hasViewer && !hasGlobe) {
        $('#mapSplit').off('mousedown', mapSplitOnMouseDown)
        $('#mapSplit').off('touchstart', mapSplitOnMouseDown)
        $('#viewerSplit').empty()
        $('#viewerSplit').css('width', 0)
        $('#mapSplit div:not(#mapSplitText)').remove()
        $('#mapSplit').css('cursor', 'default').css('box-shadow', 'none')
        $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
        $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
        $('#globeSplit').empty()
        $('#globeSplit')
            .css('width', '0')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
        $('#mapSplit').empty()
        $('#mapSplit').css('width', '0')
        $('#mapScreen').css('top', '0')
        UserInterface.splitterSize = 0
    } else if (!hasViewer) {
        $('#mapSplit').off('mousedown', mapSplitOnMouseDown)
        $('#mapSplit').off('touchstart', mapSplitOnMouseDown)
        $('#viewerSplit').empty()
        $('#viewerSplit').css('width', 0)
        $('#mapSplit div:not(#mapSplitText)').remove()
        $('#mapSplit').css('cursor', 'default').css('box-shadow', 'none')
    } else if (!hasGlobe) {
        $('#globeSplit').off('mousedown', globeSplitOnMouseDown)
        $('#globeSplit').off('touchstart', globeSplitOnMouseDown)
        $('#globeSplit').empty()
        $('#globeSplit')
            .css('width', '0')
            .css('cursor', 'default')
            .css('box-shadow', 'none')
    }
    windowresize()
    Map_.map.invalidateSize()
}

$(document).ready(function () {
    UserInterface.init()
})

export default UserInterface
