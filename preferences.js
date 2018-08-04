document.addEventListener('DOMContentLoaded', function () {

    browser.storage.sync.get({'toolbar_button': 'show_menu'}).then(function (option) {
        document.getElementById('button-select').value = option.toolbar_button;
    });
    document.getElementById('button-select').addEventListener('change', function () {
        browser.storage.sync.set({'toolbar_button': this.value}).then(function () {
            browser.runtime.sendMessage({'message': 'toolbar_button_changed'});
        });
    });

    browser.storage.sync.get({'show_notifications': true}).then(function (option) {
        document.getElementById('notifications-toggle').checked = option.show_notifications;
    });
    document.getElementById('notifications-toggle').addEventListener('change', function () {
        browser.storage.sync.set({'show_notifications': this.checked});
    });

    browser.storage.sync.get({'context_menu_items': true}).then(function (option) {
        document.getElementById('context-menu-toggle').checked = option.context_menu_items;
    });
    document.getElementById('context-menu-toggle').addEventListener('change', function () {
        browser.storage.sync.set({'context_menu_items': this.checked}).then(function () {
            browser.runtime.sendMessage({'message': 'context_menu_changed'});
        });
    });

    browser.storage.sync.get({'show_tags': true}).then(function (option) {
        document.getElementById('show-tags-toggle').checked = option.show_tags;
    });
    document.getElementById('show-tags-toggle').addEventListener('change', function () {
        browser.storage.sync.set({'show_tags': this.checked}).then(function () {
            browser.runtime.sendMessage({'message': 'url_template_changed'})
        });
    });

});
