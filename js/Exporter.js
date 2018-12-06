
const fs      = require('fs')
const path    = require('path')
const { get } = require('lodash')

const { Log } = require('./Log')

const config = require('../config')

const cPostsPath                = get(config, 'blog.posts', './blog/posts')
const cAnnotationTags           = get(config, 'annotations.tags', 'tags')
const cAnnotationPublishedTo    = get(config, 'annotations.publishedTo', 'publishedTo')

const tkMetaTags = 'Tags'

class Exporter {

    constructor() {

        this.log = new Log('Exporter')

    }

    publish(entry) {

        this.log.write(`Publishing ${entry}`)

        const name      = formatFilename(entry)
        const fullpath  = path.join(cPostsPath, name)
        const post      = formatPost(entry)

        fs.writeFileSync(fullpath, post)

        return name

    }

    unpublish(entry) {

        this.log.write(`Unpublishing ${entry}`)

        const fullpath = path.join(cPostsPath, entry.annotations[cAnnotationPublishedTo])
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
        
        if (key == cAnnotationTags) {
            post += `${tkMetaTags}: ` + entry.annotations[cAnnotationTags].join(', ') + '\n'
        }

    }

    // End of metadata
    post += '\n'

    // Content
    post += entry.html

    return post

}

module.exports = exports = Exporter