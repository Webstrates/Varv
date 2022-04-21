/**
 *  Property - A Property on a Concept
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

/**
 * Defaults:
 *
 * String: "",
 * Boolean: false,
 * Number: 0,
 * Array: [],
 * Concept: null
 */

/**
 * Property options:
 *
 * number - default, min, max
 * boolean - default
 * string - default, enum, matches
 * array - max
 */

class Property {
    constructor(name, options={}) {
        const self = this;

        this.derivedOldValues = new Map();

        this.cloneData = {
            name: name,
            options: options!=null?JSON.parse(JSON.stringify(options)):null
        }

        //Shorthand
        if(typeof options === "string") {
            let type = options;
            options = {};
            options[type] = {};
        }

        if(Object.keys(options).length > 1 && options.type != null) {
            if(Property.DEBUG) {
                console.group("This property was defined with key 'type':", options);
            }

            let temp = options;

            options = {};

            options[temp.type] = temp;

            delete options[temp.type].type;

            if(Property.DEBUG) {
                console.log(options);
                console.groupEnd();
            }
        }

        this.name = name;
        this.type = Object.keys(options)[0];
        this.options = options[this.type];

        if(this.type === "array" && typeof this.options === "string") {
            this.options = {
                items: this.options
            }
        }

        this.setCallbacks = [];
        this.getCallbacks = [];
        this.updatedCallbacks = [];

        if(this.options.derive != null) {
            this.derived = {};

            if(this.options.derive.transform == null) {
                throw new Error("Missing transform option for derive from:"+name);
            }

            if(this.options.derive.properties) {
                this.derived.properties = this.options.derive.properties;
            }
            this.derived.transform = this.options.derive.transform;
        }
    }

    cloneFresh() {
        return new Property(this.cloneData.name, this.cloneData.options);
    }

    /**
     * @param {Concept} concept
     */
    finishSetup(concept) {
        const self = this;

        if(this.derived != null) {
            if(this.derived.properties != null) {
                this.derived.updateFunction = () => {
                    self.updatedCallbacks.forEach((callback) => {
                        callback();
                    });
                }

                try {
                    this.derived.properties.forEach((propertyName) => {
                        let property = concept.getProperty(propertyName);
                        property.addUpdatedCallback(self.derived.updateFunction);
                    });
                } catch(e) {
                    console.warn(e);
                }
            }
        }
    }

    getType() {
        return this.type;
    }

    isConceptType() {
        if(typeof this.type === "string") {
            return VarvEngine.getConceptFromType(this.type) != null;
        }

        return false;
    }

    isConceptArrayType() {
        if(this.type === "array" && typeof this.options.items === "string") {
            let concept = VarvEngine.getConceptFromType(this.options.items);

            return concept != null;
        }

        return false;
    }
    
    isDerived(){
        return this.derived != null;        
    }

    async removeAllReferences(propertyConceptType, removeUuid) {
        if(Property.DEBUG) {
            console.group("["+propertyConceptType+" - "+this.name+"] Removing references to ["+removeUuid+"]");
        }

        for(let propertyConceptUUID of VarvEngine.getAllUUIDsFromType(propertyConceptType)) {
            let value = await this.getValue(propertyConceptUUID);

            if(this.type === "array") {
                //Concept array property

                let beforeLength = value.length;

                value = value.filter((arrayElm) => {
                    return arrayElm !== removeUuid;
                });

                if(value.length !== beforeLength) {
                    if(Property.DEBUG) {
                        console.log("Found reference in array!");
                    }

                    //We removed something, setValue
                    await this.setValue(propertyConceptUUID, value);
                }
            } else {
                //Concept property
                if(value === removeUuid) {
                    if(Property.DEBUG) {
                        console.log("Found reference!")
                    }
                    await this.setValue(propertyConceptUUID, null);
                }
            }
        }

        if(Property.DEBUG) {
            console.groupEnd();
        }
    }

    holdsConceptOfType(type) {
        return this.type === type || (this.type === "array" && this.options.items === type);
    }

    addUpdatedCallback(callback) {
        this.updatedCallbacks.push(callback);
    }

    removeUpdatedCallback(callback) {
        let index = this.updatedCallbacks.indexOf(callback);
        if (index==-1){
            console.warn("Cannot remove updatedcallback that isn't part of "+this.name+" list of callbacks: "+callback+" list is "+this.updatedCallbacks);
            return;
        }
        this.updatedCallbacks.splice(index, 1);
    }

    addSetCallback(callback) {
        this.setCallbacks.push(callback);
    }

    removeSetCallback(callback) {
        let index = this.setCallbacks.indexOf(callback);
        if (index==-1){
            console.warn("Cannot remove setcallback that isn't part of "+this.name+" list of callbacks: "+callback+" list is "+this.setCallbacks);
            return;
        }
        this.setCallbacks.splice(index, 1);
    }

    addGetCallback(callback) {
        this.getCallbacks.push(callback);
    }

    removeGetCallback(callback) {
        let index = this.getCallbacks.indexOf(callback);
        if (index==-1){
            console.warn("Cannot remove getcallback that isn't part of "+this.name+" list of callbacks: "+callback+" list is "+this.getCallbacks);
            return;
        }
        this.getCallbacks.splice(index, 1);
    }

    validate(value) {
        let validType = false;

        if(value === null) {
            return true;
        }

        switch(this.type) {
            case "number": {
                validType = typeof value === "number";
                break;
            }
            case "string": {
                validType = typeof value === "string";
                break;
            }
            case "boolean": {
                validType = typeof value === "boolean";
                break;
            }
            case "array": {
                validType = Array.isArray(value);
                break;
            }

            default:
                let typeConcept = VarvEngine.getConceptFromType(this.type);
                if( typeConcept != null) {
                    if(typeof value === "string") {
                        let valueConcept = VarvEngine.getConceptFromUUID(value);

                        //If valueconcept is null, we dont know what type it is, pretend its of the correct type.
                        //To fix this, all datastores need to report their known UUID's before they load values

                        validType = valueConcept != null ? (valueConcept.isA(typeConcept.name)) : true;
                    } else {
                        validType = false;
                    }
                } else {
                    console.warn("Unknown type to validate:", this.type);
                }
        }

        // TODO validate value according to options

        let validValue = true;

        if(this.type === "string") {
            if(this.options.enum != null) {
                validValue = this.options.enum.includes(value);
            }
            if(this.options.matches != null) {
                const regexp = new RegExp(this.options.matches);
                validValue = value.match(regexp);
            }
        }

        if(this.type === "number") {
            if(this.options.max != null) {
                validValue = validValue && value <= this.options.max;
            }
            if(this.options.min != null) {
                validValue = validValue && value >= this.options.min;
            }
        }

        if(this.type === "array") {
            if(this.options.max != null) {
                validValue = value.length <= this.options.max;
            }
        }

        return validType && validValue;
    }

    typeCast(inputValue, overrideType = null) {
        if(inputValue == null) {
            return null;
        }

        try {
            const self = this;

            let castedValue = inputValue;

            let type = this.type;

            if (overrideType !== null) {
                type = overrideType;
            }

            switch (type) {
                case "string": {
                    if(typeof inputValue === "string") {
                        return inputValue;
                    }

                    castedValue = "" + inputValue;
                    break;
                }

                case "number": {
                    if(typeof inputValue === "number") {
                        return inputValue;
                    }

                    castedValue = Number(inputValue);
                    if (isNaN(castedValue)) {
                        throw new Error("Unable to typecast [" + inputValue + "] to [number]");
                    }
                    break;
                }

                case "boolean": {
                    if(typeof inputValue === "boolean") {
                        return inputValue;
                    }

                    const inputValueLower = inputValue.toLowerCase();
                    if (inputValueLower !== "true" && inputValueLower !== "false") {
                        throw new Error("Unable to typecast [" + inputValue + "] to [boolean]");
                    }
                    castedValue = inputValueLower === "true";
                    break;
                }

                case "array": {
                    if (Array.isArray(inputValue)) {
                        castedValue = inputValue.map((value) => {
                            return self.typeCast(value, this.options.items);
                        });
                    } else {
                        let parsedArray = JSON.parse(inputValue);

                        if (Array.isArray(parsedArray)) {
                            castedValue = parsedArray.map((value) => {
                                return self.typeCast(value, this.options.items);
                            });
                        } else {
                            throw new Error("Attempted to typecast to an array type, but input value was not an array and could not be parsed as an array: " + inputValue);
                        }
                    }
                    break;
                }

                default:
                    let typeConcept = VarvEngine.getConceptFromType(type);
                    if(typeConcept != null) {
                        return "" + inputValue;
                    }

                    throw new Error("Unknown how to type cast to type: " + type);
            }

            return castedValue;
        } catch(e) {
            throw e;
        }
    }

    async setValue(uuid, value, skipStateChangeTrigger=false) {
        if(this.isDerived()) {
            console.warn("setValue called on a derived property (Might be a left over property in DOMStore from when it was not derived?):", this.name, uuid, value);
            return;
        }

        if(!this.validate(value)) {
            let type = typeof value;
            if(Array.isArray(value)){
                type = "array";
            }
            throw new Error("Value ["+value+":"+(type)+"] does not validate on property ["+this.name+":"+this.type+"]");
        }

        if(this.setCallbacks.length === 0) {
            throw new Error("No setCallbacks available for property ["+this.name+"]");
        }

        let oldValue;
        try {
            oldValue = await this.getValue(uuid);
        } catch (e) {
            //Ignore?
        }

        for(let setCallback of this.setCallbacks) {
            await setCallback(uuid, value);
        }

        await this.updated(uuid, oldValue, value, skipStateChangeTrigger);
    }

    async updated(uuid, oldValue, value, skipStateChangeTrigger=false) {
        for(let updateCallback of this.updatedCallbacks.slice()) {
            await updateCallback(uuid);
        }

        if(!skipStateChangeTrigger) {
            await this.stateChanged(uuid, oldValue, value);
        }
    }

    async deriveValue(uuid) {
        if(Property.DEBUG) {
            console.group("Deriving property ["+this.name+"] from ["+JSON.stringify(this.derived)+"]");
        }

        //Try to derive property
        let currentFakeContext = [{
            target: uuid
        }];

        let lastTransformOutputVariable = null;

        try {
            for (let transform of this.derived.transform) {

                let transformActionName = null;

                if (Property.DEBUG) {
                    console.log("Applying transform:", transform);
                }

                let transformActionOptions = {};

                if (typeof transform === "string") {
                    transformActionName = transform;
                } else {
                    transformActionName = Object.keys(transform)[0];
                    transformActionOptions = Object.values(transform)[0];
                }

                let transformAction = Action.getPrimitiveAction(transformActionName, transformActionOptions);

                await ActionTrigger.before(transformAction, currentFakeContext);
                currentFakeContext = await transformAction.apply(currentFakeContext);
                await ActionTrigger.after(transformAction, currentFakeContext);

                if(Property.DEBUG) {
                    console.log("CurentContext:", currentFakeContext);
                }

                if(transformActionOptions.as != null) {
                    lastTransformOutputVariable = transformActionOptions.as;
                } else {
                    lastTransformOutputVariable = Action.defaultVariableName(transformAction);
                }
            }
        } catch(e) {
            if(e instanceof StopError) {
                console.log("Transform stopped: "+e.message);
            } else {
                throw e;
            }
        }

        if(lastTransformOutputVariable == null) {
            throw new Error("Unable to extract a variable after transform has run, lastTransformOutputVariable was null!");
        }

        let result = null;

        try {
            result = Action.getVariable(currentFakeContext[0], lastTransformOutputVariable);
        } catch(e) {
            switch(this.type) {
                case "array":
                    result = [];
            }
        }

        if(!this.validate(result)) {
            throw new Error("Derived value ["+result+"] does not validate against type ["+this.type+"]");
        }

        if(Property.DEBUG) {
            console.log("Resulting value:", result);
            console.groupEnd();
        }

        return result;
    }

    async getValue(uuid) {
        if(this.derived != null) {
            const derivedOldValue = this.derivedOldValues.get(uuid);
            const derivedValue = await this.deriveValue(uuid);
            this.derivedOldValues.set(uuid, derivedValue);
            if(typeof derivedOldValue !== "undefined" && derivedOldValue !== derivedValue) {
                await this.updated(uuid, derivedOldValue, derivedValue, true);
            }
            return derivedValue;
        }

        if(this.getCallbacks.length === 0) {
            throw new Error("No getCallbacks available for property ["+this.name+"]");
        }

        for(let getCallback of this.getCallbacks) {
            try {
                return this.typeCast(await getCallback(uuid));
            } catch(e) {
                //console.warn("Something went wrong (Using Default):", e);

                // Return default value
                if(this.options.default != null) {
                    return this.options.default;
                }

                switch(this.type) {
                    case "string":
                        return "";
                    case "number":
                        return 0;
                    case "boolean":
                        return false;
                    case "array":
                        return [];
                    default:
                        if(VarvEngine.getConceptFromType(this.type) != null) {
                            return null;
                        }

                        console.warn("Unknown type for default value:", this.type);
                }
            }
        }

        throw new Error("Unable to get value for property ["+this.name+"] on ["+uuid+"]");
    }

    async stateChanged(uuid, oldValue, value) {
        await Trigger.trigger("stateChanged", {
            target: uuid,
            property: this.name,
            variables: {
                "currentValue": value,
                "oldValue": oldValue,
                "property": this.name
            }
        });
    }

    isSame(value1, value2) {
        switch(this.type) {
            case "number":
            case "string":
            case "boolean":
                return value1 === value2;

            case "array": {
                //Check if values are no match
                if(value1.length !== value2.length) {
                    return false;
                }

                //Check each entry
                for(let i = 0; i<value1.length; i++) {
                    if(value1[i] !== value2[i]) {
                        return false;
                    }
                }

                return true;
            }

            default: {
                if(this.isConceptType()) {
                    return value1 === value2;
                }

                throw new Error("["+this.name+": "+this.type+"] Unable to check isSame of ["+value1+"] and ["+value2+"]");
            }
        }
    }
}
Property.DEBUG = false;
window.Property = Property;
