function decryptNote() {
    const data = _getEncryptedNoteAndPassword()
    const decodedNote = _decodeNote(data.note, data.password)
    document.getElementById('note').value = decodedNote
}

function _getEncryptedNoteAndPassword() {
    const note = document.getElementById('encryptedNote').textContent
    const password = document.getElementById('password').value
    return { note, password }
}

function _decodeNote(encodedNote, password) {
    const decoded = CryptoJS.AES.decrypt(encodedNote, password).toString(CryptoJS.enc.Utf8)
    if (decoded === "") return encodedNote
    return decoded
}

function getNote() {
    const noteId = _getNoteIdFromUrl()
    fetch(`/notes/${noteId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
    })
        .then(response => response.text())
        .then(data => {
            const parsed = JSON.parse(data)
            if (parsed.noteText) {
                _setEncryptedNote(parsed.noteText)
            } else {
                throw ("Could not get note: " + parsed.msg)
            }
        })
        .catch((error) => {
            makeModalVisible()
            console.log('Error:', error)
        })
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
