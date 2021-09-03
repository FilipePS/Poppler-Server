const fs = require('fs')
const rimraf = require("rimraf");

fs.readdir('./output', (err, files) => {
    let total = 0
    let removed = 0
    files.forEach(file => {
        total++
        const date = new Date(parseInt(file))
        if ((Date.now() - date.getTime()) / 1000 / 60 / 60 > 6) {
            removed++
            console.log(file)
            //fs.rmdirSync('./output/' + file, {recursive: true, : true})
            rimraf.sync('./output/' + file)
        }
    })
    console.info(total, removed)
})