const http = require('http')
const https = require('https')
const express = require('express')
const formidable = require("formidable")
const fs = require("fs")
const { exec } = require("child_process")
const { Poppler } = require("node-poppler")


// create app
const app = express()

const morgan = require('morgan')
const { resolve } = require('path')
const accessLogStream = fs.createWriteStream(__dirname + '/access.log', { flags: 'a' })
app.use(morgan('combined', { stream: accessLogStream }))

app.use('/', express.static(__dirname + '/public'))
app.use('/output', express.static(__dirname + '/output'))

app.post('/pdftohtml', async function (req, res) {
    try {
        res.redirect(await inputToHtml(req))
    } catch (e) {
        console.error(e)
        res.status(500).send("Internal server error")
    }
})

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

async function inputToHtml(req) {
    const form = new formidable.IncomingForm()
    const [err, fields, files] = await new Promise(resolve => form.parse(req, (err, fields, files) => resolve([err, fields, files])))

    const out_dir = "output/" + Date.now()
    console.info(out_dir)
    fs.mkdirSync(out_dir)

    const singlePage = true
    const options = {
        ignoreImages: true,
        complexOutput: true,
        extractHidden: true,
        zoom: 1.3
    }
    if (singlePage) options.singlePage = true;

    const poppler = new Poppler("/usr/bin")
    const r = await poppler.pdfToHtml(files.file.path, out_dir + '/result.html', options)
    console.info("Success!")

    changeBackgroundColor(out_dir, singlePage)

    if (singlePage) {
        return out_dir + "/result-html.html" + (typeof fields.autotranslate !== 'undefined' ? "?autotranslate" : "")
    } else {
        return out_dir + "/result.html" + (typeof fields.autotranslate !== 'undefined'  ? "?autotranslate" : "")
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
