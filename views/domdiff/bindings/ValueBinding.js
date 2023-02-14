class ValueBinding {
    constructor(bindings) {
        this.bindings = bindings;
    }

    hasBindingFor(name) {
        return this.bindings.hasOwnProperty(name);
    }

    async getValueFor(name) {
        return this.bindings[name];
    }
}

window.ValueBinding = ValueBinding;