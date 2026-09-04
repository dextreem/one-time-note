import assert from 'node:assert'
import {
    encryptNote,
    decryptNote,
    CURRENT_PREFIX,
    WrongPasswordError
} from '../views/scripts/otnCrypto.mjs'

// The module is written for the browser but uses only WebCrypto, TextEncoder
// and btoa/atob, all of which Node provides globally, so the code the browser
// runs is the code tested here -- no shim, no reimplementation.

const PASSWORD = 'correct horse battery staple'

describe('Browser-side encryption', () => {

    describe('round trip', () => {
        it('decrypts what it encrypted', async () => {
            const noteText = 'meet me at the usual place'
            const stored = await encryptNote(noteText, PASSWORD)
            assert.strictEqual(await decryptNote(stored, PASSWORD), noteText)
        })

        it('survives unicode, newlines and emoji', async () => {
            const noteText = 'Grüße aus München 🎉\nzweite Zeile\t— dritte'
            const stored = await encryptNote(noteText, PASSWORD)
            assert.strictEqual(await decryptNote(stored, PASSWORD), noteText)
        })

        it('handles an empty note', async () => {
            const stored = await encryptNote('', PASSWORD)
            assert.strictEqual(await decryptNote(stored, PASSWORD), '')
        })

        it('handles a long note', async () => {
            const noteText = 'x'.repeat(100000)
            const stored = await encryptNote(noteText, PASSWORD)
            assert.strictEqual(await decryptNote(stored, PASSWORD), noteText)
        })
    })

    describe('the stored form leaks nothing', () => {
        it('carries the version prefix so the format can be changed later', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            assert.ok(stored.startsWith(CURRENT_PREFIX), `expected ${CURRENT_PREFIX} prefix, got ${stored.slice(0, 12)}`)
        })

        it('does not contain the plaintext or the password', async () => {
            const stored = await encryptNote('the-plaintext-marker', PASSWORD)
            assert.ok(!stored.includes('the-plaintext-marker'))
            assert.ok(!stored.includes(PASSWORD))
        })

        it('produces a different ciphertext every time, so identical notes are not linkable', async () => {
            const noteText = 'the very same note'
            const stored = await Promise.all(
                Array.from({ length: 5 }, () => encryptNote(noteText, PASSWORD))
            )
            assert.strictEqual(new Set(stored).size, 5, 'salt and IV must be random per note')
        })
    })

    describe('a wrong password does not reveal the note', () => {
        it('throws instead of returning anything', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            await assert.rejects(() => decryptNote(stored, 'wrong password'), WrongPasswordError)
        })

        // The old CBC scheme could not distinguish these two cases and showed
        // the raw ciphertext on failure. This is the regression guard for that.
        it('never hands back the ciphertext as if it were the note', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            let returned = null
            try { returned = await decryptNote(stored, 'wrong password') } catch { /* expected */ }
            assert.strictEqual(returned, null, 'a failed decrypt must return nothing at all')
        })

        it('rejects an empty password when the note used a real one', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            await assert.rejects(() => decryptNote(stored, ''), WrongPasswordError)
        })
    })

    describe('tampering is detected, not silently decrypted', () => {
        it('rejects a flipped bit in the ciphertext', async () => {
            const stored = await encryptNote('transfer 100 to alice', PASSWORD)
            const raw = Buffer.from(stored.slice(CURRENT_PREFIX.length), 'base64')
            raw[raw.length - 5] ^= 0x01
            const tampered = CURRENT_PREFIX + raw.toString('base64')
            await assert.rejects(() => decryptNote(tampered, PASSWORD), WrongPasswordError)
        })

        it('rejects a swapped salt', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            const raw = Buffer.from(stored.slice(CURRENT_PREFIX.length), 'base64')
            raw[0] ^= 0xff
            await assert.rejects(
                () => decryptNote(CURRENT_PREFIX + raw.toString('base64'), PASSWORD),
                WrongPasswordError
            )
        })

        it('rejects a truncated note', async () => {
            const stored = await encryptNote('secret', PASSWORD)
            await assert.rejects(
                () => decryptNote(stored.slice(0, CURRENT_PREFIX.length + 8), PASSWORD),
                WrongPasswordError
            )
        })

        it('rejects garbage that is not even base64', async () => {
            await assert.rejects(() => decryptNote(CURRENT_PREFIX + '!!!not base64!!!', PASSWORD), WrongPasswordError)
        })
    })

    describe('notes written before the switch', () => {
        // A note that predates the WebCrypto format has no prefix, so it must
        // be routed to the CryptoJS path rather than parsed as otn1.
        it('are routed to the legacy decoder, not misread as the new format', async () => {
            const legacyNote = 'U2FsdGVkX1+abcdefghijklmnopqrstuvwxyz0123456789=='
            await assert.rejects(
                () => decryptNote(legacyNote, PASSWORD),
                // CryptoJS is not loaded in Node, so the legacy path reports
                // exactly that. Reaching this error proves the routing works.
                err => err.name === 'CryptoUnavailableError' || err.message.includes('old format')
            )
        })
    })
})
