document.addEventListener('DOMContentLoaded', () => {

    let menu_elements = document.getElementsByClassName('message-on-click');
    for (let i = 0; i < menu_elements.length; i++) {
        let element = menu_elements[i];
        element.addEventListener('click', () => {
            browser.runtime.sendMessage({event: element.id});
            window.close();
        });
    }

    document.getElementById('menu-preferences').addEventListener('click', async () => {
        await browser.runtime.openOptionsPage();
        window.close();
    });

    let links = document.getElementsByTagName('a');
    for (let i = 0; i < links.length; i++) {
        links[i].addEventListener('click', async event => {
            event.preventDefault();
            event.target.blur();
            await browser.tabs.create({url: event.target.href});
            window.close();
        });
    }

});

