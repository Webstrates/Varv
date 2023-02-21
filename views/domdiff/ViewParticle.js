/**
 * A view particle mst 
 * @type type
 */
class ViewParticle {
    constructor(node, parseNode, scope){
        this.node = node;
        this.parseNode = parseNode;
        this.mountCallbacks = [];
        this.renderCallbacks = [];
        this.cleanup = [];
        this.scope = scope;
        this.initialRender = false;
        node.viewParticle = this;
    }
    
    getNode(){
        // TODO: error node when null
        return this.node;
    }
    
    getTargetDocument(){
        let doc = this.node.ownerDocument;
        if (!doc.createElement) console.log("Weird root node", this, this.node, doc, this.parseNode, this.scope);
        return doc;
    }

    addCleanup(callback){
        this.cleanup.push(callback);
    }    
    
    addOnMountedCallback(callback){
        this.mountCallbacks.push(callback);
    }
    
    addOnRenderedCallback(callback){
        this.renderCallbacks.push(callback);
    }
    
    mountInto(parentElement, insertBeforeNode=null){
        parentElement.insertBefore(this.node, insertBeforeNode);
        this.mountCallbacks.forEach((callback)=>{
            callback(); 
        });
    }
    
    onRendered(){
        this.initialRender = true;
        this.renderCallbacks.forEach((callback)=>{
            callback(); 
        });
    }
    
    hasRendered(){
        return this.initialRender;
    }
    
    destroy(){
        console.log("Destroying particle ",this);
        this.cleanup.forEach((callback)=>{
            callback(); 
        });
        this.node.remove();
    }    
}

window.ViewParticle = ViewParticle;