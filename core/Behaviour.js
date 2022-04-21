/**
 *  Behaviour - Concept behaviours
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

class Behaviour {
    constructor(name, triggers, actions, concept, overrideActionName=null) {
        const self = this;

        this.concept = concept;

        if(triggers == null) {
            triggers = [];
        }

        if(actions == null) {
            actions = [];
        }

        if(!Array.isArray(triggers)) {
            triggers = [triggers];
        }

        if(!Array.isArray(actions)) {
            actions = [actions];
        }

        this.cloneData = {
            name: name,
            triggers: triggers!=null?JSON.parse(JSON.stringify(triggers)):null,
            actions: actions!=null?JSON.parse(JSON.stringify(actions)):null,
            overrideActionName: overrideActionName
        }

        this.name = name;

        this.triggers = triggers.map((triggerJson)=>{
            if(typeof triggerJson !== "string") {

                let triggerName = UUIDGenerator.generateUUID("trigger-");
                let trigger = ConceptLoader.parseTrigger(triggerName, triggerJson);

                if(trigger != null) {
                    self.concept.addTrigger(trigger);

                    return triggerName;
                } else {
                    console.warn("Unable to parse anonymous trigger:", triggerJson);
                }

                return null;
            }

            return triggerJson;
        }).filter((trigger)=>{
            return typeof trigger === "string";
        });

        this.deleteCallbacks = [];

        let actionName = name+".actions";

        if(overrideActionName != null) {
            actionName = overrideActionName;
            this.callableAction = true;
        }

        this.actionChain = new ActionChain(actionName, {}, this.concept);

        actions.forEach((actionJson)=>{
            if(typeof actionJson !== "string") {
                let actionName = UUIDGenerator.generateUUID("action-");

                if(!Array.isArray(actionJson)) {
                    actionJson = [actionJson];
                }

                let action = ConceptLoader.parseAction(actionName, actionJson, self.concept);

                if(action != null) {
                    self.actionChain.addAction(action);
                } else {
                    console.warn("Unable to parse anonymous action:", actionJson);
                }
            } else {
                let action = null;

                //Check for primitive action first.
                if(Action.hasPrimitiveAction(actionJson)) {
                    action = Action.getPrimitiveAction(actionJson, {}, concept);
                } else {
                    action = new LookupActionAction("", {
                        lookupActionName: actionJson
                    }, concept);
                }

                self.actionChain.addAction(action);
            }
        });
    }

    cloneFresh(concept) {
        return new Behaviour(this.cloneData.name, this.cloneData.triggers, this.cloneData.actions, concept,  this.cloneData.overrideActionName);
    }

    setupEvents() {
        const self = this;

        this.triggers.forEach((trigger)=>{
            self.deleteCallbacks.push(Trigger.registerTriggerEvent(trigger, async (context) => {
                try {
                    await self.onTrigger(trigger, context);
                } catch(e) {
                    console.error(e);
                }
            }));
        });
    }

    async onTrigger(triggerName, context) {
        try {
            await ActionTrigger.before(this.actionChain, context);
            let resultContext = await this.actionChain.apply(context);
            await ActionTrigger.after(this.actionChain, resultContext);
        } catch(e) {
            if(e instanceof StopError) {
                //console.log("We stopped the chain: "+e.message);
            } else {
                throw e;
            }
        }
    }

    destroy() {
        const self = this;


        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        });
        this.triggers.forEach((triggerName)=>{
            let trigger = self.concept.getTrigger(triggerName);
            if(trigger != null) {
                self.concept.removeTrigger(trigger);
            }
        });
        this.deleteCallbacks = null;
        this.triggers = null;
        this.actionChain = null;
    }
}

window.Behaviour = Behaviour;
