class UpdatingEvaluation {
    constructor(originalText, scope, onChangeCallback){
        this.originalText = originalText;
        this.bindings = new Map();
        this.tokens = originalText.match(/{(.+?)}/g);
        if (!this.tokens) this.tokens = [];
        this.onChangeCallback = onChangeCallback;
        this.updateCallbacks = [];
        this.destroyed = false;
        
        let self = this;
        
        // Prepare it once manually
        for(let token of this.tokens) {
            token = token.trim();
            let lookupQuery = token.substring(1, token.length - 1);

            let binding = null;
            let propertyName;
            if (lookupQuery.includes("?")){
                let regexp = /^(?<condition>.+?)\?(?<quote1>["']?)(?<true>.+?)\k<quote1>(?::(?<quote2>["']?)(?<false>.*)\k<quote2>)?$/gm;

                let match = regexp.exec(lookupQuery);

                propertyName = match.groups.condition;

                let negated = false;

                if(propertyName.startsWith("!")) {
                    negated = true;
                    propertyName = propertyName.substring(1);
                }

                // Fancy { x ? y : < } query
                binding = DOMView.getBindingFromScope(propertyName, scope);
                this.bindings.set(lookupQuery, async ()=>{
                    if (binding===undefined) return undefined;

                    let value = await binding.getValueFor(propertyName);

                    let trueValue = match.groups.true;
                    let falseValue = typeof match.groups.false === "undefined"?"":match.groups.false;

                    if(negated) {
                        let tmp = trueValue;
                        trueValue = falseValue;
                        falseValue = tmp;
                    }

                    return value?trueValue:falseValue;
                });
            } else {
                // Normal {} query, the entire thing is the name
                propertyName = lookupQuery;
                binding = DOMView.getBindingFromScope(propertyName, scope);
                this.bindings.set(lookupQuery, async ()=>{
                    if (binding===undefined) return undefined;
                    return binding.getValueFor(propertyName);
                });
            }
            if (binding instanceof ConceptInstanceBinding){
                let property = binding.getProperty(propertyName);

                let callback = async function updateUpdatingStringEvaluation(uuid){
                    //Only update this stringEvaluation if the changed property was on the watched concept instance
                    if(uuid === binding.uuid) {
                        await self.update();
                    }
                };
                property.addUpdatedCallback(callback);
                this.updateCallbacks.push({property: property, callback: callback});
            }
        }
        this.update();
            
    }
    
    async update(){
        let mark = VarvPerformance.start();

        try {
            let text = this.originalText;
            for(let token of this.tokens) {
                token = token.trim();
                let lookupQuery = token.substring(1, token.length - 1);

                let value = await this.bindings.get(lookupQuery)();
                
                // Concept references are rewritten to their uuids
                if (value instanceof ConceptInstanceBinding){
                    value = value.uuid;
                }

                if (value !== undefined){
                    text = text.replace(token, value); // STUB: This can fail if the first token is replaced with something that looks like the second token
                }
            }

            await this.onChangeCallback(text);
        } catch (ex){
            console.error(ex);
        }

        VarvPerformance.stop("UpdatingStringEvaluation.update", mark);
    }

    destroy(){
        if (this.destroyed) {
            if (DOMView.DEBUG){
                console.warn("FIXME: Harmless double desctruction, ignoring - but try not to destroy me this much");
            }
            return;
        }
        for (let entry of this.updateCallbacks){
            entry.property.removeUpdatedCallback(entry.callback);
        }
        this.destroyed = true;
    }
}
window.UpdatingEvaluation = UpdatingEvaluation;