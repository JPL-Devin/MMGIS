/**
 * Shared, singleton-free logic for the r7-hud feature.
 *
 * The layer type, the interaction and the component all need the same facts —
 * what counts as a hazard and what the HUD calls it — so they live here and are
 * imported relatively (plugins/README.md, "One feature, several plugins").
 */

export const HAZARD_EVENT = 'r7-hud:hazard'
export const HAZARD_TYPE_ID = 'hazardzone'

export const SEVERITIES = ['nominal', 'caution', 'hazard']

/**
 * Classify a feature by the value of `severityProp`.
 *
 * @param {object|null} feature GeoJSON feature.
 * @param {object|null} config  `{ severityProp, labelProp }`, any part optional.
 * @returns {{severity: string, label: string, level: number}|null}
 */
export function classify(feature, config) {
    if (feature == null) return null
    const { severityProp = 'severity', labelProp = 'name' } = config || {}
    const props = feature.properties || {}
    const raw = props[severityProp]
    const severity = normalizeSeverity(raw)
    const label = props[labelProp] != null ? String(props[labelProp]) : 'unnamed'
    return { severity, label, level: SEVERITIES.indexOf(severity) }
}

/**
 * @param {*} raw Whatever the feature carried.
 * @returns {string} One of SEVERITIES; unknown values are 'nominal'.
 */
export function normalizeSeverity(raw) {
    if (raw == null) return 'nominal'
    if (typeof raw === 'number')
        return raw >= 2 ? 'hazard' : raw >= 1 ? 'caution' : 'nominal'
    const s = String(raw).toLowerCase()
    return SEVERITIES.includes(s) ? s : 'nominal'
}

/**
 * What the HUD shows, from what it knows. Pure so it can be unit tested.
 *
 * @param {{zones: string[], report: object|null}} state
 * @returns {{zones: string, status: string, severity: string}}
 */
export function readout(state) {
    const zones = state?.zones || []
    const report = state?.report || null
    return {
        zones: `${zones.length} zone${zones.length === 1 ? '' : 's'}`,
        status: report
            ? `${report.label} — ${report.severity.toUpperCase()}`
            : 'no zone selected',
        severity: report ? report.severity : 'nominal',
    }
}

export const SEVERITY_COLORS = {
    nominal: '#4e9a06',
    caution: '#e6a700',
    hazard: '#d63a2f',
}
