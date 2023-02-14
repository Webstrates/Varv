class TextParseNode extends ParseNode {        
    getView(targetDocument, scope){ 
        console.log("instantiating text", this.templateElement);
        
        let view = new ViewParticle(this, scope); 
        let textNode = targetDocument.createTextNode("");
        view.updatingEvaluation = new UpdatingEvaluation(this.templateElement.nodeValue, scope, function textNodeUpdated(text){                        
            textNode.nodeValue = text;
        });
        view.push(textNode);
        view.addCleanup(()=>{
            this.updatingEvaluation.destroy();
        });
        
        return view;
    }
};

window.TextParseNode = TextParseNode;