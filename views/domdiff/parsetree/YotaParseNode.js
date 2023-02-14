class YotaParseNode extends ParseNode {        
    instantiate(targetDocument, scope){
        let instance = structuredClone(this);
        instance.view = targetDocument.importNode(this.templateElement,false);
        
        return instance;
    }
    
    uninstantiate(){
        this.view.remove();
    }
};

window.YotaParseNode = YotaParseNode;