class QueryParseNode extends ScopedParseNode {
    constructor(templateElement){
        super(templateElement); 
        
        // We are our own only child
        this.children.push(this.parseTemplateNode(templateElement, {
            skipQuery: true
        }));
    }
    
    getView(targetDocument, scope){
        console.log("instantiating query for ", this.templateElement);
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
                    
                    // Enumerate some concepts                    
                    let doConceptEnumeration = async function doConceptEnumerationForScopes(){
                        // Concept enumeration queries (possibly filtered for performance)
                        if (self.templateElement.getAttribute("property")) console.log("FIXME: concept='' enumerations combined with property='' lookups not high-performance yet, use filters here");
                        if (self.templateElement.getAttribute("if")) console.log("FIXME: concept='' enumerations combined with if='' not high-performance yet, use filters here");
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
            console.log("Generating property scopes...");
            
            // Monitor property attribute for changes
            view.propertyUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, view.scope, async function propertyAttributeUpdated(property){     
                // Clean up previous callbacks
                view.propertyChangedCallbacks.forEach((callback)=>{
                    callback.delete();
                });
                
                // Find the new properties for each existing scope
                console.log("Property attribute value is now", property);
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
                        let valueToScopes = function propertyValueToScopes(propertyValue){
                            console.log("Property value is", propertyValue);
                            let as = self.templateElement.getAttribute("as");
                            if (propertyValue !== null && propertyValue !== undefined) {
                                if (engineProperty.getType()==="array") {
                                    // We need to map the array into additional childscopes
                                    // STUB: No sorting of property values in SPEC?
                                    scopeMap.set(localScope, propertyValue.map((arrayEntry, index)=>{
                                        let values = new ValueBinding({});
                                        let newScope = [...localScope];
                                        if (engineProperty.isConceptArrayType()) {         
                                            newScope.push(new ConceptInstanceBinding(VarvEngine.getConceptFromUUID(arrayEntry),arrayEntry));
                                        }

                                        // Allow .value and .index to also be found as property.value or as.value (if defined)
                                        values.bindings[".value"] = arrayEntry;
                                        values.bindings[".index"] = index;
                                        values.bindings[property+".value"] = values.bindings[".value"];
                                        values.bindings[property+".index"] = values.bindings[".index"];
                                        if (as){
                                            values.bindings[as+".value"] = values.bindings[".value"];
                                            values.bindings[as+".index"] = values.bindings[".index"];
                                        }

                                        newScope.push(new PropertyBinding(engineProperty, binding.uuid));
                                        newScope.push(values);
                                        return newScope;
                                    }));
                                } else {
                                    // Single property value, no duplication
                                    if (!engineProperty.isConceptType()) throw new Error("Cannot use a type for the property attribute that is not a list of references, a list of simple values or a single concept reference: "+propertyValue);

                                    // Access uuid as .value, property.value or (optionally) as.value
                                    let values = new ValueBinding({
                                        ".value": propertyValue,
                                        [property+".value"]: propertyValue
                                    });
                                    if (as){
                                        values.bindings[as+".value"] = propertyValue;
                                    }

                                    scopeMap.set(localScope,[[
                                        ...localScope,
                                        new ConceptInstanceBinding(VarvEngine.getConceptFromUUID(propertyValue),propertyValue),
                                        new PropertyBinding(engineProperty, binding.uuid),
                                        values
                                    ]]);
                                }
                            } else {
                                scopeMap.set(localScope,[]); // Empty scope
                            }
                        };

                        // Initial setup
                        valueToScopes(await binding.getValueFor(property,false));
                        
                        // Listen for changes in the looked up property and update the scopes if changed
                        let changedCallback = async function queryParseNodePropertyChanged(uuid, value){
                            if (uuid===binding.uuid){
                                // Update the scopeMap with the new value
                                valueToScopes(value);
                                finalFiltering(scopeMap);
                            }
                        };                                
                        engineProperty.addUpdatedCallback(changedCallback);
                        view.propertyChangedCallbacks.push({
                            delete: function queryParseNodePropertyChangeListenerRemoved(){
                                engineProperty.removeUpdatedCallback(changedCallback);
                            }
                        });
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
        if (view.conditionalUpdatingEvaluation) {
            view.conditionalEvaluation.destroy();
            view.conditionalEvaluation = null;
        }
        
        // Look at the attribute
        let conditionalQuery = this.templateElement.getAttribute("if");
        if ((conditionalQuery!==null) && conditionalQuery.trim().length>0){
            // Monitor the if-condition for changes
            view.conditionalUpdatingEvaluation = new UpdatingEvaluation(conditionalQuery, view.scope, async function conditionalAttributeUpdated(condition){                        
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
                    
                    // Perform the conditional test
                    let isIncluded = await Promise.all(localScopes.map(async function applyConditional(localScope){
                        // Sanity checks
                        let binding = await DOMView.getBindingFromScope(conditionSource, [...view.scope, ...localScope]);
                        if (!binding) throw new Error("if='"+condition+"' selecting boolean '"+conditionSource+"' not bound in scope");
                        
                        // Actual test
                        let conditionalValue = false;
                        try {
                            if (isTestingInstanceOf){
                                let testTarget = await binding.getValueFor(conditionSource);
                                if (testTarget instanceof ConceptInstanceBinding){
                                    testTarget = testTarget.concept;
                                } else {
                                    // This may be an uuid, if so, look it up instead
                                    testTarget = await VarvEngine.getConceptFromUUID(testTarget);
                                }
                                conditionalValue = testTarget.isA(testType);
                            } else {                            
                                conditionalValue = await binding.getValueFor(conditionSource);                                
                            }
                            if(negate) {
                                conditionalValue = ! conditionalValue;
                            }
                        } catch (ex){
                            console.warn(ex);
                        }
                        return conditionalValue;
                    }));                    

                    self.onScopesUpdated(view, localScopes.filter((localScope,index)=>isIncluded[index]));            
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