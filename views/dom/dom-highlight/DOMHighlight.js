class DOMHighlighter {      
    constructor(){
        let self = this;
        
        let conceptHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightConcept", (evt)=>{
            let concept = evt.detail;
            self.getViews().forEach((view)=>{
                self.walkView(view, self.clearHighlight);
                self.walkView(view, function highlightConcept(node){
                    for (let conceptBinding of DOMView.singleton.getConceptPath(node)){
                        if (conceptBinding.concept===concept){
                            self.highlight(node);
                            return false; // Don't highlight into children
                        }
                    }
                    return true;
                });
            });
        });
        
        let instanceHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightInstance", (evt)=>{
            let uuid = evt.detail;
            self.getViews().forEach((view)=>{
                self.walkView(view, self.clearHighlight);
                self.walkView(view, function highlightInstance(node){
                    for (let conceptBinding of DOMView.singleton.getConceptPath(node)){
                        if (conceptBinding.uuid===uuid){
                            self.highlight(node);
                            return false; // Don't highlight into children
                        }
                    }
                    return true;
                });
            });
        });        
        
        let propertyHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightProperty", (evt)=>{
            let property = evt.detail;
            self.getViews().forEach((view)=>{
                self.walkView(view, self.clearHighlight);
                self.walkView(view, function highlightProperty(node){
                    for (let entry of DOMView.singleton.getPropertyPath(node)){
                        if (entry.property===property){
                            if (node.setAttribute){                                
                                node.setAttribute("varv-domview-highlight",true);
                            }
                            return false;
                        }
                    }
                    return true;
                });
            });
        });       
        
        let clearHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.ClearHighlights", (evt)=>{
            self.getViews().forEach((view)=>{
                self.walkView(view, self.clearHighlight);
            });
        });        
    }
    
    getViews(){
        return document.querySelectorAll("varv-view");
    }
    
    highlight(node){
        if (node.setAttribute){                                
            node.setAttribute("varv-domview-highlight",true);
        }        
    }
        
    clearHighlight(node){
        if (node.getAttribute && node.getAttribute("varv-domview-highlight")){
            node.removeAttribute("varv-domview-highlight");
        }
        return true;
    }
    
    walkView(view, nodeCallback){
        let diveIntoChildren = nodeCallback(view);
        if (diveIntoChildren){
            for (let child of view.childNodes){
                this.walkView(child, nodeCallback);
            }
        }
    }
}

window.DOMHighlighter = DOMHighlighter;
window.DOMHighlighter.singleton = new DOMHighlighter();