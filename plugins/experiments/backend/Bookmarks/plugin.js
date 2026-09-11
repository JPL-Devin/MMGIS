const router = require('./routes/bookmarks')
const { up } = require('./models/bookmarks')

let setup = {
    onceInit: (s) => {
        s.app.use(
            s.ROOT_PATH + '/api/bookmarks',
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
