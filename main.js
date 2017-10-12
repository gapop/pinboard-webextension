const ADD_LINK_URL = 'https://pinboard.in/add?showtags=yes&description=&url={url}&title={title}';
const READ_LATER_URL = 'https://pinboard.in/add?later=yes&noui=yes&jump=close&url={url}&title={title}';

var pin_window_id;
var toolbar_button_state = 'show_menu';

function prepare_pin_url(url_template, url, title) {
    var prepared_url = url_template.replace('{url}', encodeURIComponent(url));
    prepared_url = prepared_url.replace('{title}', encodeURIComponent(title));
    return prepared_url;
}

function show_notification(message) {
    browser.notifications.create({
        'type': 'basic',
        'title': 'Pinboard',
        'message': message,
        'iconUrl': 'pinboard_icon_48.png'
    });
}

function change_toolbar_button() {
    browser.storage.sync.get({'toolbar_button': 'show_menu'}).then(function (option) {
        if (option.toolbar_button != toolbar_button_state) {
            switch (option.toolbar_button) {

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
            toolbar_button_state = option.toolbar_button;
        }
    });
}

function change_context_menu() {
    browser.storage.sync.get({'context_menu_items': true}).then(function (option) {
        if (option.context_menu_items) {
            browser.contextMenus.create({
                id: 'save',
                title: 'Save to Pinboard',
                contexts: ['link', 'page']
            });
            browser.contextMenus.create({
                id: 'read_later',
                title: 'Read later on Pinboard',
                contexts: ['link', 'page']
            });
        } else {
            browser.contextMenus.removeAll();
        }
    });
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

function add_read_later(url) {

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
                    console.log(response);
                    show_notification('FAILED TO ADD LINK. ARE YOU LOGGED-IN?');
                } else {
                    browser.storage.sync.get({show_notifications: true}).then(function (option) {
                        if (option.show_notifications) {
                            show_notification('Saved to read later.');
                        }
                    });
                }
            });
        }

    });

}

function message_handler(message) {
    switch (message.message) {

        case 'save':
            browser.tabs.query({ currentWindow: true, active: true }).then(function (tabs) {
                var pin_url = prepare_pin_url(ADD_LINK_URL, tabs[0].url, tabs[0].title);
                open_pinboard_form(pin_url);
            });
            break;

        case 'read_later':
            browser.tabs.query({ currentWindow: true, active: true }).then(function (tabs) {
                var pin_url = prepare_pin_url(READ_LATER_URL, tabs[0].url, tabs[0].title);
                add_read_later(pin_url);
            });
            break;

        case 'link_saved':
            browser.windows.remove(pin_window_id).then(function () { pin_window_id = undefined });
            browser.storage.sync.get({'show_notifications': true}).then(function (option) {
                if (option.show_notifications) {
                    show_notification('Link added to Pinboard');
                }
            });
            break;

        case 'toolbar_button_changed':
            change_toolbar_button();
            break;

        case 'context_menu_changed':
            change_context_menu();
            break;

    }
}

// Attach message event handler
browser.runtime.onMessage.addListener(message_handler);

// Toolbar button event handler
browser.browserAction.onClicked.addListener(function () {
    switch (toolbar_button_state) {
        case 'save_dialog':
            var message = 'save';
            break;
        case 'read_later':
            var message = 'read_later';
            break;
    }
    message_handler({'message': message});
});

// Context menu event handler
browser.contextMenus.onClicked.addListener(function (info, tab) {
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
        case 'save':
            var pin_url = prepare_pin_url(ADD_LINK_URL, url, title);
            open_pinboard_form(pin_url);
            break;

        case 'read_later':
            var pin_url = prepare_pin_url(READ_LATER_URL, url, title);
            add_read_later(pin_url);
            break;
    }
});

// Change toolbar button function according to user preference
change_toolbar_button();

// Add or remove context menus according to user preference
change_context_menu();

