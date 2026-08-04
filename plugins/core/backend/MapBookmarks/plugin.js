/**
 * MapBookmarks — backend plugin lifecycle.
 *
 * Core never routes for you: this mount IS the security boundary. See
 * plugins/core/backend/README.md for the `s` fields, the auth gates and what
 * `ensureAdmin`'s whitelist does.
 */
const router = require('./routes/mapBookmarks')
const MapBookmarks = require('./models/mapBookmarks')

let setup = {
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + '/api/mapBookmarks',
            // GET (listing bookmarks) is public so the unauthenticated app can
            // read them; writes (/add, /remove are POSTs) still require admin.
            // This keeps the tool usable in an AUTH=off dev instance.
            s.ensureAdmin(false, false, true),
            s.checkHeadersCodeInjection,
            s.setContentType,
            router
        )
    },
    onceStarted: (s) => {},
    // Tables exist here; run the idempotent migration.
    onceSynced: (s) => {
        if (typeof MapBookmarks.up === 'function') MapBookmarks.up()
    },
}

module.exports = setup
