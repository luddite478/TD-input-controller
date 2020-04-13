const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const now = require('moment')()

function killPrevChildrenPids(processeNames) {  
    const children_pids_file_path = path.resolve(`children_pids.json`)
    const children_pids = fs.readFileSync(children_pids_file_path)
    const currChildrenPids = JSON.parse(children_pids)

    // TODO: nice way to kill procs
    // console.log('kill');
    // child.stdin.pause();
    // child.kill();

    processeNames.forEach(p_name => {
        const p_pids = currChildrenPids[p_name]
        if (p_pids.length !== 0) {
            p_pids.forEach(pid => {
                console.log(`Killings prev children ${p_name} with pid ${pid}`)
                spawn('taskkill', [ "/F", "/PID", pid, "/T" ])
            })
        }
    })

    // Remove all pids from file
    Object.keys(currChildrenPids).forEach(proc => {
        currChildrenPids[proc] = [] 
    })

    const json = JSON.stringify(currChildrenPids)

    fs.writeFileSync(children_pids_file_path, json)
}

function addPidsToList(new_pids) {
    const children_pids_file_path = path.resolve(`children_pids.json`)
    const children_pids = fs.readFileSync(children_pids_file_path)
    const currChildrenPids = JSON.parse(children_pids)

    Object.keys(currChildrenPids).forEach(proc => {
        if (new_pids[proc]) {
            currChildrenPids[proc].push(new_pids[proc])
        }
    })

    const json = JSON.stringify(currChildrenPids)

    fs.writeFileSync(children_pids_file_path, json)
}

module.exports = function (touchdesingerIO, streamUrl) {
    try {
        killPrevChildrenPids(['streamlink', 'vlc'])
        console.log('streamlink_vlc_ndi parent pid: ', process.pid)
        
        const time = now.format('MM-DD-YYYY--h-mm-ss')
        const streamlink_log_path = path.join('videohost_restreamer', 'streamlink', `${time}_streamlink.log`)
        const vlc_log_path = path.join('videohost_restreamer', 'vlc', `${time}_vlc.log`)
        
        // RUN STREAMLINK
        const streamlink_quality = 'best'
        const streamlink = spawn('streamlink', [ streamUrl, streamlink_quality, '-O' ])
        console.log('streamlink', streamlink.pid)

        // RUN VLC
        const vlc_args = [
            '-I', 'dummy',
            '--dummy-quiet',
            ' --extraintf', 'http:logger',
            '--http-port', '8888',
            '--http-password', '123',
            '--verbose=2', `--logfile=${vlc_log_path}`,
            '--logmode=text',
            '--file-logging',
            '--save-config',
            '-',
            '--aout', 'NDI',
            '--vout', 'NDI'
        ]

        const vlc = spawn('vlc', vlc_args)
        console.log('vlc', vlc.pid)

        // PIPE STREAMLINK TO VLC
        streamlink.stdout.pipe(vlc.stdin)
        
        streamlink.stderr.setEncoding("utf8")
        streamlink.stderr.on('data', (data) => {
            fs.appendFile(streamlink_log_path, data, (err) => {
                if (err) {
                    console.log(err)
                } 
            })
        })
    
        streamlink.on('close', () => {
            console.log(`streamlink with pid ${streamlink.pid} closed`)
            touchdesingerIO.emit('videohost_restream_stop', `streamlink with pid ${streamlink.pid} closed`)
        })

        vlc.on('close', () => {
            console.log(`vlc with pid ${vlc.pid} closed`)
            touchdesingerIO.emit('videohost_restream_stop', `vlc with pid ${vlc.pid} closed`)
        })

        console.log(`Videohost restream start, emitting event, url: ${streamUrl}`)

        const new_pids = {
            vlc: vlc.pid,
            streamlink: streamlink.pid
        }

        addPidsToList(new_pids)

        touchdesingerIO.emit(`videohost_restream_start`, new_pids)

    } catch (error) {
        console.log('streamlink vlc ndi err: ', error)
        touchdesingerIO.emit('videohost_restream_err', error)
    }
}


