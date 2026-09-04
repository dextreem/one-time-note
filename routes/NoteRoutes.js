const express = require("express")
const router = express.Router()
const { StatusCodes } = require('http-status-codes');

const NoteHandler = require("../handlers/NoteHandler")
const NOTES_ENDPOINT = "/notes"
const DEFAULT_ERROR_MESSAGE = "Could not handle the note request."

router.use(express.json())

// Express 5 dropped the "/:noteId?" optional-parameter syntax; "{/:noteId}"
// is its replacement and matches the same two paths, /notes and /notes/<id>.
router.get(`${NOTES_ENDPOINT}{/:noteId}`, getNote)
router.post(`${NOTES_ENDPOINT}`, createNote)

async function getNote(req, res) {
    try {
        const getResult = await new NoteHandler().handleGetNote(req.params.noteId)
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
    const status = err.status || StatusCodes.INTERNAL_SERVER_ERROR
    const msg = err.msg || DEFAULT_ERROR_MESSAGE
    res.status(status).send({ status, msg })
}

module.exports = router
