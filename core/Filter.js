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
    "matches": "matches"
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
                    pass = value !== compareValue;
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

        return pass;
    }
}

class FilterProperty extends Filter {
    /**
     *
     * @param {string} property
     * @param {FilterOps} op
     * @param {any} value
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
                return ["boolean", "number", "string", "concept"];
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
    
    async prepare(lookup){
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
        let lookup = await this.prepare(await VarvEngine.lookupProperty(context.target, localConcept, this.property));
        let value = await lookup.property.getValue(lookup.target);
        let typeCastedValue = this.value;
        try {
            //TODO: Not sure if we should typecast here?
            typeCastedValue = lookup.property.typeCast(this.value);
        } catch(e) {
            //Ignore
        }

        return Filter.filterValue(value, typeCastedValue, this.op, assert);
    }
}
window.FilterProperty = FilterProperty;

class FilterVariable extends Filter {
    /**
     *
     * @param {string} variable
     * @param {FilterOps} op
     * @param {any} value
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
                return ["boolean", "number", "string"];
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
        let variableValue = Action.getVariable(context, this.variable);

        let type = typeof variableValue;

        if(Array.isArray(variableValue)) {
            type = "array";
        }

        if(!this.allowedTypes().includes(type)) {
            throw new Error("Op ["+this.op+"] does not work on variable with value type ["+type+"] from variable ["+this.variable+"]");
        }

        return Filter.filterValue(variableValue, this.value, this.op, assert);
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
                return ["boolean", "number", "string"];
            }
            case FilterOps.matches: {
                return ["string"];
            }
            case FilterOps.unequals: {
                return ["boolean", "number", "string"];
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
        let type = typeof value;

        if(Array.isArray(value)) {
            type = "array";
        }

        if(!this.allowedTypes().includes(type)) {
            throw new Error("This operator ["+this.op+"] does not allow value type ["+type+"]");
        }

        return Filter.filterValue(value, this.value, this.op, assert);
    }
}
window.FilterValue = FilterValue;

class FilterConcept extends Filter {
    constructor(conceptName, includeOthers=true) {
        super();

        this.includeOthers = includeOthers;
        this.conceptName = conceptName;
    }

    async filter(context, localConcept, assert) {
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

        return pass;
    }
}
window.FilterConcept = FilterConcept;

class FilterOr extends Filter {
    constructor(filters) {
        super();

        this.filters = filters;
    }

    async filter(context, localConcept, assert) {
        let pass = false;

        for(let filter of this.filters) {
            pass = pass || await filter.filter(context, localConcept, assert);
        }

        return pass;
    }
}
window.FilterOr = FilterOr;

class FilterAnd extends Filter {
    constructor(filters) {
        super();

        this.filters = filters;
    }

    async filter(context, localConcept, assert) {
        let pass = true;

        for(let filter of this.filters) {
            pass = pass && await filter.filter(context, localConcept, assert);
        }

        return pass;
    }
}
window.FilterAnd = FilterAnd;

class FilterNot extends Filter {
    constructor(filter) {
        super();

        this.notFilter = filter;
    }

    async filter(context, localConcept, assert) {

        if(assert === true) {
            assert = 1;
        }

        let pass = ! (await this.notFilter.filter(context, localConcept, assert?(assert+1):false));

        return pass;
    }
}
window.FilterNot = FilterNot;

class FilterCalc extends Filter {
    constructor(calculation, operator, value) {
        super();

        this.valueFilter = new FilterValue(operator, value);
        this.calculation = calculation;
    }

    async filter(context, localConcept, assert) {
        let result = math.evaluate(this.calculation);

        let pass = await this.valueFilter.filter(result, localConcept, assert);

        return pass;
    }
}

window.FilterCalc = FilterCalc;
