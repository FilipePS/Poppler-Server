const container = document.getElementById("container")
const btnAction = document.getElementById("btnAction")
const btnInputFile = document.getElementById("btnInputFile")
const formUpload = document.getElementById("formUpload")

container.ondragover = e => {
    e.preventDefault()
}

container.ondrop = e => {
    e.preventDefault()
    if (e.dataTransfer.files) {
        if (e.dataTransfer.files[0].type !== "application/pdf") return;
        btnInputFile.files = e.dataTransfer.files
        onFile()
    }
}


btnAction.onclick = e => {
    if (btnInputFile.value) return;
    btnInputFile.click()
}

btnInputFile.oninput = onFile

function onFile() {
    btnAction.querySelector('i').setAttribute('class', 'gg-software-upload')
    const span = btnAction.querySelector('span')
    span.textContent = 'Uploading 0%'

    const xhttp = new XMLHttpRequest()
    xhttp.responseType = "json"
    xhttp.upload.onprogress = function(e) {
        span.textContent = 'Uploading ' + Math.round(e.loaded*100/e.total) + "%"
    }
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && xhttp.response.status) {
            btnAction.querySelector('i').setAttribute('class', 'gg-swap')
            span.textContent = 'Converting...'
            fetch('/convertfile/' + encodeURIComponent(xhttp.response.fileId))
            .then(response => response.json())
            .then(response => {
                if (response.url) {
                    location = response.url
                }
            })
        }
    }
    xhttp.open(formUpload.method, formUpload.action, true);
    xhttp.send(new FormData(formUpload));

    btnInputFile.value = null
}