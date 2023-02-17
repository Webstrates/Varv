/**
 *  Filter - Filtering functionality
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

window.FilterOps = Object.freeze({
    "equals": "equals",
    "unequals": "unequals",
    "greaterThan": "greaterThan",
    "lessThan": "lessThan",
    "greaterOrEquals": "greaterOrEquals",
    "lessOrEquals": "lessOrEquals",
    "startsWith": "startsWith",
    "endsWith": "endsWith",
    "includes": "includes",
    "includesAny": "includesAny",
    "includesAll": "includesAll",
    "matches": "matches",
    "hasProperty": "hasProperty",
    "propertyType": "propertyType"
});

class Filter {
    /**
     * @param {VarvContext} context - The context to filter
     * @param {Concept} localConcept - The local concept
     * @returns {Promise<boolean>} - Returns true if the given context should be kept, false if it should be discarded
     */
    async filter(context, localConcept, assert=false) {
        console.warn("Should override 'filter' in subclass");
        return false;
    }

    /**
     * Filter based on the given values and operator
     * @param {any} value
     * @param {any} compareValue
     * @param {FilterOps} op
     * @returns {boolean}
     */
    static filterValue(value, compareValue, op, assert = false) {
        let pass = false;

        let markStart = VarvPerformance.start();

        if(value == null) {
            switch(op) {
                case FilterOps.equals: {
                    pass = value === compareValue;
                    break;
                }
                case FilterOps.unequals: {
                    pass = value !== compareValue;
                    break;
                }

                default: {
                    console.warn("Filtering with "+op+" on null, is not possible, resulting in false");
                    pass = false;
                }
            }
        } else {
            switch (op) {
                case FilterOps.equals: {
                    if(Array.isArray(value) && Array.isArray(compareValue)) {
                        pass = JSON.stringify(value) === JSON.stringify(compareValue);
                    } else {
                        pass = value === compareValue;
                    }
                    break;
                }
                case FilterOps.unequals: {
                    if(Array.isArray(value) && Array.isArray(compareValue)) {
                        pass = JSON.stringify(value) !== JSON.stringify(compareValue);
                    } else {
                        pass = value !== compareValue;
                    }
                    break;
                }
                case FilterOps.matches: {
                    let regexp = new RegExp(compareValue);
                    pass = value.match(regexp) !== null;
                    break;
                }
                case FilterOps.greaterThan: {
                    pass = value > compareValue;
                    break;
                }
                case FilterOps.lessThan: {
                    pass = value < compareValue;
                    break;
                }
                case FilterOps.greaterOrEquals: {
                    pass = value >= compareValue;
                    break;
                }
                case FilterOps.lessOrEquals: {
                    pass = value <= compareValue;
                    break;
                }
                case FilterOps.startsWith: {
                    pass = value.startsWith(compareValue);
                    break;
                }
                case FilterOps.endsWith: {
                    pass = value.endsWith(compareValue);
                    break;
                }
                case FilterOps.includes: {
                    pass = value.indexOf(compareValue) !== -1;
                    break;
                }
                case FilterOps.includesAny: {
                    if (Array.isArray(compareValue)) {
                        pass = false;
                        for (let arrayValue of compareValue) {
                            if (value.indexOf(arrayValue) !== -1) {
                                pass = true;
                                break;
                            }
                        }
                    } else {
                        pass = value.indexOf(compareValue) !== -1;
                    }
                    break;
                }
                case FilterOps.includesAll: {
                    if (Array.isArray(compareValue)) {
                        pass = true;
                        for (let arrayValue of compareValue) {
                            pass = pass && value.indexOf(arrayValue) !== -1;
                        }
                    } else {
                        pass = value.indexOf(compareValue) !== -1;
                    }
                    break;
                }

                default:
                    VarvPerformance.stop("Filter.filterValue.Error", markStart);
                    throw new Error("Unknown op: " + op);
            }
        }

        if(assert === true || assert > 1) {
            if(assert > 1 && assert % 2 == 0) {
                console.assert(!pass, "NOT: Value: ",value," should not be ",op.toString(),compareValue);
            } else {
                console.assert(pass, "Value: ",value," should be ",op.toString(),compareValue);
            }
        }

        VarvPerformance.stop("Filter.filterValue", markStart);

        return pass;
    }
}

/**
 * Filter based on a property
 *
 * @example
 * //Filter based on property "myProperty" being equal to "someValue"
 * {
 *     "property": "myProperty",
 *     "equals": "someValue"
 * }
 * @example
 * //Filter based on string property "myProperty" starting with "someValue"
 * {
 *     "property": "myProperty",
 *     "startsWith": "someValue"
 * }
 */
class FilterProperty extends Filter {
    /**
     *
     * @param {string} property The property to filter on
     * @param {FilterOps} op The operator to use
     * @param {any} value The value to compare to
     */
    constructor(property, op, value) {
        super();

        this.property = property;
        this.op = op;
        this.value = value;
    }

    /**
     *
     * @param {FilterOps} filterOp - The filter op to get allowed types from
     * @returns {string[]} - An array of allowed types
     */
    allowedTypes() {
        switch(this.op) {
            case FilterOps.equals: {
                return ["boolean", "number", "string", "concept", "array"];
            }
            case FilterOps.matches: {
                return ["string"];
            }
            case FilterOps.unequals: {
                return ["boolean", "number", "string", "concept", "array"];
            }
            case FilterOps.greaterThan: {
                return ["number", "string"];
            }
            case FilterOps.lessThan: {
                return ["number", "string"];
            }
            case FilterOps.greaterOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.lessOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.startsWith: {
                return ["string"];
            }
            case FilterOps.endsWith: {
                return ["string"];
            }
            case FilterOps.includes: {
                return ["string", "array"];
            }
            case FilterOps.includesAny: {
                return ["array"];
            }
            case FilterOps.includesAll: {
                return ["array"];
            }
        }
    }
    
    prepare(lookup){
        if(lookup === null) {
            throw new Error("No property ["+this.property+"] found!");
        }

        let property = lookup.property;
        let type = property.type;
        if(property.isConceptType()) {
            type = "concept";
        }

        if(!this.allowedTypes().includes(type)) {
            throw new Error("Op ["+this.op+"] does not work on property type ["+property.type+"] from property ["+property.name+"]");
        }
        
        return {concept:lookup.concept, property:property, target:lookup.target, type:type};
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let lookupProperty = await VarvEngine.lookupProperty(context.target, localConcept, this.property)

        let lookup = this.prepare(lookupProperty);
        let value = await lookup.property.getValue(lookup.target);

        let typeCastedValue = this.value;
        try {
            //TODO: Not sure if we should typecast here?
            typeCastedValue = lookup.property.typeCast(this.value);
        } catch(e) {
            //Ignore
        }

        let result = Filter.filterValue(value, typeCastedValue, this.op, assert);

        VarvPerformance.stop("FilterProperty.filter", markStart);

        return result;
    }
}
window.FilterProperty = FilterProperty;

/**
 * Filter based on a variable
 *
 * @example
 * //Filter based on variable "myVariable" being equal to "someValue"
 * {
 *     "variable": "myVariable",
 *     "equals": "someValue"
 * }
 * @example
 * //Filter based on string variable "myVariable" starting with "someValue"
 * {
 *     "variable": "myVariable",
 *     "startsWith": "someValue"
 * }
 */
class FilterVariable extends Filter {
    /**
     *
     * @param {string} variable The variable to filter on
     * @param {FilterOps} op The operator to use
     * @param {any} value The value to compare to
     */
    constructor(variable, op, value) {
        super();

        this.variable = variable;
        this.op = op;
        this.value = value;
    }

    /**
     * @returns {string[]} - An array of allowed types
     */
    allowedTypes() {
        switch(this.op) {
            case FilterOps.equals: {
                return ["boolean", "number", "string", "array"];
            }
            case FilterOps.matches: {
                return ["string"];
            }
            case FilterOps.unequals: {
                return ["boolean", "number", "string", "array"];
            }
            case FilterOps.greaterThan: {
                return ["number", "string"];
            }
            case FilterOps.lessThan: {
                return ["number", "string"];
            }
            case FilterOps.greaterOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.lessOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.startsWith: {
                return ["string"];
            }
            case FilterOps.endsWith: {
                return ["string"];
            }
            case FilterOps.includes: {
                return ["string", "array"];
            }
            case FilterOps.includesAny: {
                return ["array"];
            }
            case FilterOps.includesAll: {
                return ["array"];
            }
        }
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let variableValue = Action.getVariable(context, this.variable);

        let type = typeof variableValue;

        if(Array.isArray(variableValue)) {
            type = "array";
        }

        if(!this.allowedTypes().includes(type)) {
            VarvPerformance.stop("FilterVariable.filter.Error", markStart);
            throw new Error("Op ["+this.op+"] does not work on variable with value type ["+type+"] from variable ["+this.variable+"]");
        }

        let result = Filter.filterValue(variableValue, this.value, this.op, assert);

        VarvPerformance.stop("FilterVariable.filter", markStart);

        return result;
    }
}
window.FilterVariable = FilterVariable;

class FilterValue extends Filter {
    /**
     *
     * @param {FilterOps} op
     * @param {any} value
     */
    constructor(op, value) {
        super();

        this.op = op;
        this.value = value;
    }

    /**
     * @returns {string[]} - An array of allowed types
     */
    allowedTypes() {
        switch(this.op) {
            case FilterOps.equals: {
                return ["boolean", "number", "string", "array"];
            }
            case FilterOps.matches: {
                return ["string"];
            }
            case FilterOps.unequals: {
                return ["boolean", "number", "string", "array"];
            }
            case FilterOps.greaterThan: {
                return ["number", "string"];
            }
            case FilterOps.lessThan: {
                return ["number", "string"];
            }
            case FilterOps.greaterOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.lessOrEquals: {
                return ["number", "string"];
            }
            case FilterOps.startsWith: {
                return ["string"];
            }
            case FilterOps.endsWith: {
                return ["string"];
            }
            case FilterOps.includes: {
                return ["string", "array"];
            }
            case FilterOps.includesAny: {
                return ["array"];
            }
            case FilterOps.includesAll: {
                return ["array"];
            }
        }
    }

    async filter(value, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let type = typeof value;

        if(Array.isArray(value)) {
            type = "array";
        }

        if(!this.allowedTypes().includes(type)) {
            VarvPerformance.stop("FilterValue.filter.Error", markStart);
            throw new Error("This operator ["+this.op+"] does not allow value type ["+type+"]");
        }

        let result = Filter.filterValue(value, this.value, this.op, assert);

        VarvPerformance.stop("FilterValue.filter", markStart);

        return result;
    }
}
window.FilterValue = FilterValue;

/**
 * Filters based on concept
 *
 * @example
 * //Filter concepts that are not of type "myConceptType", including inherited concepts
 * {
 *     "concept": "myConceptType",
 *     "includeOthers": true
 * }
 *
 * //Filter concepts that are not of type "myConceptType", excluding inherited concepts
 * {
 *     "concept": "myConceptType",
 *     "includeOthers": false
 * }
 */
class FilterConcept extends Filter {
    constructor(conceptName, includeOthers=true) {
        super();

        this.includeOthers = includeOthers;
        this.conceptName = conceptName;
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let concept = await VarvEngine.getConceptFromUUID(context.target);

        if(concept == null) {
            return false;
        }

        let pass = false;

        if (this.includeOthers){
            // Check if concept.name or any otherConcept is correct
            pass = concept.isA(this.conceptName);
        } else {
            pass = concept.name === this.conceptName;
        }

        if(assert === true || assert > 1) {
            if(assert > 1 && assert % 2 == 0) {
                //Negated assert?
                console.assert(!pass, "NOT: Concept: "+concept.name+" is a "+this.conceptName+" when it should not be!");
            } else {
                //Normal assert
                console.assert(pass, "Concept: "+concept.name+" is not a "+this.conceptName+" when it should have been!");
            }
        }

        VarvPerformance.stop("FilterConcept.filter", markStart);

        return pass;
    }
}
window.FilterConcept = FilterConcept;

/**
 * Filter based on multiple other filters, if any filter passes, this passes
 *
 * @example
 * {
 *     "or": [
 *         {"property": "myProperty", "equals": "someValue"},
 *         {"property": "myProperty", "equals": "someOtherValue"},
 *     ]
 * }
 */
class FilterOr extends Filter {
    constructor(filters) {
        super();

        this.filters = filters;
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let pass = false;

        let promises = [];

        for(let filter of this.filters) {
            promises.push(filter.filter(context, localConcept, assert));
        }

        let filterResult = await Promise.all(promises);
        for(let result of filterResult) {
            pass = pass || result;
        }

        VarvPerformance.stop("FilterOr.filter", markStart);

        return pass;
    }
}
window.FilterOr = FilterOr;

/**
 * Filter based on multiple other filters, if all filter passes, this passes
 *
 * @example
 * {
 *     "and": [
 *         {"property": "myProperty", "equals": "someValue"},
 *         {"property": "myProperty", "equals": "someOtherValue"},
 *     ]
 * }
 */
class FilterAnd extends Filter {
    constructor(filters) {
        super();

        this.filters = filters;
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let pass = true;

        let promises = [];

        for(let filter of this.filters) {
            promises.push(filter.filter(context, localConcept, assert));
        }

        let filterResult = await Promise.all(promises);
        for(let result of filterResult) {
            pass = pass && result;
        }

        VarvPerformance.stop("FilterAnd.filter", markStart);

        return pass;
    }
}
window.FilterAnd = FilterAnd;

/**
 * Filter based on other filter, if the other filter passes, this does not, and vice versa
 *
 * @example
 * {
 *     "not": {"property": "myProperty", "equals": "someValue"}
 * }
 */
class FilterNot extends Filter {
    constructor(filter) {
        super();

        this.notFilter = filter;
    }

    async filter(context, localConcept, assert) {

        let markStart = VarvPerformance.start();

        if(assert === true) {
            assert = 1;
        }

        let pass = ! (await this.notFilter.filter(context, localConcept, assert?(assert+1):false));

        VarvPerformance.stop("FilterNot.filter", markStart);

        return pass;
    }
}
window.FilterNot = FilterNot;

/**
 * Filter based on some calculation
 *
 * @example
 * {
 *     "calculation": "10 + $someVariable$ + $someProperty$",
 *     "equals": 1010
 * }
 */
class FilterCalc extends Filter {
    constructor(calculation, operator, value) {
        super();

        this.valueFilter = new FilterValue(operator, value);
        this.calculation = calculation;
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let result = math.evaluate(this.calculation);

        let pass = await this.valueFilter.filter(result, localConcept, assert);

        VarvPerformance.stop("FilterCalc.filter", markStart);

        return pass;
    }
}

window.FilterCalc = FilterCalc;

/**
 * Filters based on if concept has a property or not
 *
 * @example
 * {
 *     "hasProperty": "somePropertyName"
 * }
 */
class FilterPropertyExists extends Filter {
    constructor(property) {
        super();

        this.property = property;
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let pass = true;

        try {
            let concept = await VarvEngine.getConceptFromUUID(context.target);
            concept.getProperty(this.property);
        } catch(e) {
            //Silent fail, but mark that we saw no property
            pass = false;
        }

        VarvPerformance.stop("FilterPropertyExists.filter", markStart);

        return pass;
    }
}
window.FilterPropertyExists = FilterPropertyExists;

/**
 * Filters based on property type
 *
 * @example
 * //Filter all where property "myProperty" is not of type "string" or "number"
 * {
 *     "property": "myProperty",
 *     "propertyType": ["number", "string"]
 * }
 *
 * @example
 * //Filter all where property "myProperty" is not of type "concept" or "concept[]"
 * {
 *     "property": "myProperty",
 *     "propertyType": ["array[concept]", "concept"]
 * }
 */

class FilterPropertyType extends Filter {
    constructor(property, types) {
        super();

        this.property = property;
        this.types = types;

        if(!Array.isArray(this.types)) {
            this.types = [this.types];
        }
    }

    async filter(context, localConcept, assert) {
        let markStart = VarvPerformance.start();

        let pass = false;

        try {
            let concept = await VarvEngine.getConceptFromUUID(context.target);
            let property = concept.getProperty(this.property);

            let type = property.getFullTypeString();

            if(Array.isArray(type)) {
                for(let t of type) {
                    if(this.types.includes(t)) {
                        pass = true;
                        break;
                    }
                }
            } else {
                pass = this.types.includes(type);
            }
        } catch(e) {
            //Silent ignore
        }

        VarvPerformance.stop("FilterPropertyType.filter", markStart);

        return pass;
    }
}
window.FilterPropertyType = FilterPropertyType;