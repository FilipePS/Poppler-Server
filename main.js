const fs = require("fs")

const { Poppler } = require("node-poppler")
const options = {
	ignoreImages: true,
	complexOutput: true,
    extractHidden: true
}

const formidable = require("formidable")

const express = require('express')

const app = express()

const morgan = require('morgan')
const accessLogStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))

app.use('/output', express.static(__dirname + '/output'))

app.get('/', function (req, res) {
    res.send(fs.readFileSync('main.html', 'utf-8'))
})

const { exec } = require("child_process")

app.post('/pdftohtml', function (req, res) {
    const form = new formidable.IncomingForm()
    form.parse(req, (err, fields, files) => {
        const dir = "output/" + Date.now()
        fs.mkdirSync(dir)

        const poppler = new Poppler("/usr/bin")
        poppler.pdfToHtml(files.file.path, dir + '/result.html', options).then((r) => {
            console.info("Success!")
        
            fs.readFile(dir + "/result_ind.html", 'utf8', (err, _data) => {
                if (err) {
                    console.error(err)
                    return
                }
        
                const fileList = _data.match(/(?<=href\=\")result\-[0-9]+\.html/g)
        
                fileList.forEach(fileName => {
                    try {
                        const data = fs.readFileSync(dir + '/' + fileName, 'utf-8')
                        fs.writeFileSync(dir + '/' + fileName, data.replace(/bgcolor\=\"\#[a-zA-Z0-9]+\"/, 'bgcolor="#FFFFFF"'), 'utf-8')
                    } catch (e) {
                        console.error(e)
                    }
                })
                const zip_output_name = "output.zip"
                exec(`sudo zip -q -r "${dir}/${zip_output_name}" "${dir}"`, (error, stdout, stderr) => {
                    if (error) {
                        console.log(`error: ${error.message}`);
                        return;
                    }
                    if (stderr) {
                        console.log(`stderr: ${stderr}`);
                        return;
                    }
                })

                fs.writeFileSync(dir + "/result.html", fs.readFileSync(dir + "/result.html", 'utf-8').replace("100,*", `120,*`))
                fs.writeFileSync(dir + "/result_ind.html", _data.replace("<body>", `<body>\n<a href="${zip_output_name}" target="_blank" >[Download]</a><br/>`))


                res.redirect(dir + '/result.html')
                //res.send(`<meta http-equiv="refresh" content="0; url=/${dir + '/result.html'}">`)
            })
        })
    })
})

//===============================

const PORT = 443
const cert_options = {
    key: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/cert.pem'),
    ca: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/chain.pem')
}

const https = require('https');
const server = https.createServer(cert_options, app);

const http = require('http');
const server2 = http.createServer(app);

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`))
server2.listen(80, () => console.log(`Server listening on port: ${80}`))
