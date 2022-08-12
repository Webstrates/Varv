/**
 *  PropertyTriggers - triggers on property changes
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
 * A trigger "stateChanged" that listens for property state changes
 * @memberOf Triggers
 * @example
 * //Triggers the stateChanged event when myProperty has changed, only the first concept that has the property is checked.
 * {
 *     "stateChanged": "myProperty"
 * }
 *
 * @example
 * //Triggers the stateChanged event when any property on myConcept changes
 * {
 *     "stateChanged": "myConcept"
 * }
 *
 * @example
 * //Triggers the stateChanged event when any property on myConcept changes, or if myProperty changes, on the first concept it was found on
 * {
 *     "stateChanged": ["myConcept", "myProperty"]
 * }
 *
 * @example
 * //Triggers the stateChanged event when property myProperty changes on myConcept
 * {
 *     "stateChanged": {"myConcept": "myProperty"}
 * }
 *
 * @example
 * //Triggers the stateChanged event when property myProperty changes on myConcept
 * {
 *     "stateChanged": {
 *         "concept": "myConcept",
 *         "property": "myProperty"
 *     }
 * }
 *
 * @example
 * //Triggers the stateChanged event when property myProperty changes
 * {
 *     "stateChanged": {
 *         "property": "myProperty"
 *     }
 * }
 *
 * @example
 * //Triggers the stateChanged event when a property on myConcept changes
 * {
 *     "stateChanged": {
 *         "concept": "myConcept"
 *     }
 * }
 */
class StateChangedTrigger extends Trigger {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            //Shorthand options string
            options = {
                runtimeLookup: [options]
            };
        } else if(Array.isArray(options)) {
            //Shorthand options concept array
            options = {
                runtimeLookup: []
            }
            for(let i = 0; i<options.length; i++) {
                options.runtimeLookup.push(options[i]);
            }
        } else if(Object.keys(options).length === 1) {
            //Shorthand options {"concept": "property"}
            let possibleConceptType = Object.keys(options)[0];
            let concept = VarvEngine.getConceptFromType(possibleConceptType);

            if(concept != null) {
                try {
                    let property = concept.getProperty(options[possibleConceptType]);

                    //We have both concept and property, so shorthand was correct
                    options = {
                        "concept": concept.name,
                        "property": property.name
                    }
                } catch(e) {
                    //Ignore
                }
            }
        }

        super(name, options, concept);
        this.triggerDelete = null;
    }

    enable() {
        const self = this;

        this.triggerDelete = Trigger.registerTriggerEvent("stateChanged", async (context)=>{
            //Always only 1 entry in array
            context = context[0];

            let options = self.options;

            if(options.runtimeLookup != null) {
                let lookedUpReferences = [];
                options.runtimeLookup.forEach((reference)=>{
                    let lookup = VarvEngine.lookupReference(reference, self.concept);
                    lookedUpReferences.push(lookup);
                });

                //Set options to the looked up references
                options = lookedUpReferences;
            }

            //Check if options array shorthand
            if(Array.isArray(options)) {
                let temp = options;
                options = {
                    concept: [],
                    property: []
                }

                temp.forEach((entry)=>{
                    if(entry.concept != null) {
                        options.concept.push(entry.concept);
                    }

                    if(entry.property != null) {
                        options.property.push(entry.property);
                    }
                })
            }

            let clonedContext = Action.cloneContext(context);

            if(Trigger.DEBUG) {
                console.log("StateChangedTrigger:", self.name, options, ""+context.target);
            }

            let triggeringConcept = await VarvEngine.getConceptFromUUID(context.target);

            if(triggeringConcept == null) {
                throw new Error("Unknown concept for UUID: "+context.target);
            }

            if(triggeringConcept.name !== self.concept.name) {
                console.warn("Trigger was not from owning concept!");
                return;
            }

            if(options.concept != null) {
                let filterConcepts = options.concept;
                if(!Array.isArray(filterConcepts)) {
                    filterConcepts = [filterConcepts];
                }

                let found = filterConcepts.length === 0;

                for(let filterConcept of filterConcepts) {
                    if(triggeringConcept.name === filterConcept) {
                        found = true;
                        break;
                    }
                }

                if(!found) {
                    //Skip based on wrong concept
                    if(Trigger.DEBUG) {
                        console.log("Skipping based on wrong concept");
                    }
                    return;
                }
            }

            if(options.property != null) {
                let filterProperties = options.property;
                if(!Array.isArray(filterProperties)) {
                    filterProperties = [filterProperties];
                }

                let found = filterProperties.length === 0;

                for(let filterProperty of filterProperties) {
                    if(context.property === filterProperty) {
                        found = true;
                        break;
                    }
                }

                if(!found) {
                    //Skip based on wrong property
                    if (Trigger.DEBUG) {
                        console.log("Skipping based on wrong property")
                    }
                    return;
                }
            }

            await Trigger.trigger(self.name, clonedContext);
        });
    }

    disable() {
        if(this.triggerDelete != null) {
            this.triggerDelete.delete();
        }
        this.triggerDelete = null;
    }
}
Trigger.registerTrigger("stateChanged", StateChangedTrigger);
window.StateChangedTrigger = StateChangedTrigger;
