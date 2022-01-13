const http = require('http')
const https = require('https')
const express = require('express')
const formidable = require("formidable")
const fs = require("fs")
const { exec } = require("child_process")
const { Poppler } = require("node-poppler")
const sqlite3 = require('sqlite3').verbose()
const uuidv4 = require('uuid').v4

const db = new sqlite3.Database(__dirname + '/db/db.sqlite')
db.serialize(function() {
    db.run(`
    CREATE TABLE IF NOT EXISTS uploads (
        fileId CHAR(36) NOT NULL,
        filePath VARCHAR(255) NOT NULL,
        fileSize INT NOT NULL,
        originalName VARCHAR(255),
        PRIMARY KEY (fileId)
    );
    `)
    db.run(`
    CREATE TABLE IF NOT EXISTS converted (
        fileId CHAR(36) NOT NULL,
        filePath VARCHAR(255) NOT NULL,
        fileSize INT NOT NULL,
        originalName VARCHAR(255),
        PRIMARY KEY (fileId)
    );
    `)
})


// create app
const app = express()

const morgan = require('morgan')
const accessLogStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))

app.use('/', express.static(__dirname + '/public'))

app.get('/result/:fileId', async function (req, res) {
    try {
        let {fileId, filePath, originalName} =  await new Promise((resolve, reject) => {
            db.get('SELECT * FROM converted WHERE fileId=?', [req.params.fileId], (err, row) => {
                if (err) {
                    return reject(err)
                }
                resolve(row)
            })
        })

        if (originalName) {
            res.setHeader('Content-disposition', 'inline; filename=' + encodeURIComponent(originalName))
        } else {
            res.setHeader('Content-disposition', 'inline; filename=' + fileId + ".html")
        }
        res.setHeader('Content-type', 'text/html')
      
        const filestream = fs.createReadStream(filePath)
        filestream.pipe(res)
    } catch (e) {
        console.error(e)
        res.status(404)
    }
})

app.post('/pdftohtml', async function (req, res) {
    try {
        console.info('starting')
        const {fields, fileId} = await receiveAndSaveFile(req)
        const url = await convertFile(fileId) + (typeof fields.autotranslate !== 'undefined' ? "?autotranslate" : "")
        res.redirect(url)
    } catch (e) {
        console.error(e)
        res.status(500).send("Internal server error")
    }
})

app.post('/uploadfile', async function (req, res) {
    try {
        const {fileId} = await receiveAndSaveFile(req)
        res.json({status: 1, fileId })
    } catch (e) {
        console.error(e)
        res.status(500).json({status: 0})
    }
})

app.get('/convertfile/:fileId', async function (req, res) {
    try {
        const url = await convertFile(req.params.fileId)
        res.json({status: 1, url})
    } catch (e) {
        console.error(e)
        res.status(500).json({status: 0})
    }
})

async function convertFile(_fileId) {
    const {fileId, filePath, originalName} =  await new Promise((resolve, reject) => {
        db.get('SELECT * FROM uploads WHERE fileId=?', [_fileId], (err, row) => {
            if (err) {
                return reject(err)
            }
            resolve(row)
        })
    })
    console.log(filePath)
    const out_dir = "result/" + Date.now()
    console.info(out_dir)
    fs.mkdirSync(out_dir)

    const singlePage = true
    const options = {
        ignoreImages: true,
        complexOutput: true,
        extractHidden: true,
        noDrm: true,
        zoom: 1.3
    }
    if (singlePage) options.singlePage = true;

    const poppler = new Poppler("/usr/bin")
    const r = await poppler.pdfToHtml(filePath, out_dir + '/result.html', options)
    console.info("Success!")

    changeBackgroundColor(out_dir, singlePage)

    let resultPath
    if (singlePage) {
        resultPath = out_dir + "/result-html.html"
    } else {
        resultPath = out_dir + "/result.html"
    }
    const convertedFileId = uuidv4()

    db.serialize(function() {
        const stmt = db.prepare("INSERT INTO converted VALUES (?, ?, ?, ?)")
        const {size: fileSize} = fs.statSync(resultPath)
        stmt.run(convertedFileId, resultPath, fileSize, originalName)
        stmt.finalize()
    })

    fs.unlinkSync(filePath)

    return "/result/" + convertedFileId
}

async function receiveAndSaveFile(req) {
    const {fields, files} = await receiveForm(req)
    const filePath = files.file.path
    const originalName = files.file.name
    const fileId = uuidv4()
    const {size: fileSize} = fs.statSync(filePath)

    db.serialize(function() {
        const stmt = db.prepare("INSERT INTO uploads VALUES (?, ?, ?, ?)")
        stmt.run(fileId, filePath, fileSize, originalName)
        stmt.finalize()
    })

    return {fields, fileId, filePath, fileSize}
}

async function receiveForm(req) {
    const form = new formidable.IncomingForm({uploadDir: __dirname + '/uploads', keepExtensions: true, allowEmptyFiles: false, maxFileSize: 1024*1024*512})
    const [err, fields, files] = await new Promise(resolve => form.parse(req, (err, fields, files) => resolve([err, fields, files])))
    
    if (err) {
        throw new Error(err);
    }
    
    return {fields, files}
}

function changeBackgroundColor(dir, singlePage, color="#FFFFFF") {
    try {
        if (singlePage) {
            fs.writeFileSync(dir + "/result-html.html", fs.readFileSync(dir + "/result-html.html", 'utf-8').replace(/bgcolor\=\"\#[a-zA-Z0-9]+\"/, `bgcolor="${color}"`))
        } else {
            const result_ind_data = fs.readFileSync(dir + "/result_ind.html", 'utf8')
            const fileList = result_ind_data.match(/(?<=href\=\")result\-[0-9]+\.html/g) 

            fileList.forEach(fileName => {
                try {
                    const data = fs.readFileSync(dir + '/' + fileName, 'utf-8')
                    fs.writeFileSync(dir + '/' + fileName, data.replace(/bgcolor\=\"\#[a-zA-Z0-9]+\"/, `bgcolor="${color}"`), 'utf-8')
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
            fs.writeFileSync(dir + "/result_ind.html", result_ind_data.replace("<body>", `<body>\n<a href="${zip_output_name}" target="_blank" >[Download]</a><br/>`))
        }
    } catch (e) {
        console.error(e)
    }
}

// create server

const http_server = http.createServer(app)
http_server.listen(80, () => console.log(`Server listening on port: ${80}`))

if (process.argv.indexOf("-nohttps") == -1) {
    const cert_options = {
        key: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/cert.pem'),
        ca: fs.readFileSync('/etc/letsencrypt/live/translatewebpages.org/chain.pem')
    }
    const https_server = https.createServer(cert_options, app);
    https_server.listen(443, () => console.log(`Server listening on port: ${433}`))
}
