import React from 'react'
import { createRoot } from 'react-dom/client'
import UserInterfaceLayout from './components/UserInterfaceLayout'
import uiStore from './store/uiStore'
import { applyTheme } from '../../../design-system/applyTheme'

let reactRoot = null

const UserInterfaceBridge = {
    init(UserInterface) {
        // Apply default theme on init
        applyTheme(uiStore.getState().themeName)
    },

    fina(l_, UserInterface) {
        // Only sync theme name to store; don't re-apply theme CSS since Stylize.js
        // already applied it and then layered individual color overrides on top.
        if (l_.configData && l_.configData.look && l_.configData.look.theme) {
            uiStore.setState({ themeName: l_.configData.look.theme })
        }

        // Sync panel state from UserInterface
        if (UserInterface) {
            const pp = UserInterface.getPanelPercents()
            uiStore.setState({
                viewerPanelOpen: pp.viewer > 0,
                mapPanelOpen: pp.map > 0,
                globePanelOpen: pp.globe > 0,
            })
        }

        // Mount React overlay
        this.mountReactOverlay(UserInterface)
    },

    mountReactOverlay(UserInterface) {
        let mountEl = document.getElementById('react-ui-overlay')
        if (!mountEl) {
            mountEl = document.createElement('div')
            mountEl.id = 'react-ui-overlay'
            mountEl.style.cssText =
                'position:absolute;top:0;left:0;width:0;height:0;overflow:visible;z-index:2000;pointer-events:none;'
            document.getElementById('main-container').appendChild(mountEl)
        }

        if (!reactRoot) {
            reactRoot = createRoot(mountEl)
        }
        reactRoot.render(
            <UserInterfaceLayout UserInterface={UserInterface} />
        )
    },
}

export default UserInterfaceBridge
