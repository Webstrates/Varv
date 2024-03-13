class QueryParseNode extends ScopedParseNode {
    constructor(templateElement){
        super(templateElement); 
        
        // We are our own only child
        this.children.push(this.parseTemplateNode(templateElement, {
            skipQuery: true
        }));
    }
    
    getView(targetDocument, scope){
        if (DOMView.DEBUG) console.log("instantiating query for ", this.templateElement);
        let view = super.getView(targetDocument, scope);        
        view.addCleanup(()=>{
            // Change callbacks            
            view.conceptAppearedCallback?.delete();
            view.conceptDisappearedCallback?.delete();
            
            // Attribute evaluators
            view.conceptUpdatingEvaluation?.destroy();
            view.propertyUpdatingEvaluation?.destroy();
            view.conditionalUpdatingEvaluation?.destroy();
        });        
        return view;
    }
    
    generateScopes(view){
        view.propertyChangedCallbacks = [];
        this.generateConceptScopes(view);
    }
    
    // Look at the CONCEPT attribute and generate some scopes
    generateConceptScopes(view){
        let self = this;
        let conceptQuery = this.templateElement.getAttribute("concept");
        if ((conceptQuery!==null) && conceptQuery.trim().length>0){
            // Need to monitor a list of concept instances
            view.conceptUpdatingEvaluation = new UpdatingEvaluation(conceptQuery, view.scope, async function conceptAttributeUpdated(conceptName){                        
                try {
                    // Clean up any previous appeared/disappeared callbacks
                    view.conceptAppearedCallback?.delete();
                    view.conceptDisappearedCallback?.delete();
                    
                    // Concept enumeration queries                
                    let doConceptEnumeration = async function doConceptEnumerationForScopes(){
                        // TODO: possibly filter for performance
                        if (DOMView.DEBUG){
                            if (self.templateElement.getAttribute("property")) console.log("FIXME: DOMView concept='' enumerations combined with property='' lookups on same element can be optimized further, use filters here");
                            if (self.templateElement.getAttribute("if")) console.log("FIXME: DOMView concept='' enumerations combined with if='' can sometimes be optimized further, use filters here");
                        }
                        let instances = await VarvEngine.lookupInstances(VarvEngine.getAllImplementingConceptNames(conceptName)); // TODO: Fancy filtering opportunity here
                        let localScopes = await Promise.all(instances.map(async function lookupConcreteTypes(uuid){
                            let concreteConcept = await VarvEngine.getConceptFromUUID(uuid);
                            return [new ConceptInstanceBinding(concreteConcept, uuid)];
                        }));                
                        self.generatePropertyScopes(view, localScopes);
                    };
                    
                    // Populate the scope
                    await doConceptEnumeration();                    
                    let refreshTimer;
                    view.conceptAppearedCallback = VarvEngine.registerEventCallback("appeared", async (evt) => {
                        if (evt.concept.isA(conceptName)){
                            clearTimeout(refreshTimer);
                            refreshTimer = setTimeout(()=>{
                                doConceptEnumeration();
                            },0);                            
                        }
                    });
                    view.conceptDisappearedCallback = VarvEngine.registerEventCallback("disappeared", async (evt) => {
                        if (evt.concept.isA(conceptName)){
                            clearTimeout(refreshTimer);
                            refreshTimer = setTimeout(()=>{
                                doConceptEnumeration();
                            },0);                            
                        }
                    });                    
                } catch (ex){
                    self.showError(view, "Evaluating concept='"+conceptQuery+"': "+ex, ex);
                    return;            
                }
            });

            // TODO: also run the above for concept added callbacks
        } else {
            // We can skip straight to property with just the view scope
            self.generatePropertyScopes(view, [[]]);
        }       
    }
    
    // Look at the PROPERTY attribute and generate additional scopes for each given local scope
    generatePropertyScopes(view, localScopes){
        let self = this;
        
        // Clean potential previous evaluation of property-args so it stops updating
        if (view.propertyUpdatingEvaluation) {
            view.propertyUpdatingEvaluation.destroy();
            view.propertyUpdatingEvaluation = null;
        }
        
        let finalFiltering = function finalFiltering(scopeMap){
            // Concat the results into one big array and ship it to the UI
            let scopeCollection = [];
            scopeMap.forEach((subscopes)=>{
                subscopes.forEach((actualScope)=>{
                    scopeCollection.push(actualScope);
                });
            });                    
            self.generateConditionalScopes(view, scopeCollection);                
        };
        
        // Look at property attribute
        let propertyQuery = this.templateElement.getAttribute("property");
        if ((propertyQuery!==null) && propertyQuery.trim().length>0){
            if (DOMView.DEBUG) console.log("Generating property scopes...");
            
            // Monitor property attribute for changes
            view.propertyUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, view.scope, async function propertyAttributeUpdated(property){     
                // Clean up previous callbacks
                view.propertyChangedCallbacks.forEach((callback)=>{
                    callback.destroy();
                });
                
                // Find the new properties for each existing scope
                if (DOMView.DEBUG) console.log("Property attribute value is now", property);
                if (property === undefined) throw new Error("Cannot render property '"+propertyQuery+"' which evaluates to undefined");
                try {
                    // Insert localScopes in the right order
                    let scopeMap = new Map(localScopes.map((localScope)=>{
                        return [localScope, []];
                    }));
                    
                    // Calculate all the initial derived scopes in parallel
                    await Promise.all(localScopes.map(async function expandPropertyScope(localScope){
                        // Sanity checks
                        let binding = await DOMView.getBindingFromScope(property, [...view.scope, ...localScope]);
                        if (!binding) throw new Error("Selecting undefined property '"+property+"' not found in scope");
                        if (!(binding instanceof ConceptInstanceBinding)) throw new Error("Property='"+propertyQuery+"' (currently '"+property+"') must be a property on a concept");

                        // Find the new scopes from a value                        
                        let engineProperty = binding.getProperty(property);
                        let valueToScopes = async function propertyValueToScopes(propertyValue){
                            try {
                                if (DOMView.DEBUG) console.log("Property value is", propertyValue);
                                let as = self.templateElement.getAttribute("as");
                                if (propertyValue !== null && propertyValue !== undefined && propertyValue!=="") {
                                    if (engineProperty.getType()==="array") {
                                        // We need to map the array into additional childscopes with arrayentry bindings
                                        scopeMap.set(localScope, await Promise.all(propertyValue.map(async (arrayEntry, index, inArray)=>{
                                            let newScope = [...localScope];
                                            if (engineProperty.isConceptArrayType()) {         
                                                newScope.push(new ConceptInstanceBinding(await VarvEngine.getConceptFromUUID(arrayEntry),arrayEntry));
                                            }
                                            newScope.push(new PropertyArrayEntryBinding(engineProperty, binding.uuid, arrayEntry, index, inArray.length, as));
                                            return newScope;
                                        })));
                                    } else {
                                        // Single property value, no duplication
                                        if (!engineProperty.isConceptType()) throw new Error("Cannot use a type for the property attribute that is not a list of references, a list of simple values or a single concept reference: "+propertyValue+" ("+engineProperty.type+")");
                                        scopeMap.set(localScope,[[
                                            ...localScope,
                                            new ConceptInstanceBinding(await VarvEngine.getConceptFromUUID(propertyValue),propertyValue),
                                            new PropertyBinding(engineProperty, binding.uuid, propertyValue, as)
                                        ]]);
                                    }
                                } else {
                                    scopeMap.set(localScope,[]); // Empty scope
                                }
                            } catch (ex){
                                scopeMap.set(localScope, [[new RuntimeExceptionBinding("Converting property value to scopes failed",ex)]]);
                            }
                        };

                        // Initial setup
                        let initialValue = await binding.getValueFor(property);
                        await valueToScopes(initialValue);
                        
                        // Listen for changes in the looked up property and update the scopes if changed
                        if (binding.generateRawChangeListener){
                            let changedCallback = binding.generateRawChangeListener(property,initialValue);
                            changedCallback.onChanged = async function queryParseNodePropertyChanged(value){
                                // Update the scopeMap with the new value
                                await valueToScopes(value);
                                finalFiltering(scopeMap);
                            };
                            view.propertyChangedCallbacks.push(changedCallback);
                        };                   
                    }));
                    
                    finalFiltering(scopeMap);
                } catch (ex){
                        self.showError(view, "Evaluating property='"+propertyQuery+"': "+ex, ex);
                        return;            
                }
           
            });
        } else {
            // Skip straight to conditionals with the given local scopes
            self.generateConditionalScopes(view, localScopes);
        }        
    }
    
    // Look at IF attribute and remove local scopes that do not fit
    generateConditionalScopes(view, localScopes){
        let self = this;
        
        // Clean potential previous evaluation of if-args so it stops updating
        if (view.conditionalPropertyUpdateListeners){
            view.conditionalPropertyUpdateListeners.forEach((listener)=>{
                listener.destroy();
            });
        }
        view.conditionalPropertyUpdateListeners = [];
        if (view.conditionalUpdatingEvaluation) {
            view.conditionalUpdatingEvaluation.destroy();
            view.conditionalUpdatingEvaluation = null;
        }
        
        // Look at the attribute
        let conditionalQuery = this.templateElement.getAttribute("if");
        if ((conditionalQuery!==null) && conditionalQuery.trim().length>0){
            // Monitor the if-condition for changes
            view.conditionalUpdatingEvaluation = new UpdatingEvaluation(conditionalQuery, view.scope, async function conditionalAttributeUpdated(condition){                        
                if (DOMView.DEBUG) console.log("If changed: ", condition);
                try {
                    // Configure the if-test
                    let negate = false;
                    let isTestingInstanceOf = false;
                    let testType;
                    let conditionSource = condition;
                    if(condition.startsWith("!")){
                        conditionSource = condition.substring(1);
                        negate = true;
                    }                    
                    if (conditionSource.includes("concept ")){ // Instance-of if
                        isTestingInstanceOf = true;

                        testType = conditionSource.substring(conditionSource.indexOf("concept ")+8);
                        conditionSource = conditionSource.replace("concept "+testType, "").trim();
                        if (conditionSource.length === 0){
                            conditionSource = "concept::uuid"; // Use most recently bound concept
                        }
                    }
                    
                    // Insert localScopes in the right order
                    let scopeMap = new Map(localScopes.map((localScope)=>{
                        return [localScope, []];
                    }));
                    
                    let onConditionalUpdateCompleted = function onConditionalUpdateCompleted(){
                        // Flatten results to list
                        let includedScopes = [];
                        scopeMap.forEach((value,key)=>{
                            if (value) includedScopes.push(key);
                        });

                        // Send to UI
                        self.onScopesUpdated(view, includedScopes);            
                    };                    

                    // Perform the conditional test
                    await Promise.all(localScopes.map(async function applyConditional(localScope){
                        // Sanity checks
                        if (localScope.length>0 && (localScope[localScope.length-1] instanceof RuntimeExceptionBinding)){
                            // Pass thru exceptions always, no if-ing
                            console.log("Passing thru error",localScope);
                            scopeMap.set(localScope, true);
                            return;
                        }
                        let binding = await DOMView.getBindingFromScope(conditionSource, [...view.scope, ...localScope]);
                        if (!binding) throw new Error("if='"+condition+"' selecting boolean '"+conditionSource+"' not bound in scope");
                        let evaluateConditional = async function evaluateConditional(value){
                            // Actual test
                            let conditionalValue = false;
                            try {
                                if (isTestingInstanceOf){
                                    // This check must be against a uuid, look it up
                                    let testTarget = await VarvEngine.getConceptFromUUID(value);                                    
                                    conditionalValue = testTarget.isA(testType);
                                } else {                            
                                    conditionalValue = value;                                
                                }
                                if(negate) {
                                    conditionalValue = !conditionalValue;
                                }
                            } catch (ex){
                                console.warn(ex);
                            }
                            scopeMap.set(localScope, conditionalValue);
                            
                        };         
                        
                        let initialValue = await binding.getValueFor(conditionSource);
                        evaluateConditional(initialValue);
                        
                        // Listen for changes in the looked up value and update this subscope if changed
                        if (binding.generateRawChangeListener){
                            let changedCallback = binding.generateRawChangeListener(conditionSource, initialValue);
                            changedCallback.onChanged = async function queryParseNodePropertyChanged(value){
                                // Update the scopeMap with the new value
                                await evaluateConditional(value);
                                onConditionalUpdateCompleted();
                            };
                            view.conditionalPropertyUpdateListeners.push(changedCallback);
                        };     
                    }));          
                    
                    onConditionalUpdateCompleted();
                } catch (ex){
                    self.showError(view, "Evaluating if='"+conditionalQuery+"': "+ex, ex);
                    return;            
                }
            });
        } else {
            // When there is no 'if=', all local scopes survive directly
            this.onScopesUpdated(view, localScopes);
        }   
    }
};

window.QueryParseNode = QueryParseNode;