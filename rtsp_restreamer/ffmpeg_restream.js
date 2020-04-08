const spawn = require('child_process').spawn
const fs = require('fs')
const path = require('path')

module.exports = function (io, streamUrl) {
    try {
        const cmd = 'ffmpeg'
        const parsedStreamUrl = new URL(streamUrl)
        const streamPath = parsedStreamUrl.pathname
        const ffmpeg_stdout_path = path.join('rtsp_restreamer', 'ffmpeg', `${streamPath}_stderr.log`)
        const ffmpeg_stderr_path = path.join('rtsp_restreamer', 'ffmpeg', `${streamPath}_stdout.log`)
        const args = [
            '-hide_banner',
            '-i', streamUrl,
            '-c', 'copy', 
            '-f', 'rtsp', `rtsp://localhost:554${streamPath}`
        ]
    
        const proc = spawn(cmd, args)
    
        proc.stdout.setEncoding("utf8")
        proc.stdout.on('data', (data) => {
            fs.appendFile(ffmpeg_stdout_path, data, (err) => {
                if (err) {
                    console.log(err)
                } 
            })
            console.log(data)
        })
    
        proc.stderr.setEncoding("utf8")
        proc.stderr.on('data', (data) => {
            fs.appendFile(ffmpeg_stderr_path, data, (err) => {
                if (err) {
                    console.log(err)
                } 
            })
        })
    
        proc.on('close', () => {
            console.log('FFmpeg closed')
        })

    } catch (error) {
        console.log('FFmpeg error: ', error)
    }
}


