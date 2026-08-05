/**
 * FleetState — backend plugin lifecycle.
 *
 * Core never routes for you: this mount IS the security boundary.
 */
const router = require('./routes/fleetState')
const { up } = require('./models/fleetState')

let setup = {
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + '/api/fleetstate',
            // ensureUser() is the only gate that lets an unauthenticated
            // AUTH=off instance both read and write: ensureAdmin() is
            // unreachable without a login, and stopGuests rejects outright
            // when AUTH is off. See the report.
            s.ensureUser(),
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    onceStarted: (s) => {},
    onceSynced: (s) => {
        up()
    },
}

module.exports = setup
