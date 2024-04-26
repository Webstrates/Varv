 /**
 *  WSDataDataStore - stores properties in .data on a compatible webstrate
 * 
 *  This code is licensed under the MIT License (MIT).
 *  
 *  Copyright 2024, Janus B. Kristensen, CAVI,
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
 * A general purpose datastore that uses Webstrates Data API as the storage.
 * 
 * This datastore registers as the type "wsdata".
 *
 * Options:
 * <ul>
 * "storageName" - The name of the data bucket you intend to use inside automerge.doc.data (default: "varvData")
 * </ul>
 *
 * @memberOf Datastores
 * @example
 * {
 *   "dataStores": { 
 *      "myDataStore": {
 *          "type": "wsdata", 
 *          "options": {
 *              "storageName": "myData"
 *          }
 *      },
 *      ...
 *  },
 *  ...
 *
 */
class WSDataDataStore extends DirectDatastore {    
    constructor(name, options = {}) {
        super(name, options);

        this.deleteCallbacks = [];
        this.inflightChanges = new Set();        
    }

    isShared() {
        return true;
    }

    destroy() {
        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        });
    }

    async init() {
        const self = this;
        
        self.storageName = "varvData";
        if(this.options.storageName != null) {
            self.storageName = this.options.storageName;
        }
        
        // Try to find/create the object to store instances in
        if (typeof webstrate === "undefined" ||
            typeof webstrate.updateData === "undefined" ||
            typeof webstrate.on === "undefined" ||
            typeof automerge === "undefined" ||
            typeof automerge.doc === "undefined" ||
            typeof automerge.doc.data === "undefined"){        
            throw new Error("Cannot use wsdata datastore on page without automerge.doc.data and websstrate.updateData");
        }
        if (typeof automerge.doc.data[self.storageName] === "undefined"){
            await webstrate.updateData((data)=>{
                data[self.storageName] = {};
            });
        }
        
        // Register for updates
        let updateFunction = (patch)=>self.onDataUpdated(patch);
        webstrate.on("dataChangedWithPatchSet", updateFunction);        
        this.deleteCallbacks.push({
            delete: ()=>{webstrate.off("dataChangedWithPatchSet", updateFunction);}
        });


        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(WSDataDataStore.DEBUG) {
                console.log("Saw disappeared UUID (WSDataDataStore):", context.target);
            }

            if (self.isConceptMapped(context.concept)){
                await webstrate.updateData((data)=>{
                    delete data[self.storageName][context.concept.name][context.target];
                });
            }
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            if(WSDataDataStore.DEBUG) {
                console.log("Saw appeared UUID (WSDataDataStore):", context);
            }
            if (self.isConceptMapped(context.concept)){
                if (self.inflightChanges.has("appear"+"."+context.target)) return; // This was caused by us, ignore it
                if (typeof automerge.doc.data[self.storageName][context.concept.name][context.target] !== "undefined") return; // This already exists
                
                if(WSDataDataStore.DEBUG) {
                    console.log("Writing appeared UUID (WSDataDataStore):", context.target);
                }
                // Broadcast to everyone
                let initialProperties = {}
                for (let property of Array.from(self.mappedConcepts.get(context.concept.name).keys())){
                    try {
                        initialProperties[property] = await context.concept.getPropertyValue(context.target, property);   
                    } catch (ex){
                        // May not have a getter/setter at all, so skip it
                    }
                }

                await webstrate.updateData((data)=>{
                    data[self.storageName][context.concept.name][context.target] = initialProperties;
                });
            }
        }));
    }
    
    async onDataUpdated(patches){
        let self = this;
        if (WSDataDataStore.DEBUG) console.log(patches);
        
        for (let patch of patches){
            if (patch.path.length<1) continue;
            if (patch.path[0]===this.storageName){ // Only look at dat in our storage bucket storageName
                if (patch.shouldSkip) continue;
                if (patch.path.length<3) continue;
                let type = patch.path[1];
                let uuid = patch.path[2];
                let concept = VarvEngine.getConceptFromType(type);
                if (!self.isConceptTypeMapped(type)) {
                    if (WSDataDataStore.DEBUG) console.log("Patch with unmapped type", type, patch);
                    continue;
                }

                if (patch.path.length===3){ // This targets a concept
                    switch (patch.action){
                        case "del": // Concept was deleted                            
                            if (WSDataDataStore.DEBUG) console.log("Remote deleted instance", type, uuid);

                            await concept.disappeared(uuid);
                            // TODO: Read forward and mark all related patches as skip
                            break;
                        case "put": // Concept was added or completely overwritten
                            if (self.inflightChanges.has("appear"+"."+uuid)) return; // This was caused by us, ignore it                            
                            // Check if already registered and only generate an appear event if not
                            let conceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
                            if (conceptByUUID){
                                if (WSDataDataStore.DEBUG) console.log("Ignoring that remote added instance that already exists", type, uuid);
                                continue;
                            }
                            if (WSDataDataStore.DEBUG) console.log("Remote added instance", type, uuid);
                            // TODO: Read forward and bulk set properties
                            await self._generateAppear(concept, uuid);
                            break;
                        default:
                            console.log("FIXME: Unknown concept action in wsdata", patch);
                    }
                } else { // This targets a property
                    let propertyName = patch.path[3];
                    if (!self.isPropertyNameMapped(type,propertyName)){
                        if (WSDataDataStore.DEBUG) console.log("Patch with unmapped property", type, propertyName, patch);
                        continue;
                    }           
                    if (self.inflightChanges.has(uuid+"."+propertyName)) return;  // This was caused by us, ignore it                            
                    if (WSDataDataStore.DEBUG) console.log("Patch changed property", type, propertyName, patch);
                    await self._setVarvProperty(concept, uuid, propertyName, structuredClone(automerge.doc.data[self.storageName][type][uuid][propertyName]));
                }
            }
        }
    }

    async createBackingStore(concept, property) {
        const self = this;
        
        // Check if concept already is mapped, if not, register it
        if (this.isPropertyMapped(concept,property)) return;
        if (typeof automerge.doc.data[self.storageName][concept.name]==="undefined"){
            if(WSDataDataStore.DEBUG) {
                console.log("Adding type space to data for:", concept.name);
            }
            await webstrate.updateData((data)=>{
                data[self.storageName][concept.name] = {};
            });
        }
        let setter = async (uuid, value) => {
            if (self.inflightChanges.has(uuid+"."+property.name)) return; // Avoid writebacks from our own changes            
            if(WSDataDataStore.DEBUG) {
                console.log("Setting ",property.name);
            }
            await webstrate.updateData((data)=>{
                data[self.storageName][concept.name][uuid][property.name]=value;
            });
        };
        let getter = (uuid, value) => {
            return automerge.doc.data[self.storageName][concept.name][uuid][property.name];
        };        
        property.addGetCallback(getter);
        property.addSetCallback(setter);
        this.internalAddPropertyMapping(concept, property, {setter: setter, getter: getter});
    }    
    
    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property)){
            throw new Error('Cannot unmap property from wsdata because the property was not mapped: ' + concept + "." + property);
        }

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        this.internalRemovePropertyMapping(concept, property);
    }
    
    async _setVarvProperty(concept, uuid, propertyName, value){
        let change = uuid+"."+propertyName;
        this.inflightChanges.add(change); // Avoid writebacks from this
        await concept.setPropertyValue(uuid, propertyName, value);
        this.inflightChanges.delete(change);        
    }    
    
    async _generateAppear(concept, uuid){
        let appearChange = "appear"+"."+uuid;
        this.registerConceptFromUUID(uuid, concept);
        this.inflightChanges.add(appearChange); // Avoid writebacks from this
        await concept.appeared(uuid);     
        this.inflightChanges.delete(appearChange); // Avoid writebacks from this                                
    }
    
    async loadBackingStore() {    
        // For each of our mapped concepts, popuplate local state from the corresponding stored data objects
        let self = this;
        for (let [type,instances] of Object.entries(automerge.doc.data[self.storageName])){
            if (!self.isConceptTypeMapped(type)){
                if (WSDataDataStore.DEBUG) console.log("Ignoring concept type from wsdata since it is not mapped", type, instances);
                continue;
            }
            if (instances){
                let concept = VarvEngine.getConceptFromType(type);                        
                for (let [uuid,storedConcept] of Object.entries(instances)){
                    // Check if already registered and only generate an appear event if not
                    let conceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
                    if (WSDataDataStore.DEBUG) console.log("Loading concept", type, uuid);

                    // Set the properties that are mapped
                    for (const [propertyName,value] of Object.entries(storedConcept)){
                        try {
                            if (WSDataDataStore.DEBUG) console.log("Loading property", propertyName, value);
                            if (self.isPropertyNameMapped(type, propertyName)){
                                await self._setVarvProperty(concept, uuid, propertyName, structuredClone(value));
                            }
                        } catch (ex){
                            console.error("Failed to push concept property from wsdata to concept", ex);
                        }
                    }

                    if (!conceptByUUID) {
                        // This was the first time Varv heard about this instance ever, in that case make it appear
                        self._generateAppear(concept, uuid);
                    }                         
                }
            }
        }
    }
}
WSDataDataStore.DEBUG = false;
window.WSDataDataStore = WSDataDataStore;

// Register default dom datastore
Datastore.registerDatastoreType("wsdata", WSDataDataStore);
