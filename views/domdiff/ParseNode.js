class ParseNode {
    constructor(templateElement){
        this.children = [];
        this.cleanupCallbacks = [];
        this.templateElement = templateElement;
        
        // TODO: Hooks for template element changes
        // TODO: Hooks for template changes?
    }
    
    parseChildNode(parseOptions={}){
        switch (this.templateElement.nodeType){
            // Nodes that cannot have attributes are treated directly
            case Node.COMMENT_NODE:
                // Drop all comments to minify view as much as possible - we cannot update them properly anyways
                return null;
            case Node.TEXT_NODE:
                return new TextParseNode(this.templateElement);
                
            // Nodes that may have attributes are handled below 
            case Node.ELEMENT_NODE:
                break;
                
            // Unknown nodes are copied verbatim
            default:
                return new YotaParseNode(this.templateElement);
        }
        
        // Handle filtering/duplication attributes before anything else (may need duplication)
        if (!parseOptions.skipFiltering){
            const atts = this.templateElement.attributes;
            if (atts && (atts["concept"] || atts["property"] || atts["if"])){
                // These are not valid on varv-template element
                if (this.templateElement.tagName==="VARV-TEMPLATE") {
                    console.log("concept, property or if used on varv-template element itself is invalid");
                }
                return new FilteringParseNode(this.templateElement);
            }
        }
        
        // Handle HTML elements
        switch (templateElement.tagName){
            case "VARV-TEMPLATE":
                // Not used in output
                return null;
            case "TEMPLATE-REF":
                return new TemplateRefParseNode(this.templateElement);
            default:
                return new ElementParseNode(this.templateElement);
        }
    }   
    
    
    async instantiateChildren(targetDocument, scope){
        let promises = [];
        for (let child of this.children){
            promises.push(child.instantiate(targetDocument, scope));
        }        
        await Promises.all(promises);        
    }
    async uninstantiateChildren(){
        let promises = [];
        for (let child of this.children){
            promises.push(child.uninstantiate());
        }        
        await Promises.all(promises);        
    }    
    
}

window.ParseNode = ParseNode;