/**
 * FieldObs — backend plugin lifecycle.
 *
 * Core never routes for you: this mount IS the security boundary. See
 * plugins/core/backend/README.md for the `s` fields, the auth gates and what
 * `ensureAdmin`'s whitelist does.
 */
const router = require('./routes/fieldObs')
const { up } = require('./models/fieldObs')

let setup = {
    // During app setup, before the server listens. Mount routes here.
    onceInit: (s) => {
        s.app.use(
            // ROOT_PATH keeps the mount correct when MMGIS is served under a
            // subpath — always prefix with it.
            s.ROOT_PATH + '/api/fieldObs',
            // Pick a gate deliberately. Omitting one leaves the route open to
            // the world whatever AUTH is set to.
            //   s.ensureUser()                        any logged-in user
            //   s.ensureAdmin()                       site admins only
            //   s.ensureAdmin(false, false, true)     public GET, admin write
            s.ensureUser(),
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    // After the HTTP server is listening (websockets, schedulers, self-calls).
    onceStarted: (s) => {},
    // After sequelize.sync() — tables exist. Run model.up() migrations here;
    // sync() does NOT add columns to existing tables.
    onceSynced: (s) => {
        up()
    },

    // Environment variables core should validate and log at startup:
    // envs: [{ name: 'FIELD_OBS_HOST', required: true }],
}

module.exports = setup
