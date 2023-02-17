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
            self.onScopesUpdated(view, []);
        });
        
        
        return view;
    }
    
    // Look at the concept attribute and generate some scopes
    generateConceptScopes(view){
        let self = this;
        let conceptQuery = this.templateElement.getAttribute("concept");
        if (conceptQuery!==null){
            // Need to monitor a list of concept instances
            let conceptUpdatingEvaluation = new UpdatingEvaluation(conceptQuery, view.scope, async function conceptAttributeUpdated(conceptName){                        
                try {
                    // Concept enumeration queries (possibly filtered)
                    if (self.templateElement.getAttribute("property")) console.log("STUB: concept='' enumerations combined with property='' lookups not high-performance yet");
                    if (self.templateElement.getAttribute("if")) console.log("STUB: concept='' enumerations combined with if='' not high-performance yet");
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
            view.addCleanup(conceptUpdatingEvaluation.destroy);
        } else {
            // We can skip straight to property with just the view scope
            self.generatePropertyScopes(view, [[]]);
        }       
    }
    
    // Look at the property attribute and generate additional scopes for each given local scope
    generatePropertyScopes(view, localScopes){
        let self = this;
        let propertyQuery = this.templateElement.getAttribute("property");
        if (propertyQuery!==null){
            throw new Error("property='' not supported yet");
        } else {
            // Skip straight to conditionals with the given local scopes
            self.generateConditionalScopes(view, localScopes);
        }        
    }
    
    // Look at if-attribute and remove local scopes that do not fit
    generateConditionalScopes(view, localScopes){
        let self = this;
        let conditionalQuery = this.templateElement.getAttribute("if");
        if (conditionalQuery!==null){
            // Monitor the if-condition for changes
            if (view.conditionalUpdatingEvaluation) view.conditionalEvaluation.destroy();
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