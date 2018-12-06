// (c) gshot, 2018

const {
    ipcRenderer
}               = require('electron')
const $         = require('jquery')
const { get }   = require('lodash')

const config = require('../config.json')

const cSearchString         = get(config, 'tokens.search.searchString', 'searchString')
const cChannelSearchRequest = get(config, 'ipc.channel.searchRequest', 'ipcChannelSearchRequest')
const cChannelSearchReply   = get(config, 'ipc.channel.searchReply', 'ipcChannelSearchReply')
const cChannelEditRequest   = get(config, 'ipc.channel.editRequest', 'ipcChannelEditRequest')
const cChannelIdleRequest   = get(config, 'ipc.channel.idleRequest', 'ipcChannelIdleRequest')
const cTextLimit            = get(config, 'search.resultTextLimit', 200)

const keyCodes = {
    ESCAPE      : 27,
    ENTER       : 13,
    ARROW_DOWN  : 40,
    ARROW_UP    : 38,
    F           : 70
}

class Finder {

    constructor() {

        this.$searchForm = $('#search')
        this.$searchForm.on('submit', (event) => {
            event.preventDefault()
            this.requestSearch(this.$search.val())
            this.$search.val('')
        })

        this.$searchResults = $('.searchResults')
        this.$searchResults.hide()

        this.$search        = $('.search')
        this.$search.focus()

        ipcRenderer.on(cChannelSearchReply, (event, message) => {
            this.onSearchResult(message)
        })


        $(window).keydown(key => {

            if (key.which == keyCodes.ESCAPE) {

                this.requestIdle()

            }

        })

    }

    onSearchResult(results) {

        this.$searchResults.empty()

        if (results.length > 0) {
            results.forEach(searchResult => {
                const content = `<span class='searchResultDate'>${searchResult.lastUpdate}</span>${this.limitText(searchResult.html, cTextLimit)}`
                //const $entry = $(`<a data-ref="${searchResult.ref}" href="#" class="list-group-item list-group-item-action">${content}</a>`)
                const $entry = $(`<div data-ref="${searchResult.$loki}" class="searchResultEntry">${content}</div>`)
                $entry.on('click', () => this.requestEdit($entry.attr('data-ref')))
                this.$searchResults.append($entry)
            })
        } else {
            this.$searchResults.append('<div class="searchResultEntryNone">No results</div>')
        }

        this.$searchResults.show()

        let $entry      = $('.searchResultEntry')
        let selected    = null
        
        $(window).keydown(key => {

            if (key.which === keyCodes.ARROW_DOWN){

                if (selected) {

                    selected.removeClass('searchResultEntrySelected')
                    let next = selected.next()

                    if(next.length > 0) {
                        selected = next.addClass('searchResultEntrySelected')
                    } else {
                        selected = $entry.eq(0).addClass('searchResultEntrySelected')
                    }

                } else {
                    selected = $entry.eq(0).addClass('searchResultEntrySelected')
                }

            } else if (key.which === keyCodes.ARROW_UP){

                if (selected) {

                    selected.removeClass('searchResultEntrySelected')
                    let next = selected.prev()

                    if (next.length > 0) {
                        selected = next.addClass('searchResultEntrySelected')
                    } else {
                        selected = $entry.last().addClass('searchResultEntrySelected')
                    }

                } else {
                    selected = $entry.last().addClass('searchResultEntrySelected')
                }

            } else if (key.which == keyCodes.ENTER) {

                this.requestEdit(selected.attr('data-ref'))

            } else if (key.which == keyCodes.F) {

                if (key.ctrlKey) {
                    selected.removeClass('searchResultEntrySelected')
                    selected = null
                    this.$search.focus()
                    window.scrollTo({top: 0})
                }

            } else if (key.which == keyCodes.ESCAPE) {

                this.requestIdle()

            }

            if (selected) {
                window.scrollTo({
                    top     : selected.position().top,
                    behavior: 'smooth'
                })
            }

        })

    }

    limitText(text, limit) {

        let result = text

        if (limit > 0) {
            result = `${text.slice(0, limit - 4)} ...`
        }

        return result

    }

    requestEdit(id) {

        ipcRenderer.send(cChannelEditRequest, id)

    }

    requestIdle() {

        ipcRenderer.send(cChannelIdleRequest, null)

    }

    requestSearch(searchString) {

        const request = {
            [cSearchString]: searchString
        }
        ipcRenderer.send(cChannelSearchRequest, request)

    }

}

module.exports = exports = Finder