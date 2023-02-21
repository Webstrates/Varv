class ElementParseNode extends ParseNode {        
    constructor(templateElement){
        super(templateElement); 
        
        // Parse the children
        for (let childNode of templateElement.childNodes){
            let parseChild = this.parseTemplateNode(childNode);
            if (parseChild){
                // If this actually needs parsing, add it
                this.children.push(parseChild);
            }
        }
    }
    
    getView(targetDocument, scope){
        let self = this;
        if (DOMView.DEBUG) console.log("instantiating element", this.templateElement);
        
        // Create the element itself
        let name = this.templateElement.tagName;
        if (name==="DOM-VIEW-TEMPLATE") name = "varv-view"; // The template itself renames to view
        let element = targetDocument.createElement(name);
        let view = new ViewParticle(element, this, scope);
        element.scope = scope;
        element.templateElement = this.templateElement;
        element.parseNode = this;
                
        // Attach the children
        view.childViews = [];
        for (let child of this.children){
            let childView = child.getView(targetDocument, scope);
            view.childViews.push(childView);
            childView.mountInto(element);
        }            
        
        // Evaluate all attributes
        for(let attr of Array.from(this.templateElement.attributes)) {
            // Filtering attributes are ignored
            if (attr.name==="concept" || attr.name==="property" || attr.name==="if") continue;
            
            // Selects are a bit special, they depend on their children being present in order to set value
            if (self.templateElement.tagName==="SELECT" && attr.name==="value"){
                let selectUpdater = function selectChildrenOptionsChanged(){
                    element.value = element.varvValue;
                };
                view.childViews.forEach((childView)=>{
                    childView.addOnRenderedCallback(()=>{
                        setTimeout(selectUpdater,0);
                    });
                });
            }

            // The rest are evaluated
            let updatingEvaluation = new UpdatingEvaluation(attr.value, scope, function attributeNodeUpdated(value){
                let shouldUpdateAttribute = true;

                // Check for special attributes
                if (attr.name==="value"){
                    switch (element.tagName){
                        case "INPUT":
                            shouldUpdateAttribute = false;
                            if (self.templateElement.type==="checkbox"){
                                element.checked = value==="true" || value===true;
                            } else {
                                element.value = value;
                            }                                 
                            break;
                        case "TEXTAREA":
                            shouldUpdateAttribute = false;
                            element.value = value;
                            break;
                        case "SELECT":
                            // Update when children option render properly
                            shouldUpdateAttribute = false;
                            element.value = value;
                            element.varvValue = value;
                            break;
                        case "DIV":
                            shouldUpdateAttribute = false;
                            if (!element.blockReadbacks){
                                element.innerHTML = value;
                            }
                            break;
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
        this.addAttributeWriteBacks(element, scope);

        // Also kill all the children if we get killed
        view.addCleanup(()=>{
            view.childViews.forEach((childView)=>{
                childView.destroy();
            });
        });
        return view;
    }
    
    addAttributeWriteBacks(element, scope){
        // Check for special elements that can push data back to the concepts
        if (element.tagName==="INPUT" || element.tagName==="TEXTAREA"){
            let writeBack = this.getAttributeWriteBack(this.templateElement.getAttribute("value"), scope);
            if (writeBack!==null){
                element.addEventListener("input", ()=>{
                    writeBack.set(element.getAttribute("type")==="checkbox"?element.checked:element.value);
                });
            }
        } else if (element.tagName==="SELECT"){
            let writeBack = this.getAttributeWriteBack(this.templateElement.getAttribute("value"), scope);
            if (writeBack!==null){
                element.addEventListener("input", ()=>{
                    writeBack.set(element.value);
                });
            }
        } else if (element.tagName==="DIV" && element.getAttribute("contenteditable")!==null){
            let writeBack = this.getAttributeWriteBack(this.templateElement.getAttribute("value"), scope);
            if (writeBack!==null){
                let coalesceTimer = null;
                let needsAnotherUpdate = false;
                element.addEventListener("input", async ()=>{
                    needsAnotherUpdate = true;
                    if (!coalesceTimer){
                        coalesceTimer = setTimeout(async ()=>{
                            while (needsAnotherUpdate){
                                needsAnotherUpdate = false;
                                element.blockReadbacks = true; // Avoid reading our own changes back
                                await writeBack.set(element.innerHTML);
                                element.blockReadbacks = false;
                            }
                            coalesceTimer = null;
                        }, 100);                                
                    }
                });                
            }
        }
    }
    
    
    /**
     * Some attributes, like input.value, can bind to simple writebacks "{someProperty}" that are looked up in scope.
     * @returns {binding} A binding if it exists in scope or null
     */
    getAttributeWriteBack(rawAttributeValue, scope){
        if (rawAttributeValue===undefined || rawAttributeValue===null) return null; // Not set
        if (!(rawAttributeValue.startsWith("{") && rawAttributeValue.endsWith("}"))) return null; // Not a dynamic binding at all

        let valueLookupName = rawAttributeValue.substring(1, rawAttributeValue.length - 1);
        let binding = DOMView.getBindingFromScope(valueLookupName,scope);
        if (!(binding instanceof ConceptInstanceBinding)){
            console.warn("DOMDiffView: Writeback attribute resolves to something that is not a writable property on a concept, assuming read-only", rawAttributeValue);
            return null;
        } else {            
            return {
                set: async function attributeWriteBack(value){
                    await binding.setValueFor(valueLookupName, value);
                }
            };
        }
    }
    
}

window.ElementParseNode = ElementParseNode;