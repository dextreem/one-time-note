const express = require('express')
const config = require('config')
const morgan = require('morgan')

const noteRoutes = require('./NoteRoutes')
const app = express()

if (config.util.getEnv('NODE_ENV') !== 'test') {
    app.use(morgan('combined'));
}

app.use('/', noteRoutes)
app.listen(config.APP_PORT, () => {
    console.log(`Starting user service at http://localhost:${config.APP_PORT}`)
})

module.exports = app
