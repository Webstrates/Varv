/**
 *  DebugActions - Actions that make debugging easier
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
 * An action "debugConcept" that prints the currently selected concepts to the console.
 *
 * @example
 * {
 *     "debugConcept"
 * }
 */
class DebugConceptAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            console.groupCollapsed("ConceptDebug:", context.target);

            let concept = VarvEngine.getConceptFromUUID(context.target);

            for(let key of concept.properties.keys()) {
                let property = concept.properties.get(key);
                let value = await property.getValue(context.target);
                console.log(key, "->", value);
            }

            console.groupEnd();

            return context;
        });
    }

    static options() {
        return {
        };
    }
}
Action.registerPrimitiveAction("debugConcept", DebugConceptAction);
window.DebugConceptAction = DebugConceptAction;

/**
 * An action "debugContext" that prints the current context to the console
 *
 * @example
 * {
 *     "debugContext"
 * }
 */
class DebugContextAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        console.groupCollapsed("ContextDebug");
        console.log("Contexts:", contexts.map((context)=>{return Action.cloneContext(context)}));
        console.log("ActionArguments:",actionArguments);
        console.log("SavedVariables:", contexts.savedVariables);

        console.group("forEachContext:")
        const result = await this.forEachContext(contexts, actionArguments, async (context, options)=>{

            console.log(JSON.parse(JSON.stringify(context)));

            return context;
        });
        console.groupEnd();

        console.groupEnd();

        return result;
    }

    static options() {
        return {
        };
    }
}
Action.registerPrimitiveAction("debugContext", DebugContextAction);
window.DebugContextAction = DebugContextAction;

/**
 * An action "debugMessage" that can debug a message to the console
 *
 * @example
 * {
 *     "debugMessage": {
 *         "message": "The message to debug"
 *     }
 * }
 *
 * @example
 * //Shorthand version
 * {
 *     "debugMessage": "The message to debug"
 * }
 */
class DebugMessageAction extends Action {
    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string"){
            options = {
                message: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        if(this.options.bulk) {
            console.log(this.options.message);
            return contexts;
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let message = options.msg;

            if(options.message != null) {
                message = options.message;
            }
            console.log(message);

            return context;
        });
    }

    static options() {
        return {
            "message": "string"
        };
    }
}
Action.registerPrimitiveAction("debugMessage", DebugMessageAction);
window.DebugMessageAction = DebugMessageAction;
