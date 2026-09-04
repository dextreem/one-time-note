const express = require('express')
const mustacheExpress = require('mustache-express');
const config = require('config')
const morgan = require('morgan')
const fs = require('fs')
const { rateLimit } = require("express-rate-limit");


const noteRoutes = require('./routes/NoteRoutes')
const uiRoutes = require('./routes/UiRoutes')
const app = express()

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100 // limit each IP to X requests per windowMs
});

// The container speaks plain HTTP behind a reverse proxy that terminates TLS,
// so the client address only arrives in X-Forwarded-For. Without this the rate
// limiter sees the proxy for every request and one client can exhaust the
// budget for everybody. TRUST_PROXY is the number of proxy hops in front of
// the app (1 in the deployed setup); set it to 0 when running with nothing in
// front, otherwise a client can spoof its address with a forged header.
app.set('trust proxy', config.TRUST_PROXY)

if (config.util.getEnv('NODE_ENV') !== 'test') {
    app.use(morgan('combined'));
}

// UPLOAD_FOLDER is a mounted volume in the deployed setup and is deliberately
// not part of the image, so it may legitimately be missing on first start.
ensureNoteStorageIsUsable(config.UPLOAD_FOLDER)

function ensureNoteStorageIsUsable(folder) {
    try {
        fs.mkdirSync(folder, { recursive: true })
        fs.accessSync(folder, fs.constants.W_OK)
    } catch (err) {
        // Refuse to start rather than accept notes we cannot store. A process
        // that still serves pages but fails every POST looks healthy to a
        // reverse proxy and to GET /, so the failure has to be loud and early.
        // The usual cause is a volume owned by root while we run unprivileged.
        console.error(`Note storage "${folder}" is not usable: ${err.message}`)
        console.error(`Make it writable by uid ${process.getuid ? process.getuid() : '?'}, e.g. "chown 1000:1000" on the mounted directory.`)
        process.exit(1)
    }
}

app.set('views', `${__dirname}/views`)
app.engine('html', mustacheExpress())
app.set('view engine', 'mustache')
app.use(limiter)
app.use('/', noteRoutes)
app.use('/', uiRoutes)
app.use(express.static(`${__dirname}/views`))

// 0.0.0.0 explicitly: inside a container loopback is unreachable from outside,
// so binding to it would make the published port dead.
app.listen(config.APP_PORT, '0.0.0.0', () => {
    console.log(`Starting one-time-note at http://0.0.0.0:${config.APP_PORT}`)
})

module.exports = app
