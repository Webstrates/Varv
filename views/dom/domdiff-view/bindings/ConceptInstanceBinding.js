class ConceptInstanceBinding {
    constructor(concept, uuid) {
        if (!uuid) throw new Error("Invalid reference to concept instance with a null or undefined uuid '"+uuid+"' and concept '"+concept+"'");
        if (!concept) throw new Error("Invalid reference to unknown concept with uuid '"+uuid+"', concept is "+concept);
        this.concept = concept;
        this.uuid = uuid;
    }

    hasBindingFor(name) {
        try {
            this.getProperty(name);
            return true;
        } catch (ex) {
            return false;
        }
    }
    
    getProperty(lookupName){
        if(lookupName.startsWith(this.concept.name+".")) {
            lookupName = lookupName.substring(this.concept.name.length+1);
        }
        return this.concept.getProperty(lookupName);
    }
    
    generateRawChangeListener(lookupName, oldValue=null){
        let self = this;
        let property = this.getProperty(lookupName);
        
        let result = {
            onChanged: async ()=>{console.error("DOMView bug: ConceptInstanceBinding raw change listener called without anything hooked up to it", concept, uuid, self);}
        };
        
        // Listen for changes in the looked up property
        let changedCallback = async function queryParseNodePropertyChanged(uuid, value){
            if (uuid===self.uuid && value!=oldValue){
                oldValue = value;
                await result.onChanged(value);
            }
        };                                
        property.addUpdatedCallback(changedCallback);
        result.destroy = ()=>{
            property.removeUpdatedCallback(changedCallback);
        };
        return result;
    }

    async getValueFor(name) {
        let property = null;
        try {
            property = this.getProperty(name);
        } catch(e) {
            //Ignore
        }

        if(property === null) {
            return undefined;
        }

        return await property.getValue(this.uuid);
    }

    async setValueFor(name, value){
        const property = this.concept.getProperty(name);
        await property.setValue(this.uuid, property.typeCast(value));
    }
}

window.ConceptInstanceBinding = ConceptInstanceBinding;