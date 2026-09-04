import { decryptNote } from './otnCrypto.mjs'

async function decryptNoteFromPage() {
    const data = _getEncryptedNoteAndPassword()
    const button = document.getElementById('decryptButton')
    hideError()
    button.disabled = true
    try {
        document.getElementById('note').value = await decryptNote(data.note, data.password)
    } catch (err) {
        // AES-GCM authenticates the ciphertext, so a failure here is a real
        // answer rather than a guess. The note stays hidden.
        showError(err.message)
    } finally {
        button.disabled = false
    }
}

function _getEncryptedNoteAndPassword() {
    const note = document.getElementById('encryptedNote').textContent
    const password = document.getElementById('password').value
    return { note, password }
}

async function getNote() {
    const noteId = _getNoteIdFromUrl()
    try {
        const response = await fetch(`/notes/${noteId}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            redirect: 'follow',
        })
        if (!response.ok) {
            throw new Error(`Could not get note (server said ${response.status})`)
        }
        const parsed = await response.json()
        if (!parsed.noteText) {
            throw new Error('The response contained no note')
        }
        _setEncryptedNote(parsed.noteText)
    } catch (error) {
        makeModalVisible()
        console.log('Error:', error)
    }
}

function _getNoteIdFromUrl() {
    const urlSearchParams = new URLSearchParams(window.location.search);
    if (urlSearchParams.has('noteId')) {
        return urlSearchParams.get('noteId')
    }
    console.error("There was no noteId defined in the url parameter. Ignoring the request!")
}

function _setEncryptedNote(encryptedNote) {
    document.getElementById('note').value = encryptedNote
    document.getElementById('encryptedNote').textContent = encryptedNote
}

function showError(message) {
    const error = document.getElementById('error')
    error.textContent = message
    error.hidden = false
}

function hideError() {
    document.getElementById('error').hidden = true
}

var modal = document.getElementById("myModal");
var span = document.getElementsByClassName("close")[0];

function makeModalVisible() {
    modal.style.display = "block";
}

span.onclick = function () {
    modal.style.display = "none";
    redirectToCreateNote()
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
        redirectToCreateNote()
    }
}

function redirectToCreateNote() {
    window.location.href = "/"
}

document.getElementById("password").addEventListener("keyup", function (event) {
    const key = (event.key || event.keyCode)
    if (key === 'Enter' || key === 13) {
        event.preventDefault();
        decryptNoteFromPage()
    }
});

// This file is a module, so nothing in it is global by default. The inline
// onclick attributes in showNote.html need these by name.
window.decryptNote = decryptNoteFromPage
window.redirectToCreateNote = redirectToCreateNote

// Module scripts are deferred, so the DOM is ready and the note can be
// fetched straight away. This replaces the inline window.onload that used to
// sit at the bottom of showNote.html.
getNote()
