
const { app } = require('electron')
const fs      = require('fs')
const path    = require('path')
const { get } = require('lodash')

const { Log } = require('./Log')

const tkMetaTags = 'Tags'

class Exporter {

    constructor(settings) {

        this.log = new Log('Exporter')

        this.config = require(get(settings, 'configFile'))

        this.cPostsPath                = path.join(get(settings, 'userBaseDir'), 'Apps/Blot/Posts')
        this.cAnnotationTags           = get(this.config, 'annotations.tags', 'tags')
        this.cAnnotationPublishedTo    = get(this.config, 'annotations.publishedTo', 'publishedTo')
        
    }

    publish(entry) {

        const name      = formatFilename(entry)
        const fullpath  = path.join(this.cPostsPath, name)
        const post      = formatPost(entry)

        this.log.write(`Publishing ${entry} to ${fullpath}`)

        fs.writeFileSync(fullpath, post)

        return name

    }

    unpublish(entry) {

        this.log.write(`Unpublishing ${entry}`)

        const fullpath = path.join(this.cPostsPath, entry.annotations[this.cAnnotationPublishedTo])
        fs.unlinkSync(fullpath)

    }

}

function formatFilename(entry) {

    const ts    = new Date(entry.lastUpdate)
    const htime = `${ts.getFullYear()}_${ts.getMonth() + 1}_${ts.getDate()}`
    let   title = get(entry.annotations, 'title', '').trim()

    if (title.length <= 0) {
        title = 'Untitled'
    } else {
        title = title.slice(0, 30)
        title = title.replace(/[\s-:;!\.\?]/gi, '_')
    }

    const result = `${htime}_${title}.html`

    return result

}

function formatPost(entry) {

    let post = new String()

    // Metadata
    for(const key in entry.annotations) {
        
        if (key == this.cAnnotationTags) {
            post += `${tkMetaTags}: ` + entry.annotations[this.cAnnotationTags].join(', ') + '\n'
        }

    }

    // End of metadata
    post += '\n'

    // Content
    post += entry.html

    return post

}

module.exports = exports = Exporter