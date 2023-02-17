class QueryParseNode extends ParseNode {
    constructor(templateElement){
        super(templateElement); 
        
        // We are our own only child
        this.children.push(this.parseTemplateNode(templateElement, {
            skipQuery: true
        }));
    }
    
    getView(targetDocument, scope){
        console.log("instantiating query for ", this.templateElement);
        let self = this;        
        let anchorNode = targetDocument.createProcessingInstruction("whenjs-query-anchor", {});
        let view = new ViewParticle(anchorNode, this, scope);
        view.childViews = [];
        
        this.generateConceptScopes(view);
        
        view.addOnMountedCallback(()=>{
            self.stubResetView(view);
        });
        view.addCleanup(()=>{
            // Empty the view
            view.conceptUpdatingEvaluation?.destroy();
            view.conditionalUpdatingEvaluation?.destroy();
            self.onScopesUpdated(view, []);
        });
        
        
        return view;
    }
    
    // Look at the CONCEPT attribute and generate some scopes
    generateConceptScopes(view){
        let self = this;
        let conceptQuery = this.templateElement.getAttribute("concept");
        if ((conceptQuery!==null) && conceptQuery.trim().length>0){
            // Need to monitor a list of concept instances
            view.conceptUpdatingEvaluation = new UpdatingEvaluation(conceptQuery, view.scope, async function conceptAttributeUpdated(conceptName){                        
                try {
                    // Concept enumeration queries (possibly filtered)
                    if (self.templateElement.getAttribute("property")) console.log("STUB: concept='' enumerations combined with property='' lookups not high-performance yet, use filters here");
                    if (self.templateElement.getAttribute("if")) console.log("STUB: concept='' enumerations combined with if='' not high-performance yet, use filters here");
                    let instances = await VarvEngine.lookupInstances(VarvEngine.getAllImplementingConceptNames(conceptName)); // TODO: Fancy filtering opportunity here
                    let localScopes = await Promise.all(instances.map(async function lookupConcreteTypes(uuid){
                        let concreteConcept = await VarvEngine.getConceptFromUUID(uuid);
                        return [new ConceptInstanceBinding(concreteConcept, uuid)];
                    }));                
                    self.generatePropertyScopes(view, localScopes);
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
        
        // Look at property attribute
        let propertyQuery = this.templateElement.getAttribute("property");
        if ((propertyQuery!==null) && propertyQuery.trim().length>0){
            console.log("Generating property scopes...");
            
            // Monitor property for changes
            view.propertyUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, view.scope, async function propertyAttributeUpdated(property){       
                console.log("Property attribute value is now", property);
                if (property === undefined) throw new Error("Cannot render property '"+propertyAttributeRaw+"' which evaluates to undefined");

                try {
                    let expandedScopes = await Promise.all(localScopes.map(async function expandPropertyScope(localScope){
                        // Sanity checks
                        let binding = await DOMView.getBindingFromScope(property, [...view.scope, ...localScope]);
                        if (!binding) throw new Error("Selecting undefined property '"+property+"' not found in scope");
                        if (!(binding instanceof ConceptInstanceBinding)) throw new Error("Property='"+propertyQuery+"' (currently '"+property+"') must be a property on a concept");

                        // Find the new scope
                        let as = self.templateElement.getAttribute("as");
                        let propertyValue = await binding.getValueFor(property);
                        console.log("Value wat", propertyValue);
                        if (propertyValue !== null) {
                            if (Array.isArray(propertyValue)) {
                                // We need to map the array into additional childscopes
                                // STUB: No sorting of property values in SPEC?
                                return propertyValue.map((arrayEntry, index)=>{
                                    let values = new ValueBinding({});
                                    let newScope = [...localScope];
                                    if (arrayEntry instanceof ConceptInstanceBinding) {         
                                        newScope.push(arrayEntry); // the concept binding itself
                                        values.bindings[".value"] = arrayEntry.uuid;
                                    } else {
                                        // Value only
                                        values.bindings[".value"] = arrayEntry;
                                    }
                                    values.bindings[".index"] = index;

                                    // Allow .value and .index to also be found as property.value or as.value (if defined)
                                    values.bindings[property+".value"] = values.bindings[".value"];
                                    values.bindings[property+".index"] = values.bindings[".index"];
                                    if (as){
                                        values.bindings[as+".value"] = values.bindings[".value"];
                                        values.bindings[as+".index"] = values.bindings[".index"];
                                    }

                                    newScope.push(new PropertyBinding(binding.concept.getProperty(property), binding.uuid));
                                    newScope.push(values);
                                    return newScope;
                                });
                            } else {
                                // Single property value, no duplication
                                if (!(propertyValue instanceof ConceptInstanceBinding)) throw new Error("Cannot use a type for the property attribute that is not a list of references, a list of simple values or a single concept reference: "+propertyValue);

                                // Access uuid as .value, property.value or (optionally) as.value
                                let values = new ValueBinding({
                                    ".value": propertyValue.uuid,
                                    [property+".value"]: propertyValue.uuid
                                });
                                if (as){
                                    values.bindings[as+".value"] = propertyValue.uuid;
                                }

                                return [[
                                    ...localScope,
                                    new ConceptInstanceBinding(propertyValue.concept, propertyValue.uuid),
                                    new PropertyBinding(binding.concept.getProperty(property), binding.uuid),
                                    values
                                ]];
                            }
                        }                    
                    }));
                    
                    // Concat the results into one big array
                    let scopeCollection = [];
                    expandedScopes.forEach((subscopes)=>{
                        subscopes.forEach((actualScope)=>{
                            scopeCollection.push(actualScope);
                        });
                    });
                    
                    console.log("Found", scopeCollection);
                    self.generateConditionalScopes(view, scopeCollection);                         
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

    onScopesUpdated(view, newChildScopes){      
        // Destroy views that are no longer in the new child scopes
        let self = this;
        for (let i = view.childViews.length-1; i>=0; i--){
            let found = false;
            newChildScopes.forEach((newChildScope)=>{
                if (QueryParseNode.fastDeepEqual(view.childViews[i].localScope,newChildScope)) found = true;
            });
            if (!found){         
                view.childViews[i].destroy();
                view.childViews.splice(i,1);
            }
        }
                
        // Move scopes that are in the child list but wrong order
        // TODO: Actually reorder views

        // Add new views for newly added scopes
        // TODO: Actually insert in correct place
        console.log("comparing",view.childViews, newChildScopes);
        newChildScopes.forEach((newChildScope)=>{
            let found = false;
            view.childViews.forEach((childView)=>{
                if (QueryParseNode.fastDeepEqual(childView.localScope,newChildScope)) found = true;
            });
            if (!found){
                let childView = self.children[0].getView(view.getTargetDocument(),[...view.scope, ...newChildScope]);
                childView.localScope = newChildScope;
                view.childViews.push(childView);
            }            
        });
        
        this.stubResetView(view);
    }
    
    stubResetView(view){
        if (view.getNode().parentNode === null) return; // Not in any document yet
        
        // Move all our children with us, in order
        view.childViews.forEach((childView)=>{
            // Insert them before our anchor node
            childView.mountInto(view.getNode().parentNode, view.getNode());
        });
    }
    
    showError(view, message, ex){
        this.onScopesUpdated(view, []);
        view.childViews.push(this.getErrorView(view.getTargetDocument(), view.scope, message, ex));
        this.stubResetView(view);        
        console.log(ex);
    }
    
    static fastDeepEqual(a,b){
        if (a === b) return true;

        if (a && b && typeof a == 'object' && typeof b == 'object') {
          if (a.constructor !== b.constructor) return false;

          var length, i, keys;
          if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;)
              if (!QueryParseNode.fastDeepEqual(a[i], b[i])) return false;
            return true;
          }

          if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
          if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
          if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

          keys = Object.keys(a);
          length = keys.length;
          if (length !== Object.keys(b).length) return false;

          for (i = length; i-- !== 0;)
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

          for (i = length; i-- !== 0;) {
            var key = keys[i];

            if (!QueryParseNode.fastDeepEqual(a[key], b[key])) return false;
          }

          return true;
        }

        if(typeof a === "function" && typeof b === "function") {
            return true;
        }

        // true if both NaN, false otherwise
        return a!==a && b!==b;
        
    };
};

window.QueryParseNode = QueryParseNode;