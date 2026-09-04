import * as chai from 'chai'
import chaiHttp, { request } from 'chai-http'
import assert from 'node:assert'
import fs from 'node:fs'
import { StatusCodes } from 'http-status-codes'
import { encryptNote, decryptNote } from '../views/scripts/otnCrypto.mjs'

// ESM evaluates every static import before the first statement of this file
// runs, and both `config` and the app read NODE_ENV the moment they are
// loaded. The test environment therefore has to be selected before they are
// pulled in, which means importing them dynamically.
process.env.NODE_ENV = 'test'
const config = (await import('config')).default
const server = (await import('../app.js')).default

// beforeEach deletes UPLOAD_FOLDER recursively. Refuse to run at all unless
// that is the throwaway test folder, so a misconfigured run can never destroy
// real, unread notes.
const EXPECTED_TEST_FOLDER = 'notes_test'
if (config.UPLOAD_FOLDER !== EXPECTED_TEST_FOLDER) {
    throw new Error(`Refusing to run: UPLOAD_FOLDER is "${config.UPLOAD_FOLDER}", expected "${EXPECTED_TEST_FOLDER}". Is NODE_ENV=test?`)
}

chai.use(chaiHttp)
const should = chai.should()
const NOTES_ENDPOINT = '/notes'

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
        fs.rmSync(config.UPLOAD_FOLDER, { recursive: true, force: true })
        fs.mkdirSync(config.UPLOAD_FOLDER)
    })

    describe(`GET a note`, () => {
        it('should return an error if a note is not existing (anymore)', async () => {
            const res = await request.execute(server)
                .get(`${NOTES_ENDPOINT}/does_not_exist`)
            res.should.have.status(StatusCodes.NOT_FOUND)
        })

        it('should be able to get a note that exists', async () => {
            const noteText = "example note"
            const noteId = "existing_note"
            createTestFile(noteId, noteText)
            const res = await request.execute(server)
                .get(`${NOTES_ENDPOINT}/${noteId}`)
            res.should.have.status(StatusCodes.OK)
            assert.strictEqual(res.body.noteText, noteText)
        })

    })

    describe(`POST - Create a new note`, () => {
        it('should be able to upload a simple note', async () => {
            const noteText = "This is an example note"
            const res = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            res.should.have.status(StatusCodes.OK)
            assert.strictEqual(testFileExists(res.body.noteId), true)
            assert.strictEqual(testFileContainsText(res.body.noteId, noteText), true)
        })

        it('should be able to upload a simple note twice. Should result in different IDs.', async () => {
            const noteText = "This is an example note"
            const res1 = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            res1.should.have.status(StatusCodes.OK)
            const res2 = await request.execute(server)
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

    // This is the whole point of the service: the note survives exactly one
    // read and nothing -- not a retry, not a reload, not a second reader --
    // can bring it back.
    describe(`A note can be read exactly once`, () => {
        it('returns the note on the first read and 404s on every read after that', async () => {
            const noteText = "ciphertext the server cannot read"
            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            create.should.have.status(StatusCodes.OK)
            const noteId = create.body.noteId

            const first = await request.execute(server).get(`${NOTES_ENDPOINT}/${noteId}`)
            first.should.have.status(StatusCodes.OK)
            assert.strictEqual(first.body.noteText, noteText)

            for (const attempt of [2, 3]) {
                const again = await request.execute(server).get(`${NOTES_ENDPOINT}/${noteId}`)
                assert.strictEqual(again.status, StatusCodes.NOT_FOUND, `read #${attempt} should be a 404`)
                assert.strictEqual(again.body.noteText, undefined, `read #${attempt} must not return the note`)
            }
        })

        it('deletes the note file from disk as part of the first read', async () => {
            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText: "gone after one read" })
            const noteId = create.body.noteId
            assert.strictEqual(testFileExists(noteId), true, 'note file should exist before the read')

            await request.execute(server).get(`${NOTES_ENDPOINT}/${noteId}`)
            assert.strictEqual(testFileExists(noteId), false, 'note file must be gone after the read')
        })

        it('serves the note to only one of many concurrent readers', async () => {
            const noteText = "only one reader may win"
            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText })
            const noteId = create.body.noteId

            const responses = await Promise.all(
                Array.from({ length: 5 }, () => request.execute(server).get(`${NOTES_ENDPOINT}/${noteId}`))
            )

            const served = responses.filter(res => res.body.noteText === noteText)
            assert.strictEqual(served.length, 1, 'exactly one concurrent reader may receive the note')
            assert.strictEqual(testFileExists(noteId), false, 'note file must be gone afterwards')
        })
    })

    // The two halves of the service meet here: the browser's encryption and
    // the server's one-time storage. This is the promise the README makes.
    describe(`End to end: the server stores only ciphertext`, () => {
        const password = 'a password the server never sees'

        it('round trips a real encrypted note through create and read', async () => {
            const noteText = 'the actual secret'
            const stored = await encryptNote(noteText, password)

            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText: stored })
            create.should.have.status(StatusCodes.OK)

            const read = await request.execute(server)
                .get(`${NOTES_ENDPOINT}/${create.body.noteId}`)
            read.should.have.status(StatusCodes.OK)
            assert.strictEqual(await decryptNote(read.body.noteText, password), noteText)
        })

        it('never writes the plaintext or the password to disk', async () => {
            const noteText = 'PLAINTEXT-CANARY-9f3a'
            const stored = await encryptNote(noteText, password)

            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText: stored })
            const onDisk = fs.readFileSync(`${config.UPLOAD_FOLDER}/${create.body.noteId}.otn`, 'utf-8')

            assert.ok(!onDisk.includes(noteText), 'the plaintext must never reach the disk')
            assert.ok(!onDisk.includes(password), 'the password must never reach the disk')
            assert.ok(onDisk.startsWith('otn1:'), 'the stored note should be the encrypted form')
        })

        it('leaves a reader with nothing usable if they do not know the password', async () => {
            const stored = await encryptNote('the actual secret', password)
            const create = await request.execute(server)
                .post(NOTES_ENDPOINT)
                .send({ noteText: stored })

            const read = await request.execute(server)
                .get(`${NOTES_ENDPOINT}/${create.body.noteId}`)
            await assert.rejects(() => decryptNote(read.body.noteText, 'guessed wrong'))
        })
    })
})
