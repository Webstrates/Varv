/**
 *  TimingActions - Actions related to time
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
 * An action "wait" that waits for a given duration before continuing
 *
 * @example
 * //Wait for 100ms
 * {
 *     "wait": {
 *         "duration": 100
 *     }
 * }
 *
 * //Wait for 100ms (shorthand version)
 * {
 *     "wait": 100
 * }
 */
class WaitAction extends Action {
    static options() {
        return {
            "duration": "number"
        }
    }

    constructor(name, options, concept) {
        //shorthand
        if(typeof options === "number") {
            options = {
                "duration": options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        if(this.options.duration == null) {
            throw new Error("Option 'duration' must be present on 'wait' action");
        }
        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            await new Promise((resolve)=>{
                setTimeout(()=>{
                    resolve();
                }, options.duration);
            })

            return context;
        });
    }
}
Action.registerPrimitiveAction("wait", WaitAction);
window.WaitAction = WaitAction;
