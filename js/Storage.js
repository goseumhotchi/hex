
const { Log } = require('./Log')

const { get }   = require('lodash')
const Loki      = require('lokijs')
const path      = require('path')


class Storage {

    constructor(settings) {

        this.log = new Log('Storage', get(settings, 'userBaseDir'))

        this.config = require(get(settings, 'configFile'))

        this.cDBName            = get(this.config, 'db.name', 'hex.db')
        this.cDBEntries         = get(this.config, 'db.entries', 'entries')
        this.cDBTags            = get(this.config, 'db.tags', 'tags')
        this.cAnnotationTags    = get(this.config, 'annotations.tags', 'tags')

        const dbPath = path.join(get(settings, 'userBaseDir'), this.cDBName)

        this.log.write(`Persisting database as ${dbPath}`)

        this.db = new Loki(dbPath, {
            autoload        : true,
            autoloadCallback: this.initDB.bind(this),
            autosave        : true,
            autosaveInterval: 1000
        })

    }

    initDB() {

        this.entries = this.db.getCollection(this.cDBEntries)
        if (this.entries === null) {
            this.entries = this.db.addCollection(this.cDBEntries)    
        }

        this.tags = this.db.getCollection(this.cDBTags)
        if (this.tags == null) {
            this.tags = this.db.addCollection(this.cDBTags)
        }

    }

    saveTag(tag) {

        if (!this.tagExists(tag)) {
            this.tags.insert({ tag })
        }

        // Autotag: rescan all existing entries for this tag
        const entries = this.find(tag)

        entries.forEach(entry => {
            this.log.write(`Autotag: added tag '${tag}' to entry '${entry.$loki}'`, Log.level.DEBUG)
            this.addEntryTag(entry.$loki, tag)
        })

    }

    tagExists(tag) {

        return (this.tags.find({ tag }).length > 0)

    }

    findAllTags() {

        const result = this.tags
        .chain()
        .find({})
        .compoundsort([
            ['meta.created', true]
        ])
        .data()

        return result

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

    deleteEntry(id) {

        this.entries.findAndRemove({ $loki: id })

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

    addEntryTag(id, tag) {

        this.entries.findAndUpdate({ $loki: id}, entry => {

            if (!(this.cAnnotationTags in entry.annotations)) {
                entry.annotations[cAnnotationTags] = []
            }
            let tags = new Set(entry.annotations[this.cAnnotationTags])

            tags.add(tag)
            entry.annotations[this.cAnnotationTags] = [...tags]

            return entry

        })

    }

    find(searchString) {

        this.log.write(`Searching for '${searchString}'`, Log.level.DEBUG)

        const result = this.entries
        .chain()
        .find({})
        .where((obj) => {
            let fulltext = obj.html + ' ' + get(obj, `annotations.${this.cAnnotationTags}`, []).join(' ')
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