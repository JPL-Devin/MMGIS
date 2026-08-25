import React from 'react'

import { IconTextButton, Modal, Select } from '@design/components'

import './ExportDialog.css'

function ExportDialog({ layerName, adapter, onClose }) {
    const [format, setFormat] = React.useState('geojson')
    const [extent, setExtent] = React.useState('local')
    const [coords, setCoords] = React.useState('source')
    const [busy, setBusy] = React.useState(false)
    const [error, setError] = React.useState('')
    const layer = layerName ? adapter.getLayerData(layerName) : null
    const options = React.useMemo(
        () =>
            adapter.getOptions?.(layerName) || {
                formats: [],
                extents: [],
                coordinates: [],
            },
        [adapter, layerName]
    )

    React.useEffect(() => {
        if (!layerName) return
        setFormat(options.formats[0]?.value || 'geojson')
        setExtent(options.extents[0]?.value || 'local')
        setCoords(options.coordinates[0]?.value || 'source')
        setError('')
    }, [layerName, options])

    const exportLayer = async () => {
        setBusy(true)
        setError('')
        try {
            await adapter.exportLayer(layerName, { format, extent, coords })
            onClose()
        } catch (exportError) {
            if (!exportError.toastHandled)
                adapter.notify?.(
                    'error',
                    `Failed to download ${layer?.display_name || layerName}.`
                )
            setError(exportError.message || `Failed to download ${layer?.display_name || layerName}.`)
        } finally {
            setBusy(false)
        }
    }

    return (
        <Modal
            open={layerName != null}
            onOpenChange={(open) => {
                if (!open && !busy) onClose()
            }}
        >
            <Modal.Title>Export {layer?.display_name || layerName}</Modal.Title>
            <div className='layersNewTool_exportDialog'>
                <label>
                    <span>Format</span>
                    <Select
                        value={format}
                        options={options.formats}
                        onValueChange={setFormat}
                    />
                </label>
                {options.extents.length > 1 && (
                    <label>
                        <span>Extent</span>
                        <Select
                            value={extent}
                            options={options.extents}
                            onValueChange={setExtent}
                        />
                    </label>
                )}
                {options.coordinates.length > 1 && (
                    <label>
                        <span>Coordinates</span>
                        <Select
                            value={coords}
                            options={options.coordinates}
                            onValueChange={setCoords}
                        />
                    </label>
                )}
                {error && (
                    <div className='layersNewTool_exportError' role='alert'>
                        {error}
                    </div>
                )}
                <div className='layersNewTool_exportActions'>
                    <IconTextButton size='sm' onClick={onClose} disabled={busy}>
                        Cancel
                    </IconTextButton>
                    <IconTextButton
                        size='sm'
                        onClick={exportLayer}
                        disabled={busy}
                        icon={<i className='mdi mdi-download mdi-16px' />}
                    >
                        {busy ? 'Exporting…' : 'Export'}
                    </IconTextButton>
                </div>
            </div>
        </Modal>
    )
}

export default ExportDialog
