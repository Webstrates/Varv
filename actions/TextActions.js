/**
 *  TextActions - Actions related to string manipulation
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
 * Actions that operate on strings
 * @namespace TextActions
 */

/**
 * An action "textTransform" that can transform a string to either "uppercase", "lowercase", "capitalize"
 * @memberOf TextActions
 * @example
 * // Uppercase a string in a property
 * {
 *     "textTransform": {
 *         "property": "myStringProperty",
 *         "mode": "uppercase"
 *     }
 * }
 *
 * // Capitalize a string in a variable
 * {
 *     "textTransform": {
 *         "variable": "myStringVariable",
 *         "mode": "capitalize"
 *     }
 * }
 */
class TextTransformAction extends Action {
    static options() {
        return {
            "$transform": "enumValue[property,variable]",
            "mode": "enum[uppercase,lowercase,capitalize]"
        }
    }
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        if(this.options.property == null && this.options.variable == null) {
            throw new Error("Either 'property' or 'variable' must be set for action 'textTransform'");
        }

        if(this.options.mode == null) {
            throw new Error("Missing option 'mode' for action 'textTransform'");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.property != null) {
                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if (property.type !== "string") {
                    throw new Error("Unable to apply textTransform on non string property [" + options.property + "] on [" + concept.name + "]");
                }

                let currentValue = await property.getValue(target);

                currentValue = self.transform(currentValue, options.mode.toLowerCase());

                await property.setValue(target, currentValue);
            } else if(options.variable != null) {
                let value = Action.getVariable(context, options.variable);

                if (typeof value !== "string") {
                    throw new Error("Unable to apply textTransform on non string variable [" + options.variable + "]");
                }

                value = self.transform(value, options.mode.toLowerCase());

                Action.setVariable(context, options.variable, value);
            }

            return context;
        });
    }

    transform(value, mode) {
        switch (mode) {
            case "uppercase": {
                value = value.toUpperCase();
                break;
            }
            case "lowercase": {
                value = value.toLowerCase();
                break;
            }
            case "capitalize": {
                const words = value.toLowerCase().split(" ");
                for (let i = 0; i < words.length; i++) {
                    words[i] = words[i].charAt(0).toUpperCase() + words[i].substring(1);
                }
                value = words.join(" ");
                break;
            }

            default:
                throw new Error("Unknown text transform mode: " + mode);
        }

        return value;
    }
}
Action.registerPrimitiveAction("textTransform", TextTransformAction);
window.TextTransformAction = TextTransformAction;

/**
 * An action "concat" that concatenates an array of strings and saves the result in a variable
 * @memberOf TextActions
 * @example
 * {
 *     "concat": [
 *         "Hello",
 *         " ",
 *         "World!"
 *     ]
 * }
 *
 * @example
 * {
 *     "concat": {
 *          "strings": [
 *              "How",
 *              "dy!"
 *          ],
 *          "as": "myResultVariable"
 *     }
 * }
 *
 * @example
 * {
 *     "concat": {
 *          "strings": [
 *              "Hello, ",
 *              "$myStringVariable",
 *              " doing?"
 *          ],
 *          "as": "myResultVariable"
 *     }
 * }
 *
 * @example
 * {
 *     "concat": {
 *          "strings": "$myStringArrayVariable",
 *          "as": "myResultVariable"
 *     }
 * }
 *
 * @example
 * {
 *     "concat": {
 *          "strings": [
 *              "Variable: "
 *              {"variable": "myStringVariable"},
 *              " Property: ",
 *              {"property": "myStringProperty"}
 *          ],
 *          "as": "myResultVariable"
 *     }
 * }
 */
class ConcatAction extends Action {
    constructor(name, options, concept) {
        //Shorthand
        if(Array.isArray(options) || typeof options === "string") {
            options = {
                strings: options
            }
        }

        if(typeof options.strings === "string") {
            options.strings = [options.strings];
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let resultName = Action.defaultVariableName(self);

            if(options.as != null) {
                resultName = options.as;
            }

            if(!Array.isArray(options.strings)) {
                throw new Error("Option 'strings' must be an array of strings");
            }

            let result = "";

            for(let s of options.strings) {
                if(typeof s === "object") {
                    if(s.variable != null) {
                        s = Action.getVariable(context, s.variable);
                    } else if(s.property != null) {
                        const lookup = await VarvEngine.lookupProperty(context.target, self.concept, s.property);

                        if(lookup == null) {
                            throw new Error("No property ["+options.of.property+"] found");
                        }

                        const concept = lookup.concept;
                        const property = lookup.property;
                        const target = lookup.target;

                        s = await property.getValue(target);
                    } else {
                        throw new Error("Unknown object type in concat strings array: "+JSON.stringify(s, null ,2));
                    }
                }

                result += s;
            }

            Action.setVariable(context, resultName, result);

            return context;
        });
    }
}
Action.registerPrimitiveAction("concat", ConcatAction);
window.ConcatAction = ConcatAction;

/**
 * An action 'split' that splits a String into an array, based on the given delimiter. Default delimiter is ","
 * @memberOf TextActions
 * @example
 * //Split the string in "myStringProperty" at the delimiter ";" and save the result in the variable "myArrayVariable"
 * {
 *     "split": {
 *         "property": "myStringProperty",
 *         "delimiter": ";",
 *         "as": "myArrayVariable"
 *     }
 * }
 *
 * @example
 * //Split the string in "myStringVariable" at the delimiter ";" and save the result in the variable "myArrayVariable"
 * {
 *     "split": {
 *         "variable": "myStringVariable",
 *         "delimiter": ";",
 *         "as": "myArrayVariable"
 *     }
 * }
 *
 * @example
 * //Shorthand example, splitting property using delimiter "," and saving result in variable "split"
 * {
 *     "split": "myStringProperty"
 * }
 *
 * @example
 * //Shorthand example, splitting variable using delimiter "," and saving result in variable "split"
 * {
 *     "split": "$myStringVariable"
 * }
 */
class TextSplitAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            if(options.startsWith("$")) {
                options = {
                    "variable": options
                }
            } else {
                options = {
                    "property": options
                }
            }
        }

        const defaultOptions = {
            delimiter: ","
        }

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments = {}) {
        const self = this;

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let result = null;

            if(options.property != null) {
                const lookup = await VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                if (property.type !== "string") {
                    throw new Error("Unable to apply split on non string property [" + options.property + "] on [" + concept.name + "]");
                }

                let currentValue = await property.getValue(target);

                result = currentValue.split(options.delimiter);

            } else if(options.variable != null) {
                let value = Action.getVariable(context, options.variable);

                if (typeof value !== "string") {
                    throw new Error("Unable to apply textTransform on non string variable [" + options.variable + "]");
                }

                result = value.split(options.delimiter);
            }

            if(result != null) {
                let resultName = Action.defaultVariableName(self);

                if (options.as != null) {
                    resultName = options.as;
                }

                Action.setVariable(context, resultName, result);
            }

            return context;
        });
    }
}
window.TextSplitAction = TextSplitAction;
Action.registerPrimitiveAction("split", TextSplitAction);
