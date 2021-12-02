const express = require("express")
const router = express.Router()
const { StatusCodes } = require('http-status-codes');

const NoteHandler = require("./NoteHandler")
const NOTES_ENDPOINT = "/notes"

router.use(express.json())

router.get(`${NOTES_ENDPOINT}/:noteID?`, getNote)
router.post(`${NOTES_ENDPOINT}`, createNote)

async function getNote(req, res) {
    try {
        const getResult = await new NoteHandler().handleGetNote(req.params.noteID)
        res.send({ noteText: getResult })
    } catch (err) {
        handleNoteError(err, res)
    }
}

async function createNote(req, res) {
    try {
        const noteId = await new NoteHandler().handleCreateNote(req.body.noteText)
        res.send({ noteId })
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