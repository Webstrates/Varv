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
        
        let conceptQuery = this.templateElement.getAttribute("concept");
        let propertyQuery = this.templateElement.getAttribute("property");
        let conditionalQuery = this.templateElement.getAttribute("if");
        let anchorNode = targetDocument.createProcessingInstruction("whenjs-query-anchor", {conceptQuery:conceptQuery,propertyQuery:propertyQuery,conditionalQuery:conditionalQuery});
        let view = new ViewParticle(anchorNode, this, scope);
        
        // Ensure that all inputs are fully evaluated before calling evaluateFilter
        view.childViews = [];
        view.needsConcept = conceptQuery!==null;
        view.needsProperty = propertyQuery!==null;        
        view.needsConditional = conditionalQuery!==null;        
        if (view.needsConcept){
            view.conceptUpdatingEvaluation = new UpdatingEvaluation(conceptQuery, scope, function conceptAttributeUpdated(text){                        
                view.needsConcept = false;
                view.concept = text;
                self.evaluateQuery(view);
            });
        }    
        if (view.needsProperty){
            view.propertyUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, scope, function propertyAttributeUpdated(text){                        
                view.needsProperty = false;
                view.property = text;
                self.evaluateQuery(view);
            });
        }   
        if (view.needsConditional){
            view.conditionalUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, scope, function conditionalAttributeUpdated(text){                        
                view.needsConditional = false;
                view.conditional = text;
                self.evaluateQuery(view);
            });
        }             
        
        return view;
    }
    
    async evaluateQuery(view){
        if (view.needsConcept||view.needsProperty||view.needsConditional) return; // Not ready yet
        
        // Create the resulting set of child scopes for this query
        let scopes = []; // Start out with no results
                
        // Concept enumeration queries (possibly filtered)
        if (view.concept){ 
            if (view.property) throw new Exception("Concept enumerations with property lookups not supported yet");
            if (view.conditional) throw new Exception("Concept enumerations with conditionals not supported yet");
            let instances = await VarvEngine.lookupInstances(VarvEngine.getAllImplementingConceptNames(view.concept));
            scopes = await Promise.all(instances.map(async function lookupConcreteTypes(uuid){
                let concreteConcept = await VarvEngine.getConceptFromUUID(uuid);
                return [new ConceptInstanceBinding(concreteConcept, uuid)];
            }));
            
            // TODO: Add concept added listener here
        } else {
            // Scope-based queries
        }
                
        // Update view
        this.onScopesUpdated(view, scopes);
        
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
            }            
        });
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
              if (!equal(a[i], b[i])) return false;
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

            if (!equal(a[key], b[key])) return false;
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