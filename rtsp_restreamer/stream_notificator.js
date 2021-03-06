Tail = require('tail').Tail
const path = require('path')
const fs = require('fs')
const chokidar = require('chokidar')

const logPath = path.resolve('rtsp_restreamer/EasyDarwin/logs')

let tail = null
function setWatcherToLatestLogFile (io, logFiles, logPath) {
    let latestLogFileName = ''
    let latestDate = 0
    logFiles.forEach(file => {
        const date = parseInt(file.split('-')[1], 10)
        if (date > latestDate && !path.extname(file) === '.log_lock') {
            latestDate = date
            latestLogFileName = file  
        }
    })
    const latestLogFilePath = path.join(logPath, latestLogFileName)
    tail = new Tail(latestLogFilePath)
    tail.on("line", (line) => handleNewLogLine(io, line))
}

function handleNewLogLine (io, line) {
    
    try {
        const firstWord = line.split(' ')[0]
        // RTSP protocol RECORD method means that stram started
        if (firstWord === 'RECORD') {
            console.log(line)
            const streamUrl = line.split(' ')[1]
            console.log('New broadcast', streamUrl)
            io.emit('rtsp_broadcast_start', streamUrl)
        }
    } catch (err) {
        console.log(err,line)
    }
    
}

function handleNewLogFile (io, logPath) { 
    // This file appears for a moment when logs are being created
    if (path.extname(logPath) === '.log_lock') {
        return
    }

    if (!tail) {
        return
    }

    tail.unwatch()
    tail = new Tail(logPath)
    tail.on("line", (line) => handleNewLogLine(io, line))
}

function handleWatchDirError (err) {
    console.log(err)
}

module.exports = (io) => {
    const logFiles = fs.readdirSync(logPath)
    // if log file for current date exists choose it for watching
    if (logFiles.length !== 0) {
        setWatcherToLatestLogFile(io, logFiles, logPath)
    }

    // Set watcher for new logs files 
    const watcher = chokidar.watch(logPath, { ignored: /^\./, persistent: true })
    watcher
        .on('add', (path) => handleNewLogFile(io,path))
        .on('error', handleWatchDirError)
}
