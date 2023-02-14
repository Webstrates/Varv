class PropertyBinding {
    constructor(property, uuid) {
        this.uuid = uuid;
        this.property = property;
    }
    
    hasBindingFor(name){
        // We don't supply this ourselves
        return false;
    }
}

window.PropertyBinding = PropertyBinding;