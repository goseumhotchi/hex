
const path  = require('path')
const fs    = require('fs')
const { get } = require('lodash')
const { createLogger, format, transports } = require('winston')
const chalk = require('chalk')

const MAX_COMPONENT_LENGTH  = 35
const MAX_LEVEL_LENGTH      = 10

const STYLE_TIME            = chalk.gray
const STYLE_COMPONENT       = chalk.cyanBright
const STYLE_DEBUG           = chalk.gray
const STYLE_INFO            = chalk.white
const STYLE_WARNING         = chalk.bgRed
const STYLE_ERROR           = chalk.bgRed
const STYLE_FAILURE         = chalk.bgRed.bold

const logSupport    = typeof fs !== 'undefined' && typeof fs.existsSync !== 'undefined'
const defaultLogDir = '.'

const time = {
    utcString() {
        return (new Date(Date.now())).toUTCString()
    }
}

const logFilename = 'hex.log'

class Logger {

    constructor(logDir) {

        if (logSupport && fs.existsSync(path.join(logDir, logFilename))) {
            fs.unlinkSync(path.join(logDir, logFilename))
        }

        const _padLevel = format((info, opts) => {
            info.level = info.level.padEnd(opts.levelLength)
            return info
        })
        const padLevel = _padLevel({ levelLength: MAX_LEVEL_LENGTH })

        const _colorizeOutput = format((info, opts) => {
            info.timestamp  = opts.tStyle(info.timestamp)
            info.from       = opts.fStyle(info.from)
            info.message    = opts.mStyle(info.message)
            return info
        })
        const colorizeMessage = _colorizeOutput({ tStyle: STYLE_TIME, fStyle: STYLE_COMPONENT, mStyle: STYLE_INFO })

        const _timestamp = format(info => {
            info.timestamp = time.utcString()
            return info
        })
        const consoleTimestamp = _timestamp({})

        const _colorizeLevel = format((info, opts) => {
            const style = Log.colors[info.level]
            info.message = style(info.message)
            return info
        })
        const colorizeLevel = _colorizeLevel({})

        const consoleFormat = format.printf(info => {
            return `${info.timestamp} | ${info.from} ${info.message}`
        })

        const fileFormat = format.printf(info => {
            return `${info.timestamp} | ${info.from} ${info.level} ${info.message}`
        })

        if (logSupport) {
            this.logger = createLogger({
                levels: Logger.levels,
                transports: [
                    new transports.Console({
                        level : Logger.level.DEBUG,
                        format: format.combine(
                            consoleTimestamp,
                            colorizeLevel,
                            colorizeMessage,
                            consoleFormat
                        )
                    }),
                    new transports.File({
                        level : Logger.level.DEBUG,
                        format: format.combine(
                            format.timestamp(),
                            padLevel,
                            fileFormat
                        ),
                        filename: `${logDir}/${logFilename}`
                    })
                ]
            })
        }

    }

    static get levels() {
        return {
            DEBUG     : 4,
            INFO      : 3,
            WARNING   : 2,
            ERROR     : 1,
            FAILURE   : 0
        }
    }

    static get level() {
        return {
            DEBUG   : 'DEBUG',
            INFO    : 'INFO',
            WARNING : 'WARNING',
            ERROR   : 'ERROR',
            FAILURE : 'FAILURE'
        }
    }

    static get colors() {
        return {
            DEBUG   : STYLE_DEBUG,
            INFO    : STYLE_INFO,
            WARNING : STYLE_WARNING,
            ERROR   : STYLE_ERROR,
            FAILURE : STYLE_FAILURE
        }
    }

    log(from, obj, level = 'INFO') {

        let message = ''
        if(obj instanceof Object) {
            message = `\n--\n${JSON.stringify(obj, null, 2)}\n--`
        } else {
            message = obj
        }

        if (logSupport) {
            this.logger.log({from, message, level})
        }
    }
}

class Log {

    constructor(component, logDir = defaultLogDir) {

        this.component = component
        this.from       = component
        const l = this.from.length
        this.from = (l > MAX_COMPONENT_LENGTH) ?
                    (this.from.slice(0, MAX_COMPONENT_LENGTH - 3) + '...') :
                    this.from
        this.from = this.from.padEnd(MAX_COMPONENT_LENGTH)

        this.LOGGER = new Logger(logDir)

    }

    static get levels() {
        return Logger.levels
    }

    static get level() {
        return Logger.level
    }

    static get colors() {
        return Logger.colors
    }

    log(obj, level = 'INFO') {
        this.LOGGER.log(this.from, obj, level)
    }

    print(obj, level = 'INFO') {
        this.log(obj, level)
    }

    write(obj, level = 'INFO') {
        this.log(obj, level)
    }

    console(message, level = LOGLEVEL.MESSAGE, force = false) {

        if (get(config, `log.logComponentToConsole.${this.component}`) || force) {
            const textStyle = LOGLEVEL_STYLE[level]

            let str = ''
            if (message instanceof Object) {
                str = `\n${JSON.stringify(message, null, 2)}\n--`
            } else {
                str = message
            }
            console.log(`${STYLE_TIME(time.utcString())} | ${STYLE_COMPONENT(this.componentStr)} ${textStyle(str)}`)

        }

    }

}

const LOGLEVEL = {
    DEBUG  : 0,
    MESSAGE: 1,
    WARNING: 2,
    ERROR  : 3,
    FAILURE: 4
}

const LOGLEVEL_STRING = {
    0 : 'DEBUG',
    1 : 'MESSAGE',
    2 : 'WARNING',
    3 : 'ERROR',
    4 : 'FAILURE'
}

const LOGLEVEL_STYLE = {
    [LOGLEVEL.DEBUG]    : STYLE_DEBUG,
    [LOGLEVEL.MESSAGE]  : STYLE_DEBUG,
    [LOGLEVEL.WARNING]  : STYLE_WARNING,
    [LOGLEVEL.ERROR]    : STYLE_ERROR,
    [LOGLEVEL.FAILURE]  : STYLE_FAILURE
}

module.exports = exports = { Log, LOGLEVEL }