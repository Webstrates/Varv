/**
 *  DOMTriggers - Triggers based on DOM events
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


// click(concept/element-property)
// hover(concept/element-property)
// focus(concept/element-property)
// key(key, concept/element-property focus, event=key-up, shift=false, meta=false)
// drag-n-drop hell

/**
 * General MouseTrigger class, for use for the different ones
 */
class MouseTrigger extends Trigger {
    static options() {
        return {
            "$mouseTarget": "@enumValue[concept,property,view,runtimeLookup]",
            "where": "filter"
        }
    }

    constructor(name, options, concept, type) {
        if(typeof options === "string") {
            options = {
                runtimeLookup: options
            }
        }

        super(name, options, concept);

        this.type = type;

        this.triggerDelete = null;
    }

    enable() {
        const self = this;

        this.triggerDelete = Trigger.registerTriggerEvent(this.type, async (context)=> {
            //Try looking up shorthand
            let options = Object.assign({}, this.options);

            if(options.runtimeLookup != null) {
                let lookupResult = VarvEngine.lookupReference(options.runtimeLookup, self.concept);
                options = Object.assign(options, lookupResult);
            }

            //Always only 1 entry in array
            context = context[0];

            let resultContext = Action.cloneContext(context);

            if(options.exactConceptMatch && options.concept == null) {
                //We are matching excact on concept, but have no concept, use owning concept
                options.concept = self.concept.name;
            }

            //Check if this context matches our options
            if(options.concept != null) {
                //Reset target, we will set it if matching concept is found
                resultContext.target = null;

                for(let i = context.conceptUUIDs.length-1; i >= 0; i--) {
                    let uuid = context.conceptUUIDs[i];
                    let concept = await VarvEngine.getConceptFromUUID(uuid);

                    if(concept != null) {
                        if(options.exactConceptMatch) {
                            //Exact match
                            if(concept.name === options.concept) {
                                resultContext.target = uuid;
                                break;
                            }
                        } else {
                            if(concept.isA(options.concept)) {
                                resultContext.target = uuid;
                                break;
                            }
                        }
                    }
                }

                if(resultContext.target == null) {
                    return;
                }
            }

            if(options.view != null) {
                if(!context.targetElement.closest("[view='"+options.view+"']")) {
                    return;
                }
            }

            if(options.property) {
                let foundPropertyBinding = null;
                for(let i = context.properties.length-1; i>= 0; i--) {
                    let propertyBinding = context.properties[i];
                    if(propertyBinding.property.name === options.property) {
                        foundPropertyBinding = propertyBinding;
                    }
                }

                if(!foundPropertyBinding) {
                    return;
                }

                //Set target to the property's owner.
                resultContext.target = foundPropertyBinding.uuid;

                try {
                    let propertyValueLookup = foundPropertyBinding.property.name + ".value";
                    let propertyValue = await DOMView.singleton.evaluateValueInScope(propertyValueLookup, context.targetElement.scope);
                    Action.setVariable(resultContext, "propertyValue", propertyValue);
                } catch(e) {
                    console.warn("Error evaluating property value:", e);
                }

                try {
                    let propertyIndexLookup = foundPropertyBinding.property.name + ".index";
                    let propertyIndex = await DOMView.singleton.evaluateValueInScope(propertyIndexLookup, context.targetElement.scope);
                    Action.setVariable(resultContext, "propertyIndex", propertyIndex);
                } catch(e) {
                    console.warn("Error evaluating property index:", e);
                }
            }

            if(options.unknown != null) {
                //Lookup of reference failed, skip trigger
                if(DOMTriggers.DEBUG) {
                    console.log("Unable to lookup reference, skipping trigger:", self);
                }
                return;
            }

            //Filter based on where
            if(options.where != null) {
                let filter = await FilterAction.constructFilter(options.where);

                if(await filter.filter(resultContext)) {
                } else {
                    if(DOMTriggers.DEBUG) {
                        console.log("Mouse trigger was filtered because of where:", options.where, context);
                    }
                    return;
                }
            }

            if(options.preventDefault) {
                context.originalEvent.preventDefault();
            }

            await Trigger.trigger(self.name, resultContext).then(()=>{
                //Ignore
            });
        });
    }

    disable() {
        if(this.triggerDelete != null) {
            this.triggerDelete.delete();
        }
        this.triggerDelete = null;
    }
}

/**
 * A trigger "click" that listens for clicks on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "click": {
 *         "concept": "theConceptIWantToHearClickTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "click": {
 *         "concept": "theConceptIWantToHearClickTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "click": {
 *         "view": "aViewBindingIWantToHearClickTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "click": {
 *         "property": "aPropertyIWantToHearClickTriggerOn"
 *     }
 * }
 */
class ClickTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "click");
    }
}
Trigger.registerTrigger("click", ClickTrigger);
window.ClickTrigger = ClickTrigger;

/**
 * A trigger "mousedown" that listens for mousdown events on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "mousedown": {
 *         "concept": "theConceptIWantToHearMousedownTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "mousedown": {
 *         "concept": "theConceptIWantToHearMousedownTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "mousedown": {
 *         "view": "aViewBindingIWantToHearMousedownTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "mousedown": {
 *         "property": "aPropertyIWantToHearMousedownTriggerOn"
 *     }
 * }
 */
class MousedownTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "mousedown");
    }
}
Trigger.registerTrigger("mousedown", MousedownTrigger);
window.MousedownTrigger = MousedownTrigger;

/**
 * A trigger "mouseup" that listens for mouseup events on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "mouseup": {
 *         "concept": "theConceptIWantToHearMouseupTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "mouseup": {
 *         "concept": "theConceptIWantToHearMouseupTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "mouseup": {
 *         "view": "aViewBindingIWantToHearMouseupTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "mouseup": {
 *         "property": "aPropertyIWantToHearMouseupTriggerOn"
 *     }
 * }
 */
class MouseupTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "mouseup");
    }
}
Trigger.registerTrigger("mouseup", MouseupTrigger);
window.MouseupTrigger = MouseupTrigger;

/**
 * A trigger "contextmenu" that listens for contextmenu events on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "contextmenu": {
 *         "concept": "theConceptIWantToHearMouseupTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "contextmenu": {
 *         "concept": "theConceptIWantToHearMouseupTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "contextmenu": {
 *         "view": "aViewBindingIWantToHearMouseupTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "contextmenu": {
 *         "property": "aPropertyIWantToHearMouseupTriggerOn"
 *     }
 * }
 */
class ContextmenuTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "contextmenu");
    }
}
Trigger.registerTrigger("contextmenu", ContextmenuTrigger);
window.ContextmenuTrigger = ContextmenuTrigger;

/**
 * A trigger "mousemove" that listens for mousemove events on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "mousemove": {
 *         "concept": "theConceptIWantToHearMousemoveTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "mousemove": {
 *         "concept": "theConceptIWantToHearMousemoveTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "mousemove": {
 *         "view": "aViewBindingIWantToHearMousemoveTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "mousemove": {
 *         "property": "aPropertyIWantToHearMousemoveTriggerOn"
 *     }
 * }
 */
class MousemoveTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "mousemove");
    }
}
Trigger.registerTrigger("mousemove", MousemoveTrigger);
window.MousemoveTrigger = MousemoveTrigger;

/**
 * A trigger "wheel" that listens for wheel events on DOM elements
 * @memberOf Triggers
 * @example
 * {
 *     "wheel": {
 *         "concept": "theConceptIWantToHearWheelTriggerOn"
 *     }
 * }
 * @example
 * //Match concept exact, not allowing any injected concepts to match
 * {
 *     "wheel": {
 *         "concept": "theConceptIWantToHearWheelTriggerOn",
 *         "exactConceptMatch": true
 *     }
 * }
 * @example
 * {
 *     "wheel": {
 *         "view": "aViewBindingIWantToHearWheelTriggerOn"
 *     }
 * }
 * @example
 * {
 *     "wheel": {
 *         "property": "aPropertyIWantToHearWheelTriggerOn"
 *     }
 * }
 */
class WheelTrigger extends MouseTrigger {
    constructor(name, options, concept) {
        super(name, options, concept, "wheel");
    }
}
Trigger.registerTrigger("wheel", WheelTrigger);
window.WheelTrigger = WheelTrigger;

/**
 * A trigger "key" that listens for key events in the DOM
 * <br />
 * Options:
 * <ul>
 * <li>event - The event to filter on, keyDown | keyPress | keyUp (Defaults to keyPress)</li>
 * <li>key - The key to filter on, ex. "a" or "Enter"</li>
 * <li>ctrl - If ctrl should be pressed or not (If omitted, then state of ctrl is not checked)</li>
 * <li>alt - If alt should be pressed or not (If omitted, then state of alt is not checked)</li>
 * <li>shift - If shift should be pressed or not (If omitted, then state of shift is not checked)</li>
 * <li>meta - If meta should be pressed or not (If omitted, then state of meta is not checked)</li>
 * <li>focus - If anything should be in focus for the event to trigger, supports concept and view</li>
 * <li>focus.exactConceptMatch - Should an exact match on concept be enforced. If no focus.concept is defined, the owning concept is used instead.</li>
 * </ul>
 * @memberOf Triggers
 * @example
 * //Trigger when key "Enter" is pressed and shift is held
 * {
 *     "key": {
 *         "event": "keyPress",
 *         "key": "Enter",
 *         "shift": true
 *     }
 * }
 *
 * //Trigger when key "Enter" is pressed and ctrl is held, and view 'myView' is in focus
 * {
 *     "key": {
 *         "event": "keyPress",
 *         "key": "Enter",
 *         "ctrl": true,
 *         "focus": {"view": "myView"}
 *     }
 * }
 *
 * //Trigger when key "Enter" is pressed and ctrl is held, and view 'myView' is in focus, and owning concept matches exact on focused concept
 * {
 *     "key": {
 *         "event": "keyPress",
 *         "key": "Enter",
 *         "ctrl": true,
 *         "focus": {"view": "myView", "exactConceptMatch": true}
 *     }
 * }
 */
class KeyTrigger extends Trigger {
    static options() {
        return {
            "event": "enum[keyUp,keyDown,keyPress]",
            "key": "@string",
            "ctrl": "boolean%false",
            "alt": "boolean%false",
            "shift": "boolean%false",
            "meta": "boolean%false",
            "focus": "@enumValue[concept,view]"
        }
    }

    constructor(name, options, concept) {
        const defaultOptions = {
            event: "keyPress"
        }

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    enable() {
        const self = this;

        this.triggerDelete = Trigger.registerTriggerEvent("key", async (context) => {
            //Always only 1 entry in array
            context = context[0];

            let resultContext = Action.cloneContext(context);

            if(DOMTriggers.DEBUG) {
                console.log("Key trigger:", context, self.options);
            }

            if(self.options.key != null && self.options.key.toLowerCase() !== context.variables.key.toLowerCase()) {
                //Key does not match
                if(DOMTriggers.DEBUG) {
                    console.log("key does not match!");
                }
                return;
            }

            if(self.options.shift != null && self.options.shift !== context.variables.shift) {
                //Shift state does not match
                if(DOMTriggers.DEBUG) {
                    console.log("Shift state does not match!");
                }
                return;
            }

            if(self.options.ctrl != null && self.options.ctrl !== context.variables.ctrl) {
                //Ctrl state does not match
                if(DOMTriggers.DEBUG) {
                    console.log("Ctrl state does not match!");
                }
                return;
            }

            if(self.options.alt != null && self.options.alt !== context.variables.alt) {
                //Alt state does not match
                if(DOMTriggers.DEBUG) {
                    console.log("Alt state does not match!");
                }
                return;
            }

            if(self.options.meta != null && self.options.meta !== context.variables.meta) {
                //Meta state does not match
                if(DOMTriggers.DEBUG) {
                    console.log("Meta state does not match!");
                }
                return;
            }

            if(self.options.event != null && self.options.event !== context.event) {
                //Event type does not match
                if(DOMTriggers.DEBUG) {
                    console.log("Event type does not match!");
                }
                return;
            }

            if(self.options.focus != null) {
                let focusOptions = self.options.focus;

                if(typeof focusOptions === "string") {
                    focusOptions = VarvEngine.lookupReference(self.options.focus, self.concept);
                }

                if(self.options.focus.exactConceptMatch && focusOptions.concept == null) {
                    focusOptions.concept = self.concept.name;
                }

                if(focusOptions.concept != null) {
                    let foundFocusConcept = false;
                    for(let uuid of context.conceptUUIDs) {
                        let concept = await VarvEngine.getConceptFromUUID(uuid);
                        if(self.options.focus.exactConceptMatch) {
                            if (concept.name === self.options.focus) {
                                foundFocusConcept = true;
                                break;
                            }
                        } else {
                            if (concept.isA(self.options.focus)) {
                                foundFocusConcept = true;
                                break;
                            }
                        }
                    }

                    if (!foundFocusConcept) {
                        if (DOMTriggers.DEBUG) {
                            console.log("Focus concept does not match!");
                        }
                        return;
                    }
                }

                if(focusOptions.view != null) {
                    let foundView = context.targetElement.closest("[view='"+focusOptions.view+"']");
                    if(!foundView) {
                        if(DOMTriggers.DEBUG) {
                            console.log("Focus view does not match!");
                        }
                        return;
                    }
                }

                if(focusOptions.property != null) {
                    throw new Error("Unsupported focus on property for key trigger");
                }

                if(focusOptions.unknown != null) {
                    if(DOMTriggers.DEBUG) {
                        console.log("Focus unknown does not match!");
                    }
                    return;
                }
            }

            await Trigger.trigger(self.name, resultContext)
        });
    }

    disable() {
        if(this.triggerDelete != null) {
            this.triggerDelete.delete();
        }
        this.triggerDelete = null;
    }
}
Trigger.registerTrigger("key", KeyTrigger);
window.KeyTrigger = KeyTrigger;

class DOMTriggers {
    static setup(targetDocument = document) {
        if (targetDocument.registeredDOMTriggers){
            console.log("DOMTriggers: Trying to register on a document that was already registered, ignoring");
            return;
        }
        
        function mouseHandler(mouseEvent, type) {
            let x = mouseEvent.pageX;
            let y = mouseEvent.pageY;

            let button = "unknown";

            switch(mouseEvent.button) {
                case 0: {
                    button = "left";
                    break;
                }
                case 1: {
                    button = "middle";
                    break;
                }
                case 2: {
                    button = "right";
                    break;
                }
            }

            let uuids = DOMView.singleton.getConceptPath(mouseEvent.target).map((binding)=>{return binding.uuid});
            let target = null;

            let properties = DOMView.singleton.getPropertyPath(mouseEvent.target);

            if(uuids.length > 0) {
                //Use nearest concept uuid as target, if ClickTrigger, does not filter on concept, this is the target that will be shown
                target = uuids[uuids.length-1];
            }

            let context = {
                variables: {
                    x: x,
                    y: y,
                    button: button
                },
                conceptUUIDs: uuids,
                targetElement: mouseEvent.target,
                properties: properties,
                target: target,
                originalEvent: mouseEvent
            };

            if(type === "wheel") {
                context.variables["wheelDelta"] = mouseEvent.wheelDelta;
            }

            Trigger.trigger(type, context);
        }

        //Setup click
        targetDocument.body.addEventListener("click", (evt)=>{
            mouseHandler(evt, "click");
        });
        targetDocument.body.addEventListener("mousemove", (evt)=>{
            mouseHandler(evt, "mousemove");
        });
        targetDocument.body.addEventListener("mouseup", (evt)=>{
            mouseHandler(evt, "mouseup");
        });
        targetDocument.body.addEventListener("mousedown", (evt)=>{
            mouseHandler(evt, "mousedown");
        });
        targetDocument.body.addEventListener("contextmenu", (evt)=>{
            mouseHandler(evt, "contextmenu");
        });
        targetDocument.body.addEventListener("wheel", (evt)=>{
            mouseHandler(evt, "wheel");
        });

        //Setup key
        function keyHandler(keyEvent, evtType) {
            let shift = keyEvent.shiftKey;
            let ctrl = keyEvent.ctrlKey;
            let meta = keyEvent.metaKey;
            let alt = keyEvent.altKey;

            let target = null;
            let uuids = DOMView.singleton.getConceptPath(keyEvent.target).map((binding)=>{ return binding.uuid});

            let properties = DOMView.singleton.getPropertyPath(keyEvent.target);

            if(uuids.length > 0) {
                //Use nearest concept uuid as target, if ClickTrigger, does not filter on concept, this is the target that will be shown
                target = uuids[uuids.length-1];
            }

            let context = {
                variables: {
                    key: keyEvent.key,
                    shift: shift,
                    ctrl: ctrl,
                    alt: alt,
                    meta: meta,
                },
                event: evtType,
                targetElement: keyEvent.target,
                conceptUUIDs: uuids,
                properties: properties,
                target: target,
                focusElement: targetDocument.activeElement,
                originalEvent: keyEvent
            }

            Trigger.trigger("key", context);
        }

        targetDocument.body.addEventListener("keydown", (evt)=>{
            keyHandler(evt, "keyDown");
        });
        targetDocument.body.addEventListener("keyup", (evt)=>{
            keyHandler(evt, "keyUp");
        });
        targetDocument.body.addEventListener("keypress", (evt)=>{
            keyHandler(evt, "keyPress");
        });
        
        targetDocument.registeredDOMTriggers = true;
    }
}

DOMTriggers.setup();
DOMTriggers.DEBUG = false;
window.DOMTriggers = DOMTriggers;

// Also find all present and future sub-documents and try to inject our listeners in those documents as well
function injectTriggers(frame){
    try {
        DOMTriggers.setup(frame.contentDocument);
    } catch (ex){
        console.log("DOMTriggers in iframe is experimental and being silly");
    }
    frame.addEventListener("load", ()=>{
        try {
            DOMTriggers.setup(frame.contentDocument);
        } catch (ex){
            console.log("DOMTriggers in iframe is experimental and being silly in a slower way");
        }
    });
}
document.querySelectorAll("iframe").forEach((frame)=>{
    injectTriggers(frame);
});
new MutationObserver((mutations) => {
    for(let mutation of mutations) {
        switch (mutation.type) {
            case 'childList': 
                for(let node of mutation.addedNodes) {
                    if (node.tagName === "IFRAME") {                
                        injectTriggers(frame);
                    }
                }
            break;
        }
    }
}).observe(document.body, {
    childList: true,
    subtree: true,
});
