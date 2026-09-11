/**
 * AuditLog — records an audit trail of /api/configure/* mutations.
 * priority 500 in plugin.json ensures the hook mounts before Config's router.
 */
const router = require('./routes/auditLog')
const { auditConfigure } = require('./recorder')
const { up } = require('./models/auditLog')
const openapi = require('./openapi.json')

let setup = {
    onceInit: (s) => {
        // Observe (never gate) configure mutations; Config's own ensureAdmin still applies.
        s.app.use(s.ROOT_PATH + '/api/configure', auditConfigure)

        s.app.use(
            s.ROOT_PATH + '/api/auditlog',
            s.ensureAdmin(),
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )

        s.app.use(
            s.ROOT_PATH + '/api-docs/auditlog',
            s.ensureAdmin(),
            s.swaggerUi.serve,
            s.useSwaggerSchema(openapi)
        )
    },
    onceStarted: (s) => {},
    onceSynced: (s) => {
        up()
    },
}

module.exports = setup
