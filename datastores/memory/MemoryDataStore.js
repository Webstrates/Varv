/**
 *  MemoryDataStore - stores properties temporarily in memory
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
 * A general purpose datastore that stores properties temporarily in memory. The
 * memory is lost on reload.
 * 
 * This datastore registers as the type "memory".
 *
 * ### Options
 * * "storageName" - The memory bucket name of the storage (default: "memory"). Multiple independant buckets can be maintained
 *
 * @memberOf Datastores
 * @example
 * {
 *   "dataStores": { 
 *      "myDataStore": {
 *          "type": "memory", 
 *          "options": {
 *              "storageName": "myMemory"
 *          }
 *      },
 *      ...
 *  },
 *  ...
 *
 */
class MemoryDataStore extends DirectDatastore {
    constructor(name, options = {}) {
        super(name, options);

        this.deleteCallbacks = [];
    }

    isShared() {
        return false;
    }

    destroy() {
        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        })
    }

    async init() {
        const self = this;
        this.typeVariable = "__memoryDataStore_internalType";

        this.storageName = "memory";
        if (this.options.storageName) this.storageName = this.options.storageName;

        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(MemoryDataStore.DEBUG) {
                console.log("Saw disappeared UUID (MemoryDataStore):", context.target);
            }

            context.concept.properties.forEach((property) => {
                if (self.isPropertyMapped(context.concept, property)) {
                    let data = self.internalPropertyTrackingData(context.concept, property);
                    delete data[context.target];
                }
            });
            self.getStorage().delete(context.target);
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            if(MemoryDataStore.DEBUG) {
                console.log("Saw appeared UUID (MemoryDataStore):", context.target);
            }
            let mark = VarvPerformance.start();
            if (self.isConceptMapped(context.concept) && !self.getStorage().has(context.target)){
                self.getStorage().set(context.target, {
                    [self.typeVariable]: context.concept.name
                });
            }
            VarvPerformance.stop("MemoryDataStore.registerEventCallback.appeared", mark);
        }));
    }
    
    getStorage(){
        if (!MemoryDataStore.storages[this.storageName]){
            MemoryDataStore.storages[this.storageName] = new Map();            
        }
        return MemoryDataStore.storages[this.storageName];
    }

    createBackingStore(concept, property) {
        const self = this;
        
        if (this.isPropertyMapped(concept,property)) return;
                
        let setter = (uuid, value) => {
            let mark = VarvPerformance.start();
            if (!self.getStorage().has(uuid)){
                throw new Error("Tried to set concept in memory that never appeared: "+concept.name+"."+property.name);
            }
            
            let data = self.getStorage().get(uuid);
            data[property.name] = value;
            VarvPerformance.stop("MemoryDataStore.setter", mark);
        };
        let getter = (uuid) => {
            let mark = VarvPerformance.start();
            let data = self.getStorage().get(uuid);
            if (!data) throw new Error("Tried to get concept from memory that was never set: "+concept.name+"."+property.name);
            if (!data.hasOwnProperty(property.name)) throw new Error("Tried to get property from memory that was never set: "+concept.name+"."+property.name);
            let result = data[property.name];
            VarvPerformance.stop("MemoryDataStore.getter", mark);
            return result;
        };
        property.addSetCallback(setter);
        property.addGetCallback(getter);

        // Check if concept already is mapped, if not, register it
        this.internalAddPropertyMapping(concept, property, {setter: setter, getter: getter});
    }    
    
    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property)){
            throw new Error('Cannot unmap property from memory because the property was not mapped: ' + concept + "." + property);
        }

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        property.removeGetCallback(trackingData.getter);
        
        this.internalRemovePropertyMapping(concept, property);
    }
    
    async loadBackingStore() {
        // For each of our stored and mapped concepts
        for(let [uuid,storedConcept] of this.getStorage().entries()) {
            if (MemoryDataStore.DEBUG) console.log("Loading from memory",uuid,storedConcept);
            
            let type = storedConcept[this.typeVariable];
            if ((!type) || !this.isConceptTypeMapped(type)){
                if (MemoryDataStore.DEBUG) console.log("Ignoring concept from memory since it is not mapped", storedConcept);                    
                continue;
            }
            
            // Check if already registered and only generate an appear event if not
            let conceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
            let concept = VarvEngine.getConceptFromType(type);                        
            
            this.registerConceptFromUUID(uuid, concept);

            // Stil set the properties that we know about
            for (const [propertyName,value] of Object.entries(storedConcept)){
                if (propertyName !== this.typeVariable){
                    try {
                        let property = concept.getProperty(propertyName);                    
                        if (MemoryDataStore.DEBUG) console.log("Loading property", property, value);
                        if (this.isPropertyMapped(concept, property)){
                            await property.setValue(uuid, value);
                        }
                    } catch (ex){
                        console.error("Failed to push concept property from memory to concept", ex);
                    }
                }
            }
            
            if (!conceptByUUID) {
                await concept.appeared(uuid);                        
            }            
        }
    }
}
MemoryDataStore.DEBUG = false;
window.MemoryDataStore = MemoryDataStore;
MemoryDataStore.storages = new Map();

// Register default dom datastore
Datastore.registerDatastoreType("memory", MemoryDataStore);
