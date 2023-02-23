class TemplateRefParseNode extends ScopedParseNode {
    constructor(templateElement){
        super(templateElement); 
        this.children.push(new TemplateInstanceParseNode(templateElement));
    }    
    
    getView(targetDocument, scope){
        if (DOMView.DEBUG) console.log("instantiating template-ref for ", this.templateElement);
        return super.getView(targetDocument, scope);
    }
    
    // Look at the TEMPLATE-NAME attribute and generate our scope(s)
    generateScopes(view){
        let self = this;
        let templateQuery = this.templateElement.getAttribute("template-name");
        if ((templateQuery!==null) && templateQuery.trim().length>0){
            // Need to monitor a list of templates
            view.templateUpdatingEvaluation = new UpdatingEvaluation(templateQuery, view.scope, async function templateNameAttributeChanged(templateName){                        
                try {                    
                    // Register for template updates 
                    // TODO
                    
                    // Find the template and create corresponding scopes
                    let templates = document.querySelectorAll("varv-template[name='" + templateName+"']");
                    let template = templates[templates.length - 1];
                    if (!template) throw new Error("Template with name '"+templateName+"' does not exist (yet?)");
                    
                    let localScopes = [];
                    localScopes.push([new TemplateBinding(template)]);
                    
                    self.onScopesUpdated(view, localScopes);
                } catch (ex){
                    self.showError(view, "Template-ref='"+templateQuery+"': "+ex, ex);
                    return;            
                }
            });
            view.addCleanup(()=>{
                view.templateUpdatingEvaluation.destroy();
            });
        }      
    }    
}
window.TemplateRefParseNode = TemplateRefParseNode;

/**
 * A node that dynamically parses and renders a template from the scope all during getView rather than construction
 * @type type
 */
class TemplateInstanceParseNode extends ParseNode {
    getView(targetDocument, scope){
        let templateBinding = scope[scope.length-1];
        if (!templateBinding instanceof TemplateBinding) throw new Error("STUB: Currently TemplateBinding MUST be the last element on the scope stack when rendering template instances");
        
        // Dynamically parse and render the template now
        let referencedTemplateElement = templateBinding.getTemplateElement()
        if (DOMView.DEBUG) console.log("parsing template-instance for ", this.templateElement, referencedTemplateElement);       
        let view = new ViewParticle(targetDocument.createProcessingInstruction("varv-template-anchor", {}), this, scope);
        let parseNodes = [];
        for (let childNode of referencedTemplateElement.childNodes){
            let parseChild = this.parseTemplateNode(childNode);
            if (parseChild){
                // If this actually needs parsing, add it
                parseNodes.push(parseChild);
            }
        }        
        
        if (DOMView.DEBUG) console.log("creating template-instance view for ", view, parseNodes);
        view.childViews = [];
        parseNodes.forEach((parseChild)=>{
            view.childViews.push(parseChild.getView(targetDocument, scope));
        });
        
        // Also destroy the template view children when our view is destroyed
        view.addCleanup(()=>{
            view.childViews.forEach((childView)=>{
                childView.destroy();
            });
        });
        
        // When we are mounted into the document, think about the children!
        view.addOnMountedCallback(()=>{
            view.childViews.forEach((childView)=>{
                // Insert them before our anchor node
                childView.mountInto(view.getNode().parentNode, view.getNode());
            })
        });
        
        return view;
    }    
};
window.TemplateInstanceParseNode = TemplateInstanceParseNode;