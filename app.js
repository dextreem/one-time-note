const express = require('express')
const mustacheExpress = require('mustache-express');
const config = require('config')
const morgan = require('morgan')
const fs = require('fs')
const rateLimit = require("express-rate-limit");


const noteRoutes = require('./routes/NoteRoutes')
const uiRoutes = require('./routes/UiRoutes')
const app = express()

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to X requests per windowMs
  });

if (config.util.getEnv('NODE_ENV') !== 'test') {
    app.use(morgan('combined'));
}

if (!fs.existsSync(config.UPLOAD_FOLDER)){
    fs.mkdirSync(config.UPLOAD_FOLDER)
}

app.set('views', `${__dirname}/views`)
app.engine('html', mustacheExpress())
app.set('view engine', 'mustache')
app.use('/', noteRoutes)
app.use('/', uiRoutes)
app.use(express.static("views"))
app.use(limiter)
app.listen(config.APP_PORT, () => {
    console.log(`Starting user service at http://localhost:${config.APP_PORT}`)
})

module.exports = app
