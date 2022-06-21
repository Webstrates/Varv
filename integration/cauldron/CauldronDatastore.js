/**
 *  CauldronDatastore
 *     A datastore that allows mapping parts of concepts so that they show up in 
 *     the Cauldron TreeBrowser and are inspectable with the inspector
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
 *
 */
class CauldronDatastore extends DirectDatastore {
    constructor(name, options = {}) {        
        super(name, options);
        let self = this;
        
        this.destroyCallbacks = [];
        this.conceptAddedCallbacks = [];
        this.instanceAddedCallbacks = new Map();
        this.instanceRemovedCallbacks = new Map();
        
        this.appearCallback = VarvEngine.registerEventCallback("appeared", async (context)=> {
            let mark = VarvPerformance.start();
            if (self.isConceptMapped(context.concept)){
                let callbacks = self.instanceAddedCallbacks.get(context.concept.name);
                if (callbacks){
                    for (let callback of callbacks){
                        callback(context.target);
                    }
                }
            }
            VarvPerformance.stop("CauldronDatastore.registerEventCallback.appeared", mark);
        });
        this.disappearCallback = VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if (self.isConceptMapped(context.concept)){
                let callbacks = self.instanceRemovedCallbacks.get(context.concept.name);
                if (callbacks){
                    for (let callback of callbacks){
                        callback(context.target);
                    }
                }
            }
        });                        
    }

    destroy() {
        this.appearCallback.delete();
        this.disappearCallback.delete();
        this.engineReloadedCallback.delete();
        for (let callback of this.destroyCallbacks){
            callback(this);
        }
    }
    
    registerDestroyCallback(callback){
        this.destroyCallbacks.push(callback);
        return callback;
    }

    async init() {        
        let self = this;

        this.engineReloadedCallback = VarvEngine.registerEventCallback("engineReloaded", ()=>{
            console.log("Engine reloaded, register on trees!");
            // Inform trees about us
            for (let tree of window.ConceptTreeGenerator.instances){
                tree.onAddDatastore(this);
            }

            // Listen for new ones
            EventSystem.registerEventCallback("Varv.ConceptTreeGeneratorSpawned", (evt)=>{
                evt.detail.onAddDatastore(self);
            });
        });
    }
    
    registerConceptAddedCallback(callback){
        this.conceptAddedCallbacks.push(callback);

        // Pre-feed with currently mapped
        for (const conceptName of this.mappedConcepts.keys()){
            callback(VarvEngine.getConceptFromType(conceptName));
        }
        
        return callback;        
    }
    
    async registerConceptInstanceAddedCallback(concept, callback){
        if (!this.instanceAddedCallbacks.has(concept.name)){
            this.instanceAddedCallbacks.set(concept.name, []);
        }
        
        let callbacks = this.instanceAddedCallbacks.get(concept.name);
        callbacks.push(callback);

        // Pre-feed with currently mapped
        for (const conceptUUID of await VarvEngine.getAllUUIDsFromType(concept.name)){
            callback(conceptUUID);
        }

        return callback;
    }    
    
    removeConceptInstanceAddedCallback(concept, callback){
        let callbacks = this.instanceAddedCallbacks.get(concept.name);
        if (!callbacks) {
            console.log("Cauldron: Tried to remove a concept callback but couldn't", concept.name, callback);
            return;
        };
        this.instanceAddedCallbacks.set(concept.name, callbacks.filter(e => e !== callback));
    }
    
    registerConceptInstanceRemovedCallback(concept, callback){
        if (!this.instanceRemovedCallbacks.has(concept.name)){
            this.instanceRemovedCallbacks.set(concept.name, []);
        }
        
        let callbacks = this.instanceRemovedCallbacks.get(concept.name);
        callbacks.push(callback);     
        
        return callback;               
    }  
    
    removeConceptInstanceRemovedCallback(concept, callback){
        let callbacks = this.instanceRemovedCallbacks.get(concept.name);
        if (!callbacks) {
            console.log("Cauldron: Tried to remove a concept removed callback but couldn't", concept.name, callback);
            return;
        };
        this.instanceRemovedCallbacks.set(concept.name, callbacks.filter(e => e !== callback));
    }    

    createBackingStore(concept, property) {
        const self = this;
        
        if (this.isPropertyMapped(concept,property)){
            console.log("Already mapped property");
            return;
        }
        
        if (!this.isConceptMapped(concept)){
            // Concept add update
            if(CauldronDatastore.DEBUG) {
                console.log("New concept", concept);
            }
            for (let callback of self.conceptAddedCallbacks){
                callback(concept);
            }                    
        }

        // Check if concept already is mapped, if not, register it
        this.internalAddPropertyMapping(concept, property, {});
    }    
    
    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property))
            throw 'Cannot unmap property from memory because the property was not mapped: ' + concept + "." + property;
       
        // TODO: Remove concept update
        
        this.internalRemovePropertyMapping(concept, property);
    }

    loadBackingStore() {
        // No storage, do nothing
    }
}

window.CauldronDatastore = CauldronDatastore;

// Register default cauldron datastore
Datastore.registerDatastoreType("cauldron", CauldronDatastore);
