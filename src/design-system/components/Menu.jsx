import React from 'react'
import { Menu as BaseMenu } from '@base-ui-components/react/menu'
import './styles/Menu.css'

function Menu(props) {
    const { trigger, children, className = '', ...rest } = props
    return (
        <BaseMenu.Root {...rest}>
            {trigger && <BaseMenu.Trigger render={trigger} />}
            <BaseMenu.Portal>
                <BaseMenu.Positioner>
                    <BaseMenu.Popup className={`ds-menu-popup ${className}`}>
                        {children}
                    </BaseMenu.Popup>
                </BaseMenu.Positioner>
            </BaseMenu.Portal>
        </BaseMenu.Root>
    )
}

Menu.Item = function MenuItem(props) {
    const { children, className = '', ...rest } = props
    return (
        <BaseMenu.Item className={`ds-menu-item ${className}`} {...rest}>
            {children}
        </BaseMenu.Item>
    )
}

Menu.Separator = function MenuSeparator() {
    return <BaseMenu.Separator className="ds-menu-separator" />
}

export default Menu
