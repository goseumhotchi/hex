// (c) gshot, 2018

const {
    app,
    Tray } = require('electron')

let tray = null

function initApp() {

    const AppControl = require('./AppControl')

    tray = new Tray('./img/icon.png')
    tray.setToolTip('Curse')

    AppControl.onCompose()

}

app.on('ready', initApp) 

app.on('window-all-closed', () => {

})

app.on('quit', () => {
    tray.destroy()
})

app.on('activate', () => {

})