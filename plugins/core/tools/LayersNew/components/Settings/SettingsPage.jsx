import React from 'react'

import SettingsView from './SettingsView'

function SettingsPage({ settings, onClose }) {
    return (
        <div className='layersNewTool_settingsPage'>
            <SettingsView settings={settings} onBack={onClose} />
        </div>
    )
}

export default SettingsPage
