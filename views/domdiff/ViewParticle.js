/**
 * A view particle mst 
 * @type type
 */
class ViewParticle {
    constructor(targetDocument, parseNode, scope){
        this.view = [];
        this.cleanup = [];
        this.scope = scope;
        this.targetDocument = targetDocument;
    }
    
    push(element){
        this.view.push(element);
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
    
    mount(parentNode, beforeNode=null){
        /*this.view.forEach()
        parentNode*/
    }
}

window.ViewParticle = ViewParticle;