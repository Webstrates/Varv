class DOMView {
    constructor(){
        this.renders = [];
    }
    
    render(){
        // Cleanup
        this.renders.forEach((view)=>{
            view.destroy();
        });
        
        // Render new views
        document.querySelectorAll("dom-view-template").forEach(async (template)=>{
            console.log("Parsing",template);
            let root = new RootParseNode(template);
            console.log("Rendering",template);
            this.renders.push(root.render());
            console.log("Ready for use");
        });
    }
    
    
    /**
     * ???
     * @param {type} viewName
     * @returns {unresolved}
     */
    getViewElements(viewName){
        return null; // STUB: what is this used for?
    }    
    
    /**
     * Gets the most specific binding with a value for a name in the scope
     * @param {type} bindingName
     * @param {type} scope
     * @returns {undefined|DOMView.getBindingFromScope.scope}
     */
    static getBindingFromScope(bindingName, scope){
        for (let i = scope.length - 1; i >= 0; i--) {
            if (scope[i].hasBindingFor(bindingName)) {
                return scope[i];
            }
        }
        return undefined;
    }

    /**
     * Convenience method that evaluates a value in scope
     * @param {type} bindingName
     * @param {type} scope
     * @returns {undefined}
     */
    async evaluateValueInScope(bindingName, scope) {
        let binding = DOMView.getBindingFromScope(bindingName, scope);
        if (binding===undefined) return undefined;
        
        return await binding.getValueFor(bindingName);
    }    
    
    /**
     * Gets an ordered list of concepts instances involved in rendering this view element
     * @param {HTMLElement} viewElement
     * @returns {string[]}
     */
    getConceptPath(viewElement){        
        let element = viewElement;
        while (element != null && !element.scope){
            element = element.parentElement;
            if (element==null){
                // No concepts in this tree path at all                
                return [];
            }
        }

        let result = [];
        if(element != null && element.scope != null) {
            for (let binding of element.scope) {
                if (binding instanceof ConceptInstanceBinding) {
                    result.push(binding);
                }
            }
        }
        return result;
    }
    
    /**
     * Gets an ordered list of template elements involved in rendering this view element
     * @param {HTMLElement} viewElement
     * @returns {string[]}
     */     
    getTemplatePath(viewElement){
        let result = [];
        let element = viewElement;
        while (element != null){
            if (element.templateElement){
                result.push(element.templateElement);
            }
            element = element.parentElement;
        }
        
        return result.reverse();
    }
    
    /**
     * Gets an ordered list of properties involved in rendering this view element
     * @param {HTMLElement} viewElement
     * @returns {string[]}
     */    
    getPropertyPath(viewElement){
        let element = viewElement;
        while (element != null && !element.scope){
            element = element.parentElement;
            if (element==null){
                // No concepts in this tree path at all                
                return [];
            }
        }

        let result = [];
        if(element != null && element.scope != null) {
            for (let binding of element.scope) {
                if (binding instanceof PropertyBinding) {
                    result.push({uuid: binding.uuid, property: binding.property});
                }
            }
        }
        return result;        
    }    
}

DOMView.DEBUG = false;
DOMView.singleton = new DOMView();
window.DOMView = DOMView;


//If fragments exists postpone the DOMView until all fragments was loaded at least first time. (Fragments added later obviously does not count)
if(typeof Fragment !== "undefined") {
    Fragment.addAllFragmentsLoadedCallback(()=>{
        // We started after autoDOM has run, so no mutations. Bootstrap with what we have
        console.log("DOMDiffView: Full re-render due to initial page load via Codestrates");
        DOMView.singleton.render();
    });
}
VarvEngine.registerEventCallback("engineReloaded", (evt) => {
    console.log("DOMDiffView: Full re-render due to engine reload");
    DOMView.singleton.render();
});