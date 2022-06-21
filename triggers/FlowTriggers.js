/**
 *  FlowTriggers - Triggers based on control flow and calls
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
 * A trigger 'action' that triggers when an action is run
 * @memberOf Triggers
 * @example
 * //Trigger before action 'myActionName' is run
 * {
 *     "action": {
 *         "action": "myActionName",
 *         "hook": "before"
 *     }
 * }
 *
 * //Trigger after action 'myActionName' is run
 * {
 *     "action": {
 *         "action": "myActionName",
 *         "hook": "after"
 *     }
 * }
 *
 * //Shorthand, trigger after 'myActionName' is run
 * {
 *     "action": "myActionName"
 * }
 *
 * //Shorthand, trigger after 'myConcept.myActionName' is run
 * {
 *     "action": "myConcept.myActionName"
 * }
 *
 * //Super shorthand, triggers after myActionName
 * "myActionName"
 */
class ActionTrigger extends Trigger {
    static options() {
        return {
            "action": "string",
            "hook": "enum[before,after]%after"
        }
    }

    constructor(name, options, concept) {
        if (typeof options === "string") {
            options = {
                action: options
            }
        }

        let defaultOptions = {
            "hook": "after"
        };

        options = Object.assign({}, defaultOptions, options);

        super(name, options, concept);
    }

    enable() {
        const self = this;

        this.deleteTrigger = Trigger.registerTriggerEvent("action", async (contexts)=>{
            //Only 1 context
            let context = contexts[0];

            let actionPart = self.options.action;
            let conceptPart = null;

            let split = self.options.action.split(".");
            if(split.length === 2) {
                //Action was on the form, concept.action
                actionPart = split[1];
                conceptPart = split[0];
            }

            if(conceptPart != null && context.actionConcept !== conceptPart) {
                //Not the concept we are looking for, skip
                return;
            }

            if(context.actionName !== actionPart) {
                //Not the action we are looking for, skip
                return;
            }

            if(context.hook !== self.options.hook) {
                //Not the hook we are looking at, skip
                return;
            }

            let clonedContexts = Action.cloneContext(context.actionContext);

            await Trigger.trigger(self.name, clonedContexts);
        });
    }

    disable() {
        if(this.deleteTrigger != null) {
            this.deleteTrigger.delete();
        }
    }

    static async before(action, contexts) {
        await ActionTrigger.doTrigger(action, contexts, false);
    }

    static async after(action, contexts) {
        await ActionTrigger.doTrigger(action, contexts, true);
    }

    static async doTrigger(action, contexts, after) {
        await Trigger.trigger("action", {
            target: null,
            actionContext: contexts,
            actionName: action.name,
            actionConcept: action.concept?.name,
            hook: after?"after":"before"
        });
    }
}
Trigger.registerTrigger("action", ActionTrigger);
window.ActionTrigger = ActionTrigger;
