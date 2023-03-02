class PropertyBinding {
    constructor(property, uuid, boundValue, as=null) {
        this.uuid = uuid;
        this.property = property;
        this.boundValue = boundValue;
        this.as = as;
    }
    
    hasBindingFor(name){
        if (name===".value") return true;
        if (this.as){
            // We are available under as.value
            return name===this.as+".value";
        } else {
            return name===this.property.name+".value";
        }
        
        return false;
    }
    
    getValueFor(name){
        if (!this.hasBindingFor(name)) throw new Error("PropertyBinding asked for value for "+name+" but only supports "+this.property.name+".value/"+this.as+".value");
        return this.boundValue;
    }
}

window.PropertyBinding = PropertyBinding;