class RootParseNode extends ElementParseNode {           
    async instantiate(){        
        // Find the target document
        let targetFrameSpec = this.templateElement.getAttribute("target-iframe");
        let targetDocument;
        if (targetFrameSpec){
            let frame = document.querySelector(targetFrameSpec);
            if (!frame) throw new Error("DOMDiffView: dom-view-template with target-iframe that does not exist in document failed to render", targetFrameSpec, templateElement);
            targetDocument = frame.contentDocument;
        } else {                        
            targetDocument = document;
        }       
        
        let scope = [];
        
        return this.instantiate(targetDocument, scope);
    }
};

window.RootParseNode = RootParseNode;