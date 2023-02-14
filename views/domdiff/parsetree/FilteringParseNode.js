class FilteringParseNode extends ParseNode {
    constructor(templateElement){
        super(templateElement); 
        
        // We are our own child
        this.children.push(this.parseTemplateNode(templateElement, {
            skipFiltering: true
        }));
    }
    
    getView(targetDocument, scope){
        console.log("instantiating filtering for ", this.templateElement);
        let self = this;        
        let view = new ViewParticle(this, scope);
        
        let conceptQuery = this.templateElement.getAttribute("concept");
        let propertyQuery = this.templateElement.getAttribute("property");
        let conditionalQuery = this.templateElement.getAttribute("if");
        
        // Ensure that all inputs are fully evaluated before calling evaluateFilter
        view.needsConcept = conceptQuery!==null;
        view.needsProperty = propertyQuery!==null;        
        view.needsConditional = conditionalQuery!==null;        
        if (view.needsConcept){
            view.conceptUpdatingEvaluation = new UpdatingEvaluation(conceptQuery, scope, function conceptAttributeUpdated(text){                        
                view.needsConcept = false;
                view.concept = text;
                self.evaluateFilter(view, scope);
            });
        }    
        if (view.needsProperty){
            view.propertyUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, scope, function propertyAttributeUpdated(text){                        
                view.needsProperty = false;
                view.property = text;
                self.evaluateFilter(view, scope);
            });
        }   
        if (view.needsConditional){
            view.conditionalUpdatingEvaluation = new UpdatingEvaluation(propertyQuery, scope, function conditionalAttributeUpdated(text){                        
                view.needsConditional = false;
                view.conditional = text;
                self.evaluateFilter(view, scope);
            });
        }             
        
        return view;
    }
    
    async evaluateFilter(view, scope){
        if (view.needsConcept||view.needsProperty||view.needsConditional) return; // Not ready yet
        
        // TODO: Setup context based on scope
        let context = {};
        
        // Concept enumeration queries (possibly filtered)
        if (view.concept){ 
            if (view.property) throw new Exception("Concept enumerations with property lookups not supported yet");
            if (view.conditional) throw new Exception("Concept enumerations with conditionals not supported yet");

            let instances = await VarvEngine.lookupInstances(VarvEngine.getAllImplementingConceptNames(view.concept), null, context);
        } else {
            // Scope-based queries
        }
        
    }
};

window.FilteringParseNode = FilteringParseNode;