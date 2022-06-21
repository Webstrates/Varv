window.LuceneFilter = {};
LuceneFilter.registeredFilters = [];

// AND
class LuceneFilterAnd {
    constructor(query){
        let self = this;
        self.filters = [];
        
        query.filters.forEach(filter =>{
            let filterClass = LuceneDataStore.getFilterClass(filter);
            if (!filterClass) throw new Error("LuceneFilter: Unsupported filter in AND list: " + filter.constructor.name);
            self.filters.push(new filterClass(filter));
        });        
    }
    
    async getLuceneQuery(primaryResultConceptName, context, localConcept){
        return "("+(await Promise.all(this.filters.map(async filter => await filter.getLuceneQuery(primaryResultConceptName, context, localConcept)))).join(") AND (")+")";
    }
}
LuceneFilter.registeredFilters["LuceneFilterAnd"] = LuceneFilterAnd;


// OR
class LuceneFilterOr {
    constructor(query){
        let self = this;
        self.filters = [];
        
        query.filters.forEach(filter =>{
            let filterClass = LuceneDataStore.getFilterClass(filter);
            if (!filterClass) throw new Error("LuceneFilter: Unsupported filter in OR list: "+ filter.constructor.name);
            self.filters.push(new filterClass(filter));
        });
    }
    
    async getLuceneQuery(primaryResultConceptName, context, localConcept){
        return "("+(await Promise.all(this.filters.map(async filter => await filter.getLuceneQuery(primaryResultConceptName, context, localConcept)))).join(") OR (")+")";
    }
}
LuceneFilter.registeredFilters["LuceneFilterOr"] = LuceneFilterOr;

// NOT
class LuceneFilterNot {
    constructor(query){
        let self = this;

        let filterClass = LuceneDataStore.getFilterClass(query.notFilter);
        if (!filterClass) throw new Error("LuceneFilter: Unsupported filter in NOT:"+ query.notFilter.constructor.name);
        self.filter = new filterClass(query.notFilter);
    }
    
    async getLuceneQuery(primaryResultConceptName, context, localConcept){
        return "NOT("+(await this.filter.getLuceneQuery(primaryResultConceptName, context, localConcept))+")";
    }
}
LuceneFilter.registeredFilters["LuceneFilterNot"] = LuceneFilterNot;

// Concept
class LuceneFilterConcept {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getLuceneQuery(){
        if (this.query.includeOthers){
            let implementingConcepts = VarvEngine.getAllImplementingConcepts(this.query.conceptName);
            if (implementingConcepts.length===0){
                throw new Error("Cannot construct query with concept filtering on '"+this.query.conceptName+"' because the concept does not exist in any implementation");
            }
            let orList = implementingConcepts.map(concept=>concept.name).join(" ");
            return LuceneDataStore.TYPE_PROPERTY + ":("+orList+")"; // TODO: escape + - && || ! ( ) { } [ ] ^ " ~ * ? : \
        } else {
            return LuceneDataStore.TYPE_PROPERTY + ":("+this.query.conceptName+")"; // TODO: escape + - && || ! ( ) { } [ ] ^ " ~ * ? : \
        }
    }
}
LuceneFilter.registeredFilters["LuceneFilterConcept"] = LuceneFilterConcept;

// Property
class LuceneFilterProperty {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    async getLuceneQuery(primaryResultConceptName, context, localConcept){
        let lookedUpProperty = await VarvEngine.lookupProperty(VarvEngine.getConceptFromType(primaryResultConceptName), localConcept, this.query.property);
        if (!lookedUpProperty){
            throw new Error("FIXME: Precondition failed. No unresolved references to properties should exist at this point EXCEPT those referring to the target type to be filtered (the primary type)", this.query.property);
        }

        let lookup = await this.query.prepare(lookedUpProperty);
        let lucenePropertyName = lookup.property.name;
        switch (lookup.property.type){
            case "string":
                lucenePropertyName+=".sv";
                break;
            case "number":
                lucenePropertyName+=".nv";
                break;                
            case "boolean":
                lucenePropertyName+=".bv";
                break;   
            default:
                if (lookup.property.isConceptType()){
                    lucenePropertyName+=".rv";
                    break;                            
                }
                throw new Error("LuceneDatastore: unsupported data type" + lookup.property.type);
        }            
        
        // TODO: Escape query value
        
        switch (this.query.op){
            case FilterOps.greaterThan:
                return lucenePropertyName + ":{"+this.query.value+" TO *]";
            case FilterOps.lessThan:
                return lucenePropertyName + ":[* TO "+this.query.value+"}";
            case FilterOps.greaterOrEquals:
                return lucenePropertyName + ":["+this.query.value+" TO *]";
            case FilterOps.lessOrEquals:
                return lucenePropertyName + ":[* TO "+this.query.value+"]";
            case FilterOps.startsWith:
                return lucenePropertyName + "__exact:"+this.query.value.replace(" ", "\\ ");
            case FilterOps.endsWith:
                return lucenePropertyName + "__exact:*"+this.query.value.replace(" ", "\\ ");
            case FilterOps.includes:
                if (this.query.value.includes(" ")){
                    return lucenePropertyName + "__exact:*"+this.query.value.replace(" ", "\\ ")+"*";
                } else {
                    return lucenePropertyName + ":*"+this.query.value+"*";
                }
            case FilterOps.equals:
                return lucenePropertyName + "__exact:"+this.query.value.replace(" ", "\\ "); 
            case FilterOps.unequals:
                return lucenePropertyName + "__exact:-"+this.query.value.replace(" ", "\\ "); 
            case FilterOps.matches:
            case FilterOps.includesAny:
            case FilterOps.includesAll:
            default:
                throw new Error("FIXME: Unsupported filter op",this.query.op);
        }
    }
}
LuceneFilter.registeredFilters["LuceneFilterProperty"] = LuceneFilterProperty;


// Variable
class LuceneFilterVariable {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getLuceneQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the variable cannot change
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: LuceneFilterVariable expression "+this.query.variable+" "+this.query.op+" "+this.query.value+" is always "+isTrue+" at this point, but the query mapper does not have anything to map that to yet");
    }
}
LuceneFilter.registeredFilters["LuceneFilterVariable"] = LuceneFilterVariable;

// Variable
class LuceneFilterValue {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getLuceneQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the variable cannot change
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: LuceneFilterValue expression "+this.query.value+" "+this.query.op+" "+context+" is always "+isTrue+" at this point, but the query mapper does not prune the query tree for static nodes yet");
    }
}
LuceneFilter.registeredFilters["LuceneFilterValue"] = LuceneFilterValue;

// Calc
class LuceneFilterCalc {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getLuceneQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the calculation cannot change if all inputs are resolved
        // STUB: Only handles static calculations
        
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: LuceneFilterCalc expression "+this.query.calculation+" "+this.query.valueFilter.op+" "+this.query.valueFilter.value+" is always "+isTrue+" at this point, but the query mapper does not prune the query tree for static nodes yet");
    }
}
LuceneFilter.registeredFilters["LuceneFilterCalc"] = LuceneFilterCalc;
