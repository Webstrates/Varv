class UpdatingEvaluation {
    constructor(originalText, scope, onChangeCallback){
        this.originalText = originalText;
        this.replacements = new Map();
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

            let replacement = {
                value: undefined,
                getText: null,
                binding: null,
                propertyName: null
            };
            if (lookupQuery.includes("?")){
                let regexp = /^(?<condition>.+?)\?(?<quote1>["']?)(?<true>.+?)\k<quote1>(?::(?<quote2>["']?)(?<false>.*)\k<quote2>)?$/gm;

                let match = regexp.exec(lookupQuery);

                replacement.propertyName = match.groups.condition;

                let negated = false;

                if(replacement.propertyName.startsWith("!")) {
                    negated = true;
                    replacement.propertyName = replacement.propertyName.substring(1);
                }

                // Fancy { x ? y : < } query
                binding = DOMView.getBindingFromScope(replacement.propertyName, scope);
                replacement.textFunction = ()=>{
                    if (replacement.binding===undefined) return undefined;
                    let trueValue = match.groups.true;
                    let falseValue = typeof match.groups.false === "undefined"?"":match.groups.false;

                    if(negated) {
                        let tmp = trueValue;
                        trueValue = falseValue;
                        falseValue = tmp;
                    }

                    return replacement.value?trueValue:falseValue;
                };
            } else {
                // Normal {} query, the entire thing is the name
                replacement.propertyName = lookupQuery;
                replacement.binding = DOMView.getBindingFromScope(replacement.propertyName, scope);
                replacement.textFunction = ()=>{
                    return replacement.value;
                };
            }
            this.replacements.set(lookupQuery, replacement);
        }
        
        this.initialUpdate = true;
        this.update();            
    }
    
    async update(){
        let self = this;
        let mark = VarvPerformance.start();
        
        // Get the initial values the first time
        if (this.initialUpdate){
            await Promise.all(Array.from(this.replacements.values()).map(async (replacement)=>{
                // Fetch initial value
                if (!replacement.binding) return;
                replacement.value = await replacement.binding.getValueFor(replacement.propertyName);
                
                // Listen for future updates, if supported by the binding                
                if (replacement.binding.generateRawChangeListener){
                    let changedCallback = replacement.binding.generateRawChangeListener(replacement.propertyName, replacement.value);
                    changedCallback.onChanged = async function updateUpdatingStringEvaluation(value){
                        replacement.value = value;
                        await self.update();
                    };
                    this.updateCallbacks.push(changedCallback);
                };                     
            }));
                        
            this.initialUpdate = false;
        }

        try {
            let text = this.originalText;
            for(let token of this.tokens) {
                token = token.trim();
                let lookupQuery = token.substring(1, token.length - 1);

                let value = this.replacements.get(lookupQuery).textFunction();
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
            entry.destroy();
        }
        this.destroyed = true;
    }
}

window.UpdatingEvaluation = UpdatingEvaluation;