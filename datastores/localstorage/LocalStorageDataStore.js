/**
 *  LocalStorageDataStore - serializes into the localStorage database
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


/**
 * A storage that serializes into the localStorage database
 * <pre>
 * options:
 * storageName - The name of the prefix to store that data below (Default: "varv-data")
 * </pre>
 *
 * @memberOf Datastores
 */

class LocalStorageDataStore extends DirectDatastore {
    constructor(name, options = {}) {
        super(name, options);
        this.storagePrefix = "varv-data";
        this.entities = {};

        if (this.options.storageName) this.storagePrefix = this.options.storageName;

        this.deleteCallbacks = [];
    }
    
    async init(){
        const self = this;

        if (!localStorage) throw new Error("Cannot use localStorage as the feature is not available on this js runtime platform");

        if (!localStorage.getItem(this.storagePrefix)) self.saveEntities();

        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(LocalStorageDataStore.DEBUG) {
                console.log("Saw disappeared UUID (LocalStorageDataStore):", context.target);
            }

            if (!self.entities[context.target]) return; // avoid loops when we caused the disappear event ourselves

            context.concept.properties.forEach((property) => {
                if (self.isPropertyMapped(context.concept, property)) {
                    localStorage.removeItem(self.storagePrefix + "-" + context.target + "-" + property.name);
                }
            });
            delete self.entities[context.target];
            self.saveEntities();
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            if(LocalStorageDataStore.DEBUG) {
                console.log("Saw appeared UUID (LocalStorageDataStore):", context.target);
            }

            let mark = VarvPerformance.start();
            if (self.entities[context.target]) return; // avoid loops when we caused the appear event ourselves

            if (self.isConceptMapped(context.concept)) {
                self.entities[context.target] = context.concept.name;
                self.saveEntities();
            }
            VarvPerformance.stop("LocalStorageDataStore.registerEventCallback.appeared", mark);
        }));

        this.storageEventListener = async function localStorageChangeUpdate(event){
            if (event.key===self.storagePrefix){
                // This is a change in the active entities, pull any new ones
                let storedEntities = JSON.parse(event.newValue);
                for (const [uuid,type] of Object.entries(storedEntities)){
                    if (!self.entities[uuid]){
                        // TODO: check mapped type?
                        self.entities[uuid] = type;
                        await self.pullConcept(uuid);
                    }
                }

                // and kill any that are gone
                for (const [uuid,type] of Object.entries(self.entities)){
                    if (!storedEntities[uuid]){
                        delete self.entities[uuid]; // delete our tracker BEFORE sending disappear event to avoid loops
                        await VarvEngine.getConceptFromType(type).disappeared(uuid);
                    }
                };
            } else if (event.key.startsWith(self.storagePrefix+"-")){
                // This could be a property change event if the key matches a property
                let matches = new RegExp("^([^-]+)\-(.+?)$").exec(event.key.substring(self.storagePrefix.length+1));
                if (matches.length===3){
                    if (event.newValue===null) return; // TODO: The property was removed, is there any way to handle this properly?

                    let uuid = matches[1];
                    let propertyName = matches[2];

                    let concept = self.getConceptFromUUID(uuid);
                    if (!concept){
                        console.log("Localstorage got property update from concept with UUID that does not exist locally", uuid);
                        return;
                    }
                    let property = concept.getProperty(propertyName);
                    if (!property){
                        console.log("Localstorage got property update from concept property that does not exist locally", concept, propertyName);
                        return;
                    }
                    await property.setValue(uuid, JSON.parse(event.newValue));
                }
            }
        };

        window.addEventListener("storage", this.storageEventListener);
    }

    destroy() {
        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        });

        window.removeEventListener("storage", this.storageEventListener);
    }
    
    saveEntities(){
        localStorage.setItem(this.storagePrefix, JSON.stringify(this.entities));
    }

    createBackingStore(concept, property) {
        const self = this;
        
        if (this.isPropertyMapped(concept,property)) {
            console.log("FIXME: Trying to create localStorage backing store for already mapped property, ignored", concept, property);
            return;
        }
                
        let setter = (uuid, value) => {
            let mark = VarvPerformance.start();
            if (!self.entities[uuid]){
                throw new Error("Tried to set concept property in localStorage for concept instance that never appeared: "+concept.name+"."+property.name);
            }
            
            localStorage.setItem(self.storagePrefix+"-"+uuid+"-"+property.name, JSON.stringify(value));
            VarvPerformance.stop("LocalStorageDataStore.setter", mark);
        };
        let getter = (uuid) => {
            let mark = VarvPerformance.start();
            if (!self.entities[uuid]){
                throw new Error("Tried to get concept property from localStorage for concept instance that was never seen: "+concept.name+"."+property.name);
            }
            
            let data = localStorage.getItem(self.storagePrefix+"-"+uuid+"-"+property.name);
            if (data===null){
                throw new Error("Tried to get concept property from localStorage that was never set: "+concept.name+"."+property.name);
            }
            let result =  JSON.parse(data);
            VarvPerformance.stop("LocalStorageDataStore.getter", mark);
            return result;
        };
        property.addSetCallback(setter);
        property.addGetCallback(getter);

        // Check if concept already is mapped, if not, register it
        this.internalAddPropertyMapping(concept, property, {setter: setter, getter: getter});        
    }

    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property)){
            throw new Error('Cannot unmap property from localStorage because the property was not mapped: ' + concept + "." + property);
        }

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        property.removeGetCallback(trackingData.getter);
        
        this.internalRemovePropertyMapping(concept, property);        
    }

    /** 
     * Loads all concept instances currently registered as backed from serialized state
     * 
     * @returns {undefined}
     */
    async loadBackingStore() {
        let self = this;
        this.entities = JSON.parse(localStorage.getItem(this.storagePrefix));
        
        for (const [uuid,type] of Object.entries(this.entities)){
            await self.pullConcept(uuid);
        }
    }
    
    async pullConcept(uuid){
        let self = this;
        
        let conceptType = this.entities[uuid];
        if (!conceptType){
            throw new Error("Tried to pull a concept from localStorage that wasn't a known entity in there");
        }
        
        const concept = VarvEngine.getConceptFromType(conceptType);
        if (!concept) {
            if (LocalStorageDataStore.DEBUG) console.log("LocalStorage: Ignoring unknown concept with type", type);
            return;
        }

        if (!self.isConceptMapped(concept)){
            if (LocalStorageDataStore.DEBUG) console.log("LocalStorage: Ignoring concept with type that isn't mapped to localStorage", type);
            return;                
        }

        let conceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
        this.registerConceptFromUUID(uuid, concept);

        // Pull all properties
        for (const property of concept.properties){     
            if (self.isPropertyMapped(concept, property)){
                try {
                    let value = localStorage.getItem(self.storagePrefix+"-"+uuid+"-"+property.name);
                    if (value!==null){
                        await property.setValue(uuid, JSON.parse(value));
                    }
                } catch (ex){
                    // Ignore
                }
            }
        };
        
        if (!conceptByUUID) {
            await concept.appeared(uuid);                        
        }         
    }
}
LocalStorageDataStore.DEBUG = false;
window.LocalStorageDataStore = LocalStorageDataStore;

//Register default dom datastore
Datastore.registerDatastoreType("localStorage", LocalStorageDataStore);
