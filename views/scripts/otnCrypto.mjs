// Browser-side encryption for one-time-note.
//
// The server only ever stores what encryptNote() returns and has no way to
// read a note. Everything here therefore runs in the reader's and writer's
// browser, and the password never leaves it.
//
// Format of a note produced by this file:
//
//     otn1:<base64( salt[16] || iv[12] || AES-GCM ciphertext+tag )>
//
// The version prefix *is* the parameter set: any change to the KDF, the
// iteration count or the cipher gets a new prefix (otn2:, ...) so that notes
// written by an older version stay readable while they are still in flight.
//
// Notes written before this file existed have no prefix -- they are CryptoJS
// AES strings and are handled by the legacy path in decryptNote() below.

export const CURRENT_PREFIX = 'otn1:'

// PBKDF2-HMAC-SHA256 at OWASP's current recommended work factor. Costs about
// 45 ms on a desktop and a few hundred ms on an old phone, which is nothing
// for a single note but multiplies an attacker's cost per guessed password by
// 600,000 compared to the single MD5 iteration this replaces.
const PBKDF2_ITERATIONS = 600000
const SALT_BYTES = 16
const IV_BYTES = 12

export class CryptoUnavailableError extends Error {}
export class WrongPasswordError extends Error {}

// WebCrypto only exists in a secure context. In production a reverse proxy
// serves the site over HTTPS and localhost counts as secure, so this only
// trips when someone opens a development container over plain HTTP using a
// LAN address. Failing loudly beats silently storing something unencrypted.
function requireSubtleCrypto() {
    if (!globalThis.crypto?.subtle) {
        throw new CryptoUnavailableError(
            'Encryption is unavailable because this page was not loaded over a secure connection. Use HTTPS (or localhost).'
        )
    }
    return globalThis.crypto.subtle
}

async function deriveKey(password, salt, usage) {
    const subtle = requireSubtleCrypto()
    const passwordKey = await subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
    )
    return await subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage]
    )
}

export async function encryptNote(noteText, password) {
    const subtle = requireSubtleCrypto()
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
    const key = await deriveKey(password, salt, 'encrypt')

    const ciphertext = new Uint8Array(await subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(noteText)
    ))

    const packed = new Uint8Array(salt.length + iv.length + ciphertext.length)
    packed.set(salt, 0)
    packed.set(iv, salt.length)
    packed.set(ciphertext, salt.length + iv.length)

    return CURRENT_PREFIX + toBase64(packed)
}

export async function decryptNote(storedNote, password) {
    if (!storedNote.startsWith(CURRENT_PREFIX)) {
        return decryptLegacyNote(storedNote, password)
    }

    const packed = fromBase64(storedNote.slice(CURRENT_PREFIX.length))
    if (packed.length <= SALT_BYTES + IV_BYTES) {
        throw new WrongPasswordError('This note is damaged and cannot be read.')
    }

    const salt = packed.subarray(0, SALT_BYTES)
    const iv = packed.subarray(SALT_BYTES, SALT_BYTES + IV_BYTES)
    const ciphertext = packed.subarray(SALT_BYTES + IV_BYTES)
    const key = await deriveKey(password, salt, 'decrypt')

    try {
        const plaintext = await requireSubtleCrypto().decrypt(
            { name: 'AES-GCM', iv }, key, ciphertext
        )
        return new TextDecoder().decode(plaintext)
    } catch {
        // AES-GCM authenticates, so this is the honest answer: either the
        // password is wrong or the ciphertext was altered. The old CBC scheme
        // could not tell the difference and showed the raw ciphertext instead.
        throw new WrongPasswordError('Wrong password, or this note has been tampered with.')
    }
}

// Notes created before the WebCrypto switch. CryptoJS derives its key with
// OpenSSL's EVP_BytesToKey (MD5, one iteration) and uses unauthenticated CBC,
// which is exactly why new notes no longer take this path. Delete this
// function, the CryptoJS script tag in showNote.html and this comment once no
// note predating the switch can plausibly still be unread -- notes are
// single-read and short-lived, so a couple of weeks is plenty.
function decryptLegacyNote(storedNote, password) {
    if (typeof CryptoJS === 'undefined') {
        throw new CryptoUnavailableError('This note uses the old format and the legacy decoder is not loaded.')
    }
    const decoded = CryptoJS.AES.decrypt(storedNote, password).toString(CryptoJS.enc.Utf8)
    if (decoded === '') {
        throw new WrongPasswordError('Wrong password.')
    }
    return decoded
}

function toBase64(bytes) {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
}

function fromBase64(text) {
    let binary
    try {
        binary = atob(text)
    } catch {
        throw new WrongPasswordError('This note is damaged and cannot be read.')
    }
    return Uint8Array.from(binary, character => character.charCodeAt(0))
}
