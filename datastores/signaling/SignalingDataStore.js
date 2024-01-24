/**
 *  SignalingDataStore - stores properties temporarily in collective memory
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
 * @memberOf Datastores
 */
class SignalingDataStore extends DirectDatastore {
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
        })
    }

    async init() {
        const self = this;
        
        let storageName = "varv-signaling";
        if(this.options.storageName != null) {
            storageName = this.options.storageName;
        }
        
        // Try to find an element to signal on
        let topElement = document;
        this.backingElement = topElement.querySelector(storageName);
        if (!this.backingElement) {
            this.backingElement = topElement.createElement(storageName, {approved: true});
            topElement.body.appendChild(this.backingElement);
        }                
        let signalFunction = (message,sender)=>self.receiveSignal(message,sender)
        this.backingElement.webstrate.on("signal", signalFunction);
        this.deleteCallbacks.push({
            delete: ()=>{
                this.backingElement.webstrate.off("signal", signalFunction);
            }
        })


        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(SignalingDataStore.DEBUG) {
                console.log("Saw disappeared UUID (SignalingDataStore):", context.target);
            }

            context.concept.properties.forEach((property) => {
                if (self.isPropertyMapped(context.concept, property)) {
                    let data = self.internalPropertyTrackingData(context.concept, property);
                    delete data[context.target];
                }
            });
            
            // Broadcast to everyone
            this.backingElement.webstrate.signal({
                q: "notifyDisappeared",
                type: context.concept.name,
                uuid: context.target
            });
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            if(SignalingDataStore.DEBUG) {
                console.log("Saw appeared UUID (SignalingDataStore):", context.target);
            }
            if (self.isConceptMapped(context.concept)){
                // Broadcast to everyone
                this.backingElement.webstrate.signal({
                    q: "notifyExists",
                    type: context.concept.name,
                    uuids: [context.target]
                });
            }
        }));
    }
    
    async receiveSignal(message, sender){
        if (sender==webstrate.clientId) return; // Ignore our own messages
        if (!message.q) return;
        console.log(message, sender);
        switch (message.q){
            case "getConceptUUIDs":
                // A peer is asking us about what UUIDs we know about for a given concept type
                if ((!message.type) || !this.isConceptTypeMapped(message.type)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring concept listing request since it is not mapped on this peer", message);                    
                    break;
                }
                this.backingElement.webstrate.signal({
                    q: "notifyExists",
                    type: message.type,
                    uuids: await VarvEngine.getAllUUIDsFromType(message.type)
                }, [sender]);
                break;
            case "notifyExists":
                // A peer is telling us about UUIDs it knows for a given concept type
                if ((!message.type) || !this.isConceptTypeMapped(message.type)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring concept listing notification since it is not mapped on this peer", message);                    
                    break;
                }
                
                let properties = Array.from(this.mappedConcepts.get(message.type).keys());
                for (let uuid of message.uuids){
                    // Check if already registered and only request data discovery if not
                    let varvConceptByUUID = await VarvEngine.getConceptFromUUID(uuid);
                    if (!varvConceptByUUID){
                        this.backingElement.webstrate.signal({
                            q: "getInitialInstance",
                            uuid: uuid,
                            properties: properties
                        }, [sender]);
                    }
                }
                break;
            case "getInitialInstance":
                if (!(message.uuid&&message.properties)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring request for initial instance data with malformed request", message);                    
                    break;
                }
                let initialConceptByUUID = await VarvEngine.getConceptFromUUID(message.uuid);
                if (!initialConceptByUUID){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring request for initial instance data for instance that doesn't exist", message);                    
                    break;
                }
                
                // TODO: Check properties are actually mapped
                
                // Construct JSON representation of instance and send it back
                let initialInstanceReply = {
                    q: "notifyInitialInstance",
                    uuid: message.uuid,
                    type: initialConceptByUUID.name,
                    properties: {}
                };
                for (let property of message.properties){
                    initialInstanceReply.properties[property] = await initialConceptByUUID.getPropertyValue(message.uuid, property);   
                }
                this.backingElement.webstrate.signal(initialInstanceReply, [sender]);                
                break;
            case "notifyInitialInstance":
                if (!(message.uuid&&message.properties&&message.type)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring initial instance data with malformed structure", message);                    
                    break;
                }

                let concept = VarvEngine.getConceptFromType(message.type);
                if (!concept){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring initial instance data with nonexisting concept", message);                    
                    break;
                }
                if (!this.isConceptMapped(concept)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring initial instance data with non-mapped concept", message);                    
                    break;
                }
                
                
                let varvInitialInstance = await VarvEngine.getConceptFromUUID(message.uuid);
                let usInitialInstance = this.getConceptFromUUID(message.uuid);
                
                // Maybe this was the first time Varv heard about this instance ever, in that case make it appear
                if (!varvInitialInstance) {
                    await concept.appeared(message.uuid);                        
                }                        
                
                if (!usInitialInstance){
                    // This is the first time we signal about this instance but it may be in another local datastore
                    this.registerConceptFromUUID(message.uuid, concept);

                    // Pull the mapped properties from the hivemind to any other local datastore + the concept
                    for (let propertyName of this.mappedConcepts.get(message.type).keys()){
                        try {
                            let property = concept.getProperty(propertyName);                    
                            if (SignalingDataStore.DEBUG) console.log("Loading property", property, message.properties[propertyName]);
                            // TODO: Error if not set in message
                            await property.setValue(message.uuid, message.properties[propertyName]);
                        } catch (ex){
                            console.error("Failed to push concept property from signal to concept", ex);
                        }
                    }                    
                }
                           
                break;
            case "setProperty":
                if (!(message.uuid&&message.property)){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring property change with malformed data", message);                    
                    break;
                }
                
                // TODO: Check if mapped
                let changedConcept = this.getConceptFromUUID(message.uuid);
                if (!changedConcept){
                    if (SignalingDataStore.DEBUG) console.log("Ignoring property change for unknown UUID", message);                    
                    break;
                }
                
                let change = message.uuid+"."+message.property;
                this.inflightChanges.add(change); // Avoid writebacks from this
                await changedConcept.setPropertyValue(message.uuid, message.property, message.value);
                this.inflightChanges.delete(change);
                break;
            default:
                console.log("Unhandled signal ",message);
        }
    }

    createBackingStore(concept, property) {
        const self = this;
        
        // Check if concept already is mapped, if not, register it
        if (this.isPropertyMapped(concept,property)) return;
        let setter = (uuid, value) => {
            if (self.inflightChanges.has(uuid+"."+property.name)) return;
            self.backingElement.webstrate.signal({
                q: "setProperty",
                uuid: uuid,
                property: property.name,
                value: value
            });
        };
        property.addSetCallback(setter);
        this.internalAddPropertyMapping(concept, property, {setter: setter});
    }    
    
    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property)){
            throw new Error('Cannot unmap property from signaling because the property was not mapped: ' + concept + "." + property);
        }

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        this.internalRemovePropertyMapping(concept, property);
    }
    
    async loadBackingStore() {
        // For each of our stored and mapped concepts, enqueue a list request for UUIDs from the hivemind to populate local state
        for (let conceptType of this.mappedConcepts.keys()){
            this.backingElement.webstrate.signal({
                q: "getConceptUUIDs",
                type: conceptType
            });
        }
    }
}
SignalingDataStore.DEBUG = false;
window.SignalingDataStore = SignalingDataStore;

// Register default dom datastore
Datastore.registerDatastoreType("signaling", SignalingDataStore);
