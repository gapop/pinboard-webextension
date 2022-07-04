document.addEventListener('DOMContentLoaded', async () => {
    // Match popup to theme colors
    const theme = await browser.theme.getCurrent()
    if (theme && theme.colors) {
        document.body.style.backgroundColor = theme.colors.popup
        document.body.style.color = theme.colors.popup_text
        const stylesheet = document.styleSheets[0]
        stylesheet.insertRule(`.panel-list-item:not(.disabled):hover { background-color: ${theme.colors.popup_highlight}; border-block: 1px solid ${theme.colors.popup_border} }`)
        stylesheet.insertRule(`.panel-list-item:not(.disabled):hover:active { background-color: ${theme.colors.popup_highlight} }`)
        stylesheet.insertRule(`.panel-section-separator { background-color: ${theme.colors.popup_border} }`)
    }    

    const menu_elements = document.getElementsByClassName('message-on-click')
    for (let i = 0; i < menu_elements.length; i++) {
        let element = menu_elements[i]
        element.addEventListener('click', () => {
            browser.runtime.sendMessage({event: element.id})
            window.close()
        })
    }

    document.getElementById('menu-preferences').addEventListener('click', () => {
        browser.runtime.openOptionsPage()
        window.close()
    })

    const links = document.getElementsByTagName('a')
    for (let i = 0; i < links.length; i++) {
        links[i].addEventListener('click', event => {
            event.preventDefault()
            event.target.blur()
        })
        links[i].parentElement.addEventListener('click', () => {
            browser.tabs.create({url: links[i].href})
            window.close()
        })
    }
})
