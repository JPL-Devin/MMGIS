import $ from 'jquery'
import L_ from '../Layers_/Layers_'
import TimeUI from '../TimeControl_/TimeUI'
import { toolModules, toolConfigs } from '../../../pre/tools'

import tippy from 'tippy.js'

let ToolController_ = {
    tools: null,
    incToolsDiv: null,
    excToolsDiv: null,
    separatedContentDiv: null,
    sepToolbarDiv: null,
    activeSeparatedTools: [],
    toolModuleNames: [],
    toolModules: toolModules,
    activeTool: null,
    activeToolName: null,
    prevHeight: 0,
    defaultColor: 'var(--color-f)',
    hoverColor: 'var(--color-mmgis)',
    activeColor: 'var(--color-mmgis)',
    activeBG: 'var(--color-i)',
    loaded: false,
    init: function (tools) {
        this.tools = tools

        var mainDiv = $('<div>')
            .attr('id', 'toolbarTools')
            .css('height', '100%')
        $('#toolbar').append(mainDiv)

        this.incToolsDiv = $('<div>')
            .attr('id', 'toolcontroller_incdiv')
            .attr('class', 'sixteen wide column')
            .css({
                'transition': 'all 0.25s ease-in',
                'pointer-events': 'none',
                'opacity': '0',
                'padding-bottom': '8px'
            })
        mainDiv.append(this.incToolsDiv)

        // Container for separated tool content (floats over the map)
        this.separatedContentDiv = $('<div>')
            .attr('id', 'toolcontroller_sep_content')
            .css({
                'position': 'absolute',
                'top': '12px',
                'left': '12px',
                'z-index': '1002',
                'display': 'flex',
                'gap': '12px',
                'pointer-events': 'none',
            })
        $('#splitscreens').append(this.separatedContentDiv)

        // Separator + container for separated tool buttons in toolbar
        this.sepToolbarDiv = $('<div>')
            .attr('id', 'toolcontroller_sepdiv')
        mainDiv.append(this.sepToolbarDiv)

        const sepDivider = $('<div>')
            .attr('class', 'toolSepDivider')
            .css({
                'width': '26px',
                'height': '1px',
                'background': '#2a3444',
                'margin': '4px auto',
            })
        this.sepToolbarDiv.append(sepDivider)

        // Helper function to create a separated tool
        // Button goes in toolbar, content floats over map
        const createSeparatedTool = (i) => {
            const isIdentifier = tools[i].name === 'Identifier'
            const toolWidth = this.toolModules[tools[i].name + 'Tool']
                ? this.toolModules[tools[i].name + 'Tool'].width || 200
                : 200

            // Outer floating panel wrapper (glassy styling) — skip for Identifier (toggle-only tool)
            const toolPanel = $('<div>')
                .attr('id', `toolPanelSeparated_${tools[i].name}`)
                .attr('class', 'sep-tool-panel')
                .css({
                    'width': isIdentifier ? '0px' : toolWidth + 'px',
                    'max-height': isIdentifier ? '0px' : 'calc(100vh - 120px)',
                    'border-radius': '10px',
                    'background': isIdentifier ? 'transparent' : 'rgba(26,26,27,0.88)',
                    'border': isIdentifier ? 'none' : '1px solid #1f2937',
                    'backdrop-filter': isIdentifier ? 'none' : 'blur(20px)',
                    '-webkit-backdrop-filter': isIdentifier ? 'none' : 'blur(20px)',
                    'box-shadow': isIdentifier ? 'none' : '0 8px 32px rgba(0,0,0,0.4)',
                    'display': 'none',
                    'flex-direction': 'column',
                    'overflow': 'hidden',
                    'pointer-events': isIdentifier ? 'none' : 'auto',
                })
            this.separatedContentDiv.append(toolPanel)

            // Header with title and close button (matching mockup)
            const toolHeader = $('<div>')
                .attr('class', 'sep-tool-header')
                .css({
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'space-between',
                    'padding': '10px 12px',
                    'border-bottom': '1px solid #1f2937',
                    'flex-shrink': '0',
                })
            const headerTitle = $('<span>')
                .css({
                    'font-size': '13px',
                    'font-weight': '600',
                    'color': '#e5e5e5',
                    'text-transform': 'uppercase',
                    'letter-spacing': '0.05em',
                })
                .text(tools[i].name)
            const headerClose = $('<div>')
                .attr('title', 'Close')
                .css({
                    'cursor': 'pointer',
                    'color': '#6b7280',
                    'width': '20px',
                    'height': '20px',
                    'display': 'flex',
                    'align-items': 'center',
                    'justify-content': 'center',
                    'border-radius': '4px',
                    'transition': 'all 0.15s',
                })
                .html('<i class="mdi mdi-close" style="font-size:14px"></i>')
                .on('mouseenter', function() { $(this).css({'color': '#e5e5e5', 'background': 'rgba(255,255,255,0.1)'}) })
                .on('mouseleave', function() { $(this).css({'color': '#6b7280', 'background': 'none'}) })
                .on('click', (function(i) {
                    return function() {
                        $(`#toolButtonSeparated_${tools[i].name}`).click()
                    }
                })(i))
            toolHeader.append(headerTitle).append(headerClose)
            toolPanel.append(toolHeader)

            // Inner content area (this is what the tool targets for rendering)
            const toolContent = $('<div>')
                .attr('id', `toolContentSeparated_${tools[i].name}`)
                .css({
                    'flex': '1',
                    'overflow': 'auto',
                    'min-height': '0',
                })
            toolPanel.append(toolContent)

            // Tool button in the toolbar (dedicated section)
            const toolButton = $('<div>')
                .attr('id', `toolButtonSeparated_${tools[i].name}`)
                .attr('class', 'toolButton toolSep')
                .attr('tabindex', i + 1)
                .css({
                    'width': '100%',
                    'height': '36px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '36px',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.15s',
                    'color': '#08aeea',
                })
                .on(
                    'click',
                    (function (i) {
                        return function () {
                            const tM =
                                ToolController_.toolModules[
                                    `${ToolController_.tools[i].name}Tool`
                                ]
                            if (tM) {
                                const isIdent = ToolController_.tools[i].name === 'Identifier'
                                if (tM.made === false) {
                                    tM.make(
                                        `toolContentSeparated_${ToolController_.tools[i].name}`
                                    )
                                    // Only show floating panel for non-Identifier tools
                                    if (!isIdent) {
                                        $(`#toolPanelSeparated_${ToolController_.tools[i].name}`).css('display', 'flex')
                                    }
                                    ToolController_.activeSeparatedTools.push(
                                        ToolController_.tools[i].name + 'Tool'
                                    )
                                    $(
                                        `#toolButtonSeparated_${tools[i].name}`
                                    ).addClass('active')
                                } else {
                                    tM.destroy()
                                    if (!isIdent) {
                                        $(`#toolPanelSeparated_${ToolController_.tools[i].name}`).css('display', 'none')
                                    }
                                    ToolController_.activeSeparatedTools =
                                        ToolController_.activeSeparatedTools.filter(
                                            (a) =>
                                                a !=
                                                ToolController_.tools[i].name +
                                                    'Tool'
                                        )

                                    $(
                                        `#toolButtonSeparated_${tools[i].name}`
                                    ).removeClass('active')
                                }

                                // Dispatch `toggleSeparatedTool` event
                                let _event = new CustomEvent(
                                    'toggleSeparatedTool',
                                    {
                                        detail: {
                                            toggledToolName:
                                                ToolController_.tools[i].js,
                                            visible: tM.made,
                                        },
                                    }
                                )
                                document.dispatchEvent(_event)
                            }
                        }
                    })(i)
                )
                .on('mouseover', function () {
                    if (!$(this).hasClass('active')) {
                        $(this).css({ background: 'rgba(30,58,95,0.19)' })
                    }
                })
                .on('mouseleave', function () {
                    if (!$(this).hasClass('active')) {
                        $(this).css({ background: 'none' })
                    }
                })
            this.sepToolbarDiv.append(toolButton)

            const sepIcon = $('<i>')
                .attr('id', tools[i].name + 'Tool')
                .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                .css('cursor', 'pointer')
            toolButton.append(sepIcon)

            if (!L_.UserInterface_.isMobile) {
                tippy(`#toolButtonSeparated_${tools[i].name}`, {
                    content: tools[i].name,
                    placement: 'right',
                    theme: 'blue',
                })
            }
        }

        let legendToolIndex = -1

        for (let i = 0; i < tools.length; i++) {
            this.toolModuleNames.push(tools[i].js)

            if (tools[i].separatedTool && L_.UserInterface_.isMobile !== true) {
                // Legend tool should always be last in its container
                if (tools[i].name === 'Legend') {
                    legendToolIndex = i
                    continue
                }
                createSeparatedTool(i)
            } else {
                const toolButton = $('<div>')
                    .attr('id', `toolButton${tools[i].name}`)
                    .attr('class', 'toolButton')
                    .css(
                        'width',
                        L_.UserInterface_.isMobile === true ? '45px' : '100%'
                    )
                    .css(
                        'height',
                        L_.UserInterface_.isMobile === true ? '100%' : '36px'
                    )
                    .css('display', 'inline-block')
                    .css('text-align', 'center')
                    .css('line-height', '36px')
                    .css(
                        'border-top',
                        i === 0 ? '1px solid var(--color-a-5)' : 'none'
                    )
                    .css('border-bottom', '1px solid var(--color-a-5)')
                    //.css( 'text-shadow', '0px 1px #111' )
                    .css('vertical-align', 'middle')
                    .css('cursor', 'pointer')
                    .attr('tabindex', i + 1)
                    .css('transition', 'all 0.2s ease-in')
                    .css('color', ToolController_.defaultColor)
                    .on(
                        'click',
                        (function (i) {
                            return function () {
                                var hasActive = false
                                if ($(this).hasClass('active')) {
                                    hasActive = true
                                }
                                var prevActive = $(
                                    '#toolcontroller_incdiv .active'
                                )
                                prevActive.removeClass('active').css({
                                    color: ToolController_.defaultColor,
                                    background: 'none',
                                })
                                prevActive.parent().css({
                                    background: 'none',
                                })
                                if (!hasActive) {
                                    var newActive = $(
                                        '#toolcontroller_incdiv #' +
                                            ToolController_.tools[i].name +
                                            'Tool'
                                    )
                                    newActive.addClass('active').css({
                                        color: ToolController_.activeColor,
                                    })
                                    newActive.parent().css({
                                        background: ToolController_.activeBG,
                                    })
                                }

                                ToolController_.makeTool(
                                    ToolController_.toolModuleNames[i],
                                    i
                                )

                                // Dispatch `toolChange` event
                                let _event = new CustomEvent('toolChange', {
                                    detail: {
                                        activeTool: ToolController_.activeTool,
                                        activeToolName:
                                            ToolController_.activeToolName,
                                    },
                                })
                                document.dispatchEvent(_event)
                            }
                        })(i)
                    )
                    // Hover styling handled by CSS .toolButton:hover rule
                this.incToolsDiv.append(toolButton)

                const toolIcon = $('<i>')
                    .attr('id', tools[i].name + 'Tool')
                    .attr('class', 'mdi mdi-' + tools[i].icon + ' mdi-18px')
                    .css('cursor', 'pointer')
                toolButton.append(toolIcon)

                if (!L_.UserInterface_.isMobile) {
                    // Only show tooltip if not in mobile mode
                    tippy(`#toolButton${tools[i].name}`, {
                        content: tools[i].name,
                        placement: 'right',
                        theme: 'blue',
                    })
                }
            }
        }

        // Add Legend tool last if it exists
        if (legendToolIndex >= 0) {
            createSeparatedTool(legendToolIndex)
        }

        // FIXME For now, remove the time button in the toolbar
        // Add the time UI button if time is enabled and in mobile mode
        if (
            L_.UserInterface_?.isMobile === true &&
            L_.configData.time &&
            L_.configData.time.enabled === true
        ) {
            let timeSelect = $('<div>')
                .attr('id', 'toggleTimeUI')
                .attr('class', 'toolButton')
                .css({
                    'position': 'relative',
                    'width': '45px',
                    'height': '45px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '45px',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease-in',
                    'color': ToolController_.defaultColor
                })
                .on(
                    'click',
                    (function () {
                        return function () {
                            var hasActive = false
                            if ($(this).hasClass('active')) {
                                hasActive = true
                            }
                            var prevActive = $('#toolcontroller_incdiv .active')
                            prevActive.removeClass('active').css({
                                color: ToolController_.defaultColor,
                                background: 'none',
                            })
                            prevActive.parent().css({
                                background: 'none',
                            })
                            if (!hasActive) {
                                var newActive = $(
                                    '#toolcontroller_incdiv #toggleTimeUI'
                                )
                                newActive.addClass('active').css({
                                    color: ToolController_.activeColor,
                                })

                                TimeUI.initialize()
                                ToolController_.setToolHeight(TimeUI.height)
                                ToolController_.setToolWidth()
                                ToolController_.activeToolName = 'TimeUI'
                                TimeUI.make()
                                TimeUI.toggleExpanded()
                                TimeUI.fina()
                            } else {
                                ToolController_.setToolHeight(0)
                                ToolController_.setToolWidth()
                                TimeUI.destroy()
                                ToolController_.closeActiveTool()
                                ToolController_.activeToolName = null
                            }

                            $('#topBar').css({
                                'padding-left': '40px',
                                'margin-left': '0px',
                                width: '100%',
                            })
                        }
                    })()
                )
            $('#toolcontroller_incdiv').append(timeSelect)

            timeSelect
                .append($('<i>')
                    .attr('class', 'mdi mdi-clock mdi-18px')
                    .css('cursor', 'pointer')
                )
        }

        if (
            L_.UserInterface_?.isMobile === true &&
            (L_.configData.coordinates.coordll == true ||
                L_.configData.coordinates.coorden == true)
        ) {
            let coordSelect = $('<div>')
                .attr('id', 'coordinatesDiv')
                .attr('class', 'toolButton')
                .css({
                    'position': 'relative',
                    'width': '45px',
                    'height': '45px',
                    'display': 'inline-block',
                    'text-align': 'center',
                    'line-height': '45px',
                    'vertical-align': 'middle',
                    'cursor': 'pointer',
                    'transition': 'all 0.2s ease-in',
                    'color': ToolController_.defaultColor
                })
                .on(
                    'click',
                    (function () {
                        return function () {
                            var hasActive = false
                            if ($(this).hasClass('active')) {
                                hasActive = true
                            }
                            var prevActive = $('#toolcontroller_incdiv .active')
                            prevActive.removeClass('active').css({
                                color: ToolController_.defaultColor,
                                background: 'none',
                            })
                            prevActive.parent().css({
                                background: 'none',
                            })
                            if (!hasActive) {
                                var newActive = $(
                                    '#toolcontroller_incdiv #coordinatesDiv'
                                )
                                newActive.addClass('active').css({
                                    color: ToolController_.activeColor,
                                })

                                L_.Coordinates.initialize()
                                L_.Coordinates.init()
                                ToolController_.setToolHeight(
                                    L_.Coordinates.height
                                )
                                ToolController_.setToolWidth()
                                ToolController_.activeToolName = 'CoordinatesTool'
                                L_.Coordinates.make()
                            } else {
                                ToolController_.setToolHeight(0)
                                ToolController_.setToolWidth()
                                L_.Coordinates.destroy()
                                ToolController_.closeActiveTool()
                                ToolController_.activeToolName = null
                            }

                            $('#topBar').css({
                                'padding-left': '40px',
                                'margin-left': '0px',
                                width: '100%',
                            })
                        }
                    })()
                )
            $('#toolcontroller_incdiv').append(coordSelect)

            coordSelect
                .append($('<i>')
                    .attr('class', 'mdi mdi-target mdi-18px')
                    .css('cursor', 'pointer')
                )
        }

        ToolController_.incToolsDiv
            .css('pointer-events', 'auto')
            .css('opacity', '1')

        ToolController_.toolModuleNames.forEach((t) => {
            if (
                ToolController_.toolModules[t] &&
                typeof ToolController_.toolModules[t].initialize === 'function'
            )
                ToolController_.toolModules[t].initialize()
        })

        ToolController_.loaded = true
        L_.toolsLoaded = true

        L_.fullyLoaded()
    },
    clear() {
        $('#toolbarTools').remove()
        $('#toolcontroller_sep_content').remove()
        this.tools = null
        this.incToolsDiv = null
        this.excToolsDiv = null
        this.separatedContentDiv = null
        this.sepToolbarDiv = null
        this.activeSeparatedTools = []
        this.toolModuleNames = []
        this.toolModules = []
    },
    getTool: function (name) {
        var tool = this.toolModules[name]
        return tool || { use: function () {} }
    },
    makeTool: function (name, idx) {
        var tool = this.getTool(name)

        if (tool != undefined) {
            if (this.activeToolName == null || name != this.activeToolName) {
                //change tool
                if (
                    typeof tool.make === 'function' &&
                    typeof tool.destroy === 'function'
                ) {
                    if (this.activeTool != null) {
                        try {
                            this.activeTool.destroy()
                        } catch (e) {
                            console.warn('Tool destroy error (non-fatal):', e)
                        }
                    }

                    // If previous tool was horizontal, reset tools height immediately
                    // to prevent stale pxIsTools from affecting the new tool's layout
                    if (this.prevHeight != 0 && this.UserInterface != null) {
                        this.UserInterface.setToolHeight(0)
                        this.prevHeight = 0
                    }

                    this.activeTool = tool
                    this.setToolHeight(this.activeTool.height)
                    this.setToolWidth(this.activeTool.width)
                    if (this.activeTool.height == 0) {
                        this.UserInterface.openToolPanel(this.activeTool.width)
                    } else {
                        this.UserInterface.closeToolPanel()
                    }
                    /*
                    if( this.prevHeight != this.activeTool.height && this.UserInterface != null ) {
                        this.UserInterface.setToolHeight( this.activeTool.height );
                    }
                    this.prevHeight = this.activeTool.height;
                    */
                    this.activeTool.make(this)

                    // Inject close X button into the tool's content area
                    ToolController_.injectCloseButton()
                } else {
                    console.warn(
                        'WARNING: ' +
                            name +
                            ' does not have a make or destroy function.' +
                            " All tools require a 'make' and a 'destroy' function."
                    )
                }
                this.activeToolName = name
            } else {
                //close tool
                this.closeActiveTool()
            }
        }
    },
    setToolHeight: function (newHeight) {
        if (this.prevHeight != newHeight && this.UserInterface != null) {
            this.UserInterface.setToolHeight(newHeight)
        }
        this.prevHeight = newHeight
    },
    setToolWidth: function (newWidth) {
        newWidth = newWidth || 'full'
        this.UserInterface.setToolWidth(newWidth)
    },
    notifyActiveTool: function (type, payload) {
        if (this.activeTool != null) {
            if (typeof this.activeTool.notify === 'function')
                this.activeTool.notify(type, payload)
        }
    },
    closeActiveTool: function () {
        var prevActive = $('#toolcontroller_incdiv .active')
        prevActive.removeClass('active').css({
            color: ToolController_.defaultColor,
            background: 'none',
        })
        prevActive.parent().css({ background: 'none' })

        if (this.activeTool != null) {
            try {
                this.activeTool.destroy()
            } catch (e) {
                console.warn('Tool destroy error (non-fatal):', e)
            }
            $('#tools').empty()
            this.UserInterface.closeToolPanel()
        }
        this.activeTool = null
        this.activeToolName = null
        if (this.prevHeight != 0 && this.UserInterface != null) {
            this.UserInterface.setToolHeight(0)
        }
        this.prevHeight = 0
    },
    injectCloseButton: function () {
        // Determine which container the tool rendered into
        const isHorizontal = this.activeTool && this.activeTool.height > 0
        const container = isHorizontal ? $('#tools') : $('#toolPanel')
        if (!container.length) return

        // Remove any existing injected close button
        container.find('.tool-close-btn').remove()

        const closeBtn = $('<div>')
            .addClass('tool-close-btn')
            .attr('title', 'Close Tool')
            .css({
                position: 'absolute',
                top: '6px',
                right: '6px',
                width: '26px',
                height: '26px',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                cursor: 'pointer',
                'border-radius': '4px',
                'z-index': '10',
                color: '#9ca3af',
                'font-size': '18px',
                transition: 'background 0.15s, color 0.15s',
            })
            .html("<i class='mdi mdi-close mdi-18px'></i>")
            .on('mouseenter', function () {
                $(this).css({ background: 'rgba(255,255,255,0.1)', color: '#fff' })
            })
            .on('mouseleave', function () {
                $(this).css({ background: 'transparent', color: '#9ca3af' })
            })
            .on('click', function () {
                ToolController_.closeActiveTool()
            })

        // Ensure the container has position:relative for absolute positioning
        const firstChild = container.children().first()
        if (firstChild.length) {
            firstChild.css('position', 'relative')
            firstChild.append(closeBtn)
        } else {
            container.css('position', 'relative')
            container.append(closeBtn)
        }
    },
    getToolsUrl: function () {
        var toolsUrl = ''
        for (var i = 0; i < this.toolModuleNames.length; i++) {
            var tool = this.toolModules[this.toolModuleNames[i]]
            if (tool && typeof tool.getUrlString === 'function') {
                var urlString = tool.getUrlString()
                if (urlString.length > 0)
                    toolsUrl += this.toolModuleNames[i] + '$' + urlString + ','
            }
        }
        //get rid of last , if there is one
        if (toolsUrl[toolsUrl.length - 1] == ',')
            toolsUrl = toolsUrl.substr(0, toolsUrl.length - 1)

        if (toolsUrl.length == 0) toolsUrl = false
        return toolsUrl
    },
    fina: function (userinterface) {
        this.UserInterface = userinterface
    },
    finalizeTools: function () {
        for (let i = 0; i < this.toolModuleNames.length; i++) {
            const tool = this.toolModules[this.toolModuleNames[i]]
            if (tool && typeof tool.finalize === 'function') {
                tool.finalize()
            }
        }
    },
}

window.ToolController_ = ToolController_
export default ToolController_
