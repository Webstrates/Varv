/**
 *  LuceneDataStore - stores properties in a Lucene database through websockets
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
 * A datastore that uses Lucene as backend
 *
 * <pre>
 * options:
 * serverURL - The url to the server
 * storageName - The name of the bucket to use on the server
 * </pre>
 *
 * @memberOf Datastores
 */
class LuceneDataStore extends GigaVarvDatastore {
    constructor(name, options = {}) {
        super(name, options);
    }
   
    async constructQuery(query, primaryResultConceptName, context, localConcept){
        // Construct an optimized Lucene query based on the Varv query given
        let topFilterClass = LuceneDataStore.getFilterClass(query);
        if (!topFilterClass) throw new Error("LuceneDatastore: FIXME: Unsupported or missing query filter type in this datastore",topFilterName,query);
        let topFilter = new topFilterClass(query);        
        
        try {
            return await topFilter.getLuceneQuery(primaryResultConceptName, context, localConcept);
        } catch (ex){
            console.warn("Failed to prepare Lucene query statement string, abstract and Lucene query trees were:", query, topFilter);
            throw ex;
        }
    }
        
    static getFilterClass(query){
        let topFilterName = "Lucene"+(query.constructor.name);
        let topFilterClass = LuceneFilter.registeredFilters[topFilterName];
        if (typeof topFilterClass === "undefined"){            
            return null;
        }
        return topFilterClass;
    }
    
    async lookupConcept(uuid){
        if (uuid===null || uuid==="") return null;
        let type = await this.requestPropertyValue(uuid, LuceneDataStore.TYPE_PROPERTY);

        if(type == null) {
            throw new Error("Unable to find concept from uuid: "+uuid);
        }

        return VarvEngine.getConceptFromType(type);
    }
    
    sendReferenceArrayUpdate(uuid, conceptType, propertyName, newValues){
        throw new Error("FIXME: Reference arrays are not implemented for Lucene datastores yet ("+propertyName+" on "+conceptType+")");
    }
    sendStringArrayUpdate(uuid, conceptType, propertyName, newValues){
        throw new Error("FIXME: String arrays are not implemented for Lucene datastores yet ("+propertyName+" on "+conceptType+")");
    }
    sendNumberArrayUpdate(uuid, conceptType, propertyName, newValues){
        throw new Error("FIXME: Number arrays are not implemented for Lucene datastores yet ("+propertyName+" on "+conceptType+")");
    }
    sendBooleanArrayUpdate(uuid, conceptType, propertyName, newValues){
        throw new Error("FIXME: Boolean arrays are not implemented for Lucene datastores yet ("+propertyName+" on "+conceptType+")");
    }    
}
LuceneDataStore.DEBUG = true;
LuceneDataStore.TYPE_PROPERTY = "__cType";
window.LuceneDataStore = LuceneDataStore;
LuceneDataStore.storages = new Map();

// Register default dom datastore
Datastore.registerDatastoreType("lucene", LuceneDataStore);
