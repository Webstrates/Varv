/**
 *  VarvEngine - The core of the Varv system
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

const RELOAD_TIMEOUT = 1000;

class VarvEngine {
    static getConceptFromUUID(uuid) {
        return VarvEngine.conceptUUIDMap.get(uuid);
    }

    static getConceptFromType(type) {
        return VarvEngine.conceptTypeMap.get(type);
    }

    static getAllUUIDsFromType(type, includeOtherConcepts=false) {
        let uuidSet = null;

        if(!includeOtherConcepts) {
            uuidSet = VarvEngine.conceptTypeUUIDMap.get(type);
        } else {
            uuidSet = new Set();

            //Find all concepts with type, including other concepts
            VarvEngine.concepts.filter((concept)=>{
                if(concept.name === type) {
                    return true;
                }

                if(concept.otherConcepts.has(type)) {
                    return true;
                }

                return false;
            }).forEach((concept)=>{
                VarvEngine.getAllUUIDsFromType(concept.name).forEach((uuid)=>{
                    uuidSet.add(uuid);
                });
            });
        }

        if (uuidSet == null) {
            return [];
        }

        return Array.from(uuidSet);
    }

    static lookupAction(actionName, lookupConcepts = [], primitiveOptions = {}) {
        //Filter null and undefined
        lookupConcepts = lookupConcepts.filter((concept)=>{
            return concept != null;
        });

        //Make unique
        lookupConcepts = new Set(lookupConcepts);

        //Add other concepts
        for(let concept of VarvEngine.conceptTypeMap.values()) {
            lookupConcepts.add(concept);
        }

        if(VarvEngine.DEBUG) {
            console.groupCollapsed("Looking up:", actionName, [...lookupConcepts].map((concept)=>{return concept.name}));
        }

        let action = VarvEngine.lookupActionInternal(actionName, lookupConcepts, primitiveOptions);

        if(VarvEngine.DEBUG) {
            if(action != null) {
                console.log("Found action:", action);
            }
            console.groupEnd();
        }

        return action;
    }

    /**
     * @private
     * @param {string} actionName
     * @param {Set<Concept>} lookupConcepts
     * @returns {Action|null}
     */
    static lookupActionInternal(actionName, lookupConcepts, primitiveOptions = {}) {

        let conceptName = null;

        let split = actionName.split(".");

        if(split.length === 1) {
            actionName = split[0];
        } else if(split.length === 2) {
            conceptName = split[0];
            actionName = split[1];
        } else {
            throw new Error("Only able to lookup actions of the form 'actionname' or 'concept.actionname'");
        }

        if(VarvEngine.DEBUG) {
            console.log("Checking if lookup was on the form 'concept.actionname'");
        }

        if(conceptName != null) {
            if(VarvEngine.DEBUG) {
                console.log("Lookup was 'concept.actionname', forcing lookup to specific concept: ", conceptName);
            }

            let concept = this.conceptTypeMap.get(conceptName);

            if (concept != null) {
                if(VarvEngine.DEBUG) {
                    console.log("Trying to lookup action [" + actionName + "] on concept [" + concept.name + "]");
                }
                return concept.getAction(actionName);
            } else {
                throw new Error("Attempted lookup on form 'concept.actionname' where concept did not exist!");
            }
        }

        //Lookup action directly from name, trying default concept first
        if(lookupConcepts!=null && lookupConcepts.size > 0) {
            if(VarvEngine.DEBUG) {
                console.group("Trying to lookup on lookupConcepts in order");
            }
            for(let lookupConcept of lookupConcepts) {
                if(VarvEngine.DEBUG) {
                    console.log("Trying lookup on concept:", lookupConcept.name);
                }

                let action = lookupConcept.getAction(actionName);

                if(action != null) {
                    if(VarvEngine.DEBUG) {
                        console.groupEnd();
                    }
                    return action;
                }
            }
            if(VarvEngine.DEBUG) {
                console.groupEnd();
            }
        }

        if(VarvEngine.DEBUG) {
            console.log("Trying lookup on primitive actions...")
        }

        //Try primitive actions?
        try {
            if (Action.hasPrimitiveAction(actionName)) {
                return Action.getPrimitiveAction(actionName, primitiveOptions, null);
            }
        } catch(e) {}

        if(VarvEngine.DEBUG) {
            console.log("Action not found!");
        }

        return null;
    }

    static isKnownConceptType(type) {
        return VarvEngine.conceptTypeMap.has(type);
    }

    static registerConceptFromUUID(uuid, concept) {
        VarvEngine.conceptUUIDMap.set(uuid, concept);

        let uuidSet = VarvEngine.conceptTypeUUIDMap.get(concept.name);
        if(uuidSet == null) {
            uuidSet = new Set();
            VarvEngine.conceptTypeUUIDMap.set(concept.name, uuidSet);
        }

        uuidSet.add(uuid);
    }

    static deregisterConceptFromUUID(uuid) {
        let concept = this.getConceptFromUUID(uuid);

        VarvEngine.conceptUUIDMap.delete(uuid);

        if(concept != null) {
            let uuidSet = VarvEngine.conceptTypeUUIDMap.get(concept.name);
            if (uuidSet == null) {
                uuidSet = new Set();
                VarvEngine.conceptTypeUUIDMap.set(concept.name, uuidSet);
            }

            uuidSet.delete(uuid);
        }
    }

    static registerConceptFromType(type, concept) {
        let oldConcept = this.conceptTypeMap.get(type);

        if(oldConcept != null && oldConcept != concept) {
            console.warn("Registering ["+type+"] already registered", oldConcept, concept);
        }

        VarvEngine.conceptTypeMap.set(type, concept);
    }

    static deregisterConceptFromType(type) {
        VarvEngine.getAllUUIDsFromType(type).forEach((uuid)=>{
            VarvEngine.deregisterConceptFromUUID(uuid);
        });

        VarvEngine.conceptTypeMap.delete(type);
    }

    /**
     * Starts the VarvEngine
     */
    static async start() {
        let reloading = false;
        let reloadQueueId = null;

        let foundDefinitionFragments = [];

        const live = new LiveElement("code-fragment[data-type='text/varv']");

        let firstRun = true;

        let fragmentChangedHandler = (fragment)=>{
            if(fragment.fragment != null) {
                fragment = fragment.fragment;
            }
            if(fragment.auto) {
                queueReload();
            }
        }

        let fragmentAutoChangedHandler = ()=>{
            queueReload();
        }

        live.forEach((elm)=>{
            let fragment = Fragment.one(elm);
            elm.fragmentLink = fragment;

            foundDefinitionFragments.push(fragment);

            fragment.registerOnFragmentChangedHandler(fragmentChangedHandler);
            fragment.registerOnAutoChangedHandler(fragmentAutoChangedHandler);

            if(!firstRun) {
                if(fragment.auto) {
                    queueReload();
                }
            }
        });

        live.removed((elm)=>{
            let fragment = elm.fragmentLink;
            foundDefinitionFragments.splice(foundDefinitionFragments.indexOf(fragment), 1);
            fragment.unRegisterOnFragmentChangedHandler(fragmentChangedHandler);
            fragment.unRegisterOnAutoChangedHandler(fragmentAutoChangedHandler);
            if(elm.hasAttribute("auto")) {
                queueReload();
            }
        });

        firstRun = false;
        await queueReload();

        async function reload() {
            reloading = true;
            if (VarvEngine.DEBUG) {
                console.group("Reloading VarvEngine....");
            }

            if (VarvEngine.DEBUG) {
                console.log("Destroying old engine...");
            }
            for (let concept of VarvEngine.concepts) {
                await concept.destroy();
            }

            VarvEngine.concepts = [];

            for (let datastore of Datastore.datastores.values()) {
                if (VarvEngine.DEBUG) {
                    console.log("Destroying datastore:", datastore);
                }
                datastore.destroy();
            }
            Datastore.datastores.clear();

            if (VarvEngine.DEBUG) {
                console.log("Merging definition fragments...");
            }

            let combinedObj = {};

            for (let fragment of foundDefinitionFragments) {
                if (fragment.auto) {
                    let convertResult = YAMLJSONConverter.loadFromString(fragment.raw);

                    combinedObj = VarvEngine.merge(combinedObj, convertResult.obj);

                    //Attempt to merge conflicts we know how to handle:
                    VarvEngine.resolveMergeConflicts(combinedObj);
                } else {
                    if (VarvEngine.DEBUG) {
                        console.log("Skipping disabled fragment:", fragment);
                    }
                }
            }

            if (VarvEngine.DEBUG) {
                console.log("Combined Spec:", combinedObj);
            }

            if (VarvEngine.DEBUG) {
                console.log("Loading new engine...");
            }

            let spec = ConceptLoader.parseSpec(combinedObj);

            VarvEngine.concepts = await ConceptLoader.loadSpec(spec);

            await VarvEngine.sendEvent("engineReloaded", VarvEngine.concepts);

            if (VarvEngine.DEBUG) {
                console.log("Reload complete...", VarvEngine.concepts);
                console.groupEnd();
            }
            reloading = false;
        }

        function queueReload() {
            return new Promise((resolve)=>{
                if(VarvEngine.DEBUG) {
                    console.log("Queuing reload...");
                }

                if(reloadQueueId != null) {
                    window.clearTimeout(reloadQueueId);
                }

                reloadQueueId = setTimeout(()=>{
                    reloadQueueId = null;
                    if(!reloading) {
                        reloading = true;
                        reload().then(()=>{
                            iziToast.success({
                                title: '',
                                message: 'Successfully loaded Varv!',
                                transitionIn: "fadeIn",
                                transitionOut: 'fadeOut',
                                position: "topCenter",
                                timeout: 2000,
                                close: false,
                                closeOnClick: true
                            });
                            reloading = false;
                            resolve();
                        }).catch((e)=>{
                            iziToast.error({
                                title: '',
                                message: 'Error reloading Varv: '+e.message,
                                transitionIn: "fadeIn",
                                transitionOut: 'fadeOut',
                                position: "topCenter",
                                timeout: 2000,
                                close: false,
                                closeOnClick: true
                            });
                            console.groupEnd();
                            console.error(e);
                            reloading = false;
                            resolve();
                        });
                    } else {
                        queueReload().then(()=>{
                            resolve();
                        });
                    }
                }, RELOAD_TIMEOUT);
            });
        }

        EventSystem.registerEventCallback("Varv.Restart", ()=>{
            queueReload();
        });
    }

    static lookupTarget(concept) {
        let target = null;

        let uuids = VarvEngine.getAllUUIDsFromType(concept.name);
        if(uuids.length > 0) {
            target = uuids[0];
            if(uuids.length > 1) {
                console.warn("[lookupTarget] Multiple uuid's exist for concept ["+concept.name+"]", uuids);
            }

            return target;
        }

        throw new Error("No instance of concept found: "+concept.name);
    }

    /**
     *
     * @param {string} contextTarget
     * @param {Concept} localConcept
     * @param {string} propertyName
     * @returns {null|object}
     */
    static lookupProperty(contextTarget, localConcept, propertyName) {
        const DEBUG_LOOKUP_PROPERTY = false;

        if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
            console.groupCollapsed("Looking up property:", propertyName, contextTarget, localConcept);
            if(localConcept == null && contextTarget == null) {
                console.trace();
            }
        }

        //Lookup of form concept.property, overrides all the other lookup types
        let conceptName = null;

        let split = propertyName.split(".");

        if(split.length === 1) {
            propertyName = split[0];
        } else if(split.length === 2) {
            conceptName = split[0];
            propertyName = split[1];
        } else {
            throw new Error("Only able to lookup actions of the form 'actionname' or 'concept.actionname'");
        }

        if(conceptName != null) {
            if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
                console.log("Lookup of form concept.property...", conceptName, propertyName);
            }

            let lookupConcept = VarvEngine.getConceptFromType(conceptName);

            if(conceptName === "lastTarget") {
                console.warn("Should never see this?????");
            }

            if(lookupConcept != null) {
                let lookupProperty = lookupConcept.getProperty(propertyName);

                if(lookupProperty != null) {

                    let lookupTarget = null;

                    if(contextTarget != null && VarvEngine.getConceptFromUUID(contextTarget).isA(conceptName)) {
                        //The current target was of this concept, lets assume that is the wanted target?
                        lookupTarget = contextTarget;
                    } else {
                        lookupTarget = VarvEngine.lookupTarget(lookupConcept);
                    }

                    if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
                        console.log("Found concept.property, ", lookupProperty, lookupConcept, lookupTarget);
                        console.groupEnd();
                    }

                    return {
                        property: lookupProperty,
                        concept: lookupConcept,
                        target: lookupTarget
                    }
                }
            }
        }

        //Lookup on contextConcept
        try {
            let contextConcept = VarvEngine.getConceptFromUUID(contextTarget);
            let property = contextConcept.getProperty(propertyName);

            if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
                console.log("Found on contextConcept", contextConcept.name);
                console.groupEnd();
            }

            return {
                property: property,
                concept: contextConcept,
                target: contextTarget
            }
        } catch(e) {
            //Ignore
        }

        //Lookup on localConcept
        try {
            let property = localConcept.getProperty(propertyName);

            if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
                console.log("Found on localConcept", localConcept.name);
                console.groupEnd();
            }

            return {
                property: property,
                concept: localConcept,
                target: VarvEngine.lookupTarget(localConcept)
            }
        } catch(e) {
            //Ignore
        }

        //Lookup on globalConcept
        for(let globalConcept of VarvEngine.concepts) {
            try {
                let property = globalConcept.getProperty(propertyName);

                if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
                    console.log("Found on globalConcept", globalConcept.name);
                    console.groupEnd();
                }

                return {
                    property: property,
                    concept: globalConcept,
                    target: VarvEngine.lookupTarget(globalConcept)
                }
            } catch(e) {
                //Ignore
            }
        }

        if(VarvEngine.DEBUG || DEBUG_LOOKUP_PROPERTY) {
            console.log("Not found...");
            console.groupEnd();
        }

        return null;
    }

    /**
     * Lookup an unknown reference
     * @param {string} reference - The reference to lookup
     * @param {Concept} localConcept=null - The concept to lookup properties on first, before trying globally
     * @param {boolean} executeAtOnce - If true, the value of the function is returned, and not the function.
     * @returns {function|object|string} - An object containing the type of reference if known, or just the reference if still unknown
     */
    static lookupReference(reference, lookupConcepts = []) {
        let allConcepts = new Set();
        if(lookupConcepts != null) {
            if(!Array.isArray(lookupConcepts)) {
                lookupConcepts = [lookupConcepts];
            }

            lookupConcepts.forEach((concept)=>{
                allConcepts.add(concept);
            });
        }

        VarvEngine.concepts.forEach((concept)=>{
            allConcepts.add(concept);
        });

        return VarvEngine.lookupReferenceInternal(reference, allConcepts);
    }

    static lookupReferenceInternal(reference, lookupConcepts) {
        if(VarvEngine.DEBUG) {
            console.groupCollapsed("Looking up unknown reference:", reference);
        }

        //Check for concept type
        if (VarvEngine.getConceptFromType(reference) != null) {
            if(VarvEngine.DEBUG) {
                console.log("Was concept!");
                console.groupEnd();
            }
            return {
                "concept": reference
            }
        }

        //Check for view
        if (DOMView.singleton.getViewElements(reference).length > 0) {
            if(VarvEngine.DEBUG) {
                console.log("Was view!");
                console.groupEnd();
            }
            return {
                "view": reference
            }
        }

        //Check for global property
        for(let concept of lookupConcepts) {
            try {
                concept.getProperty(reference);

                if(VarvEngine.DEBUG) {
                    console.log("Was property on concept: [" + concept.name + "]");
                    console.groupEnd();
                }

                return {
                    "concept": concept.name,
                    "property": reference
                }
            } catch(e) {
                //Ignore, just means we had no property of given name
            }
        }

        if(VarvEngine.DEBUG) {
            console.log("Was unknown!");
            console.groupEnd();
        }

        return {
            "unknown": reference
        };
    }

    static resolveMergeConflicts(spec) {
        const DEBUG_MERGE = VarvEngine.DEBUG || false;

        function replaceInSpec(prefix, newValue) {
            if(prefix.startsWith("spec.")) {
                prefix = prefix.substring(5);
            }

            let currentPath = spec;
            let lastPath = null;
            let lastPrefixPart = null;
            prefix.split(".").forEach((prefixPart)=>{
                lastPath = currentPath;
                lastPrefixPart = prefixPart;

                if(prefixPart.indexOf("[") !== -1) {
                    let key = prefixPart.substring(0, prefixPart.indexOf("["));
                    let index = prefixPart.substring(prefixPart.indexOf("[")+1, prefixPart.indexOf("]"));
                    //Array entry
                    currentPath = currentPath[key][index];
                } else {
                    //Object entry
                    currentPath = currentPath[prefixPart];
                }
            });

            if(lastPath != null) {
                if(lastPrefixPart.indexOf("[") !== -1) {
                    let key = lastPrefixPart.substring(0, lastPrefixPart.indexOf("["));
                    let index = lastPrefixPart.substring(lastPrefixPart.indexOf("[")+1, lastPrefixPart.indexOf("]"));
                    //Array entry
                    lastPath[key][index] = newValue;
                } else {
                    //Object entry
                    lastPath[lastPrefixPart] = newValue;
                }

                return true;
            }

            return false;
        }

        function handleMergeConflict(prefix, json) {
            let merged = false;
            if(DEBUG_MERGE) {
                console.group("Attempting to merge: ", prefix, json.mergeConflict);
            }

            if(json.mergeConflict.type === "arrayMerge") {
                if(DEBUG_MERGE) {
                    console.log("ArrayMerge");
                }

                if(prefix.endsWith(".enum")) {
                    if(DEBUG_MERGE) {
                        console.log("Enum merge!")
                    }

                    merged = replaceInSpec(prefix, json.mergeConflict.part2);
                } else if(prefix.endsWith(".then")) {
                    if(DEBUG_MERGE) {
                        console.log("Action then merge!");
                    }

                    merged = replaceInSpec(prefix, json.mergeConflict.part2);
                } else if(prefix.match(/actions\.\S+$/)) {
                    if(DEBUG_MERGE) {
                        console.log("Action array merge!");
                    }

                    merged = replaceInSpec(prefix, {"then": json.mergeConflict.part2});
                } else if(prefix.endsWith(".extensions")) {
                    let result = [];
                    json.mergeConflict.part1.forEach((ext)=>{
                        result.push(ext);
                    });
                    json.mergeConflict.part2.forEach((ext)=>{
                        result.push(ext);
                    });

                    merged = replaceInSpec(prefix, result);
                }
            } else if(json.mergeConflict.type == null) {
                if(DEBUG_MERGE) {
                    console.log("Unknown merge type!");
                }

                if(prefix.match(/actions\.\S+$/)) {
                    let then = null;
                    let when = null;

                    if(Array.isArray(json.mergeConflict.part1)) {
                        then = json.mergeConflict.part1;
                        when = json.mergeConflict.part2.when;
                    } else if(Array.isArray(json.mergeConflict.part2)) {
                        then = json.mergeConflict.part2;
                        when = json.mergeConflict.part1.when;
                    } else {
                        //Unknown action merge
                    }

                    merged = replaceInSpec(prefix, {then, when});
                }
            }

            if(DEBUG_MERGE) {
                console.groupEnd();
            }
            return merged;
        }

        //Check for any mergeconflicts left...
        function findMergeConflict(json, prefix="") {
            if(typeof json === "object") {
                if(Array.isArray(json)) {
                    json.forEach((elm, index)=>{
                        findMergeConflict(elm, prefix+"["+index+"]");
                    });
                } else if(json != null) {
                    if(json.mergeConflict != null) {
                        let handled = handleMergeConflict(prefix, json);
                        if(!handled) {
                            console.warn("Found unhandled mergeConflict:", prefix, json);
                        }
                    }

                    Object.keys(json).forEach((objKey)=>{
                        let objValue = json[objKey];
                        findMergeConflict(objValue, prefix+"."+objKey);
                    });
                }
            }
        }

        findMergeConflict(spec, "spec");
    }

    static merge(json1, json2) {
        if(VarvEngine.DEBUG) {
            console.groupCollapsed("Merging:", json1, json2);
        }

        if(json1 == null && json2 != null) {
            if(VarvEngine.DEBUG) {
                console.log("Shortcut json2:", json2);
                console.groupEnd();
            }
            return json2;
        } else if(json2 == null && json1 != null) {
            if(VarvEngine.DEBUG) {
                console.log("Shortcut json1:", json1);
                console.groupEnd();
            }
            return json1;
        }

        if(json1 == null && json2 == null) {
            if(VarvEngine.DEBUG) {
                console.log("Null shortcut...");
                console.groupEnd();
            }
            return null;
        }

        //Neither json is null, as that would have resulted in a shortcut...

        let type1 = typeof json1;
        let type2 = typeof json2;

        if(type1 !== type2) {
            //Types were different, but none of the json was null, this should be an error of some sort?
            if(VarvEngine.DEBUG) {
                console.warn("Unable to merge different types:", json1, json2);
                console.groupEnd();
            }
            return {
                "mergeConflict": {
                    "part1": json1,
                    "part2": json2
                }
            };
        }

        let isArray1 = Array.isArray(json1);
        let isArray2 = Array.isArray(json2);

        if(isArray1 != isArray2) {
            if(VarvEngine.DEBUG) {
                console.warn("One was array, other was not!");
                console.groupEnd();
            }
            return {
                "mergeConflict": {
                    "part1": json1,
                    "part2": json2
                }
            };
        }

        if(isArray1) {
            if(VarvEngine.DEBUG) {
                console.log("Array merge...");
            }

            if(VarvEngine.DEBUG) {
                console.groupEnd();
            }

            return {
                "mergeConflict": {
                    "type": "arrayMerge",
                    "part1": json1,
                    "part2": json2
                }
            };
        } else if(type1 === "object") {
            if(VarvEngine.DEBUG) {
                console.log("Object merge...");
            }

            let result = {};

            for(let key of Object.keys(json1)) {
                result[key] = VarvEngine.merge(json1[key], json2[key]);
            }

            for(let key of Object.keys(json2)) {
                if(!result.hasOwnProperty(key)) {
                    //This was not handled already from json1 keys
                    result[key] = VarvEngine.merge(json1[key], json2[key]);
                }
            }

            if(VarvEngine.DEBUG) {
                console.groupEnd();
            }
            return result;
        } else {
            if(VarvEngine.DEBUG) {
                console.log("Value merge...");
            }
            if(json1 !== json2) {
                if(VarvEngine.DEBUG) {
                    console.warn("Non equal values! (Overriding from json2)");
                }
            }

            if(VarvEngine.DEBUG) {
                console.groupEnd();
            }
            return json2;
        }
    }

    static async sendEvent(eventName, detail) {
        if(Datastore.DEBUG) {
            console.group("Sending varv engine event:", eventName, detail);
        }
        await EventSystem.triggerEventAsync(VarvEngine.VarvEngineEventPrefix+eventName, detail);
        if(Datastore.DEBUG) {
            console.groupEnd();
        }
    }

    static registerEventCallback(eventName, callback) {
        return EventSystem.registerEventCallback(VarvEngine.VarvEngineEventPrefix+eventName, async (evt)=>{
            await callback(evt.detail);
        });
    }
}
VarvEngine.concepts = [];
VarvEngine.DEBUG = false;
VarvEngine.VarvEngineEventPrefix = "VarvEngineEvent.";
VarvEngine.conceptUUIDMap = new Map();
VarvEngine.conceptTypeMap = new Map();
VarvEngine.conceptTypeUUIDMap = new Map();

window.VarvEngine = VarvEngine;
