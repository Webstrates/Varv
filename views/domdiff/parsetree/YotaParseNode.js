class YotaParseNode extends ParseNode {        
    getView(targetDocument, scope){
        console.log("instantiating yota", this.templateElement);

        return new ViewParticle(targetDocument.importNode(this.templateElement,false), this, scope);
    }
};

window.YotaParseNode = YotaParseNode;