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
        
        // Construct the view 
        let scope = [];
        let view = this.getView(targetDocument, scope);
        
        // Find the target element
        let targetSpec = this.templateElement.getAttribute("target-element");
        if (targetFrameSpec){
            // Rendering to an iframe
            if (targetSpec){
                // This template uses a custom render target element, try to find it
                let targetElement = targetDocument.querySelector(targetSpec);
                if (targetElement){
                    view.mountInto(targetElement);
                } else {
                    console.error("DOMView: Rendering into nothingness since template target-element does not exist in target iframe: ", targetFrameSpec, targetSpec);
                }
            } else {
                // Just plain add it to body
                view.mountInto(targetDocument.body);
            }
        } else {
            // Rendering to the local document
            if (targetSpec){
                // This template uses a custom render target element, try to find it
                let targetElement = targetDocument.querySelector(targetSpec);
                if (targetElement){
                    view.mountInto(targetElement);
                } else {
                    console.error("DOMView: Rendering into nothingness since template target-element does not exist in document: ", targetSpec);
                }
            } else {
                // Default is to render just after the template element.
                // Special-case for CodeStrates-based templates (avoid getting deleted inside autoDOM)
                let autoDOM = this.templateElement.closest(".autoDom");
                if (autoDOM){
                    // Add after autoDOM instead of inside of it
                    if (!autoDOM.parentNode){
                        console.log("DOMView: Was rendering an autoDOM template but it had no parent", templateElement);
                    }
                    view.mountInto(autoDOM.parentNode,autoDOM.nextElementSibling);
                } else {
                    // Outside we just insert after the template directly
                    if (!this.templateElement.parentNode){
                        console.log("DOMView: Was rendering a non autoDOM template but it had no parent", templateElement);
                    }
                    view.mountInto(this.templateElement.parentNode, this.templateElement.nextElementSibling);
                }
            }
        }        
    }
};

window.RootParseNode = RootParseNode;