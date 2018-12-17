// AppControl.js (c) gshot 2018

const {
    app,
    BrowserWindow,
    globalShortcut,
    ipcMain
} = require('electron')
const { get } = require('lodash')
const path = require('path')

const { Log }   = require( './Log')
const Storage   = require('./Storage')
const Exporter  = require('./Exporter')

const cAppStateIdle             = 'AppStateIdle'
const cAppStateCompose          = 'AppStateCompose'
const cAppStateFind             = 'AppStateFind'
const cWindowCompose            = 'WindowCompose'
const cWindowFind               = 'WindowFind'
const cContentCompose           = './html/compose.html'
const cContentFind              = './html/find.html'
const cChannelSetContent        = 'ipcChannelSetContent'
const cChannelSaveContent       = 'ipcChannelSaveContent'
const cChannelIdleRequest       = 'ipcChannelIdleRequest'
const cChannelSearchRequest     = 'ipcChannelSearchRequest'
const cChannelSearchReply       = 'ipcChannelSearchReply'
const cChannelEditRequest       = 'ipcChannelEditRequest'
const cAnnotationPublic         = 'public'
const cAnnotationPublishedTo    = 'publishedTo'
const cAnnotationTags           = 'tags'

class AppControl {

    constructor(settings) {

        this.config = require(get(settings, 'configFile'))

        this.cShortcutCompose   = get(this.config, 'shortcuts.compose', 'CommandOrControl+Alt+N')
        this.cShortcutFind      = get(this.config, 'shortcuts.find', 'CommandOrControl+Alt+F')
        this.cShortcutQuit      = get(this.config, 'shortcuts.quit', 'CommandOrControl+Alt+Q')

        this.log = new Log('AppControl', get(settings, 'userBaseDir'))
        
        this.log.write(this.config)

        this.storage    = new Storage(settings)
        this.exporter   = new Exporter(settings)
        
        this.windows    = {
            [cWindowCompose]: null,
            [cWindowFind]   : null
        }
        this.windowContent = {
            [cWindowCompose]: cContentCompose,
            [cWindowFind]   : cContentFind
        }
        this.windowSettings = {
            [cWindowCompose]: {
                frame: false
            },
            [cWindowFind]   : {
                frame   : false,
                height  : 600
            }
        }

        globalShortcut.register(this.cShortcutCompose, () => this.onCompose())
        globalShortcut.register(this.cShortcutFind, () => this.onFind())
        globalShortcut.register(this.cShortcutQuit, () => this.onQuit())

        // IPC: save the content of the editor
        ipcMain.on(cChannelSaveContent, async (event, message) => {

            let entry = null

            if (message && message.id) {

                // If this was published before, unpublish
                const old_entry = this.storage.findById(message.id)
                if (get(old_entry, `annotations.${this.cAnnotationPublic}`, false) == true) {
                    this.exporter.unpublish(old_entry)
                    this.storage.removeAnnotation(old_entry.$loki, cAnnotationPublic)
                    this.storage.removeAnnotation(old_entry.$loki, cAnnotationPublishedTo)
                }

                // This had an ID, so the existing entry needs update
                this.storage.updateEntry(message.id, message.obj, message.html, message.annotations)
                entry = this.storage.findById(message.id)

            } else {

                // This is a new entry
                entry = this.storage.saveEntry(message.obj, message.html, message.annotations)

            }

            // Save new tags globally
            get(message, `annotations.${cAnnotationTags}`, []).forEach(tag => {
                this.storage.saveTag(tag)
            })

            console.log(this.storage.findAllTags())

            // Publish again, or for the first time
            if (message.public) {
                // Publish
                const publishedTo = this.exporter.publish(entry)
                this.storage.addAnnotation(entry.$loki, cAnnotationPublishedTo, publishedTo)
            }     

            console.log(this.storage.findAll())

        })

        ipcMain.on(cChannelSearchRequest, (event, message) => {
        
            const request = message
            const result  = this.storage.find(request.searchString)
            event.sender.send(cChannelSearchReply, result)
        
        })

        ipcMain.on(cChannelEditRequest, (event, message) => {

            const id     = parseInt(message)
            const result = this.storage.findById(id)

            this.switchAppState(cAppStateCompose, result)

        })

        ipcMain.on(cChannelIdleRequest, (event, message) => {

            this.switchAppState(cAppStateIdle)

        })

        this.switchAppState(cAppStateIdle)

    }

    onCompose() {

        this.switchAppState(cAppStateCompose)

    }

    onFind() {

        this.switchAppState(cAppStateFind)

    }

    async onQuit() {

        this.switchAppState(cAppStateIdle)
        app.quit()

    }

    switchAppState(newState, args) {

        if (this.state == newState) {
            return
        }

        switch (newState) {

            case cAppStateIdle:

                this.log.write(`New state: ${newState}`, Log.level.DEBUG)

                this.closeWindow(cWindowCompose)
                this.closeWindow(cWindowFind)

                break

            case cAppStateCompose:

                this.log.write(`New state: ${newState}`, Log.level.DEBUG)

                this.closeWindow(cWindowFind)
                this.openWindow(cWindowCompose)

                if (args) {

                    // Preload edit with provided delta
                    this.windows[cWindowCompose].webContents.on('did-finish-load', () => {
                        this.windows[cWindowCompose].webContents.send(cChannelSetContent, { 
                            delta       : args.obj,
                            id          : args.$loki,
                            annotations : get(args, 'annotations', {})
                        })
                    })                    

                } else {

                    // Blank edit window
                    this.windows[cWindowCompose].webContents.on('did-finish-load', () => {
                        this.windows[cWindowCompose].webContents.send(cChannelSetContent, null)
                    })

                }


                break

            case cAppStateFind:

                this.log.write(`New state: ${newState}`)

                this.closeWindow(cWindowCompose)
                this.openWindow(cWindowFind)

                break

            default:

                this.log.write(`Invalid application state: ${newState}`)

        }

        this.state = newState

    }

    openWindow(id) {

        if (this.windows[id] != null) {
            return
        }

        this.windows[id] = new BrowserWindow(
            {
                frame   : false,
                width   : 800,
                height  : 600,
                show    : false,
                ...this.getWindowSettings(id)
            }
        )

        this.windows[id].once('ready-to-show', () => {
            this.windows[id].show()
        })

        this.windows[id].loadFile(this.getWindowContent(id))

        this.windows[id].webContents.openDevTools()

        this.windows[id].on('closed', () => {
            this.windows[id] = null
        })

    }

    closeWindow(which) {

        if (this.windows[which] != null) {
            this.windows[which].close()
            this.windows[which] = null
        }

    }

    getWindowSettings(id) {

        return this.windowSettings[id]

    }

    getWindowContent(id) {

        return this.windowContent[id]

    }

}

module.exports = exports = AppControl