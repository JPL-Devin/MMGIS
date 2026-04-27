import React, { useState, useCallback, useEffect } from 'react'
import { Button, Input } from '../../../../design-system'
import uiStore from '../store/uiStore'
import Globe_ from '../../Globe_/Globe_'

import './TopBar.css'

function TopBar({ UserInterface }) {
    const [viewerOpen, setViewerOpen] = useState(
        uiStore.getState().viewerPanelOpen
    )
    const [mapOpen, setMapOpen] = useState(uiStore.getState().mapPanelOpen)
    const [globeOpen, setGlobeOpen] = useState(
        uiStore.getState().globePanelOpen
    )

    useEffect(() => {
        const unsub = uiStore.subscribe((state) => {
            setViewerOpen(state.viewerPanelOpen)
            setMapOpen(state.mapPanelOpen)
            setGlobeOpen(state.globePanelOpen)
        })
        return unsub
    }, [])

    const handleToggleViewer = useCallback(() => {
        const newState = !uiStore.getState().viewerPanelOpen
        uiStore.getState().setViewerPanelOpen(newState)
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                const globeAmt = pp.globe > 0 ? 33 : 0
                const mapAmt = 100 - 33 - globeAmt
                UserInterface.setPanelPercents(33, mapAmt, globeAmt)
            } else {
                if (pp.map > 0 && pp.globe > 0) {
                    UserInterface.setPanelPercents(0, pp.map + pp.viewer / 2, pp.globe + pp.viewer / 2)
                } else if (pp.map > 0) {
                    UserInterface.setPanelPercents(0, pp.map + pp.viewer, 0)
                } else if (pp.globe > 0) {
                    UserInterface.setPanelPercents(0, 0, pp.globe + pp.viewer)
                } else {
                    UserInterface.setPanelPercents(0, 100, 0)
                }
            }
        }
    }, [UserInterface])

    const handleToggleMap = useCallback(() => {
        const newState = !uiStore.getState().mapPanelOpen
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                uiStore.getState().setMapPanelOpen(true)
                if (pp.viewer > 0 && pp.globe > 0) {
                    UserInterface.setPanelPercents(pp.viewer / 2, 50, pp.globe / 2)
                } else if (pp.viewer > 0) {
                    UserInterface.setPanelPercents(pp.viewer / 2, 50, 0)
                } else if (pp.globe > 0) {
                    UserInterface.setPanelPercents(0, 50, pp.globe / 2)
                } else {
                    UserInterface.setPanelPercents(0, 100, 0)
                }
            } else {
                if (pp.viewer > 0 || pp.globe > 0) {
                    uiStore.getState().setMapPanelOpen(false)
                    if (pp.viewer > 0 && pp.globe > 0) {
                        UserInterface.setPanelPercents(pp.viewer + pp.map / 2, 0, pp.globe + pp.map / 2)
                    } else if (pp.viewer > 0) {
                        UserInterface.setPanelPercents(pp.viewer + pp.map, 0, 0)
                    } else {
                        UserInterface.setPanelPercents(0, 0, pp.globe + pp.map)
                    }
                }
                // If no other panels open, do nothing (can't close the only panel)
            }
        }
    }, [UserInterface])

    const handleToggleGlobe = useCallback(async () => {
        const newState = !uiStore.getState().globePanelOpen
        uiStore.getState().setGlobePanelOpen(newState)
        // Lazy-init Globe on first open — await so renderer is ready before resize
        if (newState && !Globe_._initialized) {
            await Globe_.lazyInit()
        }
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                const viewerAmt = pp.viewer > 0 ? 33 : 0
                const mapAmt = 100 - 33 - viewerAmt
                UserInterface.setPanelPercents(viewerAmt, mapAmt, 33)
            } else {
                if (pp.map > 0 && pp.viewer > 0) {
                    UserInterface.setPanelPercents(pp.viewer + pp.globe / 2, pp.map + pp.globe / 2, 0)
                } else if (pp.map > 0) {
                    UserInterface.setPanelPercents(0, pp.map + pp.globe, 0)
                } else if (pp.viewer > 0) {
                    UserInterface.setPanelPercents(pp.viewer + pp.globe, 0, 0)
                } else {
                    UserInterface.setPanelPercents(0, 100, 0)
                }
            }
        }
    }, [UserInterface])

    return (
        <div className="topbar-react-overlay">
            <div className="topbar-panel-toggles">
                <Button
                    variant="toolbar"
                    size="compact"
                    active={viewerOpen}
                    onClick={handleToggleViewer}
                    className="topbar-toggle-btn"
                    title="Toggle Viewer panel"
                >
                    Viewer
                </Button>
                <Button
                    variant="toolbar"
                    size="compact"
                    active={mapOpen}
                    onClick={handleToggleMap}
                    className="topbar-toggle-btn"
                    title="Toggle Map panel"
                >
                    Map
                </Button>
                <Button
                    variant="toolbar"
                    size="compact"
                    active={globeOpen}
                    onClick={handleToggleGlobe}
                    className="topbar-toggle-btn"
                    title="Toggle Globe panel"
                >
                    Globe
                </Button>
            </div>
        </div>
    )
}

export default TopBar
