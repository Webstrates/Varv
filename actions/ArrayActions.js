/**
 *  ArrayActions - Actions related to array functionallity
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
 * Actions that deal with arrays
 * @namespace ArrayActions
 */

/**
 * Action "length" that can put the length of an array or string into a variable
 * @memberOf ArrayActions
 * @example
 * // Find the length of a property (array or string)
 * {
 *     "length": {
 *         "of": {"property": "myArrayOrStringProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Find the length of a property (array or string), on a non selected property
 * {
 *     "length": {
 *         "of": {"property": "myConcept.myArrayOrStringProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Find the length of a variable (array or string)
 * {
 *     "length": {
 *         "of": {"variable": "myArrayOrStringVariable"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Shorthand, set the variable "length" to the length of the property "myProperty"
 * {
 *     "length": "myProperty"
 * }
 *
 * @example
 * // Shorthand, set the variable "length" to the length of the variable "myVariable"
 * {
 *     "length": "$myVariable"
 * }
 */
class LengthAction extends Action {
    static options() {
        return {
            "of": "enumValue[property,variable]",
            "as": "@string"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {

            if(options.trim().startsWith("$")) {
                //Shorthand lookup variable
                options = {
                    of: {
                        variable: options.trim().substring(1)
                    }
                }
            } else {
                options = {
                    of: {
                        property: options
                    }
                }
            }
        }

        super(name, options, concept);

        if(this.options.of == null) {
            if(this.options.property != null) {
                this.options.of = {
                    property: this.options.property
                }

                delete this.options.property;
            } else if(this.options.variable != null) {
                this.options.of = {
                    variable: this.options.variable
                }

                delete this.options.variable;
            }
        }
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.of == null) {
            throw new Error("Missing option 'of' on length action");
        }

        if(this.options.of.property == null && this.options.of.variable == null) {
            throw new Error("Missing option 'of.property' or 'of.variable' on length action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let variableName = Action.defaultVariableName(self);

            if(options.as != null) {
                variableName = options.as;
            }

            if(options.of.property != null) {
                // Length of property

                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array" && property.type !== "string") {
                    throw new Error("Unable to get length of non array|string type property ["+property.name+"] on ["+concept.name+"]");
                }

                let value = await property.getValue(target);

                Action.setVariable(context, variableName, value.length);
            } else if(options.of.variable != null) {
                // Length of variable
                const variableValue = Action.getVariable(context, options.of.variable);

                if(!Array.isArray(variableValue) && typeof variableValue !== "string") {
                    throw new Error("Variable ["+options.of.variable+"] was not of type array or string!");
                }

                Action.setVariable(context, variableName, variableValue.length);
            }

            return context;
        });
    }
}
Action.registerPrimitiveAction("length", LengthAction);
window.LengthAction = LengthAction;

class AppendPrependAction extends Action {
    constructor(name, options, concept, prepend = false) {
        super(name, options, concept);

        if(this.options.to == null) {
            if(this.options.property != null) {
                this.options.to = {
                    property: this.options.property
                }

                delete this.options.property;
            } else if(this.options.variable != null) {
                this.options.to = {
                    variable: this.options.variable
                }

                delete this.options.variable;
            }
        }

        this.prepend = prepend;
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.to == null) {
            throw new Error("Missing option 'to' on "+(this.prepend?"prepend":"append")+" action");
        }

        if(this.options.to.property == null && this.options.to.variable == null) {
            throw new Error("Missing option 'to.property' or 'to.variable' on "+(this.prepend?"prepend":"append")+" action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options) =>{
            let items = [];

            if(options.item != null) {
                items.push(options.item);
            } else if(options.items != null) {
                items.push(...options.items);
            } else {
                throw new Error("Missing 'item' or 'items' option on Append/Prepend action.");
            }

            if(options.to.property != null) {
                // Append to property array

                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.to.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Unable to "+(this.prepend?"prepend":"append")+" to non array type property ["+property.name+"] on ["+concept.name+"]");
                }

                let value = await property.getValue(target);

                if(self.prepend) {
                    items.reverse().forEach((item)=>{
                        value.unshift(item);
                    });
                } else {
                    items.forEach((item)=>{
                        value.push(item);
                    });
                }

                await property.setValue(target, value);
            } else if(options.to.variable != null) {
                // Append to variable array
                let array = Action.getVariable(context, options.to.variable);

                if(self.prepend) {
                    items.reverse().forEach((item)=>{
                        array.unshift(item);
                    });
                } else {
                    items.forEach((item)=>{
                        array.push(item);
                    });
                }
            }

            return context;
        });
    }
}

/**
 * An action "append" that can append an 'item' or a number of 'items' to an array, the array can be from either a property or a variable
 * @memberOf ArrayActions
 * @example
 * // Append a string item to an array inside a property
 * {
 *     "append": {
 *         "to": {"property": "myStringArrayProperty"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Append a string item to an array inside a property, on a non selected concept
 * {
 *     "append": {
 *         "to": {"property": "myConcept.myStringArrayProperty"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Append a string item to an array inside a variable
 * {
 *     "append": {
 *         "to": {"variable": "myStringArrayVariable"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Append a number of string items to an array inside a variable
 * {
 *     "append": {
 *         "to": {"variable": "myStringArrayVariable"},
 *         "items": ["myStringItem1", "myStringItem2"]
 *     }
 * }
 */
class AppendAction extends AppendPrependAction {
    static options() {
        return {
            "to": "enumValue[property,variable]",
            "item": "raw"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept, false);
    }
}
Action.registerPrimitiveAction("append", AppendAction)
window.AppendAction = AppendAction;

/**
 * An action "prepend" that can prepend an 'item' or a number of 'items' to an array, the array can be from either a property or a variable
 * @memberOf ArrayActions
 * @example
 * // Prepend a string item to an array inside a property
 * {
 *     "prepend": {
 *         "to": {"property": "myStringArrayProperty"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Prepend a string item to an array inside a property, on a non selected concept
 * {
 *     "prepend": {
 *         "to": {"property": "myConcept.myStringArrayProperty"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Prepend a string item to an array inside a variable
 * {
 *     "prepend": {
 *         "to": {"variable": "myStringArrayVariable"},
 *         "item": "myStringItem"
 *     }
 * }
 *
 * @example
 * // Prepend a number of string items to an array inside a variable
 * {
 *     "prepend": {
 *         "to": {"variable": "myStringArrayVariable"},
 *         "items": ["myStringItem1", "myStringItem2"]
 *     }
 * }
 */
class PrependAction extends AppendPrependAction {
    static options() {
        return {
            "to": "enumValue[property,variable]",
            "item": "raw"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept, true);
    }
}
Action.registerPrimitiveAction("prepend", PrependAction)
window.PrependAction = PrependAction;

/**
 * An action "insert" that inserts an 'item' or 'items' into an array property or variable, at a given index.
 * @memberOf ArrayActions
 * @example
 * {
 *      /Insert "myNewItem" at index 2, in the array at myArrayProperty
 *     "insert": {
 *         "to": {"property": "myArrayProperty"},
 *         "index": 2,
 *         "item": "myNewItem"
 *     }
 * }
 *
 * @example
 * {
 *      /Insert "myNewItem" at index 2, in the array at myVariableArray
 *     "insert": {
 *         "to": {"variable": "myVariableArray"},
 *         "index": 2,
 *         "item": "myNewItem"
 *     }
 * }
 *
 * @example
 * {
 *      /Insert multiple items at index 3, in the array at myVariableArray
 *     "insert": {
 *         "to": {"variable": "myVariableArray"},
 *         "index": 3,
 *         "items": ["myNewItem", "mySecondNewItem"]
 *     }
 * }
 */
class InsertAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);

        if(this.options.to == null) {
            if(this.options.property != null) {
                this.options.to = {
                    property: this.options.property
                }

                delete this.options.property;
            } else if(this.options.variable != null) {
                this.options.to = {
                    variable: this.options.variable
                }

                delete this.options.variable;
            }
        }
    }

    async apply(contexts, actionArguments = {}) {
        if(this.options.to == null) {
            throw new Error("Missing option 'to' on "+(this.prepend?"prepend":"append")+" action");
        }

        if(this.options.index == null) {
            throw new Error("Missing option 'index' on insert action");
        }

        if(this.options.to.property == null && this.options.to.variable == null) {
            throw new Error("Missing option 'to.property' or 'to.variable' on "+(this.prepend?"prepend":"append")+" action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.index < 0) {
                throw new Error("Option 'index' can not be less than 0: "+options.index);
            }

            let array = null;
            let arrayPropertyTarget = null;
            let arrayProperty = null;

            if(options.to.property != null) {
                // Append to property array

                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.to.property);

                if (lookup == null) {
                    throw new Error("No property [" + options.of.property + "] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if (property.type !== "array") {
                    throw new Error("Unable to " + (this.prepend ? "prepend" : "append") + " to non array type property [" + property.name + "] on [" + concept.name + "]");
                }

                arrayPropertyTarget = target;
                arrayProperty = property;

                array = await property.getValue(target);
            } else if(options.to.variable != null) {
                array = Action.getVariable(context, options.to.variable);
            }

            if(array == null) {
                throw new Error("Unable to find array: "+JSON.stringify(options, null, 2)+" in 'insert'");
            }

            if(options.index > array.length) {
                throw new Error("Option 'index' can not be more than array length: "+array.length);
            }

            let items = [];

            if(options.item != null) {
                items.push(options.item);
            } else if(options.items != null) {
                items.push(...options.items);
            } else {
                throw new Error("Missing option either 'item' or 'items' on insert action");
            }

            items.reverse().forEach((item)=>{
                array.splice(options.index, 0, item);
            });

            if(arrayProperty != null) {
                //If property, remember to set it
                await arrayProperty.setValue(arrayPropertyTarget, array);
            }

            return context;
        });
    }
}
Action.registerPrimitiveAction("insert", InsertAction)
window.InsertAction = InsertAction;

class RemoveFirstLastAction extends Action {
    constructor(name, options, concept, removeFirst = false) {

        //Shorthand { "remove-first": "propertyName" }
        if(typeof options === "string") {
            if(options.trim().startsWith("$")) {
                options = {
                    "of": {
                        "variable": options.trim().substring(1)
                    }
                }
            } else {
                options = {
                    "of": {
                        "property": options
                    }
                }
            }
        }

        super(name, options, concept);

        if(this.options.of == null) {
            if(this.options.property != null) {
                this.options.of = {
                    property: this.options.property
                }

                delete this.options.property;
            } else if(this.options.variable != null) {
                this.options.of = {
                    variable: this.options.variable
                }

                delete this.options.variable;
            }
        }

        this.removeFirst = removeFirst;
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.of == null) {
            throw new Error("Missing option 'of' on "+(this.removeFirst?"remove-first":"remove-last")+" action");
        }

        if(this.options.of.property == null && this.options.of.variable == null) {
            throw new Error("Missing option 'of.property' or 'of.variable' on "+(this.removeFirst?"remove-first":"remove-last")+" action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let variableName = Action.defaultVariableName(self);

            if(options.as != null) {
                variableName = options.as;
            }

            if(options.of.property != null) {
                // remove of property

                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Unable to "+(this.removeFirst?"remove-first":"remove-last")+" of non array type property ["+property.name+"] on ["+concept.name+"]");
                }

                let value = await property.getValue(target);

                let result = null;

                if(self.removeFirst) {
                    result = value.shift();
                } else {
                    result = value.pop();
                }

                // Set back the changed array
                await property.setValue(target, value);

                // Set result variable
                Action.setVariable(context, variableName, result);
            } else if(options.of.variable != null) {
                // remove of variable
                const variableValue = Action.getVariable(context, options.of.variable);

                if(!Array.isArray(variableValue)) {
                    throw new Error("Variable ["+options.of.variable+"] was not of type array!");
                }

                let result = null;

                if(self.removeFirst) {
                    result = variableValue.shift();
                } else {
                    result = variableValue.pop();
                }

                // Set back the changed array
                Action.setVariable(context, options.of.variable, variableValue);

                // Set the result variable
                Action.setVariable(context, variableName, result);
            }

            return context;
        });
    }
}

/**
 * An action "removeFirst" that can remove the first item of an array, and set a variable to the removed item
 * @memberOf ArrayActions
 * @example
 * // Remove the first item from an array property
 * {
 *     "removeFirst": {
 *         "of": {"property": "myArrayProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Remove the first item from an array property, on a non selected concept
 * {
 *     "removeFirst": {
 *         "of": {"property": "myConcept.myArrayProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Remove the first item from an array property, shorthand notation, result will be in variable named "removeFirst"
 * {
 *     "removeFirst": "myArrayProperty"
 * }
 *
 * @example
 * // Remove the first item from an array variable
 * {
 *     "removeFirst": {
 *         "of": {"variable": "myArrayVariable"},
 *         "as": "myResultVariableName"
 *     }
 * }
 */
class RemoveFirstAction extends RemoveFirstLastAction {
    static options() {
        return {
            "of": "enumValue[property,variable]",
            "as": "@string"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept, true);
    }
}
Action.registerPrimitiveAction("removeFirst", RemoveFirstAction);
window.RemoveFirstAction = RemoveFirstAction;

/**
 * An action "removeLast" that can remove the last item of an array, and set a variable to the removed item
 * @memberOf ArrayActions
 * @example
 * // Remove the last item from an array property
 * {
 *     "removeLast": {
 *         "of": {"property": "myArrayProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Remove the last item from an array property, on a non selected concept
 * {
 *     "removeLast": {
 *         "of": {"property": "myConcept.myArrayProperty"},
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * // Remove the last item from an array property, shorthand notation, result will be in variable named "removeLast"
 * {
 *     "removeLast": "myArrayProperty"
 * }
 *
 * @example
 * // Remove the last item from an array variable
 * {
 *     "removeLast": {
 *         "of": {"variable": "myArrayVariable"},
 *         "as": "myResultVariableName"
 *     }
 * }
 */
class RemoveLastAction extends RemoveFirstLastAction {
    static options() {
        return {
            "of": "enumValue[property,variable]",
            "as": "@string"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept, false);
    }
}
Action.registerPrimitiveAction("removeLast", RemoveLastAction);
window.RemoveLastAction = RemoveLastAction;

/**
 * An action "removeItem" that can remove 1 or X items from a given index in an array, the array can be in either a property or a variable
 *
 * If removeCount is 1, then the result will be just the item removed, if its > 1, then the result will be an array of the removed items
 * @memberOf ArrayActions
 * @example
 * //Remove 1 items starting from index 1 of an array property
 * {
 *     "removeItem": {
 *         "of": { "property": "myArrayProperty" },
 *         "index": 1,
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * //Remove 2 items starting from index 1 of an array property
 * {
 *     "removeItem": {
 *         "of": { "property": "myArrayProperty" },
 *         "index": 1,
 *         "removeCount": 2,
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * //Remove 2 items starting from index 1 af an array variable
 * {
 *     "removeItem": {
 *         "of": { "variable": "myArrayVariable" },
 *         "index": 1,
 *         "removeCount": 2,
 *         "as": "myResultVariableName"
 *     }
 * }
 */
class RemoveItemAction extends Action {
    static options() {
        return {
            "of": "enumValue[property,variable]",
            "index": "number",
            "removeCount": "@number",
            "as": "@string"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept);

        if(this.options.of == null) {
            if(this.options.property != null) {
                this.options.of = {
                    property: this.options.property
                }

                delete this.options.property;
            } else if(this.options.variable != null) {
                this.options.of = {
                    variable: this.options.variable
                }

                delete this.options.variable;
            }
        }
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.of == null) {
            throw new Error("Missing option 'of' on removeItem action");
        }

        if(this.options.of.property == null && this.options.of.variable == null) {
            throw new Error("Missing option 'of.property' or 'of.variable' on removeItem action");
        }

        if(this.options.index == null && this.options.item == null) {
            throw new Error("Missing option either 'index' or 'item' on removeItem action");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let variableName = Action.defaultVariableName(self);

            if(options.as != null) {
                variableName = options.as;
            }

            let removeCount = 1;

            if(options.removeCount != null) {
                removeCount = options.removeCount;
            }

            if(options.of.property != null) {
                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Unable to removeItem of non array type property ["+property.name+"] on ["+concept.name+"]");
                }

                let value = await property.getValue(target);

                let index = 0;

                if(options.index != null) {
                    index = options.index;
                } else if(options.item != null) {
                    index = value.indexOf(options.item);
                }

                let result = value.splice(index, removeCount);

                if(result.length === 1) {
                    result = result[0];
                }

                await property.setValue(target, value);

                Action.setVariable(context, variableName, result);
            } else if(options.of.variable != null) {
                let value = Action.getVariable(context, options.of.variable);

                let index = 0;

                if(options.index != null) {
                    index = options.index;
                } else if(options.item != null) {
                    index = value.indexOf(options.item);
                }

                let result = value.splice(index, removeCount);

                if(result.length === 1) {
                    result = result[0];
                }

                Action.setVariable(context, variableName, result);
            }

            return context;
        });
    }
}
Action.registerPrimitiveAction("removeItem", RemoveItemAction);
window.RemoveItemAction = RemoveItemAction;

/**
 * An action 'items' that extracts an array property or variable into another variable, optionally applying filtering
 * @memberOf ArrayActions
 * @example
 * //Shorthand, returns result into variable 'items' and applies no filtering
 * {
 *     "items": "myArrayProperty"
 * }
 *
 * @example
 * //Shorthand, returns result into variable 'items' and applies no filtering
 * {
 *     "items": "$myArrayVariable"
 * }
 *
 * @example
 * //Property example
 * {
 *     "items:" {
 *         "property": "myArrayProperty",
 *         "as": "myResultVariableName",
 *         "where": {
 *             "equals": "my-specific-value"
 *         }
 *     }
 * }
 *
 * //Property example, on non selected concept
 * {
 *     "items:" {
 *         "property": "myConcept.myArrayProperty",
 *         "as": "myResultVariableName",
 *         "where": {
 *             "equals": "my-specific-value"
 *         }
 *     }
 * }
 *
 * @example
 * //Variable example
 * {
 *     "items:" {
 *         "variable": "myArrayVariableName",
 *         "as": "myResultVariableName",
 *         "where": {
 *             "equals": "my-specific-value"
 *         }
 *     }
 * }
 */
class ItemsAction extends Action {
    static options() {
        return {
            "$items": "enumValue[property,variable]",
            "as": "@string",
            "where": "filter"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {
            if(options.trim().startsWith("$")) {
                options = {
                    variable: options.trim().substring(1)
                }
            } else {
                options = {
                    property: options
                }
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.property == null && options.variable == null) {
                throw new Error("Action 'items' must have either option 'property' or 'variable'");
            }

            let resultName = Action.defaultVariableName(self);

            if(options.as != null) {
                resultName = options.as;
            }

            let result = null;

            if(options.property != null) {
                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Property ["+options.property+"] of ["+concept.name+"] is not an array");
                }

                result = await property.getValue(target);
            } else if(options.variable != null) {
                result = Action.getVariable(context, options.variable);

                if(!Array.isArray(result)) {
                    throw new Error("Variable ["+options.variable+"] did not contain an array!");
                }
            }

            if(options.where != null) {
                let filteredResult = [];

                let filter = FilterAction.constructFilter(options.where, true);

                for(let v of result) {
                    //TODO: Might backfire if an array of strings contains the string equal to a concept?
                    let concept = await VarvEngine.getConceptFromUUID(v);
                    if(concept != null) {
                        v = {
                            target: v
                        }
                    }

                    if(await filter.filter(v)) {
                        if(v.target != null) {
                            v = v.target;
                        }
                        filteredResult.push(v);
                    }
                }

                result = filteredResult;
            }

            Action.setVariable(context, resultName, result);

            return context;
        });
    }
}
Action.registerPrimitiveAction("items", ItemsAction);
window.ItemsAction = ItemsAction;

/**
 * An action 'join' that joins an array into a string and saves it in a variable, default separator: ","
 * @memberOf ArrayActions
 * @example
 * {
 *     "join": {
 *         "property": "myProperty",
 *         "separator": ","
 *     }
 * }
 *
 * @example
 * {
 *     "join": {
 *         "variable": "myProperty",
 *         "separator": ","
 *     }
 * }
 *
 * @example
 * //Shorthand, joins the array in property "myArrayProperty" into a string
 * {
 *     "join": "myArrayProperty"
 * }
 *
 * @example
 * //Shorthand, joins the array in variable "myArrayVariable" into a string
 * {
 *     "join": "$myArrayVariable"
 * }
 */
class JoinAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            if(options.trim().startsWith("$")) {
                options = {
                    of: {
                        variable: options.trim().substring(1)
                    }
                }
            } else {
                options = {
                    of: {
                        property: options
                    }
                }
            }
        }

        if(options.property != null) {
            options.of = {
                property: options.property
            }

            delete options.property;
        }

        if(options.variable != null) {
            options.of = {
                variable: options.variable
            }

            delete options.variable;
        }

        const defaultOptions = {
            "separator": ","
        }

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments = {}) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{

            let result = null;

            let inputArray = null;

            if(options?.of.property != null) {
                let lookup = VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Property ["+options.of.property+"] of ["+concept.name+"] is not an array");
                }

                inputArray = property.getValue(target);

            } else if(options?.of.variable != null) {
                inputArray = Action.getVariable(context, options.of.variable);
            } else {
                throw new Error("'join' requires either option 'of.property' or option 'of.variable' to be present:"+JSON.stringify(options));
            }

            if(!Array.isArray(inputArray)) {
                throw new Error("Targeted variable or property, did not result in an array: "+JSON.stringify(options));
            }

            if(inputArray != null) {
                result = inputArray.join(options.separator);
            }

            let variableName = Action.defaultVariableName(self);
            if(options.as != null) {
                variableName = options.as;
            }

            Action.setVariable(context, variableName, result);

            return context;
        });
    }
}
window.JoinAction = JoinAction;
Action.registerPrimitiveAction("join", JoinAction);

/**
 * An action 'slice' that slices a string or an array.
 *
 * @memberOf ArrayActions
 *
 * @example
 * //Slices mySliceableProperty starting from 0, ending with 10, saving the result in "myResultVariable"
 * {
 *     "slice": {
 *         "of": {
 *             "property": "mySliceableProperty"
 *         },
 *         "start": 0,
 *         "end": 10,
 *         "as": "myResultVariable"
 *     }
 * }
 *
 * @example
 * //Shorthand: Slices the variable "mySliceableVariable", from 0 to end, which in practice, means its a copy of the whole thing
 * {
 *     "slice: "mySliceableVariable"
 * }
 */
class SliceAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            if(options.startsWith("$")) {
                options = {
                    "of": {
                        "variable": options.trim().substring(1)
                    }
                }
            } else {
                options = {
                    "of": {
                        "property": options
                    }
                }
            }
        }

        if(options.property != null) {
            options.of = {
                property: options.property
            }

            delete options.property;
        }

        if(options.variable != null) {
            options.of = {
                variable: options.variable
            }

            delete options.variable;
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        const self = this;
        return this.forEachContext(contexts, actionArguments, async (context, options)=> {
            let theThingToSlice = null;

            if(options.of == null) {
                throw new Error("'slice' requires option 'of' to be present:"+JSON.stringify(options));
            }

            if(options.of.variable != null) {
                //Handle variable
                theThingToSlice = Action.getVariable(context, options.of.variable);
            } else if(options.of.property != null) {
                //Handle property
                let lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;
                
                if(property.type !== "array") {
                    throw new Error("Property ["+options.property+"] of ["+concept.name+"] is not an array");
                }

                theThingToSlice = await property.getValue(target);
            } else {
                throw new Error("'slice' requires option 'of.variable' or 'of.property' to be present:"+JSON.stringify(options));
            }

            if(theThingToSlice == null) {
                throw new Error("'slice' the chosen array was null: "+JSON.stringify(options));
            }

            if(theThingToSlice.slice == null) {
                throw new Error("'slice' unable to slice on type: "+(typeof theThingToSlice));
            }

            let start = 0;
            let end = theThingToSlice.length;

            if(options.start != null) {
                start = options.start;
            }

            if(options.end != null) {
                end = options.end;
            }

            let result = theThingToSlice.slice(start, end);

            let variableName = Action.defaultVariableName(self);
            if(options.as != null) {
                variableName = options.as;
            }

            Action.setVariable(context, variableName, result);

            return context;
        });
    }
}
window.SliceAction = SliceAction;
Action.registerPrimitiveAction("slice", SliceAction);

/**
 * An action 'index' that finds the index of a given item in an array
 *
 * @example
 * //Lookup the item "myLookupItem" inside the array property "myArrayProperty", and save the resulting index in the variable "myResultVariableName"
 * {"index": {
 *     "of": {
 *         "property": "myArrayProperty"
 *     },
 *     "item": "myLookupItem",
 *     "as": "myResultVariableName"
 * }}
 *
 * @example
 * //Shorthand, lookup the "myLookupItem" inside the property array "myArrayProperty", and saves the index in the variable "index"
 * {"index": {"myArrayProperty": "myLookupItem"}}
 */
class IndexAction extends Action {
    constructor(name, options, concept) {
        //Handle {"index": {"$myVariable": "myItem"}} shorthand
        //Handle {"index": {"myProperty": "myItem"}} shorthand

        if(Object.keys(options).length === 1) {
            let key = Object.keys(options)[0];
            let value = options[key];

            if(key.startsWith("$")) {
                options = {
                    "of": {
                        "variable": key.substring(1)
                    },
                    "item": value
                }
            } else {
                options = {
                    "of": {
                        "property": key
                    },
                    "item": value
                }
            }
        }

        if(options.property != null) {
            options.of = {
                property: options.property
            }

            delete options.property;
        }

        if(options.variable != null) {
            options.of = {
                variable: options.variable
            }

            delete options.variable;
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        const self = this;
        return this.forEachContext(contexts, actionArguments, async (context, options) => {

            let theArray = null;

            if(options.of == null) {
                throw new Error("'index' requires option 'of' to be present:"+JSON.stringify(options));
            }

            if(options.item == null) {

            }

            if(options.of.variable != null) {
                //Handle variable
                theArray = Action.getVariable(context, options.of.variable);
            } else if(options.of.property != null) {
                //Handle property
                let lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.of.property);

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if(property.type !== "array") {
                    throw new Error("Property ["+options.property+"] of ["+concept.name+"] is not an array");
                }

                theArray = await property.getValue(target);
            } else {
                throw new Error("'index' requires option 'of.variable' or 'of.property' to be present:"+JSON.stringify(options));
            }

            if(theArray == null) {
                throw new Error("'index' the chosen array was null: "+JSON.stringify(options));
            }

            if(theArray.indexOf == null) {
                throw new Error("'index' unable to find index on type: "+(typeof theArray));
            }

            let index = theArray.indexOf(options.item);

            let variableName = Action.defaultVariableName(self);

            if(options.as != null) {
                variableName = options.as;
            }

            Action.setVariable(context, variableName, index);

            return context;
        });
    }
}
Action.registerPrimitiveAction("index", IndexAction);
window.IndexAction = IndexAction;
