import React, { useEffect, useState } from 'react'

import { formatValue, rulePropertyLabel, rulePropertyPath } from '@basics/Layers_/render/dynamicStyle'
import { getDynamicStyle, getViewedRules } from '@basics/Layers_/render/layerDynamicStyle'
import { RESTYLED_EVENT } from '@basics/Layers_/render/dynamicStyleRuntime'
import './LayerSettings.css'

const SCOPE_LABELS = {
    dataset: 'Whole dataset',
    view: 'Current view',
    loaded: 'Loaded',
}

const STATISTICS = [
    ['Min', 'min'],
    ['Max', 'max'],
    ['Average', 'avg'],
    ['Std Dev', 'stddev'],
    ['Count', 'count'],
    ['Nulls', 'nullCount'],
]

export function StatisticsSection({ layer, api }) {
    const [, setRevision] = useState(0)
    useEffect(() => {
        const update = (event) => {
            if (event.detail?.layer === layer.name)
                setRevision((revision) => revision + 1)
        }
        document.addEventListener(RESTYLED_EVENT, update)
        return () => document.removeEventListener(RESTYLED_EVENT, update)
    }, [layer.name])
    if (
        getDynamicStyle(layer) == null ||
        layer.variables?.dynamicStyle?.showStats === false
    )
        return null
    const seen = new Set()
    const rows = getViewedRules(layer).flatMap((rule) => {
        const path = rulePropertyPath(rule)
        if (!path || seen.has(path)) return []
        seen.add(path)
        const stats = api.getDynamicStyleStats(path)
        if (stats == null) return []
        return [{ label: rulePropertyLabel(rule), stats }]
    })
    return (
        <div className='layerSettings_stats'>
            {rows.map(({ label, stats }) => (
                <React.Fragment key={label}>
                    <div className='layerSettings_statRow layerSettings_statProperty'>
                        <strong>{label}</strong>
                        <span>{SCOPE_LABELS[stats.scope] || stats.scope}</span>
                    </div>
                    {STATISTICS.filter(([, key]) => {
                        const value = stats[key]
                        return (
                            value != null &&
                            value !== '' &&
                            Number.isFinite(Number(value))
                        )
                    }).map(([name, key]) => (
                        <div className='layerSettings_statRow' key={key}>
                            <span>{name}</span>
                            <span>
                                {formatValue(Number(stats[key]))}
                            </span>
                        </div>
                    ))}
                </React.Fragment>
            ))}
        </div>
    )
}

export default StatisticsSection
