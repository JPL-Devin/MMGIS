import React, { useEffect, useState } from 'react'

import {
    Checkbox,
    ColorRampPicker,
    IconButton,
    InputWithUnit,
    Select,
    Slider,
    Tooltip,
} from '@design/components'
import {
    COLOR_ATTRIBUTES,
    DEFAULT_ATTRIBUTE,
    DEFAULT_RAMP,
    GROUP_STATS,
    attributeOf,
    formatValue,
    isCategoricalRule,
    rampStops,
    ruleMappings,
    rulePropertyLabel,
    rulePropertyPath,
    ruleStatOf,
    styleableAttributes,
} from '@basics/Layers_/render/dynamicStyle'
import {
    getDomainMode,
    getDynamicStyle,
    getViewedRules,
} from '@basics/Layers_/render/layerDynamicStyle'
import { RESTYLED_EVENT } from '@basics/Layers_/render/dynamicStyleRuntime'
import {
    hexToRgb,
    interpolateMultipleColors,
    parseRgb,
} from '@basics/Layers_/render/gradientUtils'
import {
    data as colormapData,
    evaluate_cmap,
} from '@external/js-colormaps/js-colormaps.js'
import { RUNTIME_RAMPS } from '../../../../../plugins/core/tools/Layers/components/DynamicStyleRamp'
import './LayerSettings.css'

const ATTRIBUTE_LABELS = {
    fillColor: 'Fill Color',
    color: 'Outline Color',
    fillOpacity: 'Fill Opacity',
    opacity: 'Outline Opacity',
    weight: 'Outline Weight',
    radius: 'Radius',
}

const CUSTOM_RAMP = 'custom'

function customRampColors(ramp) {
    const stops = rampStops(ramp, false)
    if (stops.length === 0) return null
    const colors = []
    for (let index = 0; index < 16; index++) {
        const color = interpolateMultipleColors(
            stops,
            index / 15,
            0,
            1
        )
        const rgb = hexToRgb(color) || parseRgb(color)
        if (rgb == null) return null
        colors.push([rgb.r / 255, rgb.g / 255, rgb.b / 255])
    }
    return colors
}

function rampsFor(current) {
    const custom = Array.isArray(current) ? customRampColors(current) : null
    const names = RUNTIME_RAMPS.includes(current)
        ? RUNTIME_RAMPS
        : [current, ...RUNTIME_RAMPS]
    const ramps = names
        .map((name) => {
            const colors = []
            const cmap = colormapData?.[name]
            if (!cmap) return null
            for (let index = 0; index < 16; index++) {
                const [r, g, b] = evaluate_cmap(
                    index / 15,
                    name,
                    false
                )
                colors.push([r / 255, g / 255, b / 255])
            }
            return { name, label: name, colors }
        })
        .filter(Boolean)
    if (custom == null) return ramps
    return [{ name: CUSTOM_RAMP, label: 'Custom', colors: custom }, ...ramps]
}

function numericRange(rule, attribute) {
    if (Array.isArray(rule.range) && rule.range.length === 2)
        return rule.range.map(Number)
    const defaults = {
        fillOpacity: [0.1, 1],
        opacity: [0.1, 1],
        weight: [1, 8],
        radius: [3, 12],
    }
    return defaults[attribute] || [0, 1]
}

function sliderBounds(range, stats, attribute) {
    const defaults = {
        fillOpacity: [0, 1],
        opacity: [0, 1],
        weight: [0, 10],
        radius: [0, 20],
    }
    const fallback = defaults[attribute] || [0, 1]
    const min = Number(stats?.min)
    const max = Number(stats?.max)
    const currentMin = Number.isFinite(range[0]) ? range[0] : fallback[0]
    const currentMax = Number.isFinite(range[1]) ? range[1] : fallback[1]
    const bounds = [
        Math.min(
            Number.isFinite(min) ? min : fallback[0],
            currentMin
        ),
        Math.max(
            Number.isFinite(max) ? max : fallback[1],
            currentMax
        ),
    ]
    if (bounds[0] === bounds[1]) bounds[1] = bounds[0] + 1
    return bounds
}

function DynamicStyleRule({ layer, api, rule, index }) {
    const attribute = attributeOf(rule) || DEFAULT_ATTRIBUTE
    const options = styleableAttributes(rule).map((value) => ({
        value,
        label: ATTRIBUTE_LABELS[value] || value,
    }))
    const domain = api.getDynamicStyleStats(rulePropertyPath(rule))
    const range = numericRange(rule, attribute)
    const bounds = sliderBounds(range, domain, attribute)
    const commit = (patch) => {
        const before = api.getStatsFields()
        api.overrideDynamicStyleRule(index, patch)
        if (api.getStatsFields().some((field) => !before.includes(field)))
            api.refreshLayer()
        api.refreshLegend()
    }
    const mappings = isCategoricalRule(rule)
        ? ruleMappings(rule, null)
        : []
    return (
        <div className='layerSettings_rule'>
            <div className='layerSettings_row'>
                <Tooltip content={rulePropertyLabel(rule)}>
                    <strong>{rulePropertyLabel(rule)}</strong>
                </Tooltip>
                <Checkbox
                    checked={rule.enabled !== false}
                    onCheckedChange={(checked) =>
                        commit({ enabled: checked === true })
                    }
                    aria-label={`Enable ${rulePropertyLabel(rule)}`}
                />
            </div>
            <div className='layerSettings_row'>
                <span>Style attribute</span>
                <Select
                    value={attribute}
                    options={options}
                    onValueChange={(value) => commit({ attribute: value })}
                />
            </div>
            {rule.propertyType === 'stats' && (
                <div className='layerSettings_row'>
                    <span>Statistic</span>
                    <Select
                        value={ruleStatOf(rule)}
                        options={GROUP_STATS.map((value) => ({
                            value,
                            label: value === 'stddev' ? 'Std Dev' : value,
                        }))}
                        onValueChange={(value) => commit({ stat: value })}
                    />
                </div>
            )}
            {mappings.length > 0 && (
                <div className='layerSettings_readOnly'>
                    {mappings.map((mapping) => (
                        <div
                            className='layerSettings_mapping'
                            key={String(mapping.value)}
                        >
                            <span>{String(mapping.value)}</span>
                            <span>
                                {mapping.color || formatValue(mapping.to)}
                            </span>
                        </div>
                    ))}
                </div>
            )}
            {!isCategoricalRule(rule) &&
                !COLOR_ATTRIBUTES.includes(attribute) && (
                    <div className='layerSettings_control'>
                        <span>Range</span>
                        <Slider
                            value={range}
                            min={bounds[0]}
                            max={bounds[1]}
                            step='any'
                            onValueChange={(value) =>
                                commit({ range: value })
                            }
                        />
                        <div className='layerSettings_row'>
                            <InputWithUnit
                                type='number'
                                value={range[0]}
                                step='any'
                                aria-label='Range minimum'
                                onChange={(event) =>
                                    commit({
                                        range: [
                                            Number(event.target.value),
                                            range[1],
                                        ],
                                    })
                                }
                            />
                            <InputWithUnit
                                type='number'
                                value={range[1]}
                                step='any'
                                aria-label='Range maximum'
                                onChange={(event) =>
                                    commit({
                                        range: [
                                            range[0],
                                            Number(event.target.value),
                                        ],
                                    })
                                }
                            />
                        </div>
                    </div>
                )}
            {!isCategoricalRule(rule) && COLOR_ATTRIBUTES.includes(attribute) && (
                <div className='layerSettings_control'>
                    <span>Color ramp</span>
                    <ColorRampPicker
                        value={
                            Array.isArray(rule.ramp)
                                ? CUSTOM_RAMP
                                : rule.ramp || DEFAULT_RAMP
                        }
                        ramps={rampsFor(rule.ramp || DEFAULT_RAMP)}
                        portal
                        onValueChange={(value) => commit({ ramp: value })}
                    />
                    <div className='layerSettings_row'>
                        <span>Bins</span>
                        <InputWithUnit
                            type='number'
                            min='0'
                            max='20'
                            step='1'
                            value={rule.bins || 0}
                            unit='bins'
                            onChange={(event) => {
                                const bins = Math.max(
                                    0,
                                    Math.min(20, Number(event.target.value) || 0)
                                )
                                commit({
                                    bins: bins || null,
                                    discrete: bins > 0,
                                    stops: null,
                                })
                            }}
                        />
                    </div>
                    {Number(rule.bins) > 1 &&
                        Array.from({ length: Number(rule.bins) - 1 }).map(
                            (_, stopIndex) => {
                                const stops = Array.isArray(rule.stops)
                                    ? [...rule.stops]
                                    : []
                                const value =
                                    stops[stopIndex] ||
                                    (stopIndex + 1) / Number(rule.bins)
                                return (
                                    <Slider
                                        key={stopIndex}
                                        value={[value]}
                                        min={0.01}
                                        max={0.99}
                                        step={0.01}
                                        aria-label={`Bin stop ${stopIndex + 1}`}
                                        onValueChange={(next) => {
                                            stops[stopIndex] = next[0]
                                            commit({ stops })
                                        }}
                                    />
                                )
                            }
                        )}
                </div>
            )}
            {domain == null && (
                <div className='layerSettings_hint'>
                    No statistics are available for this property yet.
                </div>
            )}
        </div>
    )
}

export function DynamicStyleSection({ layer, api }) {
    const [, setRevision] = useState(0)
    useEffect(() => {
        const update = (event) => {
            if (event.detail?.layer === layer.name)
                setRevision((revision) => revision + 1)
        }
        document.addEventListener(RESTYLED_EVENT, update)
        return () => document.removeEventListener(RESTYLED_EVENT, update)
    }, [layer.name])
    const dynamicStyle = getDynamicStyle(layer)
    const rules = getViewedRules(layer)
    useEffect(() => {
        api.ensureFieldStats()
    }, [api, layer])
    if (dynamicStyle == null && rules.length === 0) return null
    const reset = () => {
        api.overrideDynamicStyle(null)
        api.refreshLegend()
    }
    if (layer.variables?.dynamicStyle?.userSettable === false)
        return (
            <div className='layerSettings_readOnly'>
                {rules
                    .filter((rule) => rule.enabled !== false)
                    .map((rule, index) => (
                        <div className='layerSettings_row' key={index}>
                            <span>{rulePropertyLabel(rule)}</span>
                            <span>
                                {ATTRIBUTE_LABELS[
                                    attributeOf(rule) || DEFAULT_ATTRIBUTE
                                ] || attributeOf(rule)}
                            </span>
                        </div>
                    ))}
            </div>
        )
    const mode = getDomainMode(layer)
    const unmeasured = rules
        .filter((rule) => rule.enabled !== false && !isCategoricalRule(rule))
        .filter((rule) => {
            const path = rulePropertyPath(rule)
            return api.getDynamicStyleStats(path)?.scope !== 'dataset'
        })
        .map(rulePropertyLabel)
    return (
        <div className='layerSettings_control'>
            <div className='layerSettings_row'>
                <Tooltip content='Measure style values over all data or only the current map view.'>
                    <span>Domain</span>
                </Tooltip>
                <Select
                    value={mode}
                    options={[
                        { value: 'dataset', label: 'Whole dataset' },
                        { value: 'view', label: 'Current view' },
                    ]}
                    onValueChange={(value) => {
                        api.overrideDynamicStyle({ domain: value })
                        api.refreshLayer()
                        api.refreshLegend()
                    }}
                />
            </div>
            {unmeasured.length > 0 && mode === 'dataset' && (
                <div className='layerSettings_warning'>
                    Dataset-wide numbers are not available for:{' '}
                    {unmeasured.join(', ')}.
                </div>
            )}
            {rules.map((rule, index) => (
                <DynamicStyleRule
                    key={`${index}-${rulePropertyPath(rule)}`}
                    layer={layer}
                    api={api}
                    rule={rule}
                    index={index}
                />
            ))}
            <Tooltip content='Style this layer the way it was configured again, undoing the changes made here.'>
                <IconButton
                    size='sm'
                    aria-label='Reset dynamic style'
                    onClick={reset}
                >
                    <i className='mdi mdi-restore mdi-18px' />
                </IconButton>
            </Tooltip>
        </div>
    )
}

export default DynamicStyleSection
