**Input contoller for Touchdesigner**

Indludes:
- Socket-io client for communicating with the server
- Socket-io server for communicating with Touchdesigner
- Media downloader
- Stream Notificator

Run with:
`node index.js <TD_media_folder_path>`

```
                ------------- Cloud ----------------
               | EasyDarwin  (sio server 8787)      |
* RTSP  ----   | Cloud telegram bot                 | 
  src *         -------------------------------------    
             /                  \         \
            /                    \         \   
           /                      \         \  
          /                    ----\---(sio client)------INPUT CONTROLLER (sio server 9898) --------------
         /                     |    \          \                                                           | <URL>
                               |     \           FFmpeg restream --> EasyDarwin <-- Stream notificator --- | ------>  
* telegram-bot-client *        |      \                                                                    |         Touchdesigner(sio lient)        
                               |        * Downloader *    ---------------------------------------------------------->    (media folder)
                               |     (tmp folder for loading)                                              |
                               |                                                                           |
                                ----------------------------------------------------------------------------
```

`.env` file includes: 
`SERVER_ADDRESS=''` -- cloud server address

