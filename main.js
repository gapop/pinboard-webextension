const ADD_LINK_URL = 'https://pinboard.in/add?showtags={show_tags}&url={url}&title={title}&description={description}';
const READ_LATER_URL = 'https://pinboard.in/add?later=yes&noui=yes&jump=close&url={url}&title={title}';
const SAVE_TABS_URL = 'https://pinboard.in/tabs/save/';
const SHOW_TABS_URL = 'https://pinboard.in/tabs/show/';
const ALL_TABS_URL = "https://pinboard.in/tabs/";
const UNREAD_BOOKMARKS_URL = "https://pinboard.in/toread/";

let pin_window_id;
let toolbar_button_state;

var Preferences = {

    storage_area: 'local',

    defaults: {
        toolbar_button: 'show_menu',
        show_notifications: true,
        context_menu_items: true,
        show_tags: true
    },

    async get(option) {
        let option_value = {};
        option_value[option] = this.defaults[option];
        const value = await browser.storage[this.storage_area].get(option_value);
        return value[option];
    },

    async set(option, value) {
        let option_value = {};
        option_value[option] = value;
        await browser.storage[this.storage_area].set(option_value);
    },

    async migrate_to_local_storage() {
        let value;
        for (option in this.defaults) {
            this.storage_area = 'sync';
            value = await this.get(option);
            await browser.storage.sync.remove(option);
            this.storage_area = 'local';
            await this.set(option, value);
        }
    }

};

function strip_reader_mode_url(url) {
    if (url.indexOf('about:reader?url=') == 0) {
        url = decodeURIComponent(url.substr(17));
    }
    return url;
}

async function prepare_pin_url(url_template, url, title = '', description = '') {
    url = strip_reader_mode_url(url);
    const show_tags = await Preferences.get('show_tags') ? 'yes' : 'no';
    let prepared_url = url_template.replace('{show_tags}', show_tags);
    prepared_url = prepared_url.replace('{url}', encodeURIComponent(url));
    prepared_url = prepared_url.replace('{title}', encodeURIComponent(title));
    prepared_url = prepared_url.replace('{description}', encodeURIComponent(description));
    return prepared_url;
}

async function show_notification(message, force) {
    let show_notifications = await Preferences.get('show_notifications');
    if (force || show_notifications) {
        browser.notifications.create({
            'type': 'basic',
            'title': 'Pinboard',
            'message': message,
            'iconUrl': 'pinboard_icon_48.png'
        });
    }
}

async function change_toolbar_button() {
    const toolbar_button_pref = await Preferences.get('toolbar_button');
    if (toolbar_button_state === undefined) {
        toolbar_button_state = Preferences.defaults.toolbar_button;
    }
    if (toolbar_button_pref != toolbar_button_state) {
        switch (toolbar_button_pref) {

            case 'show_menu':
                browser.browserAction.setPopup({popup: 'popup_menu.html'});
                browser.browserAction.setTitle({title: 'Add to Pinboard'});
                break;

            case 'save_dialog':
                browser.browserAction.setPopup({popup: ''});
                browser.browserAction.setTitle({title: 'Add to Pinboard'});
                break;

            case 'read_later':
                browser.browserAction.setPopup({popup: ''});
                browser.browserAction.setTitle({title: 'Add to Pinboard (read later)'});
                break;

        }
        toolbar_button_state = toolbar_button_pref;
    }
}

async function change_context_menu() {
    const context_menu_items = await Preferences.get('context_menu_items');
    if (context_menu_items) {
        browser.contextMenus.create({
            id: 'save_dialog',
            title: 'Save...',
            contexts: ['link', 'page', 'selection']
        });
        browser.contextMenus.create({
            id: 'read_later',
            title: 'Read later',
            contexts: ['link', 'page', 'selection']
        });
        browser.contextMenus.create({
            id: 'save_tab_set',
            title: 'Save tab set...',
            contexts: ['page', 'selection']
        });
    } else {
        browser.contextMenus.removeAll();
    }
}

async function save_bookmark(action_url, action_callback) {
    const save = async (selected_text) => {
        const tabs = await browser.tabs.query({currentWindow: true, active: true});
        const pin_url = await prepare_pin_url(action_url, tabs[0].url, tabs[0].title, selected_text);
        action_callback(pin_url);
    };
    const get_selected_text = browser.tabs.executeScript({code: 'getSelection().toString();'});
    get_selected_text
        .then(selected_text => { save(selected_text); })
        .catch(error => { save(''); });
}

function open_pinboard_form(url) {
    browser.windows.getCurrent().then(function (bg_window) {
        browser.windows.create({
            url: url,
            type: 'popup',
            width: 750,
            height: 550,
            incognito: bg_window.incognito
        }).then(function (pin_window) { pin_window_id = pin_window.id; });
    });
}

async function add_read_later(url) {

    browser.windows.getCurrent().then(function (bg_window) {

        if (bg_window.incognito) {

            // In private mode we actually have to open a window,
            // because Firefox doesn't support split incognito mode
            // and gets confused about cookie jars.
            open_pinboard_form(url);

        } else {

            fetch(url, {credentials: 'include'}).then(function (response) {
                if (response.redirected && response.url.startsWith('https://pinboard.in/popup_login/')) {
                    open_pinboard_form(response.url);
                } else if (response.status !== 200 || response.ok !== true) {
                    show_notification('FAILED TO ADD LINK. ARE YOU LOGGED-IN?', true);
                } else {
                    show_notification('Saved to read later.');
                }
            });
        }

    });

}

function save_tab_set() {
    browser.windows.getCurrent().then(function (bg_window) {
        if (bg_window.incognito) {
            show_notification("Due to a Firefox limitation, saving tab sets does not work in Private mode. Try normal mode!", true);
            return;
        }

        browser.windows.getAll({populate: true, windowTypes: ['normal']}).then(function (window_info) {
            var windows = [];
            for (var i = 0; i < window_info.length; i++) {
                var current_window_tabs = window_info[i].tabs;
                var tabs = [];
                for (var j = 0; j < current_window_tabs.length; j++) {
                    tabs.push({
                        title: current_window_tabs[j].title,
                        url: strip_reader_mode_url(current_window_tabs[j].url)
                    });
                }
                windows.push(tabs);
            }

            var payload = new FormData();
            payload.append('data', JSON.stringify({browser: 'ffox', windows: windows}));
            fetch(SAVE_TABS_URL, {method: 'POST', body: payload, credentials: 'include'}).then(function (response) {
                if (response.status !== 200 || response.ok !== true) {
                    show_notification('FAILED TO SAVE TAB SET.', true);
                } else {
                    browser.tabs.create({url: SHOW_TABS_URL});
                }
            });
        });
    });
}

function message_handler(message) {
    switch (message.event) {

        case 'save_dialog':
            save_bookmark(ADD_LINK_URL, open_pinboard_form);
            break;

        case 'read_later':
            save_bookmark(READ_LATER_URL, add_read_later);
            break;

        case 'save_tab_set':
            save_tab_set();
            break;

        case 'link_saved':
            browser.windows.remove(pin_window_id).then(function () { pin_window_id = undefined });
            show_notification('Link added to Pinboard');
            break;

        case 'view_all_unread':
            browser.tabs.create({
                url: UNREAD_BOOKMARKS_URL
            });
            break;

        case 'view_all_tabsets':
            browser.tabs.create({
                url: ALL_TABS_URL
            });
            break;

    }
}

// Attach message event handler
browser.runtime.onMessage.addListener(message_handler);

// Toolbar button event handler
browser.browserAction.onClicked.addListener(() => {
    message_handler({event: toolbar_button_state});
});

// Context menu event handler
browser.contextMenus.onClicked.addListener(async (info, tab) => {
    var url;
    var title = '';

    if (info.linkUrl) {
        url = info.linkUrl;
        if (info.linkText) {
            title = info.linkText.substr(0, 200);
            if (title.length < info.linkText.length) {
                title += '...';
            }
        }
    } else {
        url = info.pageUrl;
        title = tab.title;
    }

    switch (info.menuItemId) {
        case 'save_dialog':
            var pin_url = await prepare_pin_url(ADD_LINK_URL, url, title, info.selectionText);
            open_pinboard_form(pin_url);
            break;

        case 'read_later':
            var pin_url = await prepare_pin_url(READ_LATER_URL, url, title);
            add_read_later(pin_url);
            break;

        case 'save_tab_set':
            save_tab_set();
            break;
    }
});

// Preferences event handler
browser.storage.onChanged.addListener((changes, area) => {
    if (area !== Preferences.storage_area) {
        return;
    }
    const key = Object.keys(changes).pop();
    switch (key) {
        case 'toolbar_button':
            change_toolbar_button();
            break;
        case 'context_menu_items':
            change_context_menu();
            break;
    }
});

// Apply preferences when loading extension
change_toolbar_button();
change_context_menu();

// Version update listener
browser.runtime.onInstalled.addListener(details => {
    // Migrate user preferences from sync to local storage
    if (details.reason === 'update' && parseFloat(details.previousVersion) < 1.4) {
        Preferences.migrate_to_local_storage();
    }
});