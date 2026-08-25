import React from 'react'

import { Checkbox, Select, Slider, Tooltip } from '@design/components'
import './LayerSettings.css'

function AttachmentControls({ layer, api, name, attachment }) {
    const description = api.attachments.describe(
        api.attachments.idForSublayerKey(name)
    )
    const title = attachment.title || description.description || name
    const dropdown = attachment.layer?.dropdown
    return (
        <div className='layerSettings_attachmentRow'>
            <Tooltip content={description.description || title}>
                <strong>{title}</strong>
            </Tooltip>
            <div className='layerSettings_attachmentControls'>
                {Array.isArray(dropdown) && (
                    <Select
                        value={attachment.layer?.dropdownValue || dropdown[0] || ''}
                        options={dropdown.map((option) => ({
                            value: option,
                            label: option,
                        }))}
                        onValueChange={(next) => {
                            api.attachments.setDropdown(layer.name, name, next)
                        }}
                    />
                )}
                {attachment.opacity != null && (
                    <Slider
                        value={[Number(attachment.opacity)]}
                        min={0}
                        max={1}
                        step={0.01}
                        aria-label={`${title} opacity`}
                        onValueChange={(next) =>
                            api.attachments.setOpacity(layer.name, name, next[0])
                        }
                    />
                )}
                <Checkbox
                    checked={attachment.on === true}
                    onCheckedChange={(checked) =>
                        api.attachments.setVisibility(
                            layer.name,
                            name,
                            checked === true
                        )
                    }
                    aria-label={`Toggle ${title}`}
                />
            </div>
        </div>
    )
}

export function CompositeLayersSection({ layer, api }) {
    const attachments = api.attachments.getAttachments(layer.name)
    const entries = Object.entries(attachments).filter(
        ([, attachment]) => attachment !== false
    )
    if (entries.length === 0) return null
    return (
        <div className='layerSettings_attachments'>
            {entries.map(([name, attachment]) => (
                <div key={name}>
                    <AttachmentControls
                        layer={layer}
                        api={api}
                        name={name}
                        attachment={attachment}
                    />
                </div>
            ))}
        </div>
    )
}

export default CompositeLayersSection
