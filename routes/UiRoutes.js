const express = require("express")
const router = express.Router()
const { StatusCodes } = require('http-status-codes');
const { render } = require("../app");

const UI_ENDPOINT = "/"

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
        handleNoteError(err, res)
    }
}

function handleNoteError(err, res) {
    if (!err.status) err.status = StatusCodes.INTERNAL_SERVER_ERROR
    if (!err.msg) err.msg = defaultMessage
    res.status(err.status).send(JSON.stringify(err))
}

module.exports = router