/**
 * Mock slow paged catalogue endpoint for developing/testing PagedCatalogue.
 *
 *   node plugins/paged-catalogue/server/paged-server.js [port]
 *   GET /items?bbox=minx,miny,maxx,maxy&page=N&limit=M
 *   -> { type:'FeatureCollection', features:[...points in bbox...], page, next }
 *
 * Each page is delayed ~700ms and there are TOTAL_PAGES pages, so a full load
 * takes several seconds — long enough to out-run by panning/zooming. Features
 * are random points inside the requested bbox so panning visibly changes them.
 *
 * CORS is wide open so the MMGIS dev server (:8889) can hit it cross-origin.
 */
const http = require('http')

const TOTAL_PAGES = 6
const PAGE_DELAY_MS = 700

const port = Number(process.argv[2]) || 3777

function rand(min, max) {
    return min + Math.random() * (max - min)
}

function makePage(bbox, page, limit) {
    const [minx, miny, maxx, maxy] = bbox
    const features = []
    for (let i = 0; i < limit; i++) {
        const lng = isFinite(minx) ? rand(minx, maxx) : rand(-180, 180)
        const lat = isFinite(miny) ? rand(miny, maxy) : rand(-85, 85)
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                id: `p${page}-f${i}`,
                page,
                name: `catalogue item ${page}.${i}`,
                magnitude: Math.round(rand(0, 10) * 10) / 10,
            },
        })
    }
    return {
        type: 'FeatureCollection',
        page,
        next: page < TOTAL_PAGES - 1,
        numberMatched: TOTAL_PAGES * limit,
        features,
    }
}

http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Content-Type', 'application/geo+json')

    if (!url.pathname.startsWith('/items')) {
        res.statusCode = 404
        return res.end('{"error":"not found"}')
    }

    const page = Number(url.searchParams.get('page') || 0)
    const limit = Math.min(Number(url.searchParams.get('limit') || 200), 2000)
    const bbox = (url.searchParams.get('bbox') || '')
        .split(',')
        .map(Number)

    setTimeout(() => {
        res.end(JSON.stringify(makePage(bbox, page, limit)))
    }, PAGE_DELAY_MS)
}).listen(port, () => {
    console.log(
        `paged-catalogue mock: http://localhost:${port}/items ` +
            `(${TOTAL_PAGES} pages, ${PAGE_DELAY_MS}ms each)`
    )
})
