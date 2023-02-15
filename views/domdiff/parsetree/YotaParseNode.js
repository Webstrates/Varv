class YotaParseNode extends ParseNode {        
    getView(targetDocument, scope){
        console.log("instantiating yota", this.templateElement);

        let view = new ViewParticle(targetDocument, this, scope);
        view.push(targetDocument.importNode(this.templateElement,false));        
        return view;
    }
};

window.YotaParseNode = YotaParseNode;