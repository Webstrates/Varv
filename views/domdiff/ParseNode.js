class ParseNode {
    constructor(templateElement){
        this.children = [];
        this.cleanupCallbacks = [];
        this.templateElement = templateElement;
        
        console.log("adding ", templateElement);
        // TODO: Hooks for template element changes
        // TODO: Hooks for template changes?
    }
    
    parseTemplateNode(elementNode, parseOptions={}){
        switch (elementNode.nodeType){
            // Nodes that cannot have attributes are treated directly
            case Node.COMMENT_NODE:
                // Drop all comments to minify view as much as possible - we cannot update them properly anyways
                return null;
            case Node.TEXT_NODE:
                return new TextParseNode(elementNode);
                
            // Nodes that may have attributes are handled below 
            case Node.ELEMENT_NODE:
                break;
                
            // Unknown nodes are copied verbatim
            default:
                return new YotaParseNode(elementNode);
        }
        
        // Handle filtering/duplication attributes before anything else (may need duplication)
        if (!parseOptions.skipQuery){
            const atts = elementNode.attributes;
            if (atts && (atts["concept"] || atts["property"] || atts["if"])){
                // These are not valid on varv-template element
                if (elementNode==="VARV-TEMPLATE") {
                    console.log("concept, property or if used on varv-template element itself is invalid");
                }
                return new QueryParseNode(elementNode);
            }
        }
        
        // Handle HTML elements
        switch (elementNode.tagName){
            case "VARV-TEMPLATE":
                // Not used in output
                return null;
            case "TEMPLATE-REF":
                return new TemplateRefParseNode(elementNode);
            default:
                return new ElementParseNode(elementNode);
        }
    }   
}

window.ParseNode = ParseNode;