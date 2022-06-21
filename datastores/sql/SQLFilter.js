window.SQLFilter = {};
SQLFilter.registeredFilters = [];

// AND
class SQLFilterAnd {
    constructor(query){
        let self = this;
        self.filters = [];
        
        query.filters.forEach(filter =>{
            let filterClass = SQLDataStore.getFilterClass(filter);
            if (!filterClass) throw new Error("SQLFilter: Unsupported filter in AND list: " + filter.constructor.name);
            self.filters.push(new filterClass(filter));
        });        
    }
    
    async getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList){
        return "("+(await Promise.all(this.filters.map(async (filter) => {
            return await filter.getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList);
        }))).join(") AND (")+")";
    }
}
SQLFilter.registeredFilters["SQLFilterAnd"] = SQLFilterAnd;


// OR
class SQLFilterOr {
    constructor(query){
        let self = this;
        self.filters = [];
        
        query.filters.forEach(filter =>{
            let filterClass = SQLDataStore.getFilterClass(filter);
            if (!filterClass) throw new Error("SQLFilter: Unsupported filter in OR list: "+ filter.constructor.name);
            self.filters.push(new filterClass(filter));
        });
    }
    
    async getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList){
        return "("+(await Promise.all(this.filters.map(async (filter) => {
            return await filter.getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList);
        }))).join(") OR (")+")";
    }
}
SQLFilter.registeredFilters["SQLFilterOr"] = SQLFilterOr;

// NOT
class SQLFilterNot {
    constructor(query){
        let self = this;

        let filterClass = SQLDataStore.getFilterClass(query.notFilter);
        if (!filterClass) throw new Error("SQLFilter: Unsupported filter in NOT:"+ query.notFilter.constructor.name);
        self.filter = new filterClass(query.notFilter);
    }
    
    async getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList){
        return "NOT ("+(await this.filter.getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList))+")";
    }
}
SQLFilter.registeredFilters["SQLFilterNot"] = SQLFilterNot;

// Concept
class SQLFilterConcept {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList){        
        if (this.query.includeOthers){
            let implementingConcepts = VarvEngine.getAllImplementingConcepts(this.query.conceptName);
            let orList = implementingConcepts.map(concept=>concept.name).join("\", \"");
            return "type IN (\""+orList+"\")"; // TODO: escape + - && || ! ( ) { } [ ] ^ " ~ * ? : \
        } else {
            return "type = '"+this.query.conceptName+"'"; // TODO: escape + - && || ! ( ) { } [ ] ^ " ~ * ? : \
        }
    }
}
SQLFilter.registeredFilters["SQLFilterConcept"] = SQLFilterConcept;

// Property
class SQLFilterProperty {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    async getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList){
        let lookedUpProperty = await VarvEngine.lookupProperty(VarvEngine.getConceptFromType(primaryResultConceptName), localConcept, this.query.property);
        if (!lookedUpProperty){
            throw new Error("FIXME: Precondition failed. No unresolved references to properties should exist at this point EXCEPT those referring to the target type to be filtered (the primary type)", this.query.property);
        }

        let lookup = await this.query.prepare(lookedUpProperty);
        let sqlPropertyName = lookup.property.name;
        switch (lookup.property.type){
            case "string":
                sqlPropertyName+=".sv";
                break;
            case "number":
                sqlPropertyName+=".nv";
                break;                
            case "boolean":
                sqlPropertyName+=".bv";
                break;   
            case "array": 
                switch (lookup.property.getArrayType()){
                    case "string":
                        sqlPropertyName+=".sa";
                        break;
                    case "number":
                        sqlPropertyName+=".na";
                        break;
                    case "ba":
                        sqlPropertyName+=".ba";
                        break;
                    default:
                        if (lookup.property.isConceptArrayType()){
                            sqlPropertyName+=".ra";
                            break;
                        }
                        throw new Error("SQLDatastore: unsupported array data type" + lookup.property);
                }
                break;
            default:
                if (lookup.property.isConceptType()){
                    sqlPropertyName+=".rv";
                    break;                            
                }
                throw new Error("SQLDatastore: unsupported data type" + lookup.property.type);
        }            
        
        sensitivityList.push(sqlPropertyName);        
        
        switch (this.query.op){
            case FilterOps.greaterThan:
                return "`"+sqlPropertyName + "`.value>"+this.query.value;
            case FilterOps.lessThan:
                return "`"+sqlPropertyName + "`.value<"+this.query.value;
            case FilterOps.greaterOrEquals:
                return "`"+sqlPropertyName + "`.value>="+this.query.value;                    
            case FilterOps.lessOrEquals:
                return "`"+sqlPropertyName + "`.value<="+this.query.value;                    
            case FilterOps.startsWith:
                return "`"+sqlPropertyName + "`.value LIKE \""+this.query.value.replaceAll("\"", "\\\"")+"%\""; // TODO: Escape %
            case FilterOps.endsWith:
                return "`"+sqlPropertyName + "`.value LIKE \"%"+this.query.value.replaceAll("\"", "\\\"")+"\""; // TODO: Escape %
            case FilterOps.includesAll:
                if (Array.isArray(this.query.value)){
                    return this.query.value.map(value=>"`"+sqlPropertyName + "`.value LIKE \"%"+value.replaceAll("\"", "\\\"")+"%\"").join(" AND "); // TODO: Escape %
                } else {
                    return "`"+sqlPropertyName + "`.value LIKE \"%"+this.query.value.replaceAll("\"", "\\\"")+"%\""; // TODO: Escape %
                }            
            case FilterOps.includesAny:
            case FilterOps.includes:
                if (Array.isArray(this.query.value)){
                    return this.query.value.map(value=>"`"+sqlPropertyName + "`.value LIKE \"%"+value.replaceAll("\"", "\\\"")+"%\"").join(" OR "); // TODO: Escape %
                } else {
                    return "`"+sqlPropertyName + "`.value LIKE \"%"+this.query.value.replaceAll("\"", "\\\"")+"%\""; // TODO: Escape %
                }            
            case FilterOps.equals:
                return "`"+sqlPropertyName + "`.value = \""+this.query.value.replaceAll("\"", "\\\"")+"\""; 
            case FilterOps.unequals:
                return "NOT `"+sqlPropertyName + "`.value = \""+this.query.value.replaceAll("\"", "\\\"")+"\"";
            case FilterOps.matches:
                return "`"+sqlPropertyName + "`.value REGEXP \""+this.query.value.replaceAll("\"", "\\\"")+"\""; 
            
            default:
                throw new Error("FIXME: Unsupported filter op",this.query.op);
        }
    }
}
SQLFilter.registeredFilters["SQLFilterProperty"] = SQLFilterProperty;


// Variable
class SQLFilterVariable {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getSQLQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the variable cannot change
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: SQLFilterVariable expression "+this.query.variable+" "+this.query.op+" "+this.query.value+" is always "+isTrue+" at this point, but the query mapper does not have anything to map that to yet");
    }
}
SQLFilter.registeredFilters["SQLFilterVariable"] = SQLFilterVariable;

// Variable
class SQLFilterValue {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getSQLQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the variable cannot change
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: SQLFilterValue expression "+this.query.value+" "+this.query.op+" "+context+" is always "+isTrue+" at this point, but the query mapper does not prune the query tree for static nodes yet");
    }
}
SQLFilter.registeredFilters["SQLFilterValue"] = SQLFilterValue;

// Calc
class SQLFilterCalc {
    constructor(query){        
        let self = this;
        self.query = query;
    }
    
    getSQLQuery(primaryResultConceptName, context, localConcept){
        // TODO: This is either always true or always false - the calculation cannot change if all inputs are resolved
        // STUB: Only handles static calculations
        
        let isTrue = this.query.filter(context, localConcept);
        throw new Error("FIXME: SQLFilterCalc expression "+this.query.calculation+" "+this.query.valueFilter.op+" "+this.query.valueFilter.value+" is always "+isTrue+" at this point, but the query mapper does not prune the query tree for static nodes yet");
    }
}
SQLFilter.registeredFilters["SQLFilterCalc"] = SQLFilterCalc;
