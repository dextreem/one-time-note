import { encryptNote } from './otnCrypto.mjs'

async function storeNote() {
    const data = _getNoteAndPassword()
    const button = document.getElementById('createButton')
    hideError()
    button.disabled = true
    try {
        // Deriving the key takes a moment, and awaiting it here also stops a
        // second click from creating a second copy of the same note.
        const encryptedNote = await encryptNote(data.note, data.password)
        makeModalVisible(await _sendNote(encryptedNote))
    } catch (err) {
        showError(err.message)
    } finally {
        button.disabled = false
    }
}

function _getNoteAndPassword() {
    const note = document.getElementById('note').value
    const password = document.getElementById('password').value
    return { note, password }
}

async function _sendNote(encryptedNote) {
    const response = await fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({ noteText: encryptedNote })
    })
    // A rate-limited or failing response is not JSON, so check before parsing.
    if (!response.ok) {
        throw new Error(response.status === 429
            ? 'Too many requests. Please wait a moment and try again.'
            : `The note could not be stored (server said ${response.status}).`)
    }
    const data = await response.json()
    return data.noteId
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

function makeModalVisible(noteId) {
    if (noteId) {
        document.getElementById("urlInput").value = window.location + "?noteId=" + noteId
    }
    modal.style.display = "block";
}

span.onclick = function () {
    modal.style.display = "none";
    location.reload()
}

window.onclick = function (event) {
    if (event.target == modal) {
        modal.style.display = "none";
        location.reload()
    }
}

function copyUrl() {
    var copyText = document.getElementById("urlInput");
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(copyText.value);
}

document.getElementById("password").addEventListener("keyup", function (event) {
    const key = (event.key || event.keyCode)
    if (key === 'Enter' || key === 13) {
        event.preventDefault();
        storeNote()
    }
});

// This file is a module, so nothing in it is global by default. The inline
// onclick attributes in createNote.html need these two by name.
window.storeNote = storeNote
window.copyUrl = copyUrl
