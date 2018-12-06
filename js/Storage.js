
const { Log } = require('./Log')

const { get }   = require('lodash')
const Loki      = require('lokijs')

const config = require('../config.json')

const dbName            = get(config, 'db.name', 'storage.db')
const dbEntries         = get(config, 'db.entries', 'entries')
const cAnnotationTags   = get(config, 'annotations.tags', 'tags')

class Storage {

    constructor() {

        this.log = new Log('Storage')

        this.db = new Loki(dbName, {
            autoload        : true,
            autoloadCallback: this.initDB.bind(this),
            autosave        : true,
            autosaveInterval: 1000
        })

    }

    initDB() {

        this.entries = this.db.getCollection(dbEntries)
        if (this.entries === null) {
            this.entries    = this.db.addCollection(dbEntries)    
        }

    }

    saveEntry(obj, html, annotations) {
   
        const lastUpdate    = (new Date()).getTime()
        const revisions     = []

        const entry = { obj, html, lastUpdate, revisions, annotations: { ...annotations} }

        const result = this.entries.insert(entry)

        this.log.write(`Saved entry ${result.$loki}: ${JSON.stringify(result)}`, Log.level.DEBUG)

        return entry

    }

    updateEntry(id, obj, html, annotations) {

        return this.entries.findAndUpdate({ $loki: id}, entry => {

            entry.obj   = obj
            entry.html  = html

            for (let key in annotations) {
                if (annotations[key] == null && (key in entry.annotations)) {
                    delete entry.annotations[key]
                } else {
                    entry.annotations[key] = annotations[key]
                }
            }

            const revision = (new Date()).getTime()
            entry.revisions.push(revision)

            return entry

        })

    }

    addAnnotation(id, name, value) {

        this.entries.findAndUpdate({ $loki: id }, entry => {

            entry.annotations[name] = value

            return entry

        })

    }

    removeAnnotation(id, name) {

        this.entries.findAndUpdate({ $loki: id }, entry => {

            if (name in entry.annotations) {
                delete entry.annotations[name]
            }

            return entry

        })

    }

    find(searchString) {

        this.log.write(`Searching for '${searchString}'`, Log.level.DEBUG)

        const result = this.entries
        .chain()
        .find({
            //'annotations.Tags': { '$containsAny': searchString },
            //'text': { '$contains': searchString }
        })
        .where((obj) => {
            let fulltext = obj.html + ' ' + get(obj, `annotations.${cAnnotationTags}`, []).join(' ')
            return fulltext.includes(searchString)
        })
        .compoundsort([
            ['lastUpdate', true], 
            ['meta.created', true]
        ])
        .data()

        return result

    }

    findById(id) {

        this.log.write(`Searching for: ${id}`, Log.level.DEBUG)

        return this.entries.findOne({ $loki: id })

    }

    findAll() {

        const result = this.entries
        .chain()
        .find({})
        .compoundsort([
            ['lastUpdate', true], 
            ['meta.created', true]
        ])
        .data()

        return result

    }

}

module.exports = exports = Storage