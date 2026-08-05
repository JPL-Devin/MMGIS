/**
 * SampleDepot — backend plugin lifecycle.
 *
 * Core never routes for you: this mount IS the security boundary. See
 * plugins/core/backend/README.md.
 */
const router = require('./routes/sampledepot')
const SampleDepots = require('./models/depots')
const SampleTubes = require('./models/tubes')

let setup = {
    onceInit: (s) => {
        s.app.use(
            // ROOT_PATH keeps the mount correct under a subpath deployment.
            s.ROOT_PATH + '/api/sampledepot',
            // ensureUser(): any logged-in user, and it passes when AUTH is not
            // 'local' — which is what makes the write routes reachable from the
            // interaction in a dev instance. ensureAdmin() would not be.
            s.ensureUser(),
            // NOT s.stopGuests: it rejects any request whose session has no
            // user, which in an AUTH=off/none instance is every request — the
            // whole mount, GETs included. Add it on a deployment that actually
            // logs users in.
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    onceStarted: (s) => {},
    onceSynced: (s) => {
        // sync() created the tables; column additions are the models' own up().
        SampleDepots.up()
        SampleTubes.up()
    },
}

module.exports = setup
