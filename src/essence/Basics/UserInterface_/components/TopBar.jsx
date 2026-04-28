import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Button } from '../../../../design-system'
import { useTheme } from '../../../../design-system/useTheme'
import uiStore from '../store/uiStore'
import Globe_ from '../../Globe_/Globe_'
import BottomBar from '../BottomBar'

import './TopBar.css'

function TopBar({ UserInterface }) {
    const theme = useTheme()

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
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef(null)
    const menuBtnRef = useRef(null)

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

    // Close user card and menu when clicking outside
    useEffect(() => {
        function handleClickOutside(e) {
            if (
                userCardRef.current && !userCardRef.current.contains(e.target) &&
                userBtnRef.current && !userBtnRef.current.contains(e.target)
            ) {
                setShowUserCard(false)
            }
            if (
                menuRef.current && !menuRef.current.contains(e.target) &&
                menuBtnRef.current && !menuBtnRef.current.contains(e.target)
            ) {
                setShowMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Apply theme colors to #topBar (jQuery-created parent)
    useEffect(() => {
        const topBar = document.getElementById('topBar')
        if (topBar) {
            topBar.style.background = theme['--color-a']
            topBar.style.borderBottom = `1px solid ${theme['--color-a1']}`
        }
    }, [theme])

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

    // Inline theme styles
    const s = {
        toggleGroup: {
            background: theme['--color-a-5'],
            border: `1px solid ${theme['--color-a1']}`,
        },
        toggleBtn: (active) => ({
            color: active ? theme['--color-mmgis'] : theme['--color-a3'],
            fontWeight: active ? 600 : 400,
            background: active ? theme['--color-accent-active'] : 'transparent',
            borderRight: `1px solid ${theme['--color-a1']}`,
        }),
        avatar: {
            background: theme['--color-accent-active'],
            color: theme['--color-c'],
            border: `1px solid ${theme['--color-a1']}`,
        },
        userCard: {
            background: theme.alpha('--color-a', 0.96),
            border: `1px solid ${theme['--color-a1']}`,
        },
        userCardName: {
            color: theme['--color-a5'],
        },
        userCardDivider: {
            background: theme['--color-a1'],
        },
        userCardAction: {
            color: theme['--color-a3'],
        },
        signIn: {
            color: theme['--color-a3'],
            border: `1px solid ${theme['--color-a1']}`,
        },
    }

    return (
        <div className="topbar-react-overlay">
            <div className="topbar-panel-toggles" style={s.toggleGroup}>
                <Button
                    variant="toolbar"
                    size="compact"
                    active={viewerOpen}
                    onClick={handleToggleViewer}
                    className="topbar-toggle-btn"
                    title="Toggle Viewer panel"
                    style={s.toggleBtn(viewerOpen)}
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
                    style={s.toggleBtn(mapOpen)}
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
                    style={{...s.toggleBtn(globeOpen), borderRight: 'none'}}
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
                            style={s.avatar}
                        >
                            {username[0].toUpperCase()}
                        </div>
                        {showUserCard && (
                            <div ref={userCardRef} className="topbar-user-card" style={s.userCard}>
                                <div className="topbar-user-card-name" style={s.userCardName}>{username}</div>
                                <div className="topbar-user-card-divider" style={s.userCardDivider} />
                                <div className="topbar-user-card-action" onClick={handleLogout} style={s.userCardAction}>
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
                        style={s.signIn}
                    >
                        <i className="mdi mdi-login" style={{ fontSize: 16 }} />
                    </div>
                )}
            </div>

            {/* Right menu (kebab) */}
            <div className="topbar-menu-wrapper">
                <div
                    ref={menuBtnRef}
                    className="topbar-menu-btn"
                    onClick={() => setShowMenu(!showMenu)}
                    title="Menu"
                    style={{ color: theme['--color-a3'], cursor: 'pointer' }}
                >
                    <i className="mdi mdi-dots-vertical" style={{ fontSize: 20 }} />
                </div>
                {showMenu && (
                    <div ref={menuRef} className="topbar-menu-dropdown" style={{
                        background: theme.alpha('--color-a', 0.96),
                        border: `1px solid ${theme['--color-a1']}`,
                    }}>
                        <div className="topbar-menu-item" style={{ color: theme['--color-a3'] }}
                            onClick={() => { BottomBar.copyLink(); setShowMenu(false) }}>
                            <i className="mdi mdi-open-in-new" style={{ marginRight: 8, fontSize: 14 }} />
                            Copy Link
                        </div>
                        <div className="topbar-menu-item" style={{ color: theme['--color-a3'] }}
                            onClick={() => { BottomBar.takeScreenshot(); setShowMenu(false) }}>
                            <i className="mdi mdi-camera" style={{ marginRight: 8, fontSize: 14 }} />
                            Screenshot
                        </div>
                        <div className="topbar-menu-item" style={{ color: theme['--color-a3'] }}
                            onClick={() => { BottomBar.fullscreen(); setShowMenu(false) }}>
                            <i className="mdi mdi-fullscreen" style={{ marginRight: 8, fontSize: 14 }} />
                            Fullscreen
                        </div>
                        <div className="topbar-menu-item" style={{ color: theme['--color-a3'] }}
                            onClick={() => { BottomBar.toggleHotkeys(true); setShowMenu(false) }}>
                            <i className="mdi mdi-keyboard" style={{ marginRight: 8, fontSize: 14 }} />
                            Keyboard Shortcuts
                        </div>
                        <div className="topbar-menu-item" style={{ color: theme['--color-a3'] }}
                            onClick={() => { BottomBar.toggleSettings(true); setShowMenu(false) }}>
                            <i className="mdi mdi-cog" style={{ marginRight: 8, fontSize: 14 }} />
                            Settings
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default TopBar
