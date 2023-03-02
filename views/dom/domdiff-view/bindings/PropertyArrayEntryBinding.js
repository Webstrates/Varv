class PropertyArrayEntryBinding extends PropertyBinding {
    constructor(property, uuid, boundValue, index, as=null) {
        super(property, uuid, boundValue, as);
        this.index = index;
    }
    
    hasBindingFor(name){
        // We don't supply this ourselves
        if (super.hasBindingFor(name)){
            return true;
        }
        
        if (name===".index") return true;
        if (this.as){
            // We are available under as.value
            return name===this.as+".index";
        } else {
            return name===this.property.name+".index";
        }
        
        return false;
    }
    
    getValueFor(name){
        if (!this.hasBindingFor(name)) throw new Error("PropertyArrayEntryBinding asked for value for "+name+" but does not support it");
        
        if (name.endsWith(".index")){
            return this.index;
        } else {
            return this.boundValue;
        }
    }
    
    updateIndex(newIndex){
        console.log("TODO: PropertyArrayEntryBinding should generate index value updates when high-performance recovery of UI is used");
        this.index = newIndex;
    }
}

window.PropertyArrayEntryBinding = PropertyArrayEntryBinding;