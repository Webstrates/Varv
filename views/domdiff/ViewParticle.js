class ViewParticle {
    constructor(parseNode, scope){
        this.view = [];
        this.cleanup = [];
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
}

window.ViewParticle = ViewParticle;