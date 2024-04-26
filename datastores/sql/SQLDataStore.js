/**
 *  SQLDataStore - stores properties in an SQL database through websockets
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
 * A general purpose datastore that uses an SQL server as backend.
 * 
 * This datastore registers as the type "sql".
 * 
 * | Feature             | Remark                                        |
 * |---------------------|-----------------------------------------------|
 * | Property Lengths    | Max 64KB string length                        |
 * | Concept Instances   | Max 4294967295 total (including deleted ones) |
 * | Properties          | No specific limit on number of named properties per concept as long as their names are shorter than 62 chars |
 * 
 * ### Performance
 * * Searching for strings that "equals"/"startWith" is really fast
 * * Good at combining multiple search requirements
 * * Creating instances and setting properties is fairly fast if no reads are performed in-between
 *
 *  ### Options
 * * "serverURL" - The URL to the server on the form "ws(s)://yourserver/sql". Note that secure websockets (wss) may be required on some sites.
 * * "storageName" - The name of the data bucket you intend to use
 *
 * @memberOf Datastores
 * @example
 * <caption>Adding the datastore</caption>
 * {
 *   "dataStoreds": { 
 *      "myDataStore": {
 *          "type": "sql", 
 *          "options": {
 *              "serverURL":"wss://someserver.com/sql",
 *              "storageName": "mybucketname"
 *          }
 *      },
 *      ...
 *  },
 *  ...
 *
 */
class SQLDataStore extends GigaVarvDatastore {
    constructor(name, options = {}) {
        super(name, options);
    }
   
    async constructQuery(query, primaryResultConceptName, context, localConcept, queryModifiers){
        // Construct an optimized SQL query based on the Varv query given
        let topFilterClass = SQLDataStore.getFilterClass(query);
        if (!topFilterClass) throw new Error("SQLDatastore: FIXME: Unsupported or missing query filter type in this datastore", query);
        let topFilter = new topFilterClass(query);
        
        try {
            let sensitivityList = [];
            let filtering = await topFilter.getSQLQuery(primaryResultConceptName, context, localConcept, sensitivityList);
            sensitivityList = [...new Set(sensitivityList)]; // Optimize by making fields unique
            let joins = sensitivityList.map((field)=>"JOIN `"+field+"` ON `"+field+"`.id = `"+SQLDataStore.INSTANCE_TABLE+"`.id").join(" ");
            
            let target = "SELECT uuid";
            switch (queryModifiers.mode){
                case "count":
                    target = "SELECT COUNT(*)";
                    break;
            }
            if (queryModifiers.offset){
                filtering += " OFFSET "+queryModifiers.offset;
            }
            if (queryModifiers.limit){                
                filtering += " LIMIT "+queryModifiers.limit;
            }
            
            let finalQuery = target+" FROM `"+SQLDataStore.INSTANCE_TABLE+"` "+joins+" WHERE "+filtering;
            if (SQLDataStore.DEBUG) console.info(finalQuery);
            return finalQuery;
        } catch (ex){
            console.warn("Failed to prepare SQL query statement string, abstract and SQL query trees were:", query, topFilter);
            throw ex;
        }
    }
        
    static getFilterClass(query){
        let topFilterName = "SQL"+(query.constructor.name);
        let topFilterClass = SQLFilter.registeredFilters[topFilterName];
        if (typeof topFilterClass === "undefined"){            
            return null;
        }
        return topFilterClass;
    }
    
    async lookupConcept(uuid){
        // STUB: misuse q op for a custom query
        if (uuid===null || uuid==="") return null;
        let type = await this.request({
           "op": "q",
           "q":"SELECT type FROM `"+SQLDataStore.INSTANCE_TABLE+"` WHERE uuid = \""+uuid+"\"" // escape uuid
        });

        if(type.a.length === 0) {
            throw Error("Unable to find concept from uuid: "+uuid);
        }

        return VarvEngine.getConceptFromType(type.a[0]);
    }    
}
SQLDataStore.DEBUG = false;
SQLDataStore.INSTANCE_TABLE = "instances";
window.SQLDataStore = SQLDataStore;
SQLDataStore.storages = new Map();

// Register default dom datastore
Datastore.registerDatastoreType("sql", SQLDataStore);
