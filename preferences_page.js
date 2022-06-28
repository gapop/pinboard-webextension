// Form getter & setter functions by element type
const bind_functions = {
    SELECT: {
        get: (input) => input.value,
        set: (input, value) => {input.value = value}
    },
    INPUT: {
        get: (input) => !!input.checked,
        set: (input, value) => {input.checked = !!value}
    }
}

async function bind_preference(option) {
    const input = document.getElementById(option)
    const bind_fn = bind_functions[input.tagName]

    // Set the form input value to current value for the preference
    bind_fn.set(input, await Preferences.get(option))

    // Create an event listener for saving the preference value
    input.addEventListener('change', async event => {
        Preferences.set(option, bind_fn.get(event.target))
    })
}

async function init() {
    for (let option in Preferences.defaults) {
        bind_preference(option)
    }

    // Add remove links for keyboard shortcuts
    const shortcuts = await Preferences.get_keyboard_shortcuts()
    const container = document.getElementById('kb-shortcuts')
    const tpl = document.getElementById('kb-shortcut-tpl')
    shortcuts.forEach(shortcut => {
        let new_shortcut = tpl.cloneNode(true)
        new_shortcut.id = null
        new_shortcut.childNodes[0].textContent = shortcut.description + ': '
        new_shortcut.childNodes[1].textContent = shortcut.shortcut
        let link = new_shortcut.getElementsByTagName('a')[0]
        link.addEventListener('click', async event => {
            event.preventDefault()
            Preferences.remove_keyboard_shortcut(shortcut.name)
            link.parentNode.remove()
        })
        new_shortcut.style.display = 'block'
        container.appendChild(new_shortcut)
    })
}

// Bind all preferences
document.addEventListener('DOMContentLoaded', init)
