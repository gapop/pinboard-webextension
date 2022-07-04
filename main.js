const Pinboard = {
    url: {
        add_link: 'https://pinboard.in/add?showtags={show_tags}&url={url}&title={title}&description={description}',
        read_later: 'https://pinboard.in/add?later=yes&noui=yes&jump=close&url={url}&title={title}',
        save_tabs: 'https://pinboard.in/tabs/save/',
        show_tabs: 'https://pinboard.in/tabs/show/',
        login: 'https://pinboard.in/popup_login/'
    },
    
    async get_endpoint(url_handle, bookmark_info) {
        const url_template = this.url[url_handle]
        const show_tags = await Preferences.get('show_tags') ? 'yes' : 'no'
        let endpoint = url_template.replace('{show_tags}', show_tags)
        if (bookmark_info) {
            endpoint = endpoint.replace('{url}', encodeURIComponent(bookmark_info.url || ''))
                .replace('{title}', encodeURIComponent(bookmark_info.title || ''))
                .replace('{description}', encodeURIComponent(bookmark_info.description || ''))
        }
        return endpoint
    }
}

const App = {
    toolbar_button_state: Preferences.defaults.toolbar_button,
    pin_window_id: null,

    // Returns the original URL for a page opened in Firefox's reader mode
    async strip_reader_mode_url(url) {
        if (url.indexOf('about:reader?url=') == 0) {
            url = decodeURIComponent(url.substr(17))
        }
        return url
    },

    async get_bookmark_info_from_current_tab() {
        const tabs = await browser.tabs.query({currentWindow: true, active: true})
        const info = {
            url: await this.strip_reader_mode_url(tabs[0].url),
            title: tabs[0].title
        }
        try {
            info.description = await browser.tabs.executeScript({code: 'getSelection().toString()'})
        } catch (error) {
            info.description = ''
        }
        return info
    },

    async get_bookmark_info_from_context_menu_target(info, tab) {
        let url
        let title = ''
    
        if (info.linkUrl) {
            url = info.linkUrl
            if (info.linkText) {
                title = info.linkText.substr(0, 200)
                if (title.length < info.linkText.length) {
                    title += '...'
                }
            }
        } else {
            url = info.pageUrl
            title = tab.title
        }

        return {
            url: await this.strip_reader_mode_url(url),
            title: title,
            description: info.selectionText || ''
        }
    },

    // Opens a window for interacting with Pinboard
    async open_window(url) {
        const show_tags = await Preferences.get('show_tags')
        const bg_window = await browser.windows.getCurrent()
        const pin_window = await browser.windows.create({
            url: url,
            type: 'popup',
            width: 750,
            height: show_tags ? 550 : 350,
            incognito: bg_window.incognito
        })
        this.pin_window_id = pin_window.id
    },

    // Opens the Pinboard "Add Link" form
    async open_save_form(bookmark_info) {
        const endpoint = await Pinboard.get_endpoint('add_link', bookmark_info)
        this.open_window(endpoint)
    },
    
    // Saves the bookmark to read later
    async save_for_later(bookmark_info) {
        const endpoint = await Pinboard.get_endpoint('read_later', bookmark_info)
        const bg_window = await browser.windows.getCurrent()
        if (bg_window.incognito) {
    
            // In private mode we actually have to open a window,
            // because Firefox doesn't support split incognito mode
            // and gets confused about cookie jars.
            this.open_window(endpoint)
    
        } else {
    
            const http_response = await fetch(endpoint, {credentials: 'include'})
            if (http_response.redirected && http_response.url.startsWith(await Pinboard.get_endpoint('login'))) {
                this.open_window(http_response.url)
            } else if (http_response.status !== 200 || http_response.ok !== true) {
                this.show_notification('FAILED TO ADD LINK. ARE YOU LOGGED-IN?', true)
            } else {
                this.show_notification('Saved to read later.')
            }
    
        }
    },
    
    async save_tab_set() {
        const bg_window = browser.windows.getCurrent()
        if (bg_window.incognito) {
            this.show_notification("Due to a Firefox limitation, saving tab sets does not work in Private mode. Try normal mode!", true)
            return
        }
    
        const window_info = await browser.windows.getAll({populate: true, windowTypes: ['normal']})
        let windows = []
        for (let i = 0; i < window_info.length; i++) {
            const current_window_tabs = window_info[i].tabs
            let tabs = []
            for (let j = 0; j < current_window_tabs.length; j++) {
                tabs.push({
                    title: current_window_tabs[j].title,
                    url: await this.strip_reader_mode_url(current_window_tabs[j].url)
                })
            }
            windows.push(tabs)
        }
    
        let payload = new FormData()
        payload.append('data', JSON.stringify({browser: 'ffox', windows: windows}))
        const http_response = await fetch(await Pinboard.get_endpoint('save_tabs'), {method: 'POST', body: payload, credentials: 'include'})
        if (http_response.status !== 200 || http_response.ok !== true) {
            this.show_notification('FAILED TO SAVE TAB SET.', true)
        } else {
            browser.tabs.create({url: await Pinboard.get_endpoint('show_tabs')})
        }
    },

    async show_notification(message, force) {
        const show_notifications = await Preferences.get('show_notifications')
        if (force || show_notifications) {
            browser.notifications.create({
                'type': 'basic',
                'title': 'Pinboard',
                'message': message,
                'iconUrl': 'icons/pinboard_icon_48.png'
            })
        }
    },

    async update_toolbar_button() {
        const pref = await Preferences.get('toolbar_button')
        if (pref != this.toolbar_button_state) {
            switch (pref) {
    
                case 'show_menu':
                    browser.browserAction.setPopup({popup: 'popup_menu.html'})
                    browser.browserAction.setTitle({title: 'Add to Pinboard'})
                    break
    
                case 'save_dialog':
                    browser.browserAction.setPopup({popup: ''})
                    browser.browserAction.setTitle({title: 'Add to Pinboard'})
                    break
    
                case 'read_later':
                    browser.browserAction.setPopup({popup: ''})
                    browser.browserAction.setTitle({title: 'Add to Pinboard (read later)'})
                    break
    
            }
            this.toolbar_button_state = pref
        }
    },
    
    async update_context_menu() {
        const add_context_menu_items = await Preferences.get('context_menu_items')
        if (add_context_menu_items) {
            browser.contextMenus.create({
                id: 'save_dialog',
                title: 'Save...',
                contexts: ['link', 'page', 'selection']
            })
            browser.contextMenus.create({
                id: 'read_later',
                title: 'Read later',
                contexts: ['link', 'page', 'selection']
            })
            browser.contextMenus.create({
                id: 'save_tab_set',
                title: 'Save tab set...',
                contexts: ['page', 'selection']
            })
        } else {
            browser.contextMenus.removeAll()
        }
    },
    
    async handle_message(message) {
        let bookmark_info
        switch (message) {
            case 'save_dialog':
                bookmark_info = await this.get_bookmark_info_from_current_tab()
                this.open_save_form(bookmark_info)
                break
    
            case 'read_later':
                bookmark_info = await this.get_bookmark_info_from_current_tab()
                this.save_for_later(bookmark_info)
                break
    
            case 'save_tab_set':
                this.save_tab_set()
                break
    
            case 'link_saved':
                browser.windows.remove(this.pin_window_id)
                this.pin_window_id = undefined
                this.show_notification('Link added to Pinboard')
                break
        }
    },

    async handle_context_menu(info, tab) {
        let bookmark_info
        switch (info.menuItemId) {
            case 'save_dialog':
                bookmark_info = await this.get_bookmark_info_from_context_menu_target(info, tab)
                this.open_save_form(bookmark_info)
                break
    
            case 'read_later':
                bookmark_info = await this.get_bookmark_info_from_context_menu_target(info, tab)
                this.save_for_later(bookmark_info)
                break
    
            case 'save_tab_set':
                this.save_tab_set()
                break
        }
    },

    async handle_preferences_changes(changes, area) {
        if (area !== Preferences.storage_area) {
            return
        }
        const key = Object.keys(changes).pop()
        switch (key) {
            case 'toolbar_button':
                this.update_toolbar_button()
                break
            case 'context_menu_items':
                this.update_context_menu()
                break
        }
    },

    async handle_upgrade(details) {
        // Migrate user preferences from sync to local storage
        if (details.reason === 'update' && parseFloat(details.previousVersion) < 1.4) {
            await Preferences.migrate_to_local_storage()
            await this.update_toolbar_button()
            await this.update_context_menu()
        }
    }
}

// Attach message event handler
browser.runtime.onMessage.addListener(async (message) => {
    if (message === 'save_tab_set') {
        await browser.permissions.request({permissions: ['tabs']})
    }
    App.handle_message(message.event)
})

// Toolbar button event handler
browser.browserAction.onClicked.addListener(() => {
    App.handle_message(App.toolbar_button_state)
})

// Keyboard shortcut event handler
browser.commands.onCommand.addListener(command => {App.handle_message(command)})

// Context menu event handler
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'save_tab_set') {
        await browser.permissions.request({permissions: ['tabs']})
    }
    App.handle_context_menu(info, tab)
})

// Preferences event handler
browser.storage.onChanged.addListener((changes, area) => {App.handle_preferences_changes(changes, area)})

// Version update listener
browser.runtime.onInstalled.addListener(details => {App.handle_upgrade(details)})

// Apply preferences when loading extension
App.update_toolbar_button()
App.update_context_menu()
