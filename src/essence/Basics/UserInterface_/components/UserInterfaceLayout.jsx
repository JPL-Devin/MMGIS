import React, { useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { applyTheme } from '../../../../design-system/applyTheme'
import uiStore from '../store/uiStore'
import TopBar from './TopBar'
import Toolbar from './Toolbar'
import BottomBarReact from './BottomBarReact'
import ToolPanel from './ToolPanel'
import SplitScreens from './SplitScreens'

import './UserInterfaceLayout.css'
import './FloatingElements.css'

function UserInterfaceLayout({ UserInterface }) {
    useEffect(() => {
        // Only subscribe to future theme changes; do NOT apply theme on mount
        // because Stylize.js has already applied the base theme + individual
        // color overrides by this point — re-applying would wipe overrides.
        const unsub = uiStore.subscribe((state, prev) => {
            if (state.themeName !== prev.themeName) {
                applyTheme(state.themeName)
            }
        })
        return unsub
    }, [])

    // MutationObserver bridge for TimeUI
    useEffect(() => {
        const timeEl = document.getElementById('timeUI')
        if (!timeEl) return

        const observer = new MutationObserver(() => {
            // TimeUI state sync - just ensure visibility is maintained
        })
        observer.observe(timeEl, { childList: true, subtree: true })
        return () => observer.disconnect()
    }, [])

    const topBarEl = document.getElementById('topBar')
    const toolbarEl = document.getElementById('toolbar')
    const barBottomEl = document.getElementById('barBottom')
    const toolPanelEl = document.getElementById('toolPanel')

    return (
        <>
            {topBarEl &&
                createPortal(
                    <TopBar UserInterface={UserInterface} />,
                    topBarEl
                )}
            {toolbarEl &&
                createPortal(
                    <Toolbar UserInterface={UserInterface} />,
                    toolbarEl
                )}
            {barBottomEl &&
                createPortal(
                    <BottomBarReact UserInterface={UserInterface} />,
                    barBottomEl
                )}
        </>
    )
}

export default UserInterfaceLayout
