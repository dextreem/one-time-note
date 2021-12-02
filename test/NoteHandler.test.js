process.env.NODE_ENV = 'test'

const chai = require('chai')
const chaiHttp = require('chai-http')
const assert = require('assert')
const { StatusCodes } = require('http-status-codes')
const fs = require('fs')

const should = chai.should()
const server = require('../app')
const NOTES_ENDPOINT = '/notes'
const config = require('config')

chai.use(chaiHttp)

function createTestFile(noteId, content) {
    try {
        fs.writeFileSync(`${config.UPLOAD_FOLDER}/${noteId}.otn`, content)
    } catch (err) {
        console.error(err)
    }
}

function testFileExists(noteId) {
    return fs.existsSync(`${config.UPLOAD_FOLDER}/${noteId}.otn`)
}

function testFileContainsText(noteId, content) {
    const fileContent = fs.readFileSync(`${config.UPLOAD_FOLDER}/${noteId}.otn`, 'utf-8')
    return fileContent === content
}

describe('Note', () => {

    before(async () => {
        if (!fs.existsSync(config.UPLOAD_FOLDER)) {
            fs.mkdirSync(config.UPLOAD_FOLDER)
        }
    })

    beforeEach(async () => {
        if (fs.existsSync(config.UPLOAD_FOLDER)) {
            fs.rmdirSync(config.UPLOAD_FOLDER, { recursive: true })
        }
        fs.mkdirSync(config.UPLOAD_FOLDER)
    })

    describe(`GET a note`, () => {
        it('should return an error if a note is not existing (anymore)', async () => {
            const res = await chai.request(server)
                .get(`${NOTES_ENDPOINT}/does_not_exist`)
            res.should.have.status(StatusCodes.NOT_FOUND)
        })

        it('should be able to get a note that exists', async () => {
            const noteText = "example note"
            const noteId = "existing_note"
            createTestFile(noteId, noteText)
            const res = await chai.request(server)
                .get(`${NOTES_ENDPOINT}/${noteId}`)
            res.should.have.status(StatusCodes.OK)
            assert.strictEqual(res.body.noteText, noteText)
        })

    })

    describe(`POST - Create a new note`, () => {
        it('should be able to upload a simple note', async () => {
            const noteText = "This is an example note"
            const res = await chai.request(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            res.should.have.status(StatusCodes.OK)
            assert.strictEqual(testFileExists(res.body.noteId), true)
            assert.strictEqual(testFileContainsText(res.body.noteId, noteText), true)
        })

        it('should be able to upload a simple note twice. Should result in different IDs.', async () => {
            const noteText = "This is an example note"
            const res1 = await chai.request(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            res1.should.have.status(StatusCodes.OK)
            const res2 = await chai.request(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            res2.should.have.status(StatusCodes.OK)
            assert.notStrictEqual(res1.body.noteId, res2.body.noteId)
            assert.strictEqual(testFileExists(res1.body.noteId), true)
            assert.strictEqual(testFileExists(res2.body.noteId), true)
            assert.strictEqual(testFileContainsText(res1.body.noteId, noteText), true)
            assert.strictEqual(testFileContainsText(res2.body.noteId, noteText), true)
        })
    })
})