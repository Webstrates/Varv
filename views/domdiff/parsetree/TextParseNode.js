class TextParseNode extends ParseNode {        
    instantiate(targetDocument, scope){        
        let instance = structuredClone(this);
        
        instance.view = targetDocument.createTextNode();
        instance.updatingEvaluation = new UpdatingEvaluation(instance.text, scope, function textNodeUpdated(text){                        
            instance.view.nodeValue = text;
        });
        
        return instance;
    }
    
    uninstantiate(){
        this.updatingEvaluation.destroy();
        this.view.remove();
    }
};

window.TextParseNode = TextParseNode;