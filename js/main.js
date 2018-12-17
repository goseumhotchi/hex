// (c) gshot, 2018

const {
    app,
    Tray }  = require('electron')
const fs    = require('fs')
const path  = require('path')

const AppControl = require('./AppControl')

let tray = null

function initApp() {

    let env = null
    if (process.env.ELECTRON_ENV) {
        env = process.env.ELECTRON_ENV.trim()
    }

    // Check if a config file exists in users space, if not, create an empty one
    const userBaseDir   = (env == 'dev') ? path.join(__dirname, '..') : path.join(app.getPath('home'), 'Dropbox')
    const configFile    = (env == 'dev') ? path.join(userBaseDir, 'config.json') : path.join(userBaseDir, 'config.json')

    console.log(userBaseDir)

    if (!fs.existsSync(configFile)) {
        fs.writeFileSync(configFile, JSON.stringify({}))
    }

    const appControl = new AppControl({
        userBaseDir,
        configFile
    })

    tray = new Tray('./img/icon.png')
    tray.setToolTip('HEX')

    //AppControl.onCompose()
    //AppControl.onFind()

}

app.on('ready', initApp) 

app.on('window-all-closed', () => {

})

app.on('quit', () => {
    tray.destroy()
})

app.on('activate', () => {

})