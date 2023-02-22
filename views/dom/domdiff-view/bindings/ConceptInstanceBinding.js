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

    async getValueFor(name, wrapValue=true) {
        let property = null;
        try {
            property = this.getProperty(name);
        } catch(e) {
            //Ignore
        }

        if(property === null) {
            return undefined;
        }

        let value = await property.getValue(this.uuid);
        
        if (!wrapValue) return value;
        
        if (property.isConceptType()) {
            if (!value) return undefined; // No uuid set
            return new ConceptInstanceBinding(VarvEngine.getConceptFromUUID(value), value);
        } else if (property.isConceptArrayType()) {
            let conceptArray = [];
            for(let entry of value) {
                conceptArray.push(new ConceptInstanceBinding(VarvEngine.getConceptFromUUID(entry), entry));
            }
            return conceptArray;
        } else {
            return value;
        }
    }

    async setValueFor(name, value){
        const property = this.concept.getProperty(name);
        await property.setValue(this.uuid, property.typeCast(value));
    }
}

window.ConceptInstanceBinding = ConceptInstanceBinding;