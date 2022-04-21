/**
 *  MathActions - Actions that calculate math
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

class IncrementDecrementAction extends Action {
    constructor(name, decrement, options, concept) {
        // Handle string shorthand
        if(typeof options === "string"){
            options = {
                property: options
            }
        }

        const defaultOptions = {
            by: 1
        }

        super(name, Object.assign({}, defaultOptions, options), concept);

        this.decrement = decrement;
    }

    /**
     * @param {VarvContext[]} context
     * @returns {Promise<VarvContext[]>}
     */
    async apply(contexts, actionArguments = {}) {
        const self = this;

        if(this.options.property == null && this.options.variable == null) {
            throw new Error("Either 'property' or 'variable' needs to be set for action 'increment'");
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            if(options.property != null) {
                const lookup = VarvEngine.lookupProperty(context.target, self.concept, options.property);

                if(lookup == null) {
                    throw new Error("No property ["+options.of.property+"] found");
                }

                const concept = lookup.concept;
                const property = lookup.property;
                const target = lookup.target;

                let currentValue = await property.getValue(target);

                if (this.decrement) {
                    currentValue -= options.by;
                } else {
                    currentValue += options.by;
                }

                await property.setValue(target, currentValue);
            } else if(options.variable != null) {
                let currentValue = Action.getVariable(context, options.variable);

                if (this.decrement) {
                    currentValue -= options.by;
                } else {
                    currentValue += options.by;
                }

                Action.setVariable(context, options.variable, currentValue);
            }

            return context;
        });
    }
}

/**
 * An action "increment" that increments a number property or variable
 *
 * @example
 * // Increment the property by 1
 * {
 *     "increment": {
 *         "property": "myNumberProperty"
 *     }
 * }
 *
 * @example
 * // Increment the property by 2
 * {
 *     "increment": {
 *         "property": "myNumberProperty",
 *         "by": 2
 *     }
 * }
 *
 * @example
 * // Increment the property by 1, (Shorthand version)
 * {
 *     "increment": "myNumberProperty"
 * }
 *
 * @example
 * // Increment the variable by 2
 * {
 *     "increment": {
 *         "variable": "myNumberVariable",
 *         "by": 2
 *     }
 * }
 */
class IncrementAction extends IncrementDecrementAction {
    static options() {
        return {
            "$inc": "enumValue[property,variable]",
            "by": "number%1"
        }
    }

    constructor(name, options, concept) {
        super(name, false, options, concept);
    }
}
Action.registerPrimitiveAction("increment", IncrementAction);
window.IncrementAction = IncrementAction;

/**
 * An action "decrement" that decrements a number property or variable
 *
 * @example
 * // Decrement the property by 1
 * {
 *     "decrement": {
 *         "property": "myNumberProperty"
 *     }
 * }
 *
 * @example
 * // Decrement the property by 2
 * {
 *     "decrement": {
 *         "property": "myNumberProperty",
 *         "by": 2
 *     }
 * }
 *
 * @example
 * // Decrement the property by 1, (Shorthand version)
 * {
 *     "decrement": "myNumberProperty"
 * }
 *
 * @example
 * // Decrement the variable by 2
 * {
 *     "decrement": {
 *         "variable": "myNumberVariable",
 *         "by": 2
 *     }
 * }
 */
class DecrementAction extends IncrementDecrementAction {
    static options() {
        return {
            "$dec": "enumValue[property,variable]",
            "by": "number%1"
        }
    }

    constructor(name, options, concept) {
        super(name, true, options, concept);
    }
}
Action.registerPrimitiveAction("decrement", DecrementAction);
window.DecrementAction = DecrementAction;

/**
 * An action 'calculate' that calculates a given math expression and sets a variable with the result
 *
 * @example
 * //Shorthand, calculates and sets result in variable 'calculate'
 * {
 *     "calculate": "42 + 60 + $myVariableName$
 * }
 *
 * @example
 * {
 *     "calculate": {
 *         "expression": "sqrt(2) * sqrt(2)",
 *         "as": "myResultVariableName"
 *     }
 * }
 */
class CalculateAction extends Action {
    static options() {
        return {
            "expression": "string",
            "as": "@string"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {
            options = {
                expression: options
            }
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

            let result = math.evaluate(options.expression);

            Action.setVariable(context, resultName, result);

            return context;
        });
    }
}
Action.registerPrimitiveAction("calculate", CalculateAction);
window.CalculateAction = CalculateAction;

/**
 * An action 'random' that generates a random number from within a range. Both minimum and maximum are inclusive
 *
 * If no range is specified. 0 - Number.MAX_SAFE_INTEGER (2^53 -1) is used as range.
 *
 * @example
 * //Shorthand, generates a random number between 0 and 10, saves the result in the variable named "random"
 * {
 *     "random": [0, 10]
 * }
 *
 * @example
 * //Generate a random integer between 0 and 10, and save the result in the variable "myResultVariableName"
 * {
 *     "random": {
 *         "range": [0, 10],
 *         "as": "myResultVariableName"
 *     }
 * }
 *
 * @example
 * //Generate a random float number between 0 and 10, and save the result in the variable "myResultVariableName"
 * {
 *     "random": {
 *         "range": [0, 10],
 *         "float": true,
 *         "as": "myResultVariableName"
 *     }
 * }
 */
class RandomAction extends Action {
    static options() {
        return {
            "range": "range",
            "float": "boolean%false",
            "as": "@string"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(Array.isArray(options)) {
            options = {
                range: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        function getRandomInt(min, max) {
            min = Math.ceil(min);
            max = Math.floor(max);
            return Math.floor(Math.random() * (max - min + 1) + min);
        }

        function getRandomArbitrary(min, max) {
            if(max < Number.MAX_VALUE) {
                //Upper bound is off by the smallest possible value
                //make it inclusive by incrementing by the smallest value
                max += Number.MIN_VALUE;
            }
            return Math.random() * (max - min) + min;
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let range = options.range;

            if(range == null) {
                range = [0, Number.MAX_SAFE_INTEGER]
            }

            let randomNumber = Number.NaN;

            if(options.float) {
                randomNumber = getRandomArbitrary(range[0], range[1]);
            } else {
                randomNumber = getRandomInt(range[0], range[1]);
            }

            let variableName = Action.defaultVariableName(this);

            if(options.as != null) {
                variableName = options.as;
            }

            Action.setVariable(context, variableName, randomNumber);

            return context;
        });
    }
}
Action.registerPrimitiveAction("random", RandomAction);
window.RandomAction = RandomAction;
