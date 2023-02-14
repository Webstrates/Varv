class RootParseNode extends ElementParseNode {           
    render(){        
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
        
        // Find the target element
        // TODO
        
        let view = this.getView(targetDocument, scope);
        
    }
};

window.RootParseNode = RootParseNode;