/**
 *  YAMLJSONConverter - Convert between JSON and YAML program code
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

class YAMLJSONConverter {
    /**
     * True/False depending on if the string code can be parsed as YAML
     * @param {string} code
     */
    static isYAML(code) {
        try {
            jsyaml.load(code);
            return true;
        } catch(e) {
            //Ignore
        }

        return false;
    }

    /**
     * True/False depending on if the string code can be parsed as JSON
     * @param {string} code
     */
    static isJSON(code) {
        try {
            JSON.parse(code);
            return true;
        } catch(e) {
            //Ignore
        }

        return false;
    }

    /**
     * Parses the given code string into an object, using either YAML or JSON
     * @param {string} code
     */
    static loadFromString(code) {
        let obj = null;
        let loader = null;

        try {
            obj = JSON.parse(code);
            loader = "JSON";
        } catch(jsonEx) {
            try {
                obj = jsyaml.load(code);
                loader = "YAML";
            } catch(yamlEx) {
                throw new Error("Unable to Parse string as YAML ("+yamlEx+") or JSON ("+jsonEx+")");
            }
        }

        return {
            loader,
            obj
        };
    }

    /**
     * Converts the given code to YAML / JSON, to opposite of what the input was.
     * @param code
     */
    static convert(code) {
        let result = YAMLJSONConverter.loadFromString(code);

        switch(result.loader) {
            case "JSON":
                return jsyaml.dump(result.obj);
                break;
            case "YAML":
                return JSON.stringify(result.obj, null, 2);
                break;
            default:
                console.warn("Unknown obj loader...");
                return code;
        }
    }
}
window.YAMLJSONConverter = YAMLJSONConverter;
