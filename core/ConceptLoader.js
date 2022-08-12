/**
 *  Concept Loader - Convert JSON to program structure
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

/* 
 * Loads all concepts from the given json spec.
 *
 * ConceptLoader.SystemDefaultMappings can be set to an array of datastores, that will be used for any property that does not define a datastore mapping.
 * It defaults to ["dom", "cauldron"]
 */

class ConceptLoader {
    static get SystemDefaultMappings() {
        let defaultMappings = ["dom"];

        if(Datastore.getDatastoreType("cauldron") != null) {
            defaultMappings.push("cauldron");
        }

        return this.hasOwnProperty('_SystemDefaultMappings') ? this._SystemDefaultMappings : defaultMappings;
    }
    static set SystemDefaultMappings(mappings) {
        this._SystemDefaultMappings = mappings;
    }

    static parseSpec(json) {
        let parsedSpec = {
            "concepts":[],
            "dataStores": []
        }

        function getConceptFromName(name) {
            return parsedSpec.concepts.find((concept)=>{
                return concept.name === name;
            });
        }

        //Start parse group
        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Parsing: ", json);
        }

        //Start datastore group
        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Parsing dataStores...");
        }

        const dataStores = {
            "dom": {
                "type": "dom",
                "options": {default: true}
            },
            "memory": {
                "type": "memory",
                "options": {default: true}
            },
            "localStorage": {
                "type": "localStorage",
                "options": {default: true}
            }
        };

        if(Datastore.getDatastoreType("cauldron") != null) {
            dataStores.cauldron = {
                "type": "cauldron",
                "options": {default: true}
            };
        }

        if(ConceptLoader.DEBUG) {
            console.log("Default dataStores:", Object.assign({},dataStores));
        }

        if(json.dataStores != null) {
            Object.keys(json.dataStores).forEach((dataStoreKey)=>{
                let dataStoreConfig = json.dataStores[dataStoreKey];
                dataStores[dataStoreKey] = dataStoreConfig;
            });
        }

        for(let dataStoreKey of Object.keys(dataStores)) {
            const dataStoreConfig = dataStores[dataStoreKey];
            if(ConceptLoader.DEBUG) {
                console.log("Creating dataStore instance:", dataStoreKey, dataStoreConfig);
            }
            let dataStoreClass = Datastore.getDatastoreType(dataStoreConfig.type);

            let dataStoreInstance = new dataStoreClass(dataStoreKey, dataStoreConfig.options);
            parsedSpec.dataStores.push(dataStoreInstance);
        }

        //End datastore group
        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(json.concepts != null) {
            // Go through every concept in this JSON
            Object.keys(json.concepts).forEach((conceptName) => {
                let conceptJson = json.concepts[conceptName];

                if (ConceptLoader.DEBUG) {
                    console.groupCollapsed("Concept:", conceptName);
                }

                let concept = new Concept(conceptName);
                //VarvEngine.registerConceptFromType(conceptName, concept);

                let structure = conceptJson.structure || conceptJson.schema;

                // Find the properties of this Concept
                if (structure != null) {
                    Object.keys(structure).forEach((propertyName) => {
                        let propertyJson = structure[propertyName];

                        let property = new Property(propertyName, propertyJson);

                        if (ConceptLoader.DEBUG) {
                            console.log("Property:", property);
                        }

                        concept.addProperty(property);
                    });
                }

                // Find the mappings
                concept.properties.forEach((property) => {
                    //Dont map derived properties
                    if(property.isDerived()) {
                        return;
                    }

                    let propertyName = property.name;

                    let propertyMappings = ConceptLoader.getMappingsForProperty(conceptJson, propertyName);

                    if (ConceptLoader.DEBUG) {
                        console.log("Mapping:", propertyName, propertyMappings);
                    }

                    concept.mapProperty(property, propertyMappings);
                });

                // Find the actions
                if (conceptJson.actions != null) {
                    Object.keys(conceptJson.actions).forEach((actionName) => {
                        let actionSetup = conceptJson.actions[actionName];

                        if (Array.isArray(actionSetup)) {
                            //This is a behaviour action, with only then part
                            let behaviour = new Behaviour(actionName, [], actionSetup, concept, actionName);

                            if (ConceptLoader.DEBUG) {
                                console.log("Behaviour:", behaviour);
                            }

                            concept.addBehaviour(behaviour);
                        } else {
                            //This is a behaviour action, with either then or when or both...
                            let behaviour = new Behaviour(actionName, actionSetup.when, actionSetup.then, concept, actionName);

                            if (ConceptLoader.DEBUG) {
                                console.log("Behaviour:", behaviour);
                            }

                            concept.addBehaviour(behaviour);
                        }
                    });
                }

                if(conceptJson.extensions != null) {
                    if(json.extensions == null) {
                        json.extensions = [];
                    }

                    let sugarExtensions = [];

                    if (ConceptLoader.DEBUG) {
                        console.log("Sugar extensions...");
                    }
                    Object.keys(conceptJson.extensions).forEach((extensionType) => {
                        let extensionSetup = conceptJson.extensions[extensionType];

                        if(!Array.isArray(extensionSetup)) {
                            extensionSetup = [extensionSetup];
                        }

                        switch(extensionType) {
                            case "inject": {
                                if (ConceptLoader.DEBUG) {
                                    console.log("Inject:", extensionSetup);
                                }
                                let extension = {
                                    "concept": concept.name,
                                    "inject": extensionSetup
                                }
                                sugarExtensions.unshift(extension);
                                break;
                            }

                            case "pick": {
                                if (ConceptLoader.DEBUG) {
                                    console.log("Pick:", extensionSetup);
                                }

                                extensionSetup.forEach((extensionSetupElm)=>{
                                    let extension = {
                                        "concept": extensionSetupElm.concept,
                                        "into": concept.name,
                                        "pick": {}
                                    }

                                    if(extensionSetupElm.schema != null) {
                                        extension.pick.schema = extensionSetupElm.schema;
                                    }
                                    if(extensionSetupElm.actions != null) {
                                        extension.pick.actions = extensionSetupElm.actions;
                                    }
                                    sugarExtensions.unshift(extension);
                                });

                                break;
                            }

                            case "omit": {
                                if (ConceptLoader.DEBUG) {
                                    console.log("Omit:", extensionSetup);
                                }

                                extensionSetup.forEach((extensionSetupElm)=>{
                                    let extension = {
                                        "concept": concept.name,
                                        "omit": {}
                                    }

                                    if(extensionSetupElm.schema != null) {
                                        extension.omit.schema = extensionSetupElm.schema;
                                    }
                                    if(extensionSetupElm.actions != null) {
                                        extension.omit.actions = extensionSetupElm.actions;
                                    }
                                    sugarExtensions.unshift(extension);
                                });

                                break;
                            }

                            default:
                                console.log("Unknown extension type:", extensionType, extensionSetup);
                        }
                    });

                    sugarExtensions.forEach((extension)=>{
                        json.extensions.unshift(extension);
                    })
                }

                if (ConceptLoader.DEBUG) {
                    console.groupEnd();
                }

                parsedSpec.concepts.push(concept);
            });
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Extensions");
        }

        // Now modify the environment with the concept extensions (join, inject ...) in order of definition
        if (json.extensions){
            json.extensions.forEach((extension)=>{
                try {
                    if (extension.inject != null) {
                        // Join two or more concepts together into a new concept
                        if (!extension.concept) throw new Error("Inject extension without target 'concept' name: " + JSON.stringify(extension));

                        let target = getConceptFromName(extension.concept);
                        if (!target) throw new Error("Inject extension with target 'concept' set to '" + extension.concept + "' that does not exist: " + JSON.stringify(extension));

                        if (ConceptLoader.DEBUG) {
                            console.log("Injecting into " + extension.concept + ":");
                        }

                        if (!Array.isArray(extension.inject)) extension.inject = [extension.inject];
                        for (let joinee of extension.inject) {
                            let otherConcept = getConceptFromName(joinee);
                            if (!otherConcept) throw new Error("Inject extension with unknown concept '" + joinee + "' in 'inject' list: " + JSON.stringify(extension));
                            target.join(otherConcept);
                        }
                    } else if (extension.join != null) {
                        // Join two or more concepts together into a new concept
                        if (!extension.as) throw new Error("Join extension without 'as' target concept name: " + JSON.stringify(extension));

                        let potentialClash = getConceptFromName(extension.as);
                        if (potentialClash) throw new Error("Join extension with 'as' target concept name '" + extension.as + "' that already exists: " + JSON.stringify(extension));

                        let concept = new Concept(extension.as);
                        parsedSpec.concepts.push(concept);

                        if (ConceptLoader.DEBUG) {
                            console.groupCollapsed("Joining into " + extension.as + ":");
                        }
                        for (let joinee of extension.join) {
                            let otherConcept = getConceptFromName(joinee);
                            if (!otherConcept) throw new Error("Join extension with unknown concept '" + joinee + "' in 'join' list: " + JSON.stringify(extension));
                            if (ConceptLoader.DEBUG) {
                                console.log(otherConcept.name);
                            }
                            concept.join(otherConcept);
                        }
                        if (ConceptLoader.DEBUG) {
                            console.groupEnd();
                        }
                    } else if (extension.omit != null) {
                        if(!extension.concept) throw new Error("Omit extension without 'concept' option: "+JSON.stringify(extension));

                        let concept = getConceptFromName(extension.concept);

                        if(concept != null) {
                            if (ConceptLoader.DEBUG) {
                                console.log("Omitting from " + extension.concept + ":", extension.omit);
                            }

                            concept.omit(extension.omit);
                        }
                    } else if (extension.pick != null) {
                        if(!extension.concept) throw new Error("Pick extension without 'concept' option: "+JSON.stringify(extension));
                        if(!extension.as && !extension.into) throw new Error("Pick extension without 'as' or 'into' option: "+JSON.stringify(extension));

                        let toConcept = null;

                        let fromConcept = getConceptFromName(extension.concept);

                        if(fromConcept == null) {
                            throw new Error("Pick extension with unknown concept '"+extension.concept+"': "+JSON.stringify(extension));
                        }

                        if(extension.as != null) {
                            if(getConceptFromName(extension.as) != null) {
                                throw new Error("Pick extension option 'as' another concept with that name already exists: "+JSON.stringify(extension));
                            }
                            toConcept = new Concept(extension.as);
                            parsedSpec.concepts.push(toConcept);
                        } else if(extension.into != null) {
                            toConcept = getConceptFromName(extension.into);
                        }

                        if (ConceptLoader.DEBUG) {
                            console.log("Picking from " + extension.concept + " as "+extension.as+":", extension.pick);
                        }

                        if(extension.pick.schema != null) {
                            if(!Array.isArray(extension.pick.schema)) {
                                extension.pick.schema = [extension.pick.schema];
                            }

                            extension.pick.schema.forEach((propertyName)=>{
                                let property = fromConcept.getProperty(propertyName);
                                toConcept.addProperty(property.cloneFresh(toConcept), true);

                                let mappings = fromConcept.mappings.get(propertyName);
                                toConcept.mapProperty(toConcept.getProperty(propertyName), mappings);
                            });
                        }

                        if(extension.pick.actions != null) {
                            if (!Array.isArray(extension.pick.actions)) {
                                extension.pick.actions = [extension.pick.actions];
                            }

                            extension.pick.actions.forEach((behaviourName)=>{
                                let behaviour = fromConcept.getBehaviour(behaviourName);
                                toConcept.addBehaviour(behaviour.cloneFresh(toConcept), true);
                            });
                        }
                    } else {
                        throw new Error("Unsupported extension: " + JSON.stringify(extension));
                    }
                } catch(e) {
                    console.warn(e);
                }
            });
        }
        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        //End Parse group
        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        return parsedSpec;
    }

    /**
     *
     * @param {object} json
     * @returns {Promise<any[]>}
     */
    static async loadSpec(spec) {
        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Loading: ", spec);
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Mapping concepts...");
        }

        spec.concepts.forEach((concept)=>{
            if(ConceptLoader.DEBUG) {
                console.log(concept);
            }
            VarvEngine.registerConceptFromType(concept.name, concept);
        });

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Loading dataStores...");
        }

        for(let dataStore of spec.dataStores) {
            if(ConceptLoader.DEBUG) {
                console.log("Initializing datastore:", dataStore);
            }
            await dataStore.init();

            Datastore.datastores.set(dataStore.name, dataStore);
        }

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Enabling mappings");
        }

        spec.concepts.forEach((concept)=>{
            concept.enableMappings(ConceptLoader.DEBUG);
        });

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Loading backing store...");
        }

        // Run all datastore load methods
        for(let datastore of Array.from(Datastore.datastores.values())) {
            await Trigger.runWithoutTriggers(async ()=>{
                await datastore.loadBackingStore();
            });
        }

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(ConceptLoader.DEBUG) {
            console.groupCollapsed("Finishing concepts");
        }

        spec.concepts.forEach((concept)=>{
            concept.finishSetup(ConceptLoader.DEBUG);
        });

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        if(ConceptLoader.DEBUG) {
            console.groupEnd();
        }

        return spec.concepts;
    }
    
    static getMappingsForProperty(conceptJson, propertyName){
        // System-level default
        let propertyMappings = ConceptLoader.SystemDefaultMappings;
        
        // If concept has defaultMappings, use those
        if(conceptJson.defaultMappings != null) {
            if(!Array.isArray(conceptJson.defaultMappings)) {
                console.warn("concept defaultMappings must be an array");
            } else {
                propertyMappings = conceptJson.defaultMappings;
            }
        }
        
        // If property has mappings use those
        if (conceptJson.mappings && conceptJson.mappings[propertyName]) {
            propertyMappings = conceptJson.mappings[propertyName];
        }

        return propertyMappings;
    }
    

    static parseTrigger(triggerName, triggerJson, concept) {
        if(ConceptLoader.DEBUG) {
            console.log("Parsing trigger:", triggerName, triggerJson);
        }

        let triggerType = Object.keys(triggerJson)[0];
        let triggerOptions = triggerJson[triggerType];

        try {
            return Trigger.getTrigger(triggerType, triggerName, triggerOptions, concept);
        } catch (e) {
            console.warn(e);
        }

        return null;
    }

    static parseAction(actionName, actionSetup, concept) {
        let chain = new ActionChain(actionName, {}, concept);

        actionSetup.forEach((actionPart) => {
            if(typeof actionPart === "string") {
                if(Action.hasPrimitiveAction(actionPart)) {
                    chain.addAction(Action.getPrimitiveAction(actionPart, {}, concept));
                } else {
                    let lookupAction = new LookupActionAction("", {
                        "lookupActionName": actionPart
                    }, concept);

                    chain.addAction(lookupAction);
                }
            } else {
                let keys = Object.keys(actionPart);

                if(keys.length > 1) {
                    console.warn("You have an action with more than one key as action name: ", actionPart);
                }

                let actionName = keys[0];
                let actionOptions = actionPart[actionName];

                let action = null;

                try {
                    // Check for primitive action
                    action = Action.getPrimitiveAction(actionName, actionOptions, concept);
                } catch(e) {
                    // No primitive action, reference with arguments?
                    action = new LookupActionAction("", {
                        "lookupActionName": actionName,
                        "lookupActionArguments": actionOptions
                    }, concept);
                }

                chain.addAction(action);
            }
        });

        return chain;
    }
}

ConceptLoader.DEBUG = false;
window.ConceptLoader = ConceptLoader;
