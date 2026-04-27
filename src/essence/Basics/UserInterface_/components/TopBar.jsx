import React, { useState, useCallback, useEffect } from 'react'
import { Button, Input } from '../../../../design-system'
import uiStore from '../store/uiStore'

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
                UserInterface.setPanelPercents(
                    33,
                    pp.globe > 0 ? 34 : 67,
                    pp.globe
                )
            } else {
                UserInterface.setPanelPercents(
                    0,
                    pp.map + pp.viewer,
                    pp.globe
                )
            }
        }
    }, [UserInterface])

    const handleToggleMap = useCallback(() => {
        const newState = !uiStore.getState().mapPanelOpen
        uiStore.getState().setMapPanelOpen(newState)
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                const total = pp.viewer + pp.globe
                if (total === 0) {
                    UserInterface.setPanelPercents(0, 100, 0)
                } else {
                    UserInterface.setPanelPercents(
                        pp.viewer > 0 ? pp.viewer / 2 : 0,
                        50,
                        pp.globe > 0 ? pp.globe / 2 : 0
                    )
                }
            } else {
                UserInterface.setPanelPercents(
                    pp.viewer > 0 ? pp.viewer + pp.map / 2 : 0,
                    0,
                    pp.globe > 0 ? pp.globe + pp.map / 2 : 0
                )
            }
        }
    }, [UserInterface])

    const handleToggleGlobe = useCallback(() => {
        const newState = !uiStore.getState().globePanelOpen
        uiStore.getState().setGlobePanelOpen(newState)
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                UserInterface.setPanelPercents(
                    pp.viewer,
                    pp.viewer > 0 ? 34 : 67,
                    33
                )
            } else {
                UserInterface.setPanelPercents(
                    pp.viewer,
                    pp.map + pp.globe,
                    0
                )
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
