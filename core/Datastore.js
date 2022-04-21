/**
 *  DataStore - Superclass for all backing stores
 * 
 *  This code is licensed under the MIT License (MIT).
 *  
 *  Copyright 2020, 2021, 2022 Rolf Bagge, Janus B. Kristensen, CAVI,
 *  Center for Advanced Visualization and Interaction, Aarhus University
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the “Software”), to deal
 *  in the Software without restriction, including without limitation the rights 
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 *  copies of the Software, and to permit persons to whom the Software is 
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
 *  THE SOFTWARE.
 *  
 */

// superclass for all datastores (mostly empty for potential later introspection code)
class Datastore {
    constructor(name, options){
        this.name = name;
        this.options = options;
        this.mappedConcepts = new Map();
    }
    
    isConceptMapped(concept){
        return this.isConceptTypeMapped(concept.name);
    }
    isConceptTypeMapped(conceptTypeName){
        return this.mappedConcepts.has(conceptTypeName);
    }
    isPropertyMapped(concept, property){
        if (!this.isConceptMapped(concept)) return false;
        return this.mappedConcepts.get(concept.name).has(property.name);
    }
    internalAddConceptMapping(concept){
        if (!this.isConceptMapped(concept))
            this.mappedConcepts.set(concept.name, new Map());
    }    
    internalAddPropertyMapping(concept, property, trackingData={}){
        if (this.isPropertyMapped(concept, property)){
            throw new Error('Already has internal mapping for '+concept+"."+property);
        }
        this.internalAddConceptMapping(concept);
        let propertyMap = this.mappedConcepts.get(concept.name);
        propertyMap.set(property.name, trackingData);
    }
    internalRemovePropertyMapping(concept, property){
        if (!this.isConceptMapped(concept)) throw new Error("Concept not mapped when trying to remove "+concept+"."+property);
        let propertyMap = this.mappedConcepts.get(concept.name);
        propertyMap.delete(property.name);
    }    
    
    internalPropertyTrackingData(concept, property){
        return this.mappedConcepts.get(concept.name).get(property.name);
    }

    createBackingStore(concept, property) {
        throw new Error("createBackingStore, should always be overridden in Datastore subclass");
    }

    removeBackingStore(concept, property) {
        throw new Error("removeBackingStore, should always be overridden in Datastore subclass");
    }

    async init() {
        throw new Error("init, should always be overridden in Datastore subclass");
    }

    destroy() {
        throw new Error("destroy, should always be overridden in Datastore subclass");
    }

    static getDatastoreFromName(name) {
        return Datastore.datastores.get(name);
    }

    static registerDatastoreType(name, datastoreType) {
        Datastore.datastoreTypes.set(name, datastoreType);
    }

    static getDatastoreType(name) {
        return Datastore.datastoreTypes.get(name);
    }
}
Datastore.DEBUG = false;
Datastore.datastores = new Map();
Datastore.datastoreTypes = new Map();

window.Datastore = Datastore;
