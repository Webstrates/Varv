/**
 *  GigaVarv - Base datastore for other datastores to work with databases through websockets
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
 * Protocol:
 *
 * Client to server (r=requestCounter):
 * bucket (bucket,key): login to a bucket
 * pg (uuid, p=property, r): request property data
 * c (uuid, t=type): create instance
 * d (uuid): delete instance
 * p: (uuid, t=type, p=propertyName, v=newValue) change a property
 * q: (q=query,r) search for instances (uuids) using text query
 *
 * Server to client:
 * bucket (bucket): login completed or error
 * pg: (r, v=requested data) instanceData
 * q: (a:[],r) search result(s)
 * debug
 * bucket
 * greeting
 * c (uuid, t=type): an instance appeared from somewhere else
 * d (uuid, t=type): an instance was deleted by someone else
 * p (uuid, p=propertyName, ...) propertyValueUpdate
 *
 */

/**
 * @memberOf Datastores
 */
class GigaVarvDatastore extends Datastore {
    constructor(name, options = {}) {
        super(name, options);

        this.deleteCallbacks = [];
        this.ignoreEventsUUID = false;
    }

    destroy() {
        this.deleteCallbacks.forEach((deleteCallback)=>{
            deleteCallback.delete();
        });
        this.websocket.close();
        clearInterval(this.pingerInterval);
    }

    async init() {
        const self = this;

        this.storageName = this.options.storageName;
        this.serverURL = this.options.serverURL;
        this.authKey = this.options.authKey;

        this.requestQueue = {};
        this.requestCounter = 0;
        this.pingerInterval = null;

        let bucketPromise = new Promise((resolve, reject)=>{
            self.bucketResolve = resolve;
        });

        if (GigaVarvDatastore.DEBUG) console.log("GigaVarv["+this.constructor.name+"]: Connecting to "+self.serverURL);
        this.websocket = new WebSocket(this.serverURL);
        this.websocket.onopen = async function () {
            // Log into our data bucket
            if (GigaVarvDatastore.DEBUG) console.log("GigaVarv["+self.constructor.name+"]: Attempting login to backend at "+self.serverURL+"#"+self.storageName);
            self.request({op: "bucket", bucket: self.storageName, key: self.authKey});
            
            if (GigaVarvDatastore.DEBUG) console.log("Starting pinger");
            self.pingerInterval = setInterval(()=>{
                if (GigaVarvDatastore.DEBUG) console.log("Sending ping");
                self.request({op: "ping"});
            },10000);
        };
        self.websocket.onerror = function (evt) {
            console.error("GigaVarv["+self.constructor.name+"]: Fatal websocket error, cannot continue GigaVarv connection to "+self.storageName+" at "+self.serverURL+" - check URL and server", evt);
        };

        self.websocket.onmessage = async function (message) {
            var messageObject = JSON.parse(message.data);
            switch (messageObject.op) {
                case 'greeting':
                    console.log("GigaVarv["+self.constructor.name+"] Greeting:", messageObject.content);
                    break;
                case 'debug':
                    if (messageObject.error){
                        console.error("GigaVarv["+self.constructor.name+"] Backend:", messageObject.content);
                    } else if (GigaVarvDatastore.DEBUG){
                        console.warn("GigaVarv["+self.constructor.name+"] Backend:", messageObject.content);
                    }
                    break;
                case 'exception':
                    let request = self.requestQueue[messageObject.r];
                    if (!request) {
                        console.error("GigaVarv["+self.constructor.name+"]: Got exception in non-existing request", messageObject);
                    } else {
                        request.reject(new Error("GigaVarv["+self.constructor.name+"] Backend:" + messageObject.content));
                    }
                    break;
                case 'bucket':
                    if (GigaVarvDatastore.DEBUG){
                        console.log("GigaVarv["+self.constructor.name+"]: Connected to "+messageObject.bucket);
                    }
                    self.bucketResolve();
                    break;
                case 'p': // propertyValueChange
                    try {
                        self.ignoreEventsUUID = messageObject.uuid;
                        await self.onRemotePropertyValueChange(messageObject.uuid, messageObject.t, messageObject.p, messageObject.v);
                    } finally {
                        self.ignoreEventsUUID = false;
                    }                        
                    break;
                case 'pg': // propertyValue get
                    // STUB: Cache this?

                    if (typeof messageObject.r === "undefined"){
                        // STUB: This could have been sent for caching by an optimizing preloader without a request id, but we have no cache so who cares
                    } else {
                        // This is the answer to a request
                        let request = self.requestQueue[messageObject.r];
                        if (!request){
                            console.error("GigaVarv["+self.constructor.name+"]: Got answer to non-existing request", messageObject);
                        } else {
                            request.resolve(messageObject);
                        }
                    }
                    break;
                case 'q': // query results
                    if (typeof messageObject.r === "undefined"){
                        throw new Error("GigaVarv["+self.constructor.name+"]: Got search results from backend with no request counter set, weird!");
                    } else {
                        let request = self.requestQueue[messageObject.r];
                        if (!request){
                            throw new Error("GigaVarv["+self.constructor.name+"] Got answer to non-existing query request", messageObject);
                        } else {
                            request.resolve(messageObject);
                        }
                    }
                    break;
                case 'c': // remote appear event
                    // TODO: check if mapped
                    try {
                        self.ignoreEventsUUID = messageObject.uuid;
                        await VarvEngine.getConceptFromType(messageObject.t).appeared(messageObject.uuid);
                    } finally {
                        self.ignoreEventsUUID = false;
                    }
                    break;
                case 'd': // remote delete event
                    // TODO: check if mapped
                    try {
                        self.ignoreEventsUUID = messageObject.uuid;
                        await VarvEngine.getConceptFromType(messageObject.t).disappeared(messageObject.uuid);
                    } finally {
                        self.ignoreEventsUUID = false;
                    }
                    break;
                case "pong":
                    break;
                default:
                    console.error("GigaVarv["+self.constructor.name+"]: Unhandled message from GigaVarv websocket", messageObject);
            }
        };
        await bucketPromise;


        this.deleteCallbacks.push(VarvEngine.registerEventCallback("disappeared", async (context)=> {
            if(GigaVarvDatastore.DEBUG) {
                console.log("Saw disappeared UUID (GigaVarv):", context.target);
            }

            // TODO: Remove from cache
            if (self.ignoreEventsUUID!==context.target && self.isConceptMapped(context.concept)){
                self.sendDeleteInstance(context.target);
            }
        }));
        this.deleteCallbacks.push(VarvEngine.registerEventCallback("appeared", async (context)=> {
            let mark = VarvPerformance.start();
            if(GigaVarvDatastore.DEBUG) {
                console.log("Saw appeared UUID (GigaVarv):", context.target);
            }
            if (self.ignoreEventsUUID!==context.target && self.isConceptMapped(context.concept)){
                // TODO: Add to cache
                // Create (or update in case it already exists) the instance in the backend and set the type
                self.sendCreateInstance(context.target, context.concept.name);
            }
            VarvPerformance.stop("GigaVarvDatastore.registerEventCallback.appeared", mark);
        }));
    }

    async onRemotePropertyValueChange(uuid, conceptType, propertyName, newValue){
        // Decode the remote value name
        // STUB: We don't decode it, just blindly assume all types are 2 letter codes after a dot
        propertyName = propertyName.substring(0, propertyName.length-3);
        
        // Inform rest of engine
        let propertyObject = VarvEngine.getConceptFromType(conceptType).getProperty(propertyName);
        if (!propertyObject) throw new Error("Unknown property got remote change notification from GigaVarv backend", propertyName, uuid, newValue);
        // STUB: Maybe check if it is mapped too? if (!this.isPropertyMapped(concept, propertyObject)...
        let value = propertyObject.typeCast(newValue);
        await propertyObject.setValue(uuid, value);
    }

    sendStringValueUpdate(uuid, conceptType, propertyName, newValue){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".sv", sv:newValue});
    }
    sendNumberValueUpdate(uuid, conceptType, propertyName, newValue){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".nv", nv:newValue});
    }
    sendBooleanValueUpdate(uuid, conceptType, propertyName, newValue){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".bv", bv:newValue});
    }
    sendReferenceValueUpdate(uuid, conceptType, propertyName, newValue){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".rv", rv:newValue});
    }
    sendReferenceArrayUpdate(uuid, conceptType, propertyName, newValues){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".ra", ra:newValues});
    }
    sendStringArrayUpdate(uuid, conceptType, propertyName, newValues){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".sa", sa:newValues});
    }
    sendNumberArrayUpdate(uuid, conceptType, propertyName, newValues){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".na", na:newValues});
    }
    sendBooleanArrayUpdate(uuid, conceptType, propertyName, newValues){
        this.send({op:"p", uuid:uuid, t:conceptType, p:propertyName+".ba", ba:newValues});
    }
    
    sendCreateInstance(uuid, instancePrimaryType){
        this.send({op:"c", uuid:uuid, t:instancePrimaryType});
    }
    sendDeleteInstance(uuid){
        this.send({op:"d", uuid:uuid});
    }
    async requestPropertyValue(uuid, propertyName){
        let result = await this.request({op:"pg", uuid:uuid, p:propertyName});
        return result.v;
    }

    send(message) {
        this.websocket.send(JSON.stringify(message));
    }

    async request(message){
        if (GigaVarvDatastore.DEBUG) console.info(message);
        let self = this;
        self.requestCounter++;
        message.r = self.requestCounter;
        let result = await new Promise((resolve, reject)=>{
            self.requestQueue[self.requestCounter] = {resolve:resolve, reject:reject};
            self.send(message);
        });
        return result;
    }

    createBackingStore(concept, property) {
        const self = this;

        if (this.isPropertyMapped(concept,property)) return;

        let setter = (uuid, value) => {
            let mark = VarvPerformance.start();

            try {
                // TODO: Optimize by checking against our cache - if not changed then avoid sending an op
                // Set property in backend
                if (self.ignoreEventsUUID!==uuid){
                    switch (property.type){
                        case "string":
                            self.sendStringValueUpdate(uuid, concept.name, property.name, value);
                            break;
                        case "number":
                            self.sendNumberValueUpdate(uuid, concept.name, property.name, value);
                            break;
                        case "boolean":
                            self.sendBooleanValueUpdate(uuid, concept.name, property.name, value);
                            break;
                        case "array":
                            switch (property.getArrayType()){
                                case "string":
                                    self.sendStringArrayUpdate(uuid, concept.name, property.name, value);
                                    break;
                                case "number":
                                    self.sendNumberArrayUpdate(uuid, concept.name, property.name, value);
                                    break;
                                case "boolean":
                                    self.sendBooleanArrayUpdate(uuid, concept.name, property.name, value);
                                    break;                                
                                default:
                                    if (property.isConceptArrayType()){
                                        self.sendReferenceArrayUpdate(uuid, concept.name, property.name, value);
                                        break;
                                    }
                                    throw new Error("GigaVarv: unsupported array data type", property);
                            }
                            break;
                        default:
                            if (property.isConceptType()){
                                self.sendReferenceValueUpdate(uuid, concept.name, property.name, value);
                                break;
                            }
                            throw new Error("GigaVarv: unsupported data type", property.type, property);
                    }
                }
            } catch (ex){
                if (GigaVarvDatastore.DEBUG) console.warn("Error in GigaVarv setter",ex, property);
            }
            VarvPerformance.stop("GigaVarv.setter.nonCached", mark);

        };
        let getter = async (uuid) => {
            let mark = VarvPerformance.start();
            try {
                // Get property from backend
                // STUB: No cache
                // TODO: Use a fixed-size in-memory concept cache since getting everything item-by-item is SUPER DUPER SLOW
                // TODO: and we already get most of the relevant values in the update notifications anyways
                if (uuid===null || uuid==="") throw new Error("Invalid UUID for Gigavarv getter", uuid);

                let fullPropertyName = property.name;
                switch (property.type){
                    case "string":
                        fullPropertyName += ".sv";
                        break;
                    case "number":
                        fullPropertyName += ".nv";
                        break;
                    case "boolean":
                        fullPropertyName += ".bv";
                        break;
                    case "array":
                        switch (property.getArrayType()){
                            case "string":
                                fullPropertyName+=".sa";
                                break;
                            case "number":
                                fullPropertyName+=".na";
                                break;
                            case "boolean":
                                fullPropertyName+=".ba";
                                break;       
                            default:
                                if (property.isConceptArrayType()){
                                    fullPropertyName+=".ra";
                                    break;
                                }
                                throw new Error("GigaVarv: unsupported array data type" + lookup.property);                                
                        }
                        break;
                    default:
                        if (property.isConceptType()){
                            fullPropertyName += ".rv";
                            break;
                        }
                        throw new Error("GigaVarv: unsupported data type", property.type, property);                        
                }

                // Cache miss, fetch a copy of the instance data to this client
                let propertyValue = await self.requestPropertyValue(uuid, fullPropertyName);
                let result = property.typeCast(propertyValue);
                VarvPerformance.stop("GigaVarv.getter.nonCached", mark);
                return result;
            } catch (ex) {
                if (GigaVarvDatastore.DEBUG) console.warn("Error GigaVarv property getter", ex);
                throw ex;
            }
        };
        property.addSetCallback(setter);
        property.addGetCallback(getter);

        // Check if concept already is mapped, if not, register it
        this.internalAddPropertyMapping(concept, property, {setter: setter, getter: getter});
    }

    removeBackingStore(concept, property) {
        if (!this.isPropertyMapped(concept, property)){
            throw new Error('Cannot unmap property from memory because the property was not mapped: ' + concept + "." + property);
        }

        let trackingData = this.internalPropertyTrackingData(concept, property);
        property.removeSetCallback(trackingData.setter);
        property.removeGetCallback(trackingData.getter);

        this.internalRemovePropertyMapping(concept, property);
    }

    async loadBackingStore() {
        // STUB: No config option for notification about global concept instances during load yet, so do nothing
        // Also, we don't know if they are to be specifically marked or options has a query for us to find them
    }

    async existsInstance(typeNames, query, context, localConcept) {
        let instances = await this.countInstances(typeNames, query, context, 1, localConcept);
        return instances > 0;
    }

    normalizeQuery(typeNames, query){
        // Filter away non-mapped concepts
        let primaryType = typeNames[0];
        if (!this.isConceptTypeMapped(primaryType)) {
            if (typeNames.length>1){
                console.warn("["+this.constructor.name+"] FIXME: Cannot figure out what to lookup since none of the properties on "+primaryType+" are mapped to this datastore even though some of the other implementing concepts' properties may be.", query);
            }
            return null;
        }
        typeNames = typeNames.filter(typeName =>this.isConceptTypeMapped(typeName));
        
        // Normalize query tree
        let normalizedQuery = new FilterOr(typeNames.map(typeName => new FilterConcept(typeName, false)));
        if (query!==null){
            normalizedQuery = new FilterAnd([normalizedQuery,query]);
        }

        return normalizedQuery;
    }

    async lookupInstances(typeNames, query, context, limit, localConcept){
        let normalizedQuery = this.normalizeQuery(typeNames, query);
        if (normalizedQuery===null) return [];
        
        let queryModifiers = {};
        if (limit){
            queryModifiers.limit = limit;
        }
        let gigaVarvQuery = await this.constructQuery(normalizedQuery, typeNames[0], context, localConcept, queryModifiers);
        
        // Send it along
        try {
            if (GigaVarvDatastore.DEBUG){
                console.log("GigaVarv["+this.constructor.name+"] query", typeNames, query, gigaVarvQuery, normalizedQuery);
            }
            let result = await this.request({op:"q", q:gigaVarvQuery});
            
            /** Optimization: When we KNOW that these results are of specific type (because we asked for only one type) then
             * we can cache it here upfront */
            if (typeNames.length===1){
                let precachedType = VarvEngine.getConceptFromType(typeNames[0]);
                result.a.forEach((uuid)=>{
                    VarvEngine.conceptUUIDCache.set(uuid, result);                
                });
            }
            return result.a;
        } catch (ex){
            console.log(typeNames, query, ex);
            throw new Error("GigaVarv: Error looking up concept instances", typeNames, query, ex);
        }
    }
    
    async countInstances(typeNames, query, context, localConcept) {
        let normalizedQuery = this.normalizeQuery(typeNames, query);
        if (normalizedQuery===null) return 0;
        
        let queryModifiers = {mode:"count"};
        let gigaVarvQuery = await this.constructQuery(normalizedQuery, typeNames[0], context, localConcept, queryModifiers);
        
        try {
            let result = await this.request({op:"q", q:gigaVarvQuery});
            return result.a[0];
        } catch (ex){
            console.log(typeNames, query, ex);
            throw new Error("GigaVarv: Error counting concept instances", typeNames, query, ex);
        }
    }    

    async constructQuery(input, primaryResultConceptType, context, localConcept, modifiers){
        throw new Error("Implementing datastores must implement constructQuery()");
    }
}
GigaVarvDatastore.DEBUG = false;
window.GigaVarvDatastore = GigaVarvDatastore;
GigaVarvDatastore.storages = new Map();
