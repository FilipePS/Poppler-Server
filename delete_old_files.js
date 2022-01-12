const fs = require('fs')
const rimraf = require("rimraf");

fs.readdir('./result', (err, files) => {
    let total = 0
    let removed = 0
    files.forEach(file => {
        total++
        const date = new Date(parseInt(file))
        if ((Date.now() - date.getTime()) / 1000 / 60 / 60 > 6) {
            removed++
            console.log(file)
            rimraf.sync('./result/' + file)
        }
    })
    console.info(total, removed)
})

fs.readdir('./uploads', (err, files) => {
    let total = 0
    let removed = 0
    files.forEach(file => {
        total++
        const { birthtime } = fs.statSync('./uploads/' + file)
        if ((Date.now() - birthtime.getTime()) / 1000 / 60 / 60 > 1) {
            removed++
            console.log(file)
            fs.unlinkSync('./uploads/' + file)
        }
    })
    console.info(total, removed)
})