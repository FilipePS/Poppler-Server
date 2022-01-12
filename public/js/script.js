const btnAction = document.getElementById("btnAction")
const btnInputFile = document.getElementById("btnInputFile")
const formUpload = document.getElementById("formUpload")

btnAction.onclick = e => {
    if (btnInputFile.value) return;
    btnInputFile.click()
}

btnInputFile.oninput = e => {
    btnAction.querySelector('i').setAttribute('class', 'gg-software-upload')
    const span = btnAction.querySelector('span')
    span.textContent = 'Uploading 0%'

    const xhttp = new XMLHttpRequest()
    xhttp.responseType = "json"
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && xhttp.response.status) {
            fetch('/convertfile?fileId=' + encodeURIComponent(xhttp.response.fileId))
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
