class ElementParseNode extends ParseNode {        
    constructor(templateElement){
        super(templateElement); 
        
        // Parse the children
        for (let childNode of templateElement.childNodes){
            this.children.push(this.parseChildNode(childNode));
        }
    }
    
    async instantiate(targetDocument, scope){
        // Create the element itself
        let instance = structuredClone(this);
        instance.view = targetDocument.createElement(this.templateElement.tagName);
        instance.view.scope = scope;
        instance.view.templateElement = this.templateElement;
        instance.view.parseNode = this;
        
        // Evaluate all attributes
        instance.updatingEvaluations = [];
        for(let attr of Array.from(this.templateElement.attributes)) {
            // Filtering attributes are ignored
            if (attr.name==="concept" || attr.name==="property" || attr.name==="if") continue;
            
            // The rest are evaluated
            instance.updatingEvaluations.push(new UpdatingEvaluation(attr.value, scope, function attributeNodeUpdated(value){
                let shouldUpdateAttribute = true;

                // Check for special attributes
                if (attr.name==="value"){
                    if (instance.view.tagName==="INPUT" || instance.view.tagName==="TEXTAREA"){
                        shouldUpdateAttribute = false;
                        if (instance.view.type==="checkbox"){
                            instance.view.checked = value==="true" || value===true;
                        } else {
                            instance.view.value = value;
                        }                                    
                    } else if (instance.view.tagName==="SELECT"){
                        // STUB: wait for the rest of the tree to render so that our OPTIONS nodes are ready
                        shouldUpdateAttribute = false;
                        instance.view.value = value;
                    } else if (instance.view.tagName==="DIV"){
                        shouldUpdateAttribute = false;
                        if (!instance.view.blockReadbacks){
                            instance.view.innerHTML = value;
                        }
                    }
                } else if(attr.name === "disabled" && value === "false") {
                    // Don't move disabled=false over
                    shouldUpdateAttribute = false;
                    instance.view.removeAttribute(attr.name);
                }
                if (shouldUpdateAttribute){
                    instance.view.setAttribute(attr.name, value);                            
                }
            }));
        }        
        
        await instance.instantiateChildren(targetDocument, scope);
        
        return instance;
    }
    
    async uninstantiate(){
        await uninstantiateChildren();
        for (let updatingEvalutation of this.updatingEvaluations){
            updatingEvalutation.destroy();
        }
    }
}

window.ElementParseNode = ElementParseNode;