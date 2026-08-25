import React, { useEffect, useRef } from 'react'

import SettingsView from './SettingsView'

export function getFocusableElements(drawer) {
    return drawer.querySelectorAll(
        'button, input, [tabindex]:not([tabindex="-1"])'
    )
}

export function handleSettingsDrawerKeyDown(
    event,
    drawer,
    onClose,
    activeElement = null
) {
    if (event.key === 'Escape') onClose()
    if (event.key !== 'Tab') return
    const currentElement =
        activeElement ||
        (typeof document !== 'undefined' ? document.activeElement : null)
    const items = getFocusableElements(drawer)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && currentElement === first) {
        event.preventDefault()
        last.focus()
    } else if (!event.shiftKey && currentElement === last) {
        event.preventDefault()
        first.focus()
    }
}

function SettingsDrawer({ settings, onClose }) {
    const drawerRef = useRef(null)

    useEffect(() => {
        const drawer = drawerRef.current
        if (!drawer) return undefined
        const focusable = getFocusableElements(drawer)[0]
        focusable?.focus()
        const handleKeyDown = (event) =>
            handleSettingsDrawerKeyDown(event, drawer, onClose)
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [onClose])

    return (
        <div className='layersNewTool_settingsOverlay'>
            <button
                type='button'
                className='layersNewTool_settingsDim'
                aria-label='Close settings'
                onClick={onClose}
            />
            <div
                ref={drawerRef}
                className='layersNewTool_settingsDrawer'
                role='dialog'
                aria-modal='true'
                aria-label='Layer settings'
            >
                <SettingsView settings={settings} onBack={onClose} />
            </div>
        </div>
    )
}

export default SettingsDrawer
