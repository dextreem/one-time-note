const express = require("express")
const router = express.Router()
const { StatusCodes } = require('http-status-codes');

const UI_ENDPOINT = "/"
const DEFAULT_ERROR_MESSAGE = "Could not render the page."

router.use(express.json())

router.get(UI_ENDPOINT, getUi)

async function getUi(req, res) {
    try {
        if (req.query.noteId){
            res.render('showNote.html')
        }else{
            res.render('createNote.html')
        }
    } catch (err) {
        handleUiError(err, res)
    }
}

function handleUiError(err, res) {
    const status = err.status || StatusCodes.INTERNAL_SERVER_ERROR
    const msg = err.msg || DEFAULT_ERROR_MESSAGE
    res.status(status).send({ status, msg })
}

module.exports = router
