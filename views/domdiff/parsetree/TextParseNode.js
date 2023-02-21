class TextParseNode extends ParseNode {        
    getView(targetDocument, scope){ 
        console.log("instantiating text", this.templateElement);
        
        let textNode = targetDocument.createTextNode("");
        let view = new ViewParticle(textNode, this, scope); 
        view.updatingEvaluation = new UpdatingEvaluation(this.templateElement.nodeValue, scope, function textNodeUpdated(text){                        
            textNode.nodeValue = text;
        });
        view.addCleanup(()=>{
            view.updatingEvaluation.destroy();
        });
        
        return view;
    }
};

window.TextParseNode = TextParseNode;