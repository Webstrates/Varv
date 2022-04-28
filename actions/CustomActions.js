/**
 *  CustomActions - Actions that allow custom code
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
 * An action 'customJS' that can run a custom piece of javascript code on the current context, the function must be a function on the window object
 *
 * @example
 * //Runs window.myFunction
 * {
 *     "customJS": {
 *          "functionName": "myFunction"
*      }
 * }
 *
 * //Shorthand, runs window.myFunction
 * {
 *     "customJS": "myFunction"
 * }
 */
class CustomJSAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            options = {
                "functionName": options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        return this.forEachContext(contexts, actionArguments, async (context, options)=> {
            if(this.options.functionName == null) {
                throw new Error("'functionName' must be set for action 'customJS'");
            }

            let f = window[options.functionName];

            if(f == null) {
                throw new Error("'window."+options.functionName+"' is not defined");
            }

            if(typeof f !== "function") {
                throw new Error("'window."+options.functionName+"' is not a function");
            }

            return await f(context, options);
        });
    }
}
Action.registerPrimitiveAction("customJS", CustomJSAction);
window.CustomJSAction = CustomJSAction;
