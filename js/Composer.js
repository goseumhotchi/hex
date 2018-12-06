// (c) gshot, 2018

const {
    ipcRenderer
}               = require('electron')
const $         = require('jquery')
const { get }   = require('lodash')
const Quill = require('quill')

const config = require('../config.json')

const cChannelSaveContent   = get(config, 'ipc.channel.saveContent', 'ipcChannelSaveContent')
const cChannelIdleRequest   = get(config, 'ipc.channel.idleRequest', 'ipcChannelIdleRequest')
const cChannelSetContent    = get(config, 'ipc.channel.setContent', 'ipcChannelSetContent')
const cAnnotationTags       = get(config, 'annotations.tags', 'tags')
const cAnnotationTitle      = get(config, 'annotations.title', 'title')
const cAnnotationPublic     = get(config, 'annotations.public', 'public')

const events = {
    EVENT_HASH_DETECTED : 'EVENT_HASH_DETECTED',
    EVENT_END_OF_WORD   : 'EVENT_END_OF_WORD',
    EVENT_DELETION      : 'EVENT_HASH_DELETION',
    EVENT_ANY_CHAR      : 'EVENT_ANY_CHAR'

}

const states = {
    IN_HASHTAG  : 'STATE_IN_HASHTAG',
    EX_HASHTAG  : 'STATE_EX_HASHTAG'
}

const keyCodes = {
    ESCAPE  : 27,
    P       : 80
}

class Composer {

    constructor() {

        this.$editorContainer   = $('#editor-container')
        this.$status            = $('#status')
        this.$statusPublic      = $('#status-public')

        this.editor = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: true
            }
        })

        this.state          = states.EX_HASHTAG
        this.tagBeginsAt    = 0
        this.tag            = ''
        this.tagList        = new Set()
        this.changed        = false
        this.public         = false

        const self = this

        $(window).on('unload', () => {
            self.requestSave()
        })

        $(window).keydown(key => {
            
            if (key.which == keyCodes.ESCAPE) {

                this.requestIdle()

            } else if (key.which == keyCodes.P && key.ctrlKey) {

                this.updatePublic()
                this.changed = true

            }

        })

        this.editor.on('text-change', (delta) => {

            const { insert, retain, del } = this.findOps(delta)
            if (insert == '#') {
                this.updateState(this.state, events.EVENT_HASH_DETECTED, { insert, retain, del })
            } else if (insert == ' ' || insert == '\n') {
                this.updateState(this.state, events.EVENT_END_OF_WORD, { insert, retain, del})
            } else if (del != undefined) {
                this.updateState(this.state, events.EVENT_DELETION, { insert, retain, del })
            } else if (insert != undefined) {
                this.updateState(this.state, events.EVENT_ANY_CHAR, { insert, retain, del })
            }
        
            this.changed = true

        })

        ipcRenderer.on(cChannelSetContent, (event, message) => {

            this.id = (message && message.id) ? message.id : null

            this.$editorContainer.focus()
            if (message && message.delta) {
                this.editor.setContents(message.delta)
            }
            if (message && message.annotations) {

                if (cAnnotationTags in message.annotations) {
                    message.annotations[cAnnotationTags].forEach(tag => {
                        this.updateTagList(tag)
                    })
                }

                if (cAnnotationPublic in message.annotations) {
                    this.updatePublic(message.annotations[cAnnotationPublic])
                }

            }

        })

    }

    updateState(state = states.EX_HASHTAG, event, ops) {

        let next = state

        switch (event) {

            case events.EVENT_HASH_DETECTED: 

                if (state === states.EX_HASHTAG) {
                    // Remember this position for later deletion of tag
                    this.tagBeginsAt = get(ops, 'retain', 0)
                }

                next = states.IN_HASHTAG
                break

            case events.EVENT_END_OF_WORD:

                if (state === states.IN_HASHTAG) {
                    // Push tag into list and delete the text
                    this.updateTagList(this.tag)
                    let tagLength = get(ops, 'retain', 0) - this.tagBeginsAt + 1
                    this.editor.deleteText(this.tagBeginsAt, tagLength)
                    this.tag = ''
                }

                next = states.EX_HASHTAG
                break

            case events.EVENT_DELETION:

                if (state == states.IN_HASHTAG) {

                    // Check if the hashtag was deleted
                    let retain  = get(ops, 'retain', 0)
                    let del     = get(ops, 'delete', 0)
                    if (retain <= this.tagBeginsAt) {
                        this.tag = ''
                        next = states.EX_HASHTAG
                    } else {
                        this.tag = this.tag.slice(0, -del)
                    }

                }

                break

            case events.EVENT_ANY_CHAR:

                if (state === states.IN_HASHTAG) {
                    // If in hashtag, add to the current tag
                    this.tag += get(ops, 'insert')
                }

                break

            default:

                break

        }

        this.state = next

        console.log(`Hashtag processor state: ${this.state}`)

    }

    updateTagList(newTag) {

        if (!this.tagList.has(newTag)) {
            this.tagList.add(newTag)
            let $tag = $(`<a class='tag'>${newTag}</a>`)
            $tag.appendTo(this.$status)
            $tag.on('click', (event) => {
                let val = $tag.html()
                this.tagList.delete(val)
                event.target.remove()
            })
        }

    }

    updatePublic(ispublic = null) {

        if (ispublic != null) {
            this.public = ispublic
        } else {
            this.public = !this.public
        }

        this.$statusPublic.css('visibility', (this.public) ? 'visible' : 'hidden')

    }

    findOps(delta) {
    
        let insert  = ''
        let retain  = undefined
        let del     = undefined

        for(const op of get(delta, 'ops', [])) {
            if ('insert' in op) {
                insert = op.insert
            } else if ('retain' in op) {
                retain = op.retain
            } else if ('delete' in op) {
                del = op.delete
            }
        }

        return { insert, retain, del }

    }

    prepareAnnotations() {

        let annotations = {
            [cAnnotationTags]   : [...this.tagList],
            [cAnnotationTitle]  : this.editor.getText().split()[0],
            [cAnnotationPublic] : this.public
        }
        
        return annotations

    }

    requestIdle() {

        ipcRenderer.send(cChannelIdleRequest, null)

    }

    requestSave() {

        if (this.changed) {
            const message = {
                id          : this.id,
                obj         : this.editor.getContents(),
                html        : this.editor.container.firstChild.innerHTML,
                annotations : this.prepareAnnotations(),
                public      : this.public
            }
    
            ipcRenderer.send(cChannelSaveContent, message)
            
        }


    }

}

module.exports = exports = Composer