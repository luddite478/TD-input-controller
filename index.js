
const express = require('express')
const app = express()
const http = require('http').createServer(app)
const touchdesingerIO = require('socket.io')(http)
const path = require('path')
const fs = require('fs')
const axios = require('axios')
require('dotenv').config()

// Run EasyDarwin RTSP server as a child process 
require('./rtsp_restreamer/easydarwin.js')()
// EasyDarwin log watcher which notifies TD about new streams
require('./rtsp_restreamer/stream_notificator')(touchdesingerIO)
// Cloud -> EasyDarwin restreaming function which uses ffmpeg in a child process 
const ffmpegRestream = require('./rtsp_restreamer/ffmpeg_restream.js')
// Streamlink restream to NDI 
const videohostRestream = require('./videohost_restreamer/index.js')

const mediaFolderPath = process.env.TD_MEDIA_FOLDER

const mediaFolder = path.join(mediaFolderPath)
const downloadFolder = path.join(__dirname, 'tmp')

const SERVER_HTTP_PORT = 8787
const SERVER_ADDRESS = process.env.SERVER_ADDRESS
const PORT = 9898
let isConenctedToTouchdesigner = false

touchdesingerIO.on('connection', (socket) => {
    isConenctedToTouchdesigner = true
    console.log('Touchdesigner connected')
    touchdesingerIO.emit('input_controller_connect', true)

    socket.on('disconnect', () => {
        isConenctedToTouchdesigner = false
        console.log('Touchdesigner disconnected')
        touchdesingerIO.emit('input_controller_disconnect', true)
    })

    socket.on('videohost_restream_request', (url) => {
        console.log('Run streamlink vlc NDI request with url: ', url)
        videohostRestream(touchdesingerIO, url)
    })
})

async function moveFileFromDownloadsFolderToTDQueueFolder (downloadFilePath, mediaFolderFilePath) {
    try {
        fs.renameSync(downloadFilePath, mediaFolderFilePath)
    } catch (error) {
        console.log('Can not move file ', err)
        touchdesingerIO.emit('input_controller_error', error)
    }
} 

async function handleRequest (request) {
    try {
        
        if (!isConenctedToTouchdesigner) {
            const errMsg = 'Could not download file since connection to Touchdesigner is broken'
            touchdesingerIO.emit('input_controller_error', errMsg)
            throw new Error(errMsg)
        }


        const { token, requestMeta } = request
        const { type, username, date, message_id, file } = requestMeta
        const { extension } = file

        console.log(`${type}_request`, request)

        const filename = `${type}_${date}_${message_id}.${extension}`
        const downloadFilePath = path.join(downloadFolder, filename)
        const mediaFolderFilePath = path.join(mediaFolder, filename)
        const fileStream = fs.createWriteStream(downloadFilePath)

        const res = await axios({
            method: 'get',
            url: `https://${SERVER_ADDRESS}:${SERVER_HTTP_PORT}/download`,
            headers: { 
                'token': token 
            },
                responseType: 'stream' 
            })

        if (res.status === 200) {
            res.data.pipe(fileStream)
                .on('finish', async () => {
                    await moveFileFromDownloadsFolderToTDQueueFolder(downloadFilePath, mediaFolderFilePath)    
                    // Send touchdesigner file path to use   
                    console.log(`${type}_request`, mediaFolderFilePath) 
                    touchdesingerIO.emit(`${type}_request`, mediaFolderFilePath)
                })             
        } else {
            const errMsg = `Failed to download file from server, status code: ${res.status}`
            touchdesingerIO.emit('input_controller_error', errMsg)
            throw new Error(errMsg)
        }
    } catch (error) {
        console.log('Failed to download file from server', error)
        touchdesingerIO.emit('input_controller_error', error)
    }
}

const tgServerBotSocket = require('socket.io-client')(`https://${SERVER_ADDRESS}:${SERVER_HTTP_PORT}`,{ rejectUnauthorized: false })

tgServerBotSocket.on('*', () => {
    console.log('sdfsdfdsf')
})
tgServerBotSocket.on('connect', () => {
    if (isConenctedToTouchdesigner) {
        touchdesingerIO.emit('bot_server_connect', true)
    }
    console.log('Connected to telegram bot server')
})

tgServerBotSocket.on('connect_failed', function() {
    console.logs("Sorry, there seems to be an issue with the connection!");
})

tgServerBotSocket.on('disconnect', () => {
    touchdesingerIO.emit('bot_server_disconnect', true)
})

tgServerBotSocket.on('audio_request', async (request) => {
    try {
        await handleRequest (request)
    } catch (error){
        touchdesingerIO.emit('input_controller_error', error)
    }
})

tgServerBotSocket.on('video_request', async (request) => {
    try {
        await handleRequest (request)
    } catch (error) {
        touchdesingerIO.emit('input_controller_error', error)
    }
})

tgServerBotSocket.on('photo_request', async (request) => {
    try {
        await handleRequest (request)
    } catch (error) {
        touchdesingerIO.emit('input_controller_error', error)
    }
})

tgServerBotSocket.on('video_note_request', async (request) => {
    try {
        await handleRequest (request)
    } catch (error) {
        touchdesingerIO.emit('input_controller_error', error)
    }
})

tgServerBotSocket.on('rtsp_broadcast_start',  (msg) => {
    // msg === rtsp://localhost:554/<stream>
    console.log('rtsp_broadcast_start', msg)
    const parsedStreamUrl = new URL(msg)
    const streamPath = parsedStreamUrl.pathname
    ffmpegRestream(touchdesingerIO, msg)
})

tgServerBotSocket.on('restream_request',  (msg) => {
    // msg(str): <restream_link>
    console.log('restream_request', msg)
    touchdesingerIO.emit('restream_request', msg)
})

tgServerBotSocket.on('restream_stop_request',  (msg) => {
    // msg(bool): true
    console.log('restream_stop_request', msg)
    touchdesingerIO.emit('restream_stop_request', msg)
})

tgServerBotSocket.on('url_request',  (msg) => {
    // msg(str): <link>
    console.log('url_request', msg)
    touchdesingerIO.emit('url_request', msg)
})

tgServerBotSocket.on('url_stop_request',  (msg) => {
    // msg(str): <link>
    console.log('url_stop_request', msg)
    touchdesingerIO.emit('url_stop_request', msg)
})


tgServerBotSocket.on('rtsp_broadcast_end',  (msg) => {
    if (msg === 'last' ) {
        touchdesingerIO.emit('rtsp_broadcast_end', 'last')
        return
    }
    console.log('rtsp_broadcast_end', msg)
    const parsedStreamUrl = new URL(msg)
    const streamPath = parsedStreamUrl.pathname
    touchdesingerIO.emit('rtsp_broadcast_end', 'rtsp://localhost:554/' + streamPath)
})

http.listen(PORT, () => {
    console.log(`input_controller is listening on ${PORT}`)
})




