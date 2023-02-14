class ConceptInstanceBinding {
    constructor(concept, uuid) {
        if (!uuid) throw new Error("Invalid reference to concept instance with a null or undefined uuid '"+uuid+"' and concept '"+concept+"'");
        if (!concept) throw new Error("Invalid reference to unknown concept with uuid '"+uuid+"', concept is "+concept);
        this.concept = concept;
        this.uuid = uuid;
    }

    hasBindingFor(name) {
        let lookupName = name;
        if(lookupName.startsWith(this.concept.name+".")) {
            lookupName = lookupName.substring(this.concept.name.length+1);
        }
        
        try {
            this.concept.getProperty(lookupName);
            return true;
        } catch (ex) {
            // Ignored
        }
        
        return false;
    }

    async getValueFor(name) {
        let lookupName = name;
        if(lookupName.startsWith(this.concept.name+".")) {
            lookupName = lookupName.substring(this.concept.name.length+1);
        }
        
        let property = null;
        
        try {
            property = this.concept.getProperty(lookupName);
        } catch(e) {
            //Ignore
        }

        if(property === null) {
            return undefined;
        }

        let value = await property.getValue(this.uuid);
        if (property.isConceptType()) {
            if (!value) return undefined; // No uuid set
            return await ConceptInstanceBinding.create(VarvEngine.getConceptFromUUID(value), value);
        } else if (property.isConceptArrayType()) {
            let conceptArray = [];
            for(let entry of value) {
                conceptArray.push(await ConceptInstanceBinding.create(VarvEngine.getConceptFromUUID(entry), entry));
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

    static async create(concept, uuid) {
        if(typeof concept === "string") {
            concept = VarvEngine.getConceptFromType(concept);
        }

        return new ConceptInstanceBinding(concept, uuid)
    }
}

window.ConceptInstanceBinding = ConceptInstanceBinding;