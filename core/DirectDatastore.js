class DirectDatastore extends Datastore {
    constructor(name, options) {
        super(name, options);

        this.conceptUUIDMap = new Map();
        this.conceptTypeUUIDMap = new Map();
    }

    registerConceptFromUUID(uuid, concept) {
        if(this.isConceptMapped(concept)) {
            this.conceptUUIDMap.set(uuid, concept);

            let uuidSet = this.conceptTypeUUIDMap.get(concept.name);
            if (uuidSet == null) {
                uuidSet = new Set();
                this.conceptTypeUUIDMap.set(concept.name, uuidSet);
            }

            uuidSet.add(uuid);
        }
    }

    deregisterConceptFromType(type) {
        const self = this;

        this.getAllUUIDsFromType(type).forEach((uuid)=>{
            self.deregisterConceptFromUUID(uuid);
        });
    }

    deregisterConceptFromUUID(uuid) {
        let concept = this.getConceptFromUUID(uuid);
        this.conceptUUIDMap.delete(uuid);
        if(concept != null) {
            let uuidSet = this.conceptTypeUUIDMap.get(concept.name);
            if (uuidSet != null) {
                uuidSet.delete(uuid);
            }
        }
    }

    getConceptFromUUID(uuid) {
        return this.conceptUUIDMap.get(uuid);
    }

    getAllUUIDsFromType(type, includeOtherConcepts = false) {
        const self = this;

        let uuidSet = null;
        if(!includeOtherConcepts) {
            uuidSet = this.conceptTypeUUIDMap.get(type);
        } else {
            uuidSet = new Set();
            VarvEngine.getAllImplementingConcepts(type).forEach((concept)=>{
                self.getAllUUIDsFromType(concept.name, false).forEach((uuid)=>{
                    uuidSet.add(uuid);
                });
            });
        }
        if (uuidSet == null) {
            return [];
        }
        return Array.from(uuidSet);
    }

    async countInstances(typeNames, query, context, localConcept) {
        let uuids = await this.lookupInstances(typeNames, query, context, 0, localConcept);
        return uuids.length;
    }

    async existsInstance(typeNames, query, context, localConcept) {
        let uuids = await this.lookupInstances(typeNames, query, context, 1, localConcept);
        return uuids.length > 0;
    }

    async lookupInstances(typeNames, query, context, limit, localConcept) {
        const self = this;

        let uuidSet = new Set();

        let markStart = VarvPerformance.start();

        typeNames.forEach((type)=>{
            self.getAllUUIDsFromType(type, false).forEach((uuid)=>{
                uuidSet.add(uuid);
            });
        });

        VarvPerformance.stop("DirectDatastore.lookupInstances.getAll", markStart);

        let result = [];

        if(query != null) {
            let markFilter = VarvPerformance.start();
            for(let uuid of uuidSet) {
                if(await query.filter({target: uuid}, localConcept)) {
                    result.push(uuid);
                }
            }
            VarvPerformance.stop("DirectDatastore.lookupInstances.filter", markFilter);
        } else {
            result.push(...uuidSet);
        }

        if(limit > 0 && result.length > limit) {
            result.splice(limit, result.length-limit);
        }

        VarvPerformance.stop("DirectDatastore.lookupInstances", markStart);

        return result;
    }

    async lookupConcept(uuid) {
        let result = this.getConceptFromUUID(uuid);

        if(result == null) {
            throw Error("Unable to find concept from uuid: "+uuid);
        }

        return result;
    }
}
window.DirectDatastore = DirectDatastore;
