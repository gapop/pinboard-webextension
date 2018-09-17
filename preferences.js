const Preferences = {

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
        browser.storage[this.storage_area].set(option_value);
    },

    async migrate_to_local_storage() {
        let value;
        for (option in this.defaults) {
            this.storage_area = 'sync';
            value = await this.get(option);
            browser.storage.sync.remove(option);
            this.storage_area = 'local';
            this.set(option, value);
        }
    }

};