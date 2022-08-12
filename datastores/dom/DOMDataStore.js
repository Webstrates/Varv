/**
 *  DOMDataStore - Store as DOM elements
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
 * A storage that provides a DOM-element&attribute-based serialization of Concept properties
 *
 * <pre>
 * options:
 * storageName - The name of the element to store that data below (Default: "varv-data")
 * storageWebstrate - The name of the webstrate to store the data at (Default: current webstrate)
 * </pre>
 *
 * @memberOf Datastores
 */
class DOMDataStore extends DirectDatastore {
    constructor(name, options = {}) {
        super(name, options);

        this.deleteCallbacks = [];
    }

    destroy() {
        if(this.iframeTransient != null) {
            this.iframeTransient.remove();
        }

        this.stopObserver();

        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        });
    }

    async init() {
        const self = this;

        let storageName = "varv-data";
        if(this.options.storageName != null) {
            storageName = this.options.storageName;
        }

        let topElement = document;

        //If webstrate is specified, find topElement inside iframe
        if(this.options.storageWebstrate != null) {
            if(DOMDataStore.DEBUG) {
                console.log("Opening storage webstrate:", this.options.storageWebstrate);
            }
            let transient = document.createElement("transient");
            transient.style.display = "none";
            transient.setAttribute("name", "storageWebstrate-"+this.options.storageWebstrate);
            let iframe = document.createElement("iframe");

            transient.appendChild(iframe);
            document.body.appendChild(transient);

            iframe.src = "/"+this.options.storageWebstrate;
            await Observer.waitForTransclude(iframe);

            if(DOMDataStore.DEBUG) {
                console.log("Storage webstrate ready:", this.options.storageWebstrate);
            }

            topElement = iframe.contentDocument;

            this.iframeTransient = transient;
        }

        // Try to find an existing one
        this.backingElement = topElement.querySelector(storageName);

        this.queryCache = new QuerySelectorCache(this.backingElement);

        // None exists, create one
        if (!this.backingElement) {
            this.backingElement = topElement.createElement(storageName, {approved: true});
            topElement.body.appendChild(this.backingElement);

            // TODO: Check if webstrates race condition happened here and remedy it
        }

        // Add an observer to data backing element
        this.observer = new MutationObserver((mutations)=>{
            self.mutationCallback(mutations);
        });
        self.startObserver();

        //Setup disappeared listener?
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=>{
            if(DOMDataStore.DEBUG) {
                console.log("Saw disappeared UUID (DOMDataStore):", context.target);
            }
            let conceptDom = this.backingElement.querySelector("concept[uuid='"+context.target+"']");
            if(conceptDom !== null) {
                self.executeObserverless(()=>{
                    conceptDom.remove();
                });
            }
        }));

        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=>{
            if(DOMDataStore.DEBUG) {
                console.log("Saw appeared UUID (DOMDataStore):", context.target);
            }

            let mark = VarvPerformance.start();
            if (self.isConceptMapped(context.concept)) {
                this.executeObserverless(() => {
                    self.getConceptElementOrCreate(context.target, context.concept);
                });
            }
            VarvPerformance.stop("DOMDataStore.registerEventCallback.appeared", mark);
        }));
    }

    async mutationCallback(mutationList) {
        const self = this;

        if(DOMDataStore.DEBUG) {
            console.log("Got remote mutation", mutationList);
        }
        for(let mutation of mutationList) {
            switch (mutation.type) {
                case 'childList':
                    // Look for newly added concept instances first
                    let propertyChangedNodes = [];
                    let newlyAppereadConceptInstances = [];
                    for(let node of mutation.addedNodes) {
                        try {
                            if (node.tagName==="CONCEPT"){
                                let uuid = node.getAttribute("uuid");
                                if (uuid===null) {
                                    console.warn("DOM concept node added without uuid, ignored for now - not sure what to do about it");
                                    continue;
                                }

                                // Check if already exists (this would be a bit weird but could happen in multi-backed concepts where the other backing already registered their part)
                                let conceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
                                // Check if a duplicate already exists in the DOM marshalled data, since that is definitely a mistake
                                if (this.backingElement.querySelectorAll('concept[uuid="'+uuid+'"]').length > 1){
                                    console.warn("Warning: More than one DOM concept node found for "+conceptByUUID.name +" - only one element is allowed per uuid, this is bad, ignoring one of them");
                                    continue;
                                }

                                // Check if the concept type is available and mapped
                                let conceptType = node.getAttribute("type");
                                if (conceptType===null) {
                                    console.warn("DOM concept node added without type, ignoring for now - not sure how to handle it");
                                    continue;
                                }
                                let concept = VarvEngine.getConceptFromType(conceptType);
                                if (!concept){
                                    console.warn("Warning: DOM concept node added for concept of unknown type '"+conceptType+"', ignoring");
                                    continue;
                                }
                                if (conceptByUUID && concept.name !== conceptByUUID.name){
                                    console.warn("Warning: DOM concept node added which specified different type than the one registered in the current mapping, ignoring it");
                                    continue;
                                }
                                if (!self.isConceptMapped(concept)){
                                    console.warn("Warning: DOM concept node added for concept for which there are no DOM-mapped properties in the current mapping, ignoring it");
                                    continue;
                                }

                                // Everything checks out, let's add it then'
                                if(DOMDataStore.DEBUG) {
                                    console.log("DOM saw " + uuid + " of type "+conceptType);
                                }
                                self.registerConceptFromUUID(uuid, concept);

                                // Concepts can only exist as top-level but when added they can already carry properties as children nodes
                                Array.from(node.children).forEach((childNode)=>{
                                    if (childNode.tagName==="PROPERTY"){
                                        // Make sure to import those property values if they exist
                                        propertyChangedNodes.push(childNode);
                                    }
                                });

                                // Signal that someone made a new concept instance appear for the first time
                                if(conceptByUUID == null) {
                                    await concept.appeared(uuid);
                                }
                            }

                            // A property could also be added (set) directly by someone for the first time
                            if (node.tagName==="PROPERTY"){
                                propertyChangedNodes.push(node);
                            }                      
                        } catch (ex){
                            console.error("Unhandled exception in DOM node adding handler", ex);
                        }
                    }
                    
                    // Array property had one or more new child nodes added to it
                    if (mutation.target.tagName==="PROPERTY"){
                        propertyChangedNodes.push(mutation.target);
                    }                      

                    // Removals
                    for(let node of mutation.removedNodes) {
                        try {
                            // Concepts can be removed (deleted) and they appear only as top-level nodes here
                            if (node.tagName==="CONCEPT"){
                                let uuid = node.getAttribute("uuid");
                                if (uuid===null) {
                                    console.warn("DOM concept node removed without uuid, ignored for now - not sure what to do about it");
                                    return;
                                }
                                let concept =  self.getConceptFromUUID(uuid);
                                if (!concept ){
                                    console.warn("Notice: DOM concept node removed for concept with uuid "+uuid+" that we didn't know about, this inconsistency is odd");
                                    return;
                                }

                                // Someone deleted this concept instance, let's tell everyone to delete it here too
                                await concept.disappeared(uuid);
                            }
                        } catch (ex){
                            console.error("Unhandled exception in DOM node remove handler", ex);
                        }                        
                    }
                    // An array property had one or more children removed
                    if (mutation.target.tagName==="PROPERTY"){
                        propertyChangedNodes.push(mutation.target);
                    }

                                            
                    // Any changed properties either from new concepts or direct changes should be imported to their local concepts
                    for(let node of propertyChangedNodes) {
                        try {
                            await self.syncronizePropertyElementFromDOM(node);
                        } catch (ex){
                            console.error("Failed to push concept property from DOM node to concept", node, ex);
                        }
                    }

                    break;
                case 'attributes':
                    // - Simple property value change
                    if (mutation.attributeName==="value" && mutation.target.tagName==="PROPERTY"){
                        await self.syncronizePropertyElementFromDOM(mutation.target);
                    }
                    
                    // TODO: uuid and/or type added to concept that was previously missing it and was thus ignored
                    break;
            }
        }
    }

    createBackingStore(concept, property) {
        if(DOMDataStore.DEBUG) {
            console.log("DOMDataStore Mapping "+concept.name+"."+property.name);
        }

        const self = this;
        if (!concept)
            throw new Error('Cannot map invalid concept to DOM: ' + concept);
        if (!property)
            throw new Error('Cannot map invalid property to DOM for concept: ' + concept + "." + property);
        if (this.isPropertyMapped(concept, property))
            throw new Error('Already mapped a DOM backing store for: ' + concept.name + "." + property.name);
        
        if (!this.isConceptMapped(concept)){
            // TODO: This is the first time we hear about this concept, add some create/delete or appear/disappear events as well
        }
        let getter = (uuid) => {
            if(DOMDataStore.DEBUG) {
                console.log("DOMDataStore getter: "+concept.name+"."+property.name);
            }

            let mark = VarvPerformance.start();

            let conceptElement = self.queryCache.querySelector("concept[uuid='" + uuid + "']");
            if (!conceptElement)
                throw new Error("No DOM data stored at all for "+concept.name+" with UUID "+uuid+" while getting "+concept.name+"."+property.name);
            let propertyElement = conceptElement.querySelector("property[name='" + property.name + "']");
            if (!propertyElement)
                throw new Error('No DOM data for property ' + concept.name + "." + property.name + " stored yet with UUID "+uuid);

            let result = self.getPropertyFromDOM(concept, propertyElement, property);

            VarvPerformance.stop("DOMDataStore.getter.nonCached", mark);

            return result;
        }

        let setter = (uuid, value) => {
            let mark = VarvPerformance.start();

            if(DOMDataStore.DEBUG) {
                console.log("DOMDataStore setter: "+concept.name+"."+property.name);
            }

            this.executeObserverless(()=>{
                let conceptElement = self.getConceptElementOrCreate(uuid, concept);

                let propertyElement = conceptElement.querySelector("property[name='" + property.name + "']");
                if (!propertyElement) {
                    propertyElement = document.createElement("property", { approved: true });
                    propertyElement.setAttribute("name", property.name, { approved: true });
                    conceptElement.appendChild(propertyElement);
                }

                let oldValue;

                try {
                    oldValue = property.typeCast(getter(uuid));
                } catch(e) {
                    //Ignore
                }

                if(property.isSame(value, oldValue)) {
                    //This value was already set in DOM, dont set it again
                    if(DOMDataStore.DEBUG) {
                        console.log("Skipping because same value...");
                    }
                    return;
                }

                if (Array.isArray(value)) {
                    let entryElement = document.createElement("temp");
                    value.forEach((entryValue) => {
                        let entry = document.createElement("entry", {approved: true});
                        if (Array.isArray(entryValue))
                            throw new Error('Nested arrays not supported yet'); // TODO
                        entry.setAttribute("value", entryValue);
                        entryElement.appendChild(entry);
                    });
                    propertyElement.innerHTML = entryElement.innerHTML;
                } else {
                    propertyElement.setAttribute("value", value, { approved: true });
                }
            });
            VarvPerformance.stop("DOMDataStore.setter", mark);
        }
        property.addSetCallback(setter);
        property.addGetCallback(getter);

        // Check if concept already is mapped, if not, register it
        this.internalAddPropertyMapping(concept, property, {setter: setter, getter: getter});
    }

    getConceptElementOrCreate(uuid, concept) {
        let mark = VarvPerformance.start();
        let conceptElement = this.queryCache.querySelector("concept[uuid='" + uuid + "']");
        if (!conceptElement) {
            conceptElement = document.createElement("concept", {approved: true});
            conceptElement.setAttribute("type", concept.name, { approved: true });
            conceptElement.setAttribute("uuid", uuid, { approved: true });
            this.backingElement.appendChild(conceptElement);
        }
        VarvPerformance.stop("DOMDataStore.getConceptElementOrCreate", mark);
        return conceptElement;
    }

    removeBackingStore(concept, property) {
        if (!concept)
            throw new Error('Cannot unmap invalid concept from DOM: ' + concept);
        if (!property)
            throw new Error('Cannot unmap invalid property from DOM for concept: ' + concept + "." + property);
        if (!this.isConceptMapped(concept))
            throw new Error('Cannot unmap property from concept not managed by DOM: ' + concept.name);
        if (!this.isPropertyMapped(concept, property))
            throw new Error('Cannot unmap property on managed DOM concept because the property was not mapped: ' + concept.name + "." + property.name);

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        property.removeGetCallback(trackingData.getter);
        
        // TODO: If this was the last mapping for this concept, also remove delete/create or appear/disappear events, we no longer care
        this.internalRemovePropertyMapping(concept, property);
    }

    /** 
     * Loads all concept instances currently registered as backed from serialized state
     * 
     * @returns {undefined}
     */
    async loadBackingStore() {
        // We restore the state by faking that someone else just added all the contents of the
        // backing element to our DOM
        let fakeAddMutationList = [{
            type: "childList",
            target: this.backingElement,
            addedNodes: Array.from(this.backingElement.children),
            removedNodes: []
        }];
        await this.mutationCallback(fakeAddMutationList);
    }

    /**
     * Starts this DOM datastore's mutation observer
     * @ignore
     * @protected
     */
    startObserver() {
        this.observer.observe(this.backingElement, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeOldValue: true,
            characterData: false,
            characterDataOldValue: false
        });
    }

    /**
     * Stops this DOM datastore's mutation observer, handling any mutations that is queued before stopping.
     * @ignore
     * @protected
     */
    stopObserver() {
        let mutations = this.observer.takeRecords();
        if (mutations.length > 0) {
            this.mutationCallback(mutations);
        }
        this.observer.disconnect();
    }

    /**
     * Run the given method without triggering the mutation observer
     * @ignore
     * @protected
     * @param {Function} method - Method to call. Important: must not be async, the observer will be restarted as soon as this promise returns.
     */
    executeObserverless(method) {
        this.stopObserver();

        //Run our method, potentially adding mutations
        method();

        this.startObserver();
    }
    
    /**
     * Reconstruct a value from DOM
     * @param {Concept} concept
     * @param {Element} propertyElement
     * @param {Property} propertyObject
     * @returns {any}
     */
    getPropertyFromDOM(concept, propertyElement, propertyObject){
        // Reconstruct the value
        if (propertyObject.type === "array") {
            // Unpack as array property
            let value = [];

            propertyElement.querySelectorAll(":scope > entry").forEach((childNode) => {
                let entryValue = childNode.getAttribute("value");
                if (entryValue === null)
                    throw new Error("Illegal array entry stored in DOM, cannot unmarsharl " + concept.name + "." + propertyObject.name);
                value.push(entryValue);
            });

            return value;
        } else {
            // Unpack as flat property
            let value = propertyElement.getAttribute("value");
            if (value === null)
                throw new Error('No actual value stored in DOM backed property for ' + concept.name + "." + propertyObject.name);

            return value;
        }
    }
    
    /** 
     * Takes the element and looks up everything else from that and pushes its state
     * to the concept
     * @param {element} propertyElement The element with the property to push to concept
     */
    syncronizePropertyElementFromDOM(propertyElement){
        const self = this;

        // Lookup concept
        let conceptElement = propertyElement.parentElement;

        if(DOMDataStore.DEBUG) {
            console.log("Synchronizing:", conceptElement, propertyElement);
        }

        let conceptInstance = this.getConceptInstanceFromConceptElement(conceptElement);
        
        // Lookup property
        let propertyName = propertyElement.getAttribute("name");
        if (propertyName === null) throw new Error("No property name on DOM property node "+conceptInstance.concept.name+" "+propertyElement);
        let propertyObject = conceptInstance.concept.getProperty(propertyName);

        return new Promise((resolve)=>{
            // Fire a set on the property which in turn calls our setter method while pausing our observer to sync with other datastores
            let value = self.getPropertyFromDOM(conceptInstance.concept, propertyElement, propertyObject);
            if(DOMDataStore.DEBUG) {
                console.log("DOM: Pushing remote change to " + conceptInstance.uuid + " " + conceptInstance.concept.name + "." + propertyObject.name + "=" + value);
            }
            propertyObject.setValue(conceptInstance.uuid, propertyObject.typeCast(value)).then(()=>{
                resolve();
            }).catch(()=>{
                //Unable to synchronize from dom, as dom did not validate
                resolve();
            });
        });
    }
    
    /**
     * Lookup concept and uuid from a concept element
     * @param {Element} conceptElement
     * @returns {any}
     */
    getConceptInstanceFromConceptElement(conceptElement){
        if (!conceptElement) throw new Error("Cannot get instance from undefined/null element");
        
        // TODO: Consider if manually added elements should get autogenerated uuid somehow, for now ignore it
        let uuid = conceptElement.getAttribute("uuid");
        if (uuid===null) throw new Error("Incomplete null concept instance in DOM");

        let type = conceptElement.getAttribute("type");
        if (type===null) throw new Error("Incomplete concept instance in DOM ignored, missing type: "+conceptElement.innerHTML);
        if (!this.isConceptTypeMapped(type)) throw new Error("DOM storage contains data for unmapped type, ignoring: "+type);

        // Lookup Concept by type through registry
        let concept = VarvEngine.getConceptFromType(type);
        if (!concept) throw new Error("DOM storage contains data for mapped type that is not registered in the system: "+type);
        
        return {concept: concept, uuid: uuid};
    }
}
DOMDataStore.DEBUG = false;
window.DOMDataStore = DOMDataStore;

//Register default dom datastore
Datastore.registerDatastoreType("dom", DOMDataStore);

class QuerySelectorCache {
    constructor(optionalParent) {
        this.parent = optionalParent!=null?optionalParent:document;
        this.cache = new Map();
        this.reverseLookup = new Map();

        this.setupObserver();
    }

    setupObserver() {
        const self = this;

        this.observer = new MutationObserver((mutations)=>{
            mutations.forEach((mutation)=>{
                mutation.removedNodes.forEach((node)=>{
                    let selectors = self.reverseLookup.get(node);
                    if(selectors != null) {
                        selectors.forEach((selector)=>{
                            self.cache.delete(selector);
                        });
                        self.reverseLookup.delete(node);
                        if(DOMDataStore.DEBUG) {
                            console.log("Updated cache for: ", node);
                        }
                    }
                });
            });
        });

        this.observer.observe(this.parent, {
            childList: true
        });
    }

    querySelector(selector) {
        let mark = VarvPerformance.start();
        let cacheEntry = this.cache.get(selector);
        if(cacheEntry != null) {
            VarvPerformance.stop("DOMDataStore.querySelector.cached", mark);
            return cacheEntry;
        }

        let result = this.parent.querySelector(selector);

        if(result != null) {
            this.cache.set(selector, result);
            let selectors = this.reverseLookup.get(result);
            if(selectors == null) {
                selectors = new Set();
                this.reverseLookup.set(result, selectors);
            }
            selectors.add(selector);
        }

        VarvPerformance.stop("DOMDataStore.querySelector.nonCached", mark);

        return result;
    }
}
