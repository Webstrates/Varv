/**
 * A view particle mst 
 * @type type
 */
class ViewParticle {
    constructor(node, parseNode, scope){
        this.node = node;
        this.parseNode = parseNode;
        this.cleanup = [];
        this.scope = scope;
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
    
    destroy(){
        this.cleanup.forEach((callback)=>{
            callback(); 
        });
        this.view.forEach((element)=>{
            element.remove();
        });
    }    
}

window.ViewParticle = ViewParticle;