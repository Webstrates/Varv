/**
 *  Concept - The central part of the Varv language
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
class Concept {
    constructor(name) {
        this.name = name;
        this.properties = new Map();
        this.actions = new Map();
        this.behaviours = new Map();
        this.triggers = new Map();
        this.mappings = new Map();

        this.otherConcepts = new Set();
    }

    addTrigger(trigger, removeOld=false) {
        if(removeOld) {
            let oldTrigger = this.triggers.get(trigger.name);

            if (oldTrigger != null) {
                if (Concept.DEBUG) {
                    console.log("Overwriting trigger:", oldTrigger, trigger);
                }

                this.removeTrigger(oldTrigger);
            }
        }

        this.triggers.set(trigger.name, trigger);
    }

    removeTrigger(trigger) {
        this.triggers.delete(trigger.name);
        trigger.disable(this);
    }

    getTrigger(name) {
        return this.triggers.get(name);
    }

    addBehaviour(behaviour, removeOld=false) {
        if(removeOld) {
            let oldBehaviour = this.behaviours.get(behaviour.name);

            if (oldBehaviour != null) {
                if (Concept.DEBUG) {
                    console.log("Overwriting behaviour:", oldBehaviour, behaviour);
                }

                this.removeBehaviour(oldBehaviour);
            }
        }

        this.behaviours.set(behaviour.name, behaviour);

        if(behaviour.callableAction) {
            this.addAction(behaviour.actionChain);
        }
    }

    removeBehaviour(behaviour) {
        this.removeAction(behaviour.actionChain);
        this.behaviours.delete(behaviour.name);
        behaviour.destroy();
    }

    getBehaviour(name) {
        return this.behaviours.get(name);
    }

    addAction(action, removeOld=false) {
        if(removeOld) {
            let oldAction = this.actions.get(action.name);

            if (oldAction != null) {
                if (Concept.DEBUG) {
                    console.log("Overwriting action:", oldAction, action);
                }

                this.removeAction(oldAction);
            }
        }

        this.actions.set(action.name, action);
    }

    removeAction(action) {
        this.actions.delete(action.name);
    }

    getAction(name) {
        return this.actions.get(name);
    }

    addProperty(property, removeOld=false) {
        if(removeOld) {
            let oldProperty = this.properties.get(property.name);

            if (oldProperty != null) {
                if (Concept.DEBUG) {
                    console.log("Overwriting property:", oldProperty, property);
                }

                this.removeProperty(oldProperty);
            }
        }

        this.properties.set(property.name, property);
    }

    removeProperty(property) {
        this.unmapProperty(property);
        this.properties.delete(property.name);
    }

    getProperty(name) {
        if(name === "uuid") {
            return {
                name: "uuid",
                type: "string",
                isConceptType: ()=>{return false},
                getValue: (uuid) => {
                    return uuid;
                }
            };
        }

        const property = this.properties.get(name);

        if(property != null) {
            return property;
        } else {
            throw new Error("No property ["+name+"] on ["+this.name+"]");
        }
    }

    async setPropertyValue(uuid, name, value, skipStateChangeTrigger=false) {
        await this.getProperty(name).setValue(uuid, value, skipStateChangeTrigger);
    }

    getPropertyValue(uuid, name) {
        return this.getProperty(name).getValue(uuid);
    }

    setupTriggers(debug) {
        const self = this;

        if(debug) {
            console.groupCollapsed("Setting up triggers on concept [" + this.name + "]");
        }

        for(let trigger of this.triggers.values()) {
            if(debug) {
                console.log("Enabling trigger:", trigger);
            }
            trigger.enable(this);
        }

        //We should listen for deleted concepts, and update our property when any we have are deleted...
        this.deletedTriggerDeleter = Trigger.registerTriggerEvent("deleted", async (contexts)=>{
            for(let context of contexts) {
                if(context.target != null) {
                    let concept = await VarvEngine.getConceptFromUUID(context.target);
                    if(concept != null) {
                        //A concept was deleted, check if we have any properties with the given concept
                        for(let property of self.properties.values()) {
                            if(property.holdsConceptOfType(concept.name)) {
                                await property.removeAllReferences(self.name, context.target);
                            }
                        }
                    }
                }
            }
        });

        if(debug) {
            console.groupEnd();
        }
    }

    destroyTriggers() {
        for(let trigger of this.triggers.values()) {
            if(Concept.DEBUG) {
                console.log("Disabling trigger:", trigger);
            }
            trigger.disable(this);
        }

        this.deletedTriggerDeleter.delete();
    }

    async create(wantedUUID=null, properties=null){
        let mark = VarvPerformance.start();
        if(wantedUUID == null) {
            let uuidMark = VarvPerformance.start();
            wantedUUID = UUIDGenerator.generateUUID("concept");
            VarvPerformance.stop("Concept.create.generateUUID", uuidMark);
        } else {

            // TODO is this correct?

            let oldConcept = await VarvEngine.getConceptFromUUID(wantedUUID);

            //If already present, just return as if it has been created?
            if(oldConcept != null) {
                if(oldConcept !== this) {
                    throw new Error("Trying to create ["+wantedUUID+"] as ["+this.name+"] but it is already registered as a ["+oldConcept.name+"]");
                }

                throw new Error("Trying to create ["+wantedUUID+"] that already existed, as the same concept type..");
            }
        }       

        await VarvEngine.registerConceptFromUUID(wantedUUID, this);
        await this.appeared(wantedUUID);

        if (properties != null) {
            for (let key of Object.keys(properties)) {
                let value = properties[key];

                await this.setPropertyValue(wantedUUID, key, value, true);
            }
        }

        await this.created(wantedUUID);

        VarvPerformance.stop("Concept.create", mark);

        return wantedUUID;
    }
    
    /**
     * Clones the given UUID into a new one
     * @param {type} sourceUUID
     * @returns {@var;wantedUUID}
     */
    async clone(sourceUUID, deep=false, alreadyClonedReferences={}){
        let clonedProperties = {};
        for (const [propertyName, property] of this.properties){
            clonedProperties[propertyName] = await property.getValue(sourceUUID);
            
            if (deep){
                async function cloneUUID(propertyConcept, uuid){
                    let propertyActualConcept = await VarvEngine.getConceptFromUUID(uuid);
                    if (!propertyActualConcept) {
                        console.warn("Invalid reference to UUID '"+uuid+"' while deep-cloning property "+propertyName+" on "+propertyConcept.name+", the property was left as is (invalid)");
                        return uuid;
                    }
                    if (uuid===sourceUUID) throw new Error("Currently no support for deep cloning of concept instances with properties that contain direct self-references");
                    // TODO: cycles too
                    
                    // Check if we already cloned it, if not do so
                    if (alreadyClonedReferences[uuid]){
                        return alreadyClonedReferences[uuid];                        
                    } else {
                        let theClone = await propertyConcept.clone(uuid, true);
                        alreadyClonedReferences[uuid] = theClone;
                        return theClone;
                    }
                }
                
                // Referenced Concepts and Concept reference lists should also be cloned
                if (property.isConceptType()){
                    let propertyConcept = await VarvEngine.getConceptFromType(property.getType());   
                    clonedProperties[propertyName] = await cloneUUID(propertyConcept, clonedProperties[propertyName]);
                }
                if (property.isConceptArrayType()){
                    let propertyConcept = await VarvEngine.getConceptFromType(property.getArrayType());      
                    let newPropertyValue = [];
                    for(let i = 0; i < clonedProperties[propertyName].length; i++) {
                        newPropertyValue.push(await cloneUUID(propertyConcept, clonedProperties[propertyName][i]));
                    }
                    clonedProperties[propertyName] = newPropertyValue;
                }
            };
        }        

        return this.create(null, clonedProperties);
    }

    finishSetup(debug) {
        if(debug) {
            console.groupCollapsed("Finishing concept:", this.name);
        }
        this.finishProperties(debug);
        this.finishBehaviours(debug);
        this.setupTriggers(debug);
        if(debug) {
            console.groupEnd();
        }
    }

    finishProperties(debug) {
        let self = this;

        if(debug) {
            console.group("Properties:");
        }

        this.properties.forEach((property)=>{
            if(debug) {
                console.log(property)
            }
            property.finishSetup(self);
        });

        if(debug) {
            console.groupEnd();
        }
    }

    finishBehaviours(debug) {
        if(debug) {
            console.group("Behaviours:");
        }
        this.behaviours.forEach((behaviour, key)=>{
            if(debug) {
                console.log(behaviour);
            }
            behaviour.setupEvents();
        });
        if(debug) {
            console.groupEnd();
        }
    }

    omit(omitConfig) {
        let self = this;

        if(omitConfig.schema != null) {
            if(!Array.isArray(omitConfig.schema)) {
                omitConfig.schema = [omitConfig.schema];
            }
            omitConfig.schema.forEach((propertyName)=>{
                let property = self.getProperty(propertyName);
                if(property != null) {
                    self.removeProperty(property);
                }
            });
        }

        if(omitConfig.actions != null) {
            if(!Array.isArray(omitConfig.actions)) {
                omitConfig.actions = [omitConfig.actions];
            }

            omitConfig.actions.forEach((actionName)=>{
                let behaviour = self.getBehaviour(actionName);
                if(behaviour != null) {
                    self.removeBehaviour(behaviour);
                }

                let action = self.getAction(actionName);
                if(action != null) {
                    self.removeAction(action);
                }
            });
        }
    }

    /**
     * Import the otherConcept into this one. This concept will be the combination of both concepts but retains its name.
     * In case of clashes the otherConcept will override existing entries in this concept.
     * 
     * @param {Concept} otherConcept Other concept to import into this one
     */
    join(otherConcept){
        if(this === otherConcept) {
            console.warn("Attempting to join concept to itself!");
            return;
        }

        if(Concept.DEBUG) {
            console.group("Joining:", otherConcept.name, " into ", this.name);
        }

        const self = this;

        otherConcept.properties.forEach((property)=>{
            self.addProperty(property.cloneFresh(self), true);
        });

        for (let [propertyName, mappings] of otherConcept.mappings){
            this.mapProperty(this.getProperty(propertyName), mappings);
        }

        otherConcept.behaviours.forEach((behaviour)=>{
            self.addBehaviour(behaviour.cloneFresh(self), true);
        });

        this.otherConcepts.add(otherConcept.name);
        otherConcept.otherConcepts.forEach((otherConceptType)=>{
            self.otherConcepts.add(otherConceptType);
        })

        if(Concept.DEBUG) {
            console.groupEnd();
        }
    }

    unmapProperty(property) {
        this.mappings.get(property.name).forEach((datastoreName)=>{
            let datastore = Datastore.getDatastoreFromName(datastoreName);
            if(datastore != null) {
                datastore.removeBackingStore(this, property);
            } else {
                // TODO: Throw an error here?, We might just be unmapping from a join before datastores are even a thing...
            }
        });
        this.mappings.delete(property.name);
    }

    mapProperty(property, propertyMappings){
        this.mappings.set(property.name, propertyMappings);
    }

    enableMappings(debug = false) {
        const self = this;
        this.mappings.forEach((propertyMappings, propertyName)=>{
            let property = self.getProperty(propertyName);

            if(debug) {
                console.log(propertyName, propertyMappings);
            }

            propertyMappings.forEach((datastoreName)=>{
                let datastore = Datastore.getDatastoreFromName(datastoreName);
                if(datastore != null) {
                    datastore.createBackingStore(this, property);
                } else {
                    throw new Error("["+self.name+"] is attempting to map ["+propertyName+"] to a non existing datastore ["+datastoreName+"]");
                }
            });
        });
    }

    async delete(uuid){
        // Trigger deleted() trigger with target set to uuid
        await this.deleted(uuid);

        await this.disappeared(uuid);
    }

    async deleted(uuid) {
        let mark = VarvPerformance.start();
        await Trigger.trigger("deleted", {
            target: uuid
        });
        VarvPerformance.stop("Concept.Event.deleted", mark);
    }

    async created(uuid) {
        let mark = VarvPerformance.start();
        await Trigger.trigger("created", {
            target: uuid
        });
        VarvPerformance.stop("Concept.Event.created", mark);
    }

    async appeared(uuid) {
        let mark = VarvPerformance.start();
        // This instance just appeared in at least one datastore
        await VarvEngine.sendEvent("appeared", {
            target: uuid,
            concept: this
        });
        VarvPerformance.stop("Concept.Event.appeared", mark);
    }
    async disappeared(uuid) {
        let mark = VarvPerformance.start();
        // This instance just disappeared in at least one datastore
        await VarvEngine.sendEvent("disappeared", {
            target: uuid,
            concept: this
        });

        //Unregister the UUID
        VarvEngine.deregisterConceptFromUUID(uuid);
        VarvPerformance.stop("Concept.Event.disappeared", mark);
    }

    async destroy() {
        const self = this;

        if(Concept.DEBUG) {
            console.log("Destroying:", this);
        }

        //Destroy triggers
        this.destroyTriggers();

        //Destroy properties
        for(let property of this.properties.values()) {
            if(Concept.DEBUG) {
                console.log("Derigestering property:", property);
            }
            //Brute force trying to remove from any datastore known to mankind...
            Datastore.datastores.forEach((datastore)=>{
                try {
                    datastore.removeBackingStore(self, property);
                } catch(e) {
                    //Ignore
                }
            })
        }

        //Destroy behaviours
        for(let behaviour of this.behaviours.values()) {
            behaviour.destroy();
        }

        //Destroy actions
        this.actions = null;

        this.triggers = null;
        this.properties = null;
        this.behaviours = null;

        if(Concept.DEBUG) {
            console.log("Deregistering from VarvEngine...");
        }
        VarvEngine.deregisterConceptFromType(this.name);
    }

    isA(conceptType) {
        return this.name === conceptType || this.otherConcepts.has(conceptType);
    }
}
Concept.DEBUG = false;
window.Concept = Concept;
