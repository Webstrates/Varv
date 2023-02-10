/**
 *  LocationDataStore - access/control the URL in browsers
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
 * A datastore that uses the location, query and hash as storage
 * @memberOf Datastores
 */
class LocationDataStore extends DirectDatastore {
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

        this.storageName = "memory";

        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(LocationDataStore.DEBUG) {
                console.log("Saw disappeared UUID (LocationDataStore):", context.target);
            }
            // Do nothing?
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            if(LocationDataStore.DEBUG) {
                console.log("Saw appeared UUID (LocationDataStore):", context.target);
            }
            let mark = VarvPerformance.start();
            // Do nothing? Maybe call them like onload?
            VarvPerformance.stop("LocationDataStore.registerEventCallback.appeared", mark);
        }));
        
        window.addEventListener("hashchange", function locationHashChanged(){
            self.onHashChange();
        });
    }
    
    createBackingStore(concept, property) {
        const self = this;
        if (this.isPropertyMapped(concept,property)) return;
                
        let setter = (uuid, value) => {
            let mark = VarvPerformance.start();
            
            if (property.name==="locationHash"){
                if (decodeURIComponent(location.hash.substring(1))!==value){
                    location.hash = value;
                }
            } else {
                // This is a parameter/location change if it differs from current
                let urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has(property.name)){
                    if (urlParams.get(property.name)!=value){
                        if (LocationDataStore.DEBUG) console.info("FIXME: Location datastore only supports getting, not setting URL paramters so far");                        
                    }
                }                
                return;
            }

            VarvPerformance.stop("LocationDataStore.setter", mark);
        };
        let getter = (uuid) => {
            let mark = VarvPerformance.start();
            if (property.name==="locationHash"){
                let result = decodeURIComponent(location.hash.substring(1));
                if (result === "") throw new Exception("Cannot get empty locationHash");
                VarvPerformance.stop("LocationDataStore.getter.hash", mark);
                return result;
            } else {
                let urlParams = new URLSearchParams(window.location.search);
                if (!urlParams.has(property.name)) throw new Exception("Cannot get property not present in URL");                
                VarvPerformance.stop("LocationDataStore.getter.argument", mark);
                return urlParams.get(property.name);
            }
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
    
    async onHashChange(){
        if (LocationDataStore.DEBUG) console.log("Location hash changed", location.hash);
        // For each of our mapped concepts
        for (let [conceptName, properties] of this.mappedConcepts.entries()){
            if (properties.has("locationHash")){
                let concept = VarvEngine.getConceptFromType(conceptName);
                let property = concept.getProperty("locationHash");                
                let value = decodeURIComponent(location.hash.substring(1));
                
                if (LocationDataStore.DEBUG) console.log("Firing location hash property set", property, value);
                let uuids = await VarvEngine.getAllUUIDsFromType(concept.name, true);
                uuids.forEach(async uuid=>{
                    await property.setValue(uuid, value);
                });
            }
        };
    }
    
    async loadBackingStore() {
        const self = this;
        
        if (LocationDataStore.DEBUG) console.info("LocationDataStore location is "+location);
        
        setTimeout(async function onLoadLocationTriggers(){
            if (location.hash){
                await self.onHashChange();
            }

            // On-load set the URL parameters too
            for (let [name,value] of new URLSearchParams(window.location.search).entries()){
                for (let [conceptName, properties] of self.mappedConcepts.entries()){
                    if (properties.has(name)){
                        let concept = VarvEngine.getConceptFromType(conceptName);
                        let property = concept.getProperty(name);                

                        if (LocationDataStore.DEBUG) console.log("Firing URL parameter property set", conceptName, concept, property, value);
                        let uuids = await VarvEngine.getAllUUIDsFromType(conceptName, false); // nulllointer if true?
                        uuids.forEach(async uuid=>{
                            await property.setValue(uuid, value);
                        });
                    }
                };
            }
            
            self.hasLoaded = true;
        },0);
    }
}
LocationDataStore.DEBUG = true;
window.LocationDataStore = LocationDataStore;

// Register default dom datastore
Datastore.registerDatastoreType("location", LocationDataStore);
