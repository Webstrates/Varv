/**
 *  PropertyActions - Actions that manipulate properties on concept instances
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
 * Actions that operate on properties
 * @namespace PropertyActions
 */

/**
 * An action "set" that sets a property or variable to a given value
 * @memberOf PropertyActions
 * @example
 * //Set property to a given value
 * {
 *     "set": {
 *         "property": "myProperty",
 *         "value": "myValueToSet"
 *     }
 * }
 *
 * @example
 * //Set property to a given value (shorthand version)
 * {
 *     "set": {
 *         "myProperty": "myValueToSet"
 *     }
 * }
 *
 * @example
 * //Set variable to a given value (shorthand version)
 * {
 *     "set": {
 *         "$myVariableName": "myValueToSet"
 *     }
 * }
 *
 * @example
 * //Set a variable to a given value
 * {
 *     "set": {
 *         "variable": "myVariableName",
 *         "value": "myValueToSet"
 *     }
 * }
 *
 * @example
 * //Set a property on a currently non selected concept to a given value
 * {
 *     "set": {
 *         "property": "myConcept.myProperty",
 *         "value": "myValueToSet"
 *     }
 * }
 */
class SetAction extends Action {
    static options() {
        return {
            "$setType": "enumValue[property,variable]",
            "value": "raw"
        }
    }

    constructor(name, options, concept) {
        // Shorthand { "property-name": "value-to-set" }
        if(Object.keys(options).length === 1) {
            const key = Object.keys(options)[0];
            const value = options[key];

            if(key.trim().startsWith("$")) {
                options = {
                    variable: key.trim().substring(1),
                    value: value
                }
            } else {
                options = {
                    property: key,
                    value: value
                }
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        const mark = "action-set-start-"+performance.now();

        if(this.options.property == null && this.options.variable == null) {
            throw new Error("Missing option 'property' or 'variable' on 'set' action: "+JSON.stringify(this.options, null, 2));
        }

        if(this.options.value == null) {
            throw new Error("Missing option 'value' on 'set' action: "+JSON.stringify(this.options, null, 2));
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let mark = VarvPerformance.start();

            if(options.property) {
                let lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property [" + options.property + "] found on any concept");
                }

                await lookup.property.setValue(lookup.target, options.value);
            } else if(options.variable) {
                Action.setVariable(context, options.variable, options.value);
            }

            VarvPerformance.stop("SetAction.forEachContext.loop", mark);

            return context;
        });
    }
}
Action.registerPrimitiveAction("set", SetAction);
window.SetAction = SetAction;

/**
 * An action 'get' that extracts a property and saves it in a variable
 * @memberOf PropertyActions
 * @example
 * {
 *     "get": {
 *         "property": "myProperty",
 *         "as": "myVariableName"
 *     }
 * }
 *
 * @example
 * //Get a property on a currently non selected concept
 * {
 *     "get": {
 *         "property": "myConcept.myProperty",
 *         "as": "myVariableName"
 *     }
 * }
 *
 * @example
 * //Shorthand example that gets the given property and sets it into variable 'get'
 * {
 *     "get": "myProperty"
 * }
 */
class GetAction extends Action {
    static options() {
        return {
            "property": "string",
            "as": "@string"
        }
    }
    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {
            options = {
                property: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.property == null) {
                throw new Error("Missing option 'property' on 'get' action");
            }

            let lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

            if(lookup == null) {
                throw new Error("Unable to find property: "+options.property);
            }

            let value = await lookup.property.getValue(lookup.target);

            let resultName = Action.defaultVariableName(self);
            if(options.as != null) {
                resultName = options.as;
            }

            Action.setVariable(context, resultName, value);

            return context;
        });
    }
}
Action.registerPrimitiveAction("get", GetAction);
window.GetAction = GetAction;

/**
 * An action "toggle" that toggles a boolean property or variable
 * @memberOf PropertyActions
 * @example
 * //Toggle a boolean property
 * {
 *     "toggle": {
 *         "property": "myBooleanProperty"
 *     }
 * }
 *
 * @example
 * //Toggle a boolean property on a non selected concept
 * {
 *     "toggle": {
 *         "property": "myConcept.myBooleanProperty"
 *     }
 * }
 *
 * @example
 * //Toggle a boolean property (shorthand version)
 * {
 *     "toggle": "myBooleanProperty"
 * }
 *
 * @example
 * //Toggle a boolean variable (shorthand version)
 * {
 *     "toggle": "$myBooleanVariable"
 * }
 *
 * @example
 * //Toggle a boolean variable
 * {
 *     "toggle": {
 *         "variable": "myBooleanVariable"
 *     }
 * }
 */
class ToggleAction extends Action {
    static options() {
        return {
            "$setType": "enumValue[property,variable]"
        }
    }
    constructor(name, options, concept) {
        // Shorthand "toggle": "property-to-toggle"
        if(typeof options === "string") {
            if(options.trim().startsWith("$")) {
                options = {
                    variable: options.trim().substring(1),
                }
            } else {
                options = {
                    property: options,
                }
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.property == null && this.options.variable == null) {
            throw new Error("Either 'property' or 'variable' must be set for 'toggle' action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options) => {
            if(options.property != null) {
                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if (property.type !== "boolean") {
                    throw new Error("Unable to toggle non boolean property [" + options.property + "] on [" + concept.name + "]");
                }

                let currentValue = await property.getValue(target);

                await property.setValue(target, !currentValue);
            } else if(options.variable != null) {
                let currentValue = Action.getVariable(context, options.variable);

                if(typeof currentValue !== "boolean") {
                    throw new Error("Unable to toggle non boolean variable ["+options.variable+"]");
                }

                Action.setVariable(context, options.variable, !currentValue);
            }

            return context;
        });
    }
}
Action.registerPrimitiveAction("toggle", ToggleAction);
window.ToggleAction = ToggleAction;

/**
 * An action 'enums' that sets a variable to all possible values of an enum string type.
 * @memberOf PropertyActions
 * @example
 * //Fetch all enum values for myEnumProperty and save in variable $enum
 * {
 *     "enums": {
 *         "property": "myEnumProperty"
 *     }
 * }
 *
 * @example
 * //Fetch all enum values for myEnumProperty and save in variable $myVariableName
 * {
 *     "enums": {
 *         "property": "myEnumProperty",
 *         "as": "myVariableName"
 *     }
 * }
 *
 * @example
 * //Non selected concept version
 * {
 *     "enums": {
 *         "property": "myConcept.myEnumProperty"
 *     }
 * }
 *
 * @example
 * //Shorthand version
 * {
 *     "enums": "myEnumProperty"
 * }
 */
class EnumsAction extends Action {
    static options() {
        return {
            "property": "string",
            "as": "@string"
        }
    }
    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {
            options = {
                property: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.property == null) {
                throw new Error("Missing required option 'property' for 'enums' action");
            }

            if(context.target == null) {
                throw new Error("Missing 'target' option for 'enums' action")
            }

            const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

            if(lookup == null) {
                throw new Error("No property ["+options.of.property+"] found");
            }

            const property = lookup.property;

            if(property.options.enum == null || property.type !== "string") {
                throw new Error("["+options.property+"] is not an enumerable string type");
            }

            let resultName = Action.defaultVariableName(self);

            if(options.as != null) {
                resultName = options.as;
            }

            Action.setVariable(context, resultName, property.options.enum.slice());

            return context;
        });
    }
}
Action.registerPrimitiveAction("enums", EnumsAction);
window.EnumsAction = EnumsAction;
