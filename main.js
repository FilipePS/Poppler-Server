const fs = require("fs")

const { Poppler } = require("node-poppler")
const poppler = new Poppler("/usr/bin")
const options = {
	ignoreImages: true,
	complexOutput: true,
    extractHidden: true
}

const formidable = require("formidable")
const form = new formidable.IncomingForm()

const express = require('express')

const app = express()

app.use('/output', express.static(__dirname + '/output'))

app.get('/', function (req, res) {
    res.send(fs.readFileSync('main.html', 'utf-8'))
})

app.post('/pdftohtml', function (req, res) {
    form.parse(req, (err, fields, files) => {
        const dir = "output/" + Date.now()
        fs.mkdirSync(dir)
        
        poppler.pdfToHtml(files.pdf.path, dir + '/result.html', options).then((r) => {
            console.info("Success!")
        
            fs.readFile(dir + "/result_ind.html", 'utf8', (err, data) => {
                if (err) {
                    console.error(err)
                    return
                }
        
                const fileList = data.match(/(?<=href\=\")result\-[0-9]+\.html/g)
        
                fileList.forEach(fileName => {
                    try {
                        const data = fs.readFileSync(dir + '/' + fileName, 'utf-8')
                        fs.writeFileSync(dir + '/' + fileName, data.replace(/bgcolor\=\"\#[a-zA-Z0-9]+\"/, 'bgcolor="#FFFFFF"'), 'utf-8')
                    } catch (e) {
                        console.error(e)
                    }
                })

                res.redirect(dir + '/result.html')
                //res.send(`<meta http-equiv="refresh" content="0; url=/${dir + '/result.html'}">`)
            })
        })
    })
})

//===============================

const PORT = 443
const cert_options = {
    key: fs.readFileSync(__dirname + '/../certs/privkey.pem'),
    cert: fs.readFileSync(__dirname + '/../certs/cert.pem'),
    ca: fs.readFileSync(__dirname + '/../certs/chain.pem')
}

const https = require('https');
const server = https.createServer(cert_options, app);

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
