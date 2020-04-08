const spawn = require('child_process').spawn
const path = require('path')

module.exports = function () {

const proc = spawn(path.join(__dirname, './EasyDarwin/EasyDarwin.exe'))

    proc.stdout.setEncoding("utf8")
    proc.stdout.on('data', (data) => {
        // console.log(`[ NODE_CHILD_PROCESS pid ${proc.pid} ] `, data)
    })

    proc.stderr.setEncoding("utf8")
    proc.stderr.on('data', (data) => {
        // console.log(`[ NODE_CHILD_PROCESS pid ${proc.pid} ] `, data)
    })

    proc.on('close', () => {
        // console.log(`[ NODE_CHILD_PROCESS pid ${proc.pid}] `, 'finished')
    })

}