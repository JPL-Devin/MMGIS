/**
 * GustReport's decisions, with nothing imported from `src/essence`, so they can
 * be unit tested in Node.
 */
import { gustReport } from '../../lib/wind'

/**
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config  This interaction's settings on the layer.
 * @returns {{message: string, station: string|null, gust: number}|null}
 */
export function decide(feature, config) {
    const report = gustReport(feature, config)
    if (report == null) return null
    const where = report.station ? `Station ${report.station}` : 'This station'
    return {
        station: report.station,
        gust: report.gust,
        message: `${where}: gusting ${report.gust} (sustained ${report.speed})`,
    }
}
