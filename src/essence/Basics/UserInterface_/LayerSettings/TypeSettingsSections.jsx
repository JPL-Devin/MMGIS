import React, { useEffect, useMemo, useRef, useState } from 'react'

import {
    ColorRampPicker,
    IconTextButton,
    InputWithUnit,
    Select,
    Slider,
    Switch,
} from '@design/components'
import {
    formatRangeTick,
    formatVideoTime,
    commitRange,
    orderedRange,
    rangeTicks,
    resolveColormap,
} from './typeSettings'
import { buildColormapRamps } from '@basics/Layers_/render/rampUtils'

function Field({ label, children }) {
    return (
        <div className='layerSettings_row'>
            <span>{label}</span>
            <div>{children}</div>
        </div>
    )
}

function FilterRows({ api, layer, includeBlend = false }) {
    const filters = api.getFilters?.() || {}
    const update = (key, value) => api.setFilter(key, value)
    return (
        <>
            <Field label='Brightness'>
                <Slider
                    value={[Number(filters.brightness ?? layer.style?.brightness ?? 1)]}
                    min={0}
                    max={3}
                    step={0.05}
                    onValueChange={(v) => update('brightness', v[0])}
                />
            </Field>
            <Field label='Contrast'>
                <Slider
                    value={[Number(filters.contrast ?? layer.style?.contrast ?? 1)]}
                    min={0}
                    max={4}
                    step={0.05}
                    onValueChange={(v) => update('contrast', v[0])}
                />
            </Field>
            <Field label='Saturation'>
                <Slider
                    value={[Number(filters.saturate ?? layer.style?.saturation ?? 1)]}
                    min={0}
                    max={4}
                    step={0.05}
                    onValueChange={(v) => update('saturate', v[0])}
                />
            </Field>
            {includeBlend && (
                <Field label='Blend'>
                    <Select
                        value={filters['mix-blend-mode'] || 'unset'}
                        options={[
                            { value: 'unset', label: 'None' },
                            { value: 'color', label: 'Color' },
                            { value: 'overlay', label: 'Overlay' },
                        ]}
                        onValueChange={(v) => update('mix-blend-mode', v)}
                    />
                </Field>
            )}
        </>
    )
}

export function RampDomainTicks({ values, units = '' }) {
    if (!values?.length) return null
    return (
        <div className='layerSettings_rampTicks'>
            {values.map((value) => (
                <span key={value}>{formatRangeTick(value, units)}</span>
            ))}
        </div>
    )
}

function RampPreview({ value, fallback }) {
    const selectedValue = value || fallback
    const selected = resolveColormap(selectedValue, fallback)
    const ramps = useMemo(
        () => buildColormapRamps(selectedValue, fallback),
        [fallback, selectedValue]
    )
    const ramp =
        ramps.find(({ name }) => name === selectedValue) ||
        ramps.find(({ name }) => name === selected.colormap)
    if (!ramp) return null
    const colors = ramp.colors
        .map(([r, g, b]) => `rgb(${r * 255}, ${g * 255}, ${b * 255})`)
        .join(', ')
    return (
        <div
            className='layerSettings_rampPreview'
            style={{ background: `linear-gradient(to right, ${colors})` }}
            aria-label={`${selectedValue} color ramp preview`}
        />
    )
}

function RampPicker({ value, onChange, fallback }) {
    const selectedValue = value || fallback
    const selected = resolveColormap(selectedValue, fallback)
    const [reverse, setReverse] = useState(selected.reverse)
    useEffect(() => setReverse(selected.reverse), [selected.reverse])
    const ramps = useMemo(
        () => buildColormapRamps(selectedValue, fallback),
        [fallback, selectedValue]
    )
    const commit = (nextReverse, nextName = selected.colormap) =>
        onChange(`${nextName}${nextReverse ? '_r' : ''}`)
    return (
        <div>
            <ColorRampPicker
                value={selectedValue}
                ramps={ramps}
                onValueChange={(name) => commit(reverse, name)}
            />
            <div className='layerSettings_rampToggle'>
                <span>Reverse</span>
                <Switch
                    checked={reverse}
                    onCheckedChange={(checked) => {
                        setReverse(checked)
                        commit(checked)
                    }}
                    aria-label='Reverse color ramp'
                />
            </div>
        </div>
    )
}

export function RasterSettingsSection({
    layer,
    api,
    adapterType,
    fallback = 'viridis',
    hasCog = false,
    includeFilters = true,
    includeBlend = false,
    allowExpression = false,
    discoverStac = false,
    normalizeRange = orderedRange,
    resetLabel = 'COG settings',
}) {
    const runtime = api.runtime?.()
    const initialMin =
        layer.currentCogMin ??
        layer.cogMin ??
        layer.variables?.streamlines?.minVelocity ??
        0
    const initialMax =
        layer.currentCogMax ??
        layer.cogMax ??
        layer.variables?.streamlines?.maxVelocity ??
        15
    const [min, setMin] = useState(initialMin)
    const [max, setMax] = useState(initialMax)
    const [draftMin, setDraftMin] = useState(String(initialMin))
    const [draftMax, setDraftMax] = useState(String(initialMax))
    const colormap =
        layer.cogColormap || layer.variables?.streamlines?.colorScale || fallback
    const [expression, setExpression] = useState(
        layer.currentCogExpression || layer.cogExpression || ''
    )
    const [stacAssets, setStacAssets] = useState([])
    const [stacBands, setStacBands] = useState([])
    useEffect(() => {
        if (!discoverStac || !layer.url?.startsWith('stac-collection:')) return
        let active = true
        api.discoverStac?.()
            .then((result) => {
                if (!active) return
                setStacAssets(result?.assets || result || [])
                setStacBands(result?.bands || [])
            })
            .catch(() =>
                api.notify?.(
                    'warning',
                    'STAC asset discovery is unavailable for this service.'
                )
            )
        return () => {
            active = false
        }
    }, [api, discoverStac, layer.url])
    const applyRange = (nextMin, nextMax) => {
        const range = commitRange(
            min,
            max,
            nextMin,
            nextMax,
            normalizeRange
        )
        if (range == null) return
        setMin(range.min)
        setMax(range.max)
        setDraftMin(String(range.min))
        setDraftMax(String(range.max))
        api.updateRange?.(range.min, range.max, adapterType)
    }
    const commitDraftRange = () => applyRange(draftMin, draftMax)
    const units =
        layer.cogUnits || layer.variables?.streamlines?.units || ''
    return (
        <div className='layerSettings_control'>
            {includeFilters && (
                <FilterRows
                    api={api}
                    layer={layer}
                    includeBlend={includeBlend}
                />
            )}
            {hasCog && (
                <>
                    <Field label='Rescale'>
                        <div className='layerSettings_rangeControl'>
                            <div className='layerSettings_rangeInputs'>
                                <InputWithUnit
                                    type='number'
                                    value={draftMin}
                                    unit={units}
                                    onChange={(e) => setDraftMin(e.target.value)}
                                    onBlur={commitDraftRange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitDraftRange()
                                    }}
                                />
                                <InputWithUnit
                                    type='number'
                                    value={draftMax}
                                    unit={units}
                                    onChange={(e) => setDraftMax(e.target.value)}
                                    onBlur={commitDraftRange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitDraftRange()
                                    }}
                                />
                            </div>
                            <span className='layerSettings_hint'>
                                Configured: {layer.cogMin ?? layer.variables?.streamlines?.minVelocity ?? 'auto'} –{' '}
                                {layer.cogMax ?? layer.variables?.streamlines?.maxVelocity ?? 'auto'}
                            </span>
                            <RampPreview value={colormap} fallback={fallback} />
                            <RampDomainTicks
                                values={rangeTicks(min, max)}
                                units={units}
                            />
                        </div>
                    </Field>
                    <Field label='Color ramp'>
                        <RampPicker
                            value={colormap}
                            fallback={fallback}
                            onChange={(value) =>
                                api.updateColormap?.(value, adapterType)
                            }
                        />
                    </Field>
                    {allowExpression &&
                        layer.cogExpressionEditable === true && (
                            <Field label='Band math'>
                                <div className='layerSettings_expression'>
                                    <InputWithUnit
                                        value={expression}
                                        unit=''
                                        placeholder='e.g. b1*2'
                                        onChange={(e) => setExpression(e.target.value)}
                                    />
                                    <div>
                                        <IconTextButton
                                            size='sm'
                                            onClick={() => api.updateExpression?.(expression)}
                                        >
                                            Apply
                                        </IconTextButton>
                                        <IconTextButton
                                            size='sm'
                                            onClick={() => {
                                                const configured = layer.cogExpression || ''
                                                setExpression(configured)
                                                api.updateExpression?.(null)
                                            }}
                                        >
                                            Reset
                                        </IconTextButton>
                                    </div>
                                </div>
                            </Field>
                        )}
                    {stacAssets.length > 0 && (
                        <Field label='STAC asset'>
                            <Select
                                value={layer.cogAsset || stacAssets[0].value}
                                options={stacAssets}
                                onValueChange={(value) =>
                                    api.set('cogAsset', value)
                                }
                            />
                        </Field>
                    )}
                    {stacBands.length > 0 && (
                        <Field label='STAC band'>
                            <Select
                                value={String(layer.cogBands?.[0] || stacBands[0].value)}
                                options={stacBands}
                                onValueChange={(value) =>
                                    api.set('cogBands', [Number(value)])
                                }
                            />
                        </Field>
                    )}
                    <div className='layerSettings_dynamicReset'>
                        <IconTextButton
                            size='sm'
                            icon={<i className='mdi mdi-restore mdi-16px' />}
                            onClick={() =>
                                api.resetTypeSettings?.(adapterType)
                            }
                        >
                            Reset {resetLabel}
                        </IconTextButton>
                    </div>
                </>
            )}
            {runtime == null && hasCog && (
                <div className='layerSettings_hint'>Turn the layer on to edit runtime raster settings.</div>
            )}
        </div>
    )
}

export function DataShaderSection({ layer, api }) {
    const shader = layer.variables?.shader || {}
    const [type, setType] = useState(shader.type || 'colorize')
    const [discrete, setDiscrete] = useState(api.runtime?.()?.isDiscrete === true)
    const setShader = (path, value) => api.set(`variables.shader.${path}`, value)
    useEffect(() => {
        api.populateCogScale?.(layer.name)
    }, [api, layer.name])
    return (
        <div className='layerSettings_control'>
            <Field label='Shader'>
                <Select
                    value={type}
                    options={[
                        { value: 'colorize', label: 'Colorize' },
                        { value: 'image', label: 'Image' },
                    ]}
                    onValueChange={(value) => {
                        setType(value)
                        setShader('type', value)
                        api.refreshLayer?.()
                    }}
                />
            </Field>
            {type === 'colorize' && (
                <>
                    <Field label='Animated'>
                        <Select
                            value={api.runtime?.()?.isAnimated === false ? 'false' : 'true'}
                            options={[
                                { value: 'true', label: 'On' },
                                { value: 'false', label: 'Off' },
                            ]}
                            onValueChange={(value) => {
                                if (api.runtime?.()) api.runtime().isAnimated = value === 'true'
                            }}
                        />
                    </Field>
                    <Field label='Mode'>
                        <Select
                            value={discrete ? 'discrete' : 'continuous'}
                            options={[
                                { value: 'continuous', label: 'Continuous' },
                                { value: 'discrete', label: 'Discrete' },
                            ]}
                            onValueChange={(value) => {
                                setDiscrete(value === 'discrete')
                                if (api.runtime?.()) {
                                    api.runtime().isDiscrete = value === 'discrete'
                                    api.runtime().setUniform?.('discrete', value === 'discrete' ? 1 : 0)
                                    api.runtime().reRender?.()
                                }
                            }}
                        />
                    </Field>
                    <Field label='Units'>
                        <InputWithUnit
                            value={shader.units || ''}
                            unit=''
                            onChange={(e) => setShader('units', e.target.value)}
                        />
                    </Field>
                </>
            )}
        </div>
    )
}

export function VideoSettingsSection({ api }) {
    const [state, setState] = useState({ current: 0, duration: 0, paused: true, muted: true })
    const wasPaused = useRef(true)
    useEffect(() => {
        const timer = setInterval(() => {
            const video = api.videoElement?.()
            if (video)
                setState({
                    current: video.currentTime,
                    duration: video.duration,
                    paused: video.paused,
                    muted: video.muted,
                })
        }, 100)
        return () => clearInterval(timer)
    }, [api])
    const video = api.videoElement?.()
    const playPause = () => {
        if (!video) return
        if (video.paused) video.play?.()
        else video.pause?.()
    }
    return (
        <div className='layerSettings_control'>
            <Field label='Video'>
                <div className='layerSettings_videoButtons'>
                    <IconTextButton size='sm' onClick={playPause}>
                        <i className={`mdi mdi-${state.paused ? 'play' : 'pause'} mdi-16px`} />
                    </IconTextButton>
                    <IconTextButton size='sm' onClick={() => { if (video) { video.currentTime = 0; if (!state.paused) video.play?.() } }}>
                        <i className='mdi mdi-restart mdi-16px' />
                    </IconTextButton>
                    <IconTextButton size='sm' onClick={() => { if (video) video.muted = !video.muted }}>
                        <i className={`mdi mdi-volume-${state.muted ? 'off' : 'high'} mdi-16px`} />
                    </IconTextButton>
                </div>
            </Field>
            <Field label='Scrub'>
                <Slider
                    value={[state.duration ? (state.current / state.duration) * 100 : 0]}
                    min={0}
                    max={100}
                    step={0.1}
                    onPointerDown={() => {
                        if (!video) return
                        wasPaused.current = video.paused
                        if (!video.paused) video.pause?.()
                    }}
                    onPointerUp={() => {
                        if (video && !wasPaused.current) video.play?.()
                    }}
                    onValueChange={(value) => {
                        if (!video || !Number.isFinite(video.duration)) return
                        video.currentTime = (value[0] / 100) * video.duration
                    }}
                />
            </Field>
            <div className='layerSettings_videoTime'>
                {formatVideoTime(state.current)} / {formatVideoTime(state.duration)}
            </div>
        </div>
    )
}
