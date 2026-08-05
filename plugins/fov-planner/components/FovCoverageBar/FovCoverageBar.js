import './FovCoverageBar.css'

import { REPORT_EVENT } from './events'

/**
 * FovCoverageBar — a page-level readout of the last observation clicked.
 *
 * Core gives a component no slot, so this appends its own element to
 * document.body at z-index 1600 (above #bottomFloatingBar at 1500, below the
 * toolbar at 2006), as OperationsClock does.
 *
 * It hears about clicks through a namespaced CustomEvent dispatched by the
 * FovInspect interaction in this same container: there is no core channel from
 * an interaction to a component. That means the event name is duplicated in two
 * files — the component cannot import the interaction's module, which pulls
 * `@basics` aliases.
 */
const FovCoverageBar = {
    _el: null,

    init(vars) {
        const { position = 'bottom-left' } = vars || {}

        const el = document.createElement('div')
        el.className = `fovCoverageBar fovCoverageBar--${position}`
        el.setAttribute('aria-live', 'polite')
        el.innerHTML = '<div class="fovCoverageBar__empty">No observation selected</div>'
        document.body.appendChild(el)
        FovCoverageBar._el = el

        document.addEventListener(REPORT_EVENT, (e) => FovCoverageBar.render(e.detail))
    },

    render(report) {
        const el = FovCoverageBar._el
        if (!el || !report) return

        const conflicts = report.conflicts || []
        const conflictLine = conflicts.length
            ? `<span class="fovCoverageBar__warn">${conflicts.length} overlapping</span>: ${conflicts
                  .map((c) => escapeHtml(String(c.id)))
                  .slice(0, 6)
                  .join(', ')}`
            : '<span class="fovCoverageBar__ok">no overlaps</span>'

        el.innerHTML = [
            `<div class="fovCoverageBar__id">${escapeHtml(String(report.id))}</div>`,
            `<div class="fovCoverageBar__pointing">az ${fmt(report.azimuth)}° · fov ${fmt(
                report.fov
            )}° · range ${fmt(report.range)} m</div>`,
            `<div class="fovCoverageBar__conflicts">${conflictLine}</div>`,
        ].join('')
    },
}

const fmt = (n) => (Number.isFinite(n) ? Math.round(n * 10) / 10 : '—')

const escapeHtml = (s) =>
    s.replace(
        /[&<>"']/g,
        (c) =>
            ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    )

export default FovCoverageBar
