/**
 *  FlowActions - Actions that create control flow
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
 * Actions that control the flow of the program
 * @namespace FlowActions
 */

/**
 * An action 'run' that runs another action, and continuing no matter the outcome of the other action.
 * @memberOf FlowActions
 * @example
 * {
 *     "run": {
 *         "action": "myActionName"
 *     }
 * }
 *
 * @example
 * //Shorthand example
 * {
 *     "run": "myActionName"
 * }
 */
class RunAction extends Action {
    static options() {
        return {
            "run": "string"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string") {
            options = {
                action: options
            }
        }

        const defaultOptions = {
            lookupActionArguments: {},
            stopOnError: true
        };

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments) {
        const self = this;

        let optionsWithArguments = await Action.lookupArguments(this.options, actionArguments);

        if(optionsWithArguments.action == null) {
            throw new Error("Missing option 'action' for 'run' action");
        }

        //TODO: We assume that all concepts are of the same type, this is probabely wrong with otherConcepts being in play...
        let contextConcept = null;
        if(contexts.length > 0) {
            contextConcept = await VarvEngine.getConceptFromUUID(contexts[0].target);
        }

        let action = VarvEngine.lookupAction(optionsWithArguments.action, [contextConcept, self.concept]);

        if(action == null) {
            throw new Error("Unable to find action ["+optionsWithArguments.action+"]");
        }

        let clonedContexts = contexts.map((context)=> {
            return Action.cloneContext(context);
        });
        if(contexts.savedVariables) {
            clonedContexts.savedVariables = JSON.parse(JSON.stringify(contexts.savedVariables));
        }

        try {
            await ActionTrigger.before(action, clonedContexts);
            let mark = VarvPerformance.start();
            let runContextsResult = await action.apply(clonedContexts, optionsWithArguments.lookupActionArguments);
            if(action.isPrimitive) {
                VarvPerformance.stop("PrimitiveAction-"+action.name, mark);
            } else {
                VarvPerformance.stop("CustomAction-"+action.name, mark);
            }
            await ActionTrigger.after(action, runContextsResult);
        } catch(e) {
            if(e instanceof StopError) {
                //console.log("Run Action was stopped: " + e.message);
            } else {
                if(this.options.stopOnError === true) {
                    throw e;
                }
            }
        }

        return contexts;
    }
}
Action.registerPrimitiveAction("run", RunAction);
window.RunAction = RunAction;
RunAction.DEBUG = false;

/**
 * An action 'exit' that stops the action chain as soon as it is encountered
 * @memberOf FlowActions
 *
 * @example
 * "exit"
 */
class ExitAction extends Action {
    static options() {
        return {};
    }

    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        throw new StopError("Action '"+this.name+"' encountered!");
    }
}
Action.registerPrimitiveAction("exit", ExitAction);
window.ExitAction = ExitAction;

/**
 * An action 'switch' that can test several branches, and execute an array of actions if the branch matches
 *
 * Each branch is tested in the order they are present in the array.
 *
 * The where option is used as a filter, and if the filter matches the actions in then is applied
 *
 * Default is to break after a branch matches, but if "break": false is added as an option, it will continue to next branch
 *
 * If a branch has no where option, it is always executed if no branch has breaked until it is reached.
 * @memberOf FlowActions
 * @example
 * {
 *     "switch": [
 *         {
 *             "where": {"property": "myProperty", "equals": "myValue"},
 *             "then": ["myAction", "myOtherAction"],
 *             "break": true
 *         },
 *         {
 *             "where": {"property": "myProperty", "equals": "myOtherValue"},
 *             "then": ["myAction", "myOtherAction"],
 *             "break": true
 *         },
 *         {
 *             "then": ["myDefaultAction"]
 *         }
 *     ]
 * }
 */
class SwitchAction extends Action {
    static options() {
        return {
            "$switch": "switch"
        }
    }

    constructor(name, options, concept) {
        if(options == null) {
            options = [];
        }

        if(!Array.isArray(options)) {
            options = [options];
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let results = [];

        for (let context of contexts) {
            //Make sure to clone context, since we change it directly, thus variables might be a shared object if not.
            let clonedContext = Action.cloneContext(context);

            let lookedUpOptions = [];

            if(Array.isArray(options)) {
                //Lookup variables for each case
                for(let option of options) {
                    let clonedOption = {};

                    if(option.where != null) {
                        clonedOption.where = await Action.lookupVariables(option.where, clonedContext);
                    }
                    if(option.break != null) {
                        clonedOption.break = await Action.lookupVariables(option.break, clonedContext);
                    }
                    if(option.then) {
                        clonedOption.then =  Action.clone(option.then);
                    }

                    lookedUpOptions.push(clonedOption);
                }
            }

            //Do switch
            for(let caseOption of lookedUpOptions) {
                if(caseOption.where != null) {
                    let filter = FilterAction.constructFilter(caseOption.where);

                    let matches = await filter.filter(clonedContext);

                    if(!matches) {
                        //Did not match, skip to next branch
                        continue;
                    }
                }

                let actions = caseOption.then;
                if(!Array.isArray(actions)) {
                    actions = [actions];
                }

                let action = ConceptLoader.parseAction(UUIDGenerator.generateUUID("SwitchCaseAction"), actions, this.concept);

                await ActionTrigger.before(action,  [clonedContext]);
                let mark = VarvPerformance.start();
                clonedContext = await action.apply([clonedContext]);
                if(action.isPrimitive) {
                    VarvPerformance.stop("PrimitiveAction-"+action.name, mark);
                } else {
                    VarvPerformance.stop("CustomAction-"+action.name, mark);
                }
                await ActionTrigger.after(action, [clonedContext]);

                let doBreak = true;

                if(caseOption.break != null) {
                    doBreak = caseOption.break;
                }

                if(doBreak) {
                    break;
                }
            }

            if (clonedContext != null) {
                if (Array.isArray(clonedContext)) {
                    clonedContext.forEach((entry) => {
                        results.push(entry);
                    });
                } else {
                    results.push(clonedContext);
                }
            }
        }

        return results;
    }
}
Action.registerPrimitiveAction("switch", SwitchAction);
window.SwitchAction = SwitchAction;

