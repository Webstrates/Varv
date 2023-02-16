class ElementParseNode extends ParseNode {        
    constructor(templateElement){
        super(templateElement); 
        
        // Parse the children
        for (let childNode of templateElement.childNodes){
            this.children.push(this.parseTemplateNode(childNode));
        }
    }
    
    getView(targetDocument, scope){
        console.log("instantiating element", this.templateElement);
        
        // Create the element itself
        let name = this.templateElement.tagName;
        if (name==="DOM-VIEW-TEMPLATE") name = "varv-view"; // The template itself renames to view
        let element = targetDocument.createElement(name);
        let view = new ViewParticle(element, this, scope);
        element.scope = scope;
        element.templateElement = this.templateElement;
        element.parseNode = this;
        
        // Evaluate all attributes
        for(let attr of Array.from(this.templateElement.attributes)) {
            // Filtering attributes are ignored
            if (attr.name==="concept" || attr.name==="property" || attr.name==="if") continue;
            
            // The rest are evaluated
            let updatingEvaluation = new UpdatingEvaluation(attr.value, scope, function attributeNodeUpdated(value){
                let shouldUpdateAttribute = true;

                // Check for special attributes
                if (attr.name==="value"){
                    if (this.templateElement.tagName==="INPUT" || this.templateElement.tagName==="TEXTAREA"){
                        shouldUpdateAttribute = false;
                        if (this.templateElement.type==="checkbox"){
                            element.checked = value==="true" || value===true;
                        } else {
                            element.value = value;
                        }                                    
                    } else if (view.view.tagName==="SELECT"){
                        // STUB: wait for the rest of the tree to render so that our OPTIONS nodes are ready
                        shouldUpdateAttribute = false;
                        element.value = value;
                    } else if (view.view.tagName==="DIV"){
                        shouldUpdateAttribute = false;
                        if (!element.blockReadbacks){
                            element.innerHTML = value;
                        }
                    }
                } else if(attr.name === "disabled" && value === "false") {
                    // Don't move disabled=false over
                    shouldUpdateAttribute = false;
                    element.removeAttribute(attr.name);
                }
                if (shouldUpdateAttribute){
                    element.setAttribute(attr.name, value);                            
                }
            });
            view.addCleanup(()=>{
                updatingEvaluation.destroy();
            });
        }        
        
        // Attach the children
        for (let child of this.children){
            let childView = child.getView(targetDocument, scope); 
            view.addCleanup(childView.destroy);
            element.appendChild(childView.getNode());
        }        
        
        return view;
    }
}

window.ElementParseNode = ElementParseNode;