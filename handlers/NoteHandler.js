const fs = require('fs')
const fsPromises = fs.promises;
const crypto = require("crypto");
const config = require('config')
const { StatusCodes } = require('http-status-codes');

class NoteHandler {

    async handleGetNote(noteID) {
        await this._logNoteEvent('getNote')
        return await this._claimAndReadNote(noteID)
    }

    // A note must be handed out exactly once, including when several readers
    // arrive at the same moment. Checking for the file and then reading it
    // cannot provide that: every concurrent reader passes the check before the
    // first one gets around to deleting, so all of them receive the note.
    // rename() is atomic, so it is what decides ownership here -- exactly one
    // caller can move the note aside. That winner reads its private copy and
    // deletes it; every loser gets ENOENT and is told the note is gone, which
    // is the truth. The note also stops being reachable through the API the
    // instant it is claimed, because the claim file no longer ends in .otn.
    async _claimAndReadNote(noteID) {
        const notePath = this._getNotePathByNoteID(noteID)
        const claimPath = `${notePath}.${this._getClaimSuffix()}.claimed`

        try {
            await fsPromises.rename(notePath, claimPath)
        } catch (err) {
            if (err.code === 'ENOENT') this._throwNoteNotFound(noteID)
            throw err
        }

        try {
            return await fsPromises.readFile(claimPath, 'utf-8')
        } finally {
            await fsPromises.unlink(claimPath)
        }
    }

    _throwNoteNotFound(noteID) {
        throw { status: StatusCodes.NOT_FOUND, msg: `No note with ID ${noteID} found!` }
    }

    _getClaimSuffix() {
        return crypto.randomBytes(8).toString("hex")
    }

    _doesNoteExist(notePath) {
        return fs.existsSync(notePath)
    }

    async handleCreateNote(noteText) {
        const noteID = this._getFreeNoteID()
        await fsPromises.writeFile(this._getNotePathByNoteID(noteID), noteText)
        await this._logNoteEvent('createNote')
        return noteID
    }

    _getFreeNoteID() {
        for (let i = 0; i < config.FIND_FREE_ID_RETRIES; i++) {
            const randomId = this._getRandomId()
            const fileNameCandidate = this._getNotePathByNoteID(randomId)
            if (!this._doesNoteExist(fileNameCandidate)) {
                return randomId
            }
        }
        throw { status: StatusCodes.INTERNAL_SERVER_ERROR, msg: `Found no free note ID, tried ${config.FIND_FREE_ID_RETRIES} times` }
    }

    _getRandomId() {
        return crypto.randomBytes(config.NOTE_ID_BYTE_SIZE).toString("hex");
    }

    _getNotePathByNoteID(noteID) {
        return `${config.UPLOAD_FOLDER}/${noteID}.otn`
    }

    async _logNoteEvent(type) {
        const fileName = `${config.UPLOAD_FOLDER}/_counter_${type}.log`
        await fsPromises.appendFile(fileName, `${this._getCurrentDateTime()}\n`)
    }

    _getCurrentDateTime() {
        return new Date().toLocaleString()
    }

}

module.exports = NoteHandler