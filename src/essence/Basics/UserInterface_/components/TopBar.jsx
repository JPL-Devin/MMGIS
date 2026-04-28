import React, { useState, useCallback, useEffect, useRef } from 'react'
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
    const [username, setUsername] = useState(null)
    const [showUserCard, setShowUserCard] = useState(false)
    const userCardRef = useRef(null)
    const userBtnRef = useRef(null)

    useEffect(() => {
        const unsub = uiStore.subscribe((state) => {
            setViewerOpen(state.viewerPanelOpen)
            setMapOpen(state.mapPanelOpen)
            setGlobeOpen(state.globePanelOpen)
        })
        return unsub
    }, [])

    useEffect(() => {
        function syncUser() {
            if (window.mmgisglobal && window.mmgisglobal.user && window.mmgisglobal.user !== 'guest') {
                setUsername(window.mmgisglobal.user)
            } else {
                setUsername(null)
            }
        }
        syncUser()
        const interval = setInterval(syncUser, 2000)
        return () => clearInterval(interval)
    }, [])

    // Hide the jQuery #loginDiv since we handle user UI in React now
    useEffect(() => {
        const loginDiv = document.getElementById('loginDiv')
        if (loginDiv) loginDiv.style.display = 'none'
        return () => {
            if (loginDiv) loginDiv.style.display = ''
        }
    }, [])

    // Close user card when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                userCardRef.current && !userCardRef.current.contains(e.target) &&
                userBtnRef.current && !userBtnRef.current.contains(e.target)
            ) {
                setShowUserCard(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleToggleViewer = useCallback(() => {
        if (UserInterface && UserInterface.hasViewer === false) return
        const newState = !uiStore.getState().viewerPanelOpen
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                uiStore.getState().setViewerPanelOpen(true)
                const globeAmt = pp.globe > 0 ? 33 : 0
                const mapAmt = 100 - 33 - globeAmt
                UserInterface.setPanelPercents(33, mapAmt, globeAmt)
            } else {
                uiStore.getState().setViewerPanelOpen(false)
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
            }
        }
    }, [UserInterface])

    const handleToggleGlobe = useCallback(async () => {
        if (UserInterface && UserInterface.hasGlobe === false) return
        if (Globe_._isInitializing) return
        const newState = !uiStore.getState().globePanelOpen
        if (!Globe_._initialized) {
            Globe_._isInitializing = true
            try {
                await Globe_.lazyInit()
            } finally {
                Globe_._isInitializing = false
            }
            if (newState && uiStore.getState().globePanelOpen === newState) return
        }
        if (UserInterface && UserInterface.setPanelPercents) {
            const pp = UserInterface.getPanelPercents()
            if (newState) {
                uiStore.getState().setGlobePanelOpen(true)
                const viewerAmt = pp.viewer > 0 ? 33 : 0
                const mapAmt = 100 - 33 - viewerAmt
                UserInterface.setPanelPercents(viewerAmt, mapAmt, 33)
            } else {
                uiStore.getState().setGlobePanelOpen(false)
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

    const handleLogout = useCallback(() => {
        setShowUserCard(false)
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

    const handleSignIn = useCallback(() => {
        const loginoutBtn = document.getElementById('loginoutButton')
        if (loginoutBtn) loginoutBtn.click()
    }, [])

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

            {/* User account area */}
            <div className="topbar-user-area">
                {username ? (
                    <div className="topbar-user-wrapper">
                        <div
                            ref={userBtnRef}
                            className="topbar-user-avatar"
                            onClick={() => setShowUserCard(!showUserCard)}
                            title={username}
                        >
                            {username[0].toUpperCase()}
                        </div>
                        {showUserCard && (
                            <div ref={userCardRef} className="topbar-user-card">
                                <div className="topbar-user-card-name">{username}</div>
                                <div className="topbar-user-card-divider" />
                                <div className="topbar-user-card-action" onClick={handleLogout}>
                                    <i className="mdi mdi-logout" style={{ marginRight: 6, fontSize: 14 }} />
                                    Logout
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className="topbar-signin-btn"
                        onClick={handleSignIn}
                        title="Sign In"
                    >
                        <i className="mdi mdi-login" style={{ fontSize: 16 }} />
                    </div>
                )}
            </div>
        </div>
    )
}

export default TopBar
