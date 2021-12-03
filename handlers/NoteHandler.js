const fs = require('fs')
const fsPromises = fs.promises;
const crypto = require("crypto");
const config = require('config')
const { StatusCodes } = require('http-status-codes');

class NoteHandler {

    async handleGetNote(noteID) {
        return await this._getNoteIfExists(noteID)
    }

    async _getNoteIfExists(noteID) {
        const notePath = this._getNotePathByNoteID(noteID)
        this._makeSureNoteExists(notePath, noteID)
        return await this._getAndDeleteNote(notePath)
    }

    _makeSureNoteExists(notePath, noteID) {
        if (!this._doesNoteExist(notePath)) {
            throw { status: StatusCodes.NOT_FOUND, msg: `No note with ID ${noteID} found!` }
        }
    }

    _doesNoteExist(notePath) {
        return fs.existsSync(notePath)
    }

    async _getAndDeleteNote(notePath) {
        var data = await fsPromises.readFile(notePath, 'utf-8')
        await fsPromises.unlink(notePath)
        return data
    }

    async handleCreateNote(noteText) {
        const noteID = this._getFreeNoteID()
        await fsPromises.writeFile(this._getNotePathByNoteID(noteID), noteText)
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

}

module.exports = NoteHandler