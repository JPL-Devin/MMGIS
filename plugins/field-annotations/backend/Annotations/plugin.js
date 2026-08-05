/**
 * Annotations — backend plugin lifecycle.
 *
 * Core never routes for you: this mount IS the security boundary.
 */
const router = require('./routes/annotations')
const FieldAnnotations = require('./models/annotations')

let setup = {
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + '/api/annotations',
            // GETs are readable by anyone the instance lets in (so the layer
            // draws in an AUTH=off dev instance); writes need a logged-in
            // non-guest user where auth exists.
            s.ensureAdmin(false, false, true),
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    onceStarted: (s) => {},
    // Tables exist here; sync() never adds columns, so migrations run now.
    onceSynced: (s) => {
        FieldAnnotations.up().catch((err) =>
            console.warn(`Annotations migration failed: ${err.message}`)
        )
    },
}

module.exports = setup
