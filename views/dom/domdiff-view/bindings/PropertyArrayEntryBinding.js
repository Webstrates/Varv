class PropertyArrayEntryBinding extends PropertyBinding {
    constructor(property, uuid, boundValue, index, as=null) {
        super(property, uuid, boundValue, as);
        this.index = index;
        this._reIndexCount = 0;
        this._indexCallbacks = [];
    }
    
    hasBindingFor(name){
        // We don't supply this ourselves
        if (super.hasBindingFor(name)){
            return true;
        }
        
        if (name===".index") return true;
        if (name==="view::reused") return true;
        if (this.as){
            // We are available under as.value
            return name===this.as+".index";
        } else {
            return name===this.property.name+".index";
        }
    }
    
    getValueFor(name){
        if (!this.hasBindingFor(name)) throw new Error("PropertyArrayEntryBinding asked for value for "+name+" but does not support it");
        if (name==="view::reused") return this._reIndexCount;
        
        if (name.endsWith(".index")){
            return this.index;
        } else {
            return this.boundValue;
        }
    }
    
    updateIndex(newIndex){
        this._reIndexCount++;
        this.index = newIndex;
        this._indexCallbacks.forEach((callback)=>{
            try {
                callback();
            } catch (ex){
                console.log(ex);
            }
        });
    }
    
    addIndexCallback(callback) {
        this._indexCallbacks.push(callback);
    }

    removeIndexCallback(callback) {
        let index = this._indexCallbacks.indexOf(callback);
        if (index===-1){
            console.warn("Cannot remove indexcallback that isn't part of list of callbacks: "+callback+" list is "+this._indexCallbacks);
            return;
        }
        this._indexCallbacks.splice(index, 1);
    }    
    
    generateRawChangeListener(name, oldValue=null){
        if (!this.hasBindingFor(name)) throw new Error("PropertyArrayEntryBinding asked for change listener for "+name+" but does not support it");        
        let self = this;

        let result = {
            onChanged: async ()=>{console.error("DOMView bug: PropertyArrayEntryBinding raw change listener called without anything hooked up to it");},
            destroy: ()=>{}
        };     
        let changedCallback = false;
        if (name==="view::reused"){
            changedCallback = async function indexChanged(){
                await result.onChanged(self._reIndexCount);
            };                 
        } else if (name.endsWith(".index")){
            changedCallback = async function indexChanged(){
                await result.onChanged(self.index);
            };                 
        }
        
        if (changedCallback){
            self.addIndexCallback(changedCallback);
            result.destroy = ()=>{
                self.removeIndexCallback(changedCallback);
            };
        }
        return result;
    }
    
    identicalExceptIndex(otherBinding){
        return this.property === otherBinding.property &&
                this.uuid === otherBinding.uuid &&
                this.boundValue === otherBinding.boundValue;
    }
}

window.PropertyArrayEntryBinding = PropertyArrayEntryBinding;