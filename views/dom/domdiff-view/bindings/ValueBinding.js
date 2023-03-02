class ValueBinding {
    constructor(bindings) {
        this.bindings = bindings;
    }

    hasBindingFor(name) {
        return this.bindings.hasOwnProperty(name);
    }

    getValueFor(name) {
        return this.bindings[name];
    }
}

window.ValueBinding = ValueBinding;