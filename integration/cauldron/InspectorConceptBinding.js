/**
 *  InspectorConceptBinding - Allow inspection of Concepts in the inspector
 *  
 *  This code is licensed under the MIT License (MIT).
 *  
 *  Copyright 2020, 2021, 2022 Rolf Bagge, Janus B. Kristensen, CAVI,
 *  Center for Advanced Visualization and Interaction, Aarhus University
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the “Software”), to deal
 *  in the Software without restriction, including without limitation the rights 
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 *  copies of the Software, and to permit persons to whom the Software is 
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
 *  THE SOFTWARE.
 *  
 */

/**
 *
 */
class InspectorConceptBinding {
    /**
     * Inspects the given TreeNode and if supported, returns a map of editable attributes
     * @param {TreeNode} treeNode
     * @returns {Cauldron.InspectorElement[]}
     */
    static inspect(treeNode) {
        let elements = [];
        let concept = null;
        let datastore = null;
       
        switch (treeNode.type){
            case "ConceptInstanceNode":
                concept = treeNode.context.concept;
                datastore = treeNode.context.datastore;

                let propertyEditors = new Cauldron.InspectorSegment("Properties", elements);
                elements.push(propertyEditors);
                for (const property of concept.properties.values()){
                    if (datastore.isPropertyMapped(concept, property) || property.isDerived()){
                        propertyEditors.push(new Cauldron.InspectorPropertyEditor(treeNode.context, property, treeNode.getTreeBrowser()));                
                    }
                }

                return elements;
                break;
            case "ConceptNode":
                concept = treeNode.context;
                
                if (concept.properties.size>0){
                    let propertiesView = new Cauldron.InspectorSegment("Properties", elements);
                    elements.push(propertiesView);
                    for (const property of concept.properties.values()){
                        propertiesView.push(new Cauldron.InspectorPropertyView(treeNode.context, property, treeNode.getTreeBrowser()));                
                    }
                }

                if (concept.behaviours.size>0){
                    let actionsView = new Cauldron.InspectorSegment("Actions", elements);
                    elements.push(actionsView);
                    for (const behaviour of concept.behaviours.values()){
                        actionsView.push(new Cauldron.InspectorBehaviourView(treeNode.context, behaviour, treeNode.getTreeBrowser()));                
                    }                
                }

                return elements;
                break;
            default:
                return null;
        } 
    }
}
window.Cauldron.InspectorConceptBinding = InspectorConceptBinding;
Cauldron.CauldronInspector.registerContentBinding(InspectorConceptBinding, 10);

class InspectorBehaviourView extends Cauldron.InspectorElement {
    constructor(concept, behaviour, treeBrowser) {
        super();
        
        let label = document.createElement("span");
        label.classList.add("cauldron-inspector-element-label");
        label.textContent = behaviour.name;

        let triggersCausingView = document.createElement("span");
        triggersCausingView.classList.add("cauldron-inspector-element-field");
        let triggerList = "";
        for (let triggerName of behaviour.triggers.values()){
            let trigger = concept.getTrigger(triggerName);
            let triggerNameReal = "'"+triggerName+"'";
            try {
                triggerNameReal = trigger.constructor.name;
            } catch (ex){}
            triggerList += "@"+triggerNameReal+" ";
        }        
        triggersCausingView.textContent = triggerList;

        // TODO: Jump to code link here

        this.html.appendChild(label);
        this.html.appendChild(triggersCausingView);
    }
}
window.Cauldron.InspectorBehaviourView = InspectorBehaviourView;

class InspectorPropertyView extends Cauldron.InspectorElement {
    constructor(concept, property, treeBrowser) {
        super();
        
        let label = document.createElement("span");
        label.classList.add("cauldron-inspector-element-label");
        label.textContent = property.name;

        let theType = document.createElement("span");
        theType.classList.add("cauldron-inspector-element-field");
        theType.textContent = property.type + (property.isDerived()?" (derived)":"");

        this.html.appendChild(label);
        this.html.appendChild(theType);
    }
}
window.Cauldron.InspectorPropertyView = InspectorPropertyView;



class InspectorPropertyEditor extends Cauldron.InspectorElement {
    /**
     *
     * @param {Element} domElement
     * @param {String} attrName
     * @param {String} overrideLabel
     */
    constructor(conceptInstance, property, browser) {
        super();
        this.browser = browser;

        let self = this;

        this.conceptInstance = conceptInstance;
        this.property = property;

        if(property.isDerived()) {
            this.readOnly = true;
        }

        if (property.type==="array"){
            this.editor = document.createElement("div");            
        } else if (property.type==="boolean"){
            this.editor = document.createElement("input");            
            this.editor.setAttribute("type", "checkbox");
        } else if (property.type==="number"){
            this.editor = document.createElement("input");
            this.editor.setAttribute("type", "number");
            this.editor.setAttribute("step", "1");
        } else {
            this.editor = document.createElement("input");
            this.editor.setAttribute("contenteditable", "true");
            this.editor.setAttribute("spellcheck", "false");
        }
        this.editor.classList.add("cauldron-inspector-element-editor");

        if(this.readOnly) {
            this.editor.setAttribute("disabled", true);
        }

        this.label = document.createElement("span");
        this.label.classList.add("cauldron-inspector-element-label");
        this.label.textContent = property.name;

        this.html.append(this.label);

        this.editorContainer = document.createElement("div");
        this.editorContainer.appendChild(this.editor);
        this.editorContainer.classList.add("cauldron-inspector-element-editor-container");
        this.editorContainer.classList.add("cauldron-inspector-element-field");

        this.html.appendChild(this.editorContainer);

        this.html.classList.add("inspector-property");
        
        this.html.addEventListener("click", ()=>{
            EventSystem.triggerEventAsync("Varv.DOMView.HighlightProperty", property);
        });        
        
        if(this.property.isConceptType()) {
            this.autocompleteDiv = document.createElement("div");
            this.autocompleteDiv.classList.add("cauldron-inspector-element-autocomplete");
            this.autocompleteDiv.classList.add("hidden");
            this.editorContainer.appendChild(this.autocompleteDiv);

            if(!this.readOnly) {
                this.editor.addEventListener("focus", () => {
                    self.autoComplete(self.editor.value);
                });
                document.addEventListener("pointerdown", (evt) => {
                    if (evt.target.closest(".cauldron-inspector-element-editor-container") !== self.editorContainer) {
                        self.autocompleteDiv.innerHTML = "";
                        self.autocompleteDiv.classList.add("hidden");
                    }
                });
            }
            
            // Add the click-to-locate feature
            if (property.type!=="array"){
                this.locatorContainer = document.createElement("span");
                this.editorContainer.append(this.locatorContainer);
            }            
        }
        
        this.html.addEventListener("keydown", (event)=>{
            if(event.code === "Enter") {
                event.preventDefault();
            }
        });                

        // Send changes to concept
        this.html.addEventListener("input", (evt)=>{
            if(self.property.isConceptType()) {
                self.autoComplete(self.editor.value);
            }

            self.persistValue();
        });

        // Fetch changes from concept
        this.valueUpdaterCallback = async function onFieldUpdate(uuid, value){
            let mark = VarvPerformance.start();
            if (uuid===self.conceptInstance.uuid){
                if (property.type==="array"){
                    self.editor.innerHTML="";
                    let value = await property.getValue(conceptInstance.uuid);
                    for(let i = 0; i < value.length; i++){ 
                        let entry = value[i];
                        let entryElement = document.createElement("div");
                        entryElement.style.display = "flex";
                        entryElement.style.alignItems = "center";

                        if (!property.isDerived()){
                            let deleter = IconRegistry.createIcon("mdc:delete");
                            deleter.style.cursor = "pointer";
                            deleter.style.flex = "1 1 0%";
                            deleter.style.fontSize = "1.5em";
                            deleter.addEventListener("click", ()=>{
                                // Delete this entry
                                value.splice(i, 1);
                                property.setValue(conceptInstance.uuid, value); 
                            });    
                            entryElement.appendChild(deleter);
                        }
                                                
                        let theText = document.createElement("div");
                        theText.style.flex = "1 1 100%";
                        theText.innerText = entry;
                        entryElement.appendChild(theText);
                        
                        
                        if (property.isConceptArrayType()){
                            let link = self.getConceptLink(entry);
                            link.style.flex = "1 1 0%";
                            entryElement.appendChild(link);
                        }
                        
                        self.editor.appendChild(entryElement);                        
                    }   
                    
                    if (!property.isDerived()){
                        let adder = document.createElement("button");
                        adder.innerText = "Add Entry";
                        adder.addEventListener("click", ()=>{
                            let newValue = prompt ("Value to add", "");
                            value.push(newValue);
                            property.setValue(conceptInstance.uuid, value);
                        });                    
                        self.editor.appendChild(adder);
                    }
                } else if (property.type==="boolean"){
                    self.editor.checked = value;
                } else {
                    self.editor.value = value;
                    
                    if (property.isConceptType()){
                        self.updateLocator();
                    }
                }
            }
            VarvPerformance.stop("InspectorConceptBinding.valueUpdaterCallback", mark);
        };
        
        property.getValue(conceptInstance.uuid).then((value)=>{
            self.valueUpdaterCallback(self.conceptInstance.uuid, value);
        });
        property.addUpdatedCallback(this.valueUpdaterCallback);
    }

    updateLocator() {
        this.locatorContainer.innerHTML = "";
        this.locatorContainer.appendChild(this.getConceptLink(this.editor.value));
    }

    persistValue() {
        try {
            let value = null;
            if (this.property.type==="boolean"){
                value = this.editor.checked;
            } else {
                value = this.property.typeCast(this.editor.value);
                if (this.property.isConceptType()){
                    this.updateLocator();
                }
            }
            this.property.setValue(this.conceptInstance.uuid, value);

            //What is this method?
            this.setFailing(false);
        } catch (ex){
            this.setFailing(true);
        };
    }

    async autoComplete() {
        const self = this;

        let allUUIDS = await VarvEngine.getAllUUIDsFromType(this.property.type, true);

        this.autocompleteDiv.innerHTML = "";

        let ul = document.createElement("ul");

        allUUIDS.forEach((uuid)=>{
            let li = document.createElement("li");
            li.textContent = uuid;
            ul.appendChild(li);

            li.addEventListener("mouseenter", ()=>{
                EventSystem.triggerEventAsync("Varv.DOMView.HighlightInstance", uuid);
            });

            li.addEventListener("mouseleave", ()=>{
                EventSystem.triggerEventAsync("Varv.DOMView.ClearHighlights");
            });

            li.addEventListener("click", ()=>{
                self.editor.value = uuid;
                self.autocompleteDiv.classList.add("hidden");
                self.persistValue();
            });
        });

        this.autocompleteDiv.appendChild(ul);
        this.autocompleteDiv.classList.remove("hidden");
    }

    getConceptLink(uuid){
        let linker = IconRegistry.createIcon("mdc:gps_fixed");
        linker.style.cursor = "pointer";
        linker.addEventListener("click", ()=>{
            let treeNodes = this.browser.findTreeNode(uuid);
            if(treeNodes.length > 0) {
                let treeNode = treeNodes[0];
                treeNode.reveal();
                treeNode.select();
            }            
        });        
        return linker;
    }

    destroy() {
        super.destroy();
        this.property.removeUpdatedCallback(this.valueUpdaterCallback);
    }
    
    focus(){
        this.editor.select();
    }
}

window.Cauldron.InspectorPropertyEditor = InspectorPropertyEditor;
 


EventSystem.registerEventCallback("TreeBrowser.Selection", ({detail: {selection: selection}})=>{
    if (selection.context && selection.context instanceof Concept){
        let concept = selection.context;
        EventSystem.triggerEventAsync("Varv.DOMView.HighlightConcept", concept);
    } else if (selection.context && selection.context.uuid) {        
        EventSystem.triggerEventAsync("Varv.DOMView.HighlightInstance", selection.context.uuid);
    } else {
        EventSystem.triggerEventAsync("Varv.DOMView.ClearHighlights");
    }
});
