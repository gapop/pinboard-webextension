document.addEventListener('DOMContentLoaded', function () {

    document.getElementById('menu-save').addEventListener('click', function () {
        browser.runtime.sendMessage({'message': 'save'}).then(function () { window.close(); });
    });

    document.getElementById('menu-later').addEventListener('click', function () {
        browser.runtime.sendMessage({'message': 'read_later'}).then(function () { window.close(); });
    });

    document.getElementById('menu-tabset').addEventListener('click', function () {
        browser.runtime.sendMessage({'message': 'save_tab_set'}).then(function () { window.close(); });
    });

    document.getElementById('menu-all-unread').addEventListener('click', function () {
        browser.runtime.sendMessage({'message': 'view_all_unread'}).then(function () { window.close(); });
    });

    document.getElementById('menu-all-tabsets').addEventListener('click', function () {
        browser.runtime.sendMessage({'message': 'view_all_tabsets'}).then(function () { window.close(); });
    });

    document.getElementById('menu-preferences').addEventListener('click', function () {
        browser.runtime.openOptionsPage();
        window.close();
    });

    for (let header_link of document.querySelectorAll('.panel-section-header a')) {
        header_link.addEventListener('click', function (event) {
            this.blur();
        });
    }

});

