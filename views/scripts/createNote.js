function storeNote() {
    const data = _getNoteAndPassword()
    const encodedNote = _encodedNote(data.note, data.password)
    _sendNote(encodedNote)
}

function _getNoteAndPassword() {
    const note = document.getElementById('note').value
    const password = document.getElementById('password').value
    return { note, password }
}

function _encodedNote(note, password) {
    return CryptoJS.AES.encrypt(note, password).toString()
}

function _sendNote(encodedNote) {
    fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({ noteText: encodedNote })
    })
        .then(response => response.json())
        .then(data => makeModalVisible(data.noteId));
}

var modal = document.getElementById("myModal");
var span = document.getElementsByClassName("close")[0];

function makeModalVisible(noteId) {
    console.log(noteId)
    if (noteId){
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