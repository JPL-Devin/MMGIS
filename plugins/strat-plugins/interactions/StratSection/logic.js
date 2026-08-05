/**
 * StratSection's decisions — nothing from `src/essence`, so it is unit testable.
 */
import { unitsOfLayer } from '../../lib/unitTable'

const TO_METRES = { m: 1, cm: 0.01, ft: 0.3048 }

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * The section penetrated at one outcrop.
 *
 * @param {object|null} feature  The clicked feature.
 * @param {object|null} config   This interaction's settings on the layer.
 * @param {object|null} layerObj The layer's config — the unit table and marker
 *   horizons live in the layer *type's* subtree, not in ours.
 * @returns {{depthMetres: number, units: object[], markers: object[]}|null}
 */
export function sectionAt(feature, config, layerObj) {
    if (feature == null) return null

    const units = unitsOfLayer(layerObj)
    if (units.length === 0) return null

    const depthProp = config?.depthProp || 'measured_depth_m'
    const unit = TO_METRES[config?.depthUnit] || TO_METRES.m
    const raw = feature.properties?.[depthProp]
    const depthMetres =
        raw == null || raw === ''
            ? units[units.length - 1].base
            : num(raw, 0) * unit

    const penetrated = units
        .filter((u) => u.top < depthMetres)
        .map((u) => ({
            name: u.name,
            color: u.color,
            top: u.top,
            base: Math.min(u.base, depthMetres),
        }))

    const includeMarkers = config?.includeMarkers !== false
    const markers = includeMarkers
        ? (layerObj?.variables?.stratColumn?.markerHorizons || [])
              .map((m) => ({ label: m.label, depth: num(m.depth, NaN), color: m.color }))
              .filter((m) => Number.isFinite(m.depth) && m.depth <= depthMetres)
        : []

    return { depthMetres, units: penetrated, markers }
}
