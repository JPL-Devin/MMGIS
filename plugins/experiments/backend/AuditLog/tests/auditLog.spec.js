/**
 * AuditLog backend — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). Backend plugins are CommonJS
 * and server-side, so they import for real here; route behavior against a live
 * server belongs in an E2E spec under `tests/e2e/api`.
 */
const { test, expect } = require('@playwright/test')
const path = require('path')

const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
const setup = require(path.resolve(__dirname, '..', 'plugin.js'))

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('AuditLog')
    expect(manifest.type).toBe('backend')
})

test('lifecycle hooks are functions @unit', () => {
    for (const hook of ['onceInit', 'onceStarted', 'onceSynced'])
        expect(typeof setup[hook]).toBe('function')
})

test('onceInit mounts under ROOT_PATH behind an auth gate @unit', () => {
    const mounts = []
    const gate = () => 'gate'
    setup.onceInit({
        app: { use: (route, ...middleware) => mounts.push({ route, middleware }) },
        ROOT_PATH: '/root',
        ensureUser: gate,
        ensureAdmin: gate,
        checkHeadersCodeInjection: 'checkHeaders',
        setContentType: 'setContentType',
        swaggerUi: { serve: 'serve' },
        useSwaggerSchema: () => 'schema',
    })

    // configure hook (observer only), /api/auditlog (admin), /api-docs/auditlog (admin)
    expect(mounts.length).toBe(3)
    for (const m of mounts) expect(m.route.startsWith('/root')).toBe(true)
    const api = mounts.find((m) => m.route === '/root/api/auditlog')
    expect(api.middleware).toContain('gate')
    const docs = mounts.find((m) => m.route === '/root/api-docs/auditlog')
    expect(docs.middleware).toContain('gate')
})
