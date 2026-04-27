import React from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import './styles/Dialog.css'

function Dialog(props) {
    const { title, children, trigger, className = '' } = props
    return (
        <BaseDialog.Root>
            {trigger && <BaseDialog.Trigger render={trigger} />}
            <BaseDialog.Portal>
                <BaseDialog.Backdrop className="ds-dialog-backdrop" />
                <BaseDialog.Popup className={`ds-dialog-popup ${className}`}>
                    {title && (
                        <BaseDialog.Title className="ds-dialog-title">
                            {title}
                        </BaseDialog.Title>
                    )}
                    <BaseDialog.Close className="ds-dialog-close">
                        <i className="mdi mdi-close" />
                    </BaseDialog.Close>
                    {children}
                </BaseDialog.Popup>
            </BaseDialog.Portal>
        </BaseDialog.Root>
    )
}

export default Dialog
