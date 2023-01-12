/**
 *  Action - The super class for all Actions
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
 * A context in Varv
 * @typedef {object} VarvContext
 * @property {string} [target] - The UUID of the target this context refers to
 * @property {object} [variables] - The variables currently set to any value
 */

/**
 * Base class for all actions
 */
class Action {
    /**
     * Crate a new Action
     * @param {string} name - The name of the action
     * @param {object} options - The options of the action
     * @param {Concept} concept - The owning concept
     */
    constructor(name, options, concept) {
        this.name = name;
        this.options = options;
        this.concept = concept;

        if(this.options == null) {
            this.options = {};
        }
    }

    /**
     * Applies this Action to the given contexts, returning some resulting contexts
     * @param {VarvContext[]} contexts
     * @param {object} arguments
     * @returns {Promise<VarvContext[]>}
     */
    async apply(contexts, actionArguments = {}) {
        console.warn("Always override Action.apply in subclass!");
        return contexts;
    }

    /**
     * @callback forEachCallback
     * @param {VarvContext} context - The context currently being looked at
     * @param {object} options - The current options with variables and arguments substituted
     * @param {number} index - The index of the current context in the context array
     * @returns {VarvContext|VarvContext[]}
     */

    /**
     * Loops through the given contexts, and calls the given callback for each, complete with substituted options and the index of the context
     * @param {VarvContext[]} contexts - The contexts to handle
     * @param {object} actionArguments - The arguments to use for this action
     * @param {forEachCallback} callback - The callback to call for each context
     * @returns {Promise<VarvContext[]>}
     */
    async forEachContext(contexts, actionArguments={}, callback) {
        if(arguments.length < 2) {
            throw new Error("forEachContext can be called either as (contexts, actionArguments, callback) or (contexts, callback)");
        }

        //If called with 2 arguments options is the callback
        if(arguments.length === 2) {
            if(typeof actionArguments !== "function") {
                throw new Error("forEachContext can be called either as (contexts, actionArguments, callback) or (contexts, callback)");
            }

            // noinspection JSValidateTypes
            callback = actionArguments;
            actionArguments = {};
        }

        let results = [];

        let index = 0;

        let options = await Action.lookupArguments(this.options, actionArguments);

        for (let context of contexts) {
            //Make sure to clone context, since we change it directly, thus variables might be a shared object if not.
            let clonedContext = Action.cloneContext(context);

            let optionsWithVariables = await Action.lookupVariables(options, clonedContext);

            let result = await callback(clonedContext, optionsWithVariables, index);

            if (result != null) {
                if (Array.isArray(result)) {
                    result.forEach((entry) => {
                        results.push(entry);
                    });
                } else {
                    results.push(result);
                }
            }

            index++;
        }

        return results;
    }

    /**
     * Get the default variable name, for when no variable name is supplied
     * @param {Action} - The action asking, the name of the action is used.
     * @returns {string} - The default variable name
     */
    static defaultVariableName(action) {
        if(action == null) {
            return "result";
        }

        return action.name;
    }

    /**
     * Sets the given variable to the given value, in the given context
     * @param {VarvContext} context - The context to set the variable inside
     * @param {string} name - The name of the variable to set
     * @param {any} value - The value to set
     */
    static setVariable(context, name, value) {
        if(context.variables == null) {
            context.variables = {}
        }

        if(name === "target") {
            console.warn("Unable to set variable target!");
            return;
        }

        context.variables[name] = value;
    }

    /**
     * Retrieve the value of the given variable from the given context
     * @param {VarvContext} context
     * @param {string} name
     * @returns {any}
     */
    static getVariable(context, name) {
        if(name === "target" && context.target != null) {
            //If context.target exists use that, if not, check variables as getCommonVariables might have saved a common target
            return context.target;
        }

        if(name === "lastTarget" && context.lastTarget != null) {
            //If context.lastTarget exists use that
            return context.lastTarget;
        }

        if(context.variables == null) {
            context.variables = {}
        }

        if(!context.variables.hasOwnProperty(name)) {
            if(name === "target") {
                throw new Error("Context did not contain target, and no variable target existed either!");
            }

            throw new Error("No named variable ["+name+"]");
        }

        return context.variables[name];
    }

    /**
     * Extract all the variables that have the same value across all contexts
     * @param contexts
     * @returns {{}}
     */
    static getCommonVariables(contexts) {
        let common = {};

        let mark = VarvPerformance.start();

        if(contexts.length > 0) {
            let testContext = contexts[0];

            if(testContext.variables != null) {
                Object.keys(testContext.variables).forEach((variableName)=>{
                    let variableValue = testContext.variables[variableName];
                    let keep = true;

                    for(let otherContext of contexts) {
                        if(otherContext.variables != null) {
                            let otherValue = otherContext.variables[variableName];

                            if(otherValue != null && otherValue === variableValue) {
                                continue;
                            }

                            if(Array.isArray(otherValue) && Array.isArray(variableValue)) {
                                if(otherValue.length === variableValue.length) {
                                    let arrayEqual = true;
                                    for(let i = 0; i<otherValue.length; i++) {
                                        arrayEqual = arrayEqual && otherValue[i] === variableValue[i];
                                    }

                                    if(arrayEqual) {
                                        continue;
                                    }
                                }
                            }
                        }

                        keep = false;
                        break;
                    }

                    if(keep) {
                        common[variableName] = variableValue;
                    }
                });
            }

            if(testContext.target != null) {
                let keep = true;
                for(let otherContext of contexts) {
                    if (otherContext.target != testContext.target) {
                        keep = false;
                        break;
                    }
                }

                if(keep) {
                    common["target"] = testContext.target;
                }
            }
        } else {
            if(contexts.savedVariables) {
                return contexts.savedVariables;
            }
        }

        VarvPerformance.stop("Action.getCommonVariables", mark, "#contexts "+contexts.length);

        return common;
    }

    static getCommonTarget(contexts) {
        let commonTarget = -1;
        contexts.forEach((context)=>{
            if(commonTarget === -1) {
                commonTarget = context.target;
            } else {
                if(commonTarget !== context.target) {
                    commonTarget = null;
                }
            }
        });
        return commonTarget;
    }

    /**
     * Looks up any options that are set to an argument replacement value "@myArgumentName" and replaces it with that arguments value
     * @param {object} options - The options to do the replacement on
     * @param {object} actionArguments - The arguments to replace into the options
     * @returns {object} A clone of the options argument, with all replacement values replaced
     */
    static async lookupArguments(options, actionArguments) {
        let mark = VarvPerformance.start();

        const optionsClone = Action.clone(options);

        let regex = /@(\S+?)(?:@|\s|$)/gm;

        for(let parameter in optionsClone) {
            if(!Object.hasOwn(optionsClone, parameter)) {
                continue;
            }

            let value = optionsClone[parameter];

            optionsClone[parameter] = await Action.subParam(value, (value)=>{
                if(!value.includes("@")) {
                    return value;
                }

                //Substitute any @argumentName with the value of the argument
                for(let match of value.matchAll(regex)) {
                    let search = match[0].trim();
                    let variableName = match[1];

                    let variableValue = actionArguments[variableName];

                    if(Action.DEBUG) {
                        console.log("Replaced argument:", search, variableValue, actionArguments, variableName);
                    }

                    if(value === search) {
                        //Single value, set it directly
                        value = variableValue;
                    } else {
                        //Replace into value
                        value = value.replace(search, variableValue);
                    }
                }

                return value;
            });

        }

        VarvPerformance.stop("Action.lookupArguments", mark, {options});

        return optionsClone;
    }

    static async subParam(value, lookupCallback) {
        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                value[i] = await Action.subParam(value[i], lookupCallback);
            }
            return value;
        } else if (typeof value === "object" && value != null && Object.getPrototypeOf(value) === Object.prototype) {
            for(let key in value) {
                if(Object.hasOwn(value, key)) {
                    value[key] = await Action.subParam(value[key], lookupCallback);
                }
            }
            return value;
        } else if (typeof value === "string") {
            return lookupCallback(value);
        } else {
            return value;
        }
    }

    static clone(obj) {
        if(Array.isArray(obj)) {
            return obj.map((arrayValue)=>{
                return Action.clone(arrayValue);
            });
        } else if(typeof obj === "object" && obj != null && Object.getPrototypeOf(obj) === Object.prototype) {

            let clone = {};

            for (let key in obj) {
                if (!Object.hasOwn(obj, key)) {
                    continue;
                }

                clone[key] = Action.clone(obj[key]);
            }

            return clone;
        }

        return obj;
    }


    /**
     * Look up any options that have a variable replacement value "$myVariable" and replaces it with the value of that variable.
     * @param {object} options
     * @param {VarvContext} context
     * @returns {object} - Returns a clone of the given options, with all replacement values replaced.
     */
    static async lookupVariables(options, context) {
        if(Action.DEBUG) {
            console.group("Looking up variables from context:", options, context);
        }

        let mark = VarvPerformance.start();

        const optionsClone = Action.clone(options);

        async function doLookup(context, variableName) {
            let variableValue = null;

            if(variableName.indexOf(".") !== -1) {
                let split = variableName.split(".");

                //concept.property lookup, not really variable
                let conceptName = split[0];
                let propertyName = split[1];

                let result = null;

                if(conceptName === "lastTarget") {
                    result = await VarvEngine.lookupProperty(context.lastTarget, null, propertyName);
                } else if(conceptName === "target") {
                    result = await VarvEngine.lookupProperty(context.target, null, propertyName);
                } else {
                    result = await VarvEngine.lookupProperty(context.target, null, variableName);
                }

                if (result != null && result.target != null) {
                    variableValue = await result.property.getValue(result.target);
                }
            } else {
                variableValue = Action.getVariable(context, variableName);
            }

            return variableValue;
        }

        let regex = /\$(\S+?)(?:\$|\s|$)/gm;

        for(let key of Object.keys(optionsClone)) {
            optionsClone[key] = await Action.subParam(optionsClone[key], async (value)=>{
                if(!value.includes("$")) {
                    return value;
                }

                //Substitute any $VariableName with the value of the variable
                for(let match of value.matchAll(regex)) {
                    let search = match[0].trim();
                    let variableName = match[1];

                    let variableValue = await doLookup(context, variableName);

                    if(Action.DEBUG) {
                        console.log("Replaced variable:", search, variableValue);
                    }

                    if(value === search) {
                        //Single value, set it directly
                        value = variableValue;
                    } else {
                        //Replace into value
                        value = value.replace(search, variableValue);
                    }
                }

                return value;
            });
        }

        if(Action.DEBUG) {
            console.groupEnd();
        }

        VarvPerformance.stop("Action.lookupVariables", mark, {context, options});

        //Handle special stuff here
        Action.substituteEvery(optionsClone, "calculate", (value)=>{
            return CalculateAction.evaluate(value);
        });

        return optionsClone;
    }

    static substituteEvery(input, nameToSubstitute, callback) {
        if(Array.isArray(input)) {
            for(let i = 0; i< input.length; i++) {
                input[i] = Action.substituteEvery(input[i], nameToSubstitute, callback);
            }
        } else if(typeof input === "object") {
            for(let key in input) {
                if(input.hasOwnProperty(key)) {
                    if(key === nameToSubstitute) {
                        if(Object.keys(input).length > 1) {
                            console.warn("Substituting on something with more than 1 entry (Stuff will be lost):", input, nameToSubstitute);
                        }

                        let origValue = input[key];
                        return callback(origValue);
                    } else {
                        input[key] = Action.substituteEvery(input[key], nameToSubstitute, callback);
                    }
                }
            }
        }

        return input;
    }

    /**
     * Registers the given action as a primitive action with the given name
     * @param {string} name
     * @param {Action} action
     */
    static registerPrimitiveAction(name, action) {
        if(Action.DEBUG) {
            console.log("Registering primitive action:", name, action);
        }

        if (Action.primitiveActions.has(name)) {
            console.warn("Overriding primitive action: ", name);
        }

        Action.primitiveActions.set(name, action);
    }

    /**
     * Gets an instance of the primitive action with the given name, using the given options
     * @param {string} name
     * @param {object} options
     * @returns {Action}
     */
    static getPrimitiveAction(name, options, concept) {
        let actionClass = Action.primitiveActions.get(name);

        if (actionClass == null) {
            throw new Error("Unknown primitive action [" + name + "]");
        }

        let action = new actionClass(name, options, concept);

        action.isPrimitive = true;

        return action;
    }

    /**
     * Checks if a primitive action with the given name exists
     * @param {string} name
     * @returns {boolean}
     */
    static hasPrimitiveAction(name) {
        return Action.primitiveActions.has(name);
    }

    /**
     * Clones the given context. (Any non JSON serializable values in the context, will be lost)
     * @param {VarvContext} context
     * @returns {VarvContext} - The cloned context
     */
    static cloneContext(context) {
        let mark = VarvPerformance.start();

        let result = null;
        if(Array.isArray(context)) {
            result = context.map(Action.cloneContextInternal);
        } else {
            result = Action.cloneContextInternal(context);
        }

        VarvPerformance.stop("Action.cloneContext", mark);

        return result;
    }

    static cloneContextInternal(context) {
        //Move over allowed properties
        let preCloneObject = {};
        preCloneObject.variables = context.variables;
        preCloneObject.target = context.target;

        if(Action.DEBUG) {
            console.log("Cloning context:", context, preCloneObject);
        }
        return Action.clone(preCloneObject);
    }
}
Action.DEBUG = false;
Action.primitiveActions = new Map();
window.Action = Action;

class ActionChain extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);

        this.actions = [];
    }

    addAction(action) {
        const self = this;

        if(Array.isArray(action)) {
            action.forEach((actionElm)=>{
                self.actions.push(actionElm);
            })
        } else {
            this.actions.push(action);
        }
    }

    async apply(contexts, actionArguments = {}) {
        let currentContexts = contexts;

        for (let action of this.actions) {
            let commonVariablesBefore = Action.getCommonVariables(currentContexts);

            await ActionTrigger.before(action, currentContexts);
            let mark = VarvPerformance.start();
            currentContexts = await action.apply(currentContexts, actionArguments);
            if(action.isPrimitive) {
                VarvPerformance.stop("PrimitiveAction-"+action.name, mark);
            } else {
                VarvPerformance.stop("CustomAction-"+action.name, mark);
            }
            await ActionTrigger.after(action, currentContexts);

            if(currentContexts == null) {
                currentContexts = [];
            }

            if(currentContexts.length === 0) {
                currentContexts.savedVariables = commonVariablesBefore;
            }
        }

        return currentContexts;
    }
}

window.ActionChain = ActionChain;

class LookupActionAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        const self = this;

        let optionsWithArguments = await Action.lookupArguments(this.options, actionArguments);

        if(optionsWithArguments.lookupActionName == null) {
            throw new Error("[LookupActionAction] Missing option 'lookupActionName'");
        }

        //TODO: We assume that all concepts are of the same type, when/if polymorphism is introduced this breaks
        let contextConcept = null;
        if(contexts.length > 0) {
            contextConcept = await VarvEngine.getConceptFromUUID(contexts[0].target);
        }

        let action = VarvEngine.lookupAction(optionsWithArguments.lookupActionName, [contextConcept, self.concept], optionsWithArguments.lookupActionArguments);

        if(action != null) {
            await ActionTrigger.before(action, contexts);
            let mark = VarvPerformance.start();
            let lookupActionResult = await action.apply(contexts, action.isPrimitive?{}:optionsWithArguments.lookupActionArguments);
            if(action.isPrimitive) {
                VarvPerformance.stop("PrimitiveAction-"+action.name, mark);
            } else {
                VarvPerformance.stop("CustomAction-"+action.name, mark);
            }
            await ActionTrigger.after(action, lookupActionResult);
            return lookupActionResult;
        }

        return null;
    }
}

window.LookupActionAction = LookupActionAction;

class StopError extends Error {
    constructor(msg) {
        super(msg);
    }
}
window.StopError = StopError;
