/**
 *  DOMView - A view that provides a DOM templating engine for concepts
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

class DOMView {
    constructor() {
        const self = this;

        // Add an observer to the DOM
        this.observer = new MutationObserver((mutations) => {
            self.mutationCallback(mutations);
        });
        self.startObserver();
    }

    /**
     * Starts the element mutation observer
     * @ignore
     * @protected
     */
    startObserver() {
        this.observer.observe(document.body, {
            attributes: true,
            attributeOldValue: true,    
            childList: true,
            subtree: true,
            characterData: true,
            characterDataOldValue: false
        });
    }

    getViewElements(viewName) {
        let templates = document.querySelectorAll("dom-view-template");
        let viewElements = [];
        templates.forEach((template)=>{
            if (template.varvView){
                let views = template.varvView.querySelectorAll("[view='"+viewName+"']");
                views.forEach((view)=>{
                    viewElements.push(view);
                });
            }
        });
        return viewElements;
    }

    async mutationCallback(mutationList) {
        try {
            const self = this;
            let promises = [];

            for(let mutation of mutationList) {
                switch (mutation.type) {
                    case 'childList':
                        let rebuildTemplates = [];
                        let killTemplates = [];

                        // If change was inside a template, rebuild view
                        let potentialParent = mutation.target.closest("dom-view-template");
                        if (potentialParent){
                            rebuildTemplates.push(potentialParent);
                        }

                        // If a DOM view template was added either directly or indirectly, rebuild view
                        for(let node of mutation.addedNodes) {
                            try {
                                if (node.tagName === "DOM-VIEW-TEMPLATE") {
                                    rebuildTemplates.push(node);
                                } else if (node.querySelectorAll != null){
                                    // Could be a childnode as well
                                    Array.prototype.push.apply(rebuildTemplates, Array.from(node.querySelectorAll("dom-view-template")));
                                }
                            } catch (ex) {
                                console.error(ex);
                            }
                        }

                        // Find directly or indirectly removed varv templates and destroy their views
                        for(let node of mutation.removedNodes) {
                            if (node.tagName === "DOM-VIEW-TEMPLATE") {
                                killTemplates.push(node);
                            } else if (node.querySelectorAll != null){
                                Array.prototype.push.apply(killTemplates, Array.from(node.querySelectorAll("dom-view-template")));
                            }                        
                        }

                        for (let templateElement of killTemplates){
                            let connectedView = templateElement.varvView;
                            if (connectedView){
                                self.tearDownElement(connectedView);
                            }                        

                            // Find DOM template elements in the removed varv templates and rebuild all other views in which they are used (since they are now unreferenceable)
                            for (let childTemplate of templateElement.querySelectorAll("template, varv-template")){
                                let name = childTemplate.getAttribute("name");
                                if (name){
                                    await EventSystem.triggerEventAsync("domview.template.disappeared", name);
                                }
                            }
                        }

                        for(let templateElement of rebuildTemplates) {
                            await self.rebuildView(templateElement);

                            // Also notify any template-refs in other views of the DOM templates that just appeared within this varv template
                            for (let childTemplate of templateElement.querySelectorAll("template, varv-template")){
                                let name = childTemplate.getAttribute("name");
                                if (name){
                                    await EventSystem.triggerEventAsync("domview.template.appeared", name);
                                }
                            }
                        }
                        break;
                    case "attributes":
                        // Handle someone changing the name of a template
                        if ((mutation.target.tagName==="VARV-TEMPLATE" || mutation.target.tagName==="TEMPLATE") && mutation.attributeName==="name"){
                            await EventSystem.triggerEventAsync("domview.template.disappeared", mutation.oldValue);
                            let name = mutation.target.getAttribute("name");
                            if (name){
                                await EventSystem.triggerEventAsync("domview.template.appeared", name);
                            }
                        } else if (mutation.target.tagName==="DOM-VIEW-TEMPLATE"){
                            // Handle changes to targetElement attributes etc
                            await self.rebuildView(mutation.target);
                        } else if (mutation.target.closest("dom-view-template")){
                            // Attribute inside a template
                            await self.rebuildView(mutation.target.closest("dom-view-template"));
                        }

                        break;                        
                    case "characterData":
                        // If change was inside a dom view template, rebuild view
                        let charParent = mutation.target.parentElement.closest("dom-view-template");
                        if (charParent){
                            await self.rebuildView(charParent);
                        }               
                        
                        // If it was also inside a varv template, rebuild anything depending on that
                        let varvTemplateParent = mutation.target.parentElement.closest("template, varv-template");
                        if (varvTemplateParent){
                            let varvTemplateParentName = varvTemplateParent.getAttribute("name");
                            if (varvTemplateParentName){
                                await EventSystem.triggerEventAsync("domview.template.appeared", varvTemplateParentName);
                            }                        
                        }
                        
                        break;
                }
            }
        } catch (ex){
            console.log(ex);
        }
    }

    /**
     * Reconstructs a view based on the template element(s) currently loaded
     * @param {HTMLElement} templateElement
     * @returns {Promise<void>}
     */
    async rebuildView(templateElement) {
        const self = this;

        // If view already exists, tear it down to let it rebuild
        if (templateElement == null || templateElement == undefined) {
            console.warn("[rebuildView] Template element did not exist?:", templateElement);
            return;
        }        
        
        if (templateElement.isRendering){
            console.log("Requested render of DOMView while already busy rendering, queueing another frame");
            templateElement.isRenderingInterruption = true;
        } else {
            if (templateElement.renderTimeout) clearTimeout(templateElement.renderTimeout);
            templateElement.renderTimeout = setTimeout(async ()=>{
                try {
                    // Create a new rendering view
                    templateElement.isRendering = true;
                    
                    // Find the target document
                    let targetFrameSpec = templateElement.getAttribute("targetFrame");
                    let targetDocument;
                    if (targetFrameSpec){
                        let frame = document.querySelector(targetFrameSpec);
                        if (!frame) throw new Error("DOMView: dom-view-template with targetFrame that does not exist in document failed to render", targetFrameSpec, templateElement);
                        targetDocument = frame.contentDocument;
                    } else {                        
                        targetDocument = document;
                    }

                    let view = targetDocument.createElement("varv-view");
                    let oldView = templateElement.varvView;
                    view.templateElement = templateElement;

                    // Re-render template nodes if additions/removals are made later
                    let addCallback = VarvEngine.registerEventCallback("appeared", (evt) => {
                        let conceptThatHadAdded = VarvEngine.getConceptFromUUID(evt.target);

                        // TODO: Check if we actually use it anywhere as a concept
                        // TODO: Check if we actually use it as a property
                        // TODO: Rebuild only that part of the tree

                        // STUB: Rebuilding everything
                        self.stubTriggerFullRebuild(templateElement, "Concept was added somewhere");
                    });
                    let deleteCallback = VarvEngine.registerEventCallback("disappeared", (evt) => {
                        // STUB: Rebuilding everything
                        self.stubTriggerFullRebuild(templateElement, "Concept was removed somewhere");
                    });
                    let reloadCallback = VarvEngine.registerEventCallback("engineReloaded", (evt) => {
                        // STUB: Rebuilding everything
                        self.stubTriggerFullRebuild(templateElement, "Engine was reloaded entirely");
                    });      
                    let clearHighlights = function clearHighlight(node){
                        if (node.getAttribute && node.getAttribute("varv-domview-highlight")){
                            node.removeAttribute("varv-domview-highlight");
                        }
                        return true;
                    }
                    let conceptHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightConcept", (evt)=>{
                        let concept = evt.detail;
                        self.walkView(view, clearHighlights);
                        self.walkView(view, function highlightConcept(node){
                            for (let conceptUUID of self.getConceptPath(node)){
                                let nodeConcept = VarvEngine.getConceptFromUUID(conceptUUID);
                                if (nodeConcept===concept){
                                    if (node.setAttribute){                                
                                        node.setAttribute("varv-domview-highlight",true);
                                    }
                                    return false;
                                }
                            }
                            return true;
                        });
                    });            
                    let instanceHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightInstance", (evt)=>{
                        let uuid = evt.detail;
                        self.walkView(view, clearHighlights);
                        self.walkView(view, function highlightInstance(node){
                            for (let conceptUUID of self.getConceptPath(node)){
                                if (conceptUUID===uuid){
                                    if (node.setAttribute){                                
                                        node.setAttribute("varv-domview-highlight",true);
                                    }
                                    return false;
                                }
                            }
                            return true;
                        });
                    });            
                    let propertyHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.HighlightProperty", (evt)=>{
                        let property = evt.detail;
                        self.walkView(view, clearHighlights);
                        self.walkView(view, function highlightProperty(node){
                            for (let entry of self.getPropertyPath(node)){
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

                    let clearHighlightCallback = EventSystem.registerEventCallback("Varv.DOMView.ClearHighlights", (evt)=>{
                        self.walkView(view, clearHighlights);
                    });
                    self.addCleanup(view, () => {
                        conceptHighlightCallback.delete();
                        instanceHighlightCallback.delete();
                        propertyHighlightCallback.delete();
                        clearHighlightCallback.delete();
                        addCallback.delete();
                        deleteCallback.delete();
                        reloadCallback.delete();
                    });

                    // Go through the varv template one node at a time and clone it into the view
                    for (let templateChild of Array.from(templateElement.childNodes)) {
                        await self.cloneToView(targetDocument, view, templateChild);
                    }

                    // Insert into target document
                    let targetSpec = templateElement.getAttribute("targetElement");
                    view.targetSpec = targetSpec;
                    view.targetFrameSpec = targetFrameSpec;
                    if ((oldView && oldView.targetSpec!=targetSpec) || (oldView && oldView.targetFrameSpec!=targetFrameSpec)){
                        // Old view was somewhere else, tear it down
                        self.tearDownElement(oldView);                    
                        oldView = false;
                    }
                    if (oldView && !oldView.parentNode){
                        // Old view was outside any document, it is useless
                        console.log("DOMView: Was replacing a view but it had no parent in any document and was useless", templateElement);                                                
                        self.tearDownElement(oldView);                    
                        oldView = false;
                    }

                    if (oldView==null || oldView==false) {
                        // This is the first render, insert into target document
                        if (targetFrameSpec){
                            // Rendering to an iframe
                            if (targetSpec){
                                // This template uses a custom render target element, try to find it
                                let targetElement = targetDocument.querySelector(targetSpec);
                                if (targetElement){
                                    targetElement.appendChild(view);
                                } else {
                                    console.error("DOMView: Rendering into nothingness since template targetElement does not exist in target iframe: ", targetFrameSpec, targetSpec);
                                }
                            } else {
                                // Just plain add it to body
                                targetDocument.body.appendChild(view);
                            }
                        } else {
                            // Rendering to the local document
                            if (targetSpec){
                                // This template uses a custom render target element, try to find it
                                let targetElement = targetDocument.querySelector(targetSpec);
                                if (targetElement){
                                    targetElement.appendChild(view);
                                } else {
                                    console.error("DOMView: Rendering into nothingness since template targetElement does not exist in document: ", targetSpec);
                                }
                            } else {
                                // Default is to render just after the template element.
                                // Special-case for CodeStrates-based templates (avoid getting deleted inside autoDOM)
                                let autoDOM = templateElement.closest(".autoDom");
                                if (autoDOM){
                                    // Add after autoDOM instead of inside of it
                                    if (!autoDOM.parentNode){
                                        console.log("DOMView: Was rendering an autoDOM template but it had no parent", templateElement);
                                    }
                                    autoDOM.parentNode.insertBefore(view, autoDOM.nextElementSibling);
                                } else {
                                    // Outside we just insert after the template directly
                                    if (!templateElement.parentNode){
                                        console.log("DOMView: Was rendering a non autoDOM template but it had no parent", templateElement);
                                    }
                                    templateElement.parentNode.insertBefore(view, templateElement.nextElementSibling);
                                }
                            }
                        }
                    } else {
                        // Replace old view           
                        oldView.parentNode.insertBefore(view, oldView);
                        self.tearDownElement(oldView);
                    }

                    // View has updated
                    templateElement.varvView = view;
                } catch (ex){
                    console.error("DOMView render exception", ex);
                }
                templateElement.isRendering = false;
                if (templateElement.isRenderingInterruption){
                    // We got interrupted while rendering, try again
                    templateElement.isRenderingInterruption = false;
                    self.rebuildView(templateElement);
                }

            }, 1); // Only update view at 1000fps at most        
            
        }
    }
    
    walkView(view, nodeCallback){
        let diveIntoChildren = nodeCallback(view);
        if (diveIntoChildren){
            for (let child of view.childNodes){
                this.walkView(child, nodeCallback);
            }
        }
    }

    async cloneToView(targetDocument, currentViewElement, currentTemplateNode, currentScope = [], currentInsertBeforeElement=null) {
        const self = this;
        let results = [];
        
        switch (currentTemplateNode.nodeType){
            case Node.COMMENT_NODE:
                // Drop all comments to minify view as much as possible - we cannot update them properly anyways
                break;
            case Node.TEXT_NODE:
                // Rewrite contents by matching {zzz} with content from the scope and updating it if it changes
                let element = targetDocument.createTextNode("");
                element.templateElement = currentTemplateNode;
                await new Promise(initialUpdateResolve => {
                    let selfUpdatingString = new UpdatingStringEvaluation(currentTemplateNode.nodeValue, currentScope, function textNodeUpdated(text){                        
                        element.nodeValue = text;
                        
                        if (initialUpdateResolve){ // We wait for the first update to avoid voids in the UI rendering
                            initialUpdateResolve();
                            initialUpdateResolve = false;
                        }
                    });
                    self.addCleanup(element, ()=>{
                        selfUpdatingString.destroy();
                    });      
                });
                currentViewElement.appendChild(element);                
                results.push(element);
                break;
            case Node.ELEMENT_NODE:
                // Element nodes are more complicated
                switch (currentTemplateNode.tagName) {
                    case "TEMPLATE":
                        console.error("DOMView: <template> element is deprecated inside dom view template - use <varv-template> instead! Live editing is disabled for this element", currentTemplateNode);
                    case "VARV-TEMPLATE":
                        // Ignored entirely, only ever used directly from varv template
                        break;
                    default:
                        // A conditional if attribute may block elements from rendering
                        let conditionalIf = async function conditionalIf(localInsertBeforeElement, insertList, scope) {
                            let ifAttributeRaw = currentTemplateNode.getAttribute("if");
                            if (ifAttributeRaw!==null){
                                // Inject a handle for updating the property
                                let conditionalHandle = targetDocument.createProcessingInstruction("whenjs-conditional-handle", ifAttributeRaw);
                                insertList.push(conditionalHandle); // Only expose this handle to the outside, we take care of the rest ourselves
                                currentViewElement.insertBefore(conditionalHandle, localInsertBeforeElement);
                                let conditionalHandleChildren = [];         

                                // Handle changes to looked up conditional attribute itself (i.e. when dynamically using {...} as the attribute
                                let selfUpdatingConditionalAttribute = new UpdatingStringEvaluation(ifAttributeRaw, scope, async function conditionalAttributeUpdated(conditionSource){
                                    // Remove previously rendered children
                                    for (let child of conditionalHandleChildren){
                                        self.tearDownElement(child);
                                    }
                                    conditionalHandleChildren = [];
                                    
                                    try {
                                        let negate = false;
                                        let isTestingInstanceOf = false;
                                        let testType;
                                        
                                        // Check wether this is an existance "if" or type "if"
                                        let originalConditionSource = conditionSource;
                                        if (conditionSource.includes("concept ")){ // STUB: should probably be regex with captures...
                                                // Instance-of if
                                                if(conditionSource.startsWith("!"))  throw new Error("DOMView: Unsupported negate of instance-of check");
                                                isTestingInstanceOf = true;
                                                
                                                testType = conditionSource.substring(conditionSource.indexOf("concept ")+8);
                                                conditionSource = conditionSource.replace("concept "+testType, "").trim();
                                                if (conditionSource.length === 0){
                                                    conditionSource = "concept::uuid"; // Use most recently bound concept
                                                }
                                        } else {
                                                // Standard if
                                                if(conditionSource.startsWith("!")) {
                                                    conditionSource = conditionSource.substring(1);
                                                    negate = true;
                                                }
                                        }
                                                                                
                                        if (conditionSource === undefined){
                                            console.warn("DOM varv template has conditional attribute '"+ifAttributeRaw+"' that evaluates to undefined", scope, currentTemplateNode);
                                            throw new Error("Cannot render conditional element where condition source '"+ifAttributeRaw+"' evaluates to undefined");
                                        }

                                        let binding = await DOMView.getBindingFromScope(conditionSource, scope);
                                        if (!binding) {
                                            console.warn("DOM varv template conditional selecting undefined '"+conditionSource+"' not bound in scope: ", scope, currentTemplateNode);
                                            throw new Error("Selecting conditional boolean '"+conditionSource+"' not bound in scope");
                                        }

                                        // Perform the actual conditional test
                                        let conditionalValue = false;
                                        if (isTestingInstanceOf){
                                            let testTarget = await binding.getValueFor(conditionSource);
                                            if (testTarget instanceof ConceptInstanceBinding){
                                                testTarget = testTarget.concept;
                                            } else {
                                                // This may be an uuid, if so, look it up instead
                                                testTarget = VarvEngine.getConceptFromUUID(testTarget);
                                            }
                                            conditionalValue = testTarget.isA(testType);
                                        } else {
                                            //  here everything that js considers "true" is accepted
                                            try {
                                                conditionalValue = await binding.getValueFor(conditionSource);

                                                if(negate) {
                                                    conditionalValue = ! conditionalValue;
                                                }
                                            } catch (ex){
                                                // Ignore this
                                                console.warn(ex);
                                            }
                                        }

                                        if (conditionalValue) {
                                            for (let resultingChild of await self.insertFromTemplateElement(targetDocument, currentViewElement, currentTemplateNode, scope, conditionalHandle)){
                                                conditionalHandleChildren.push(resultingChild);
                                            }
                                        }     
                                        
                                        // Register property update callbacks for the final looked up conditional source       
                                        let property = null;
                                        if (binding instanceof ConceptInstanceBinding){
                                            property = binding.concept.getProperty(conditionSource);
                                        } else if (binding instanceof PropertyBinding){
                                            property = binding.property;
                                        }
                                        if (property){
                                            // The value is property-based and can update
                                            let callback = (uuid)=>{
                                                if (uuid===binding.uuid){
                                                    conditionalAttributeUpdated(originalConditionSource); // Re-render ourselves
                                                }
                                            };                                        
                                            property.addUpdatedCallback(callback);

                                            // Clean it up later
                                            let cleanupHandle = targetDocument.createProcessingInstruction("whenjs-cleanup-handle", ifAttributeRaw);
                                            currentViewElement.insertBefore(cleanupHandle, conditionalHandle);                                        
                                            conditionalHandleChildren.push(cleanupHandle);
                                            self.addCleanup(cleanupHandle, ()=>{
                                                property.removeUpdatedCallback(callback);
                                            });
                                        };                                        
                                    } catch (exception){                                    
                                        console.warn("DOM varv template conditional value evaluation caused an error: ", exception, conditionSource, scope, currentTemplateNode);
                                        let child = self.createErrorElement("Evaluating '"+conditionSource+"' caused "+exception, targetDocument);
                                        currentViewElement.insertBefore(child, conditionalHandle);
                                        conditionalHandleChildren.push(child); // intentionally only exposed to conditionalHandleChildren
                                    }                                        
                                });
                                self.addCleanup(conditionalHandle, ()=>{
                                    selfUpdatingConditionalAttribute.destroy();
                                    for (let child of conditionalHandleChildren){
                                        self.tearDownElement(child);
                                    }
                                    conditionalHandleChildren = [];                                    
                                });                                   
                            } else {
                                // No if-attribute, everything goes straight thru
                                for (let resultingChild of await self.insertFromTemplateElement(targetDocument, currentViewElement, currentTemplateNode, scope, localInsertBeforeElement)){
                                    insertList.push(resultingChild);
                                }                                
                            }
                        }
                        
                        // Property Attribute: May create potential duplicates
                        let splitProperty = async function splitProperty(localInsertBeforeElement, insertList, scope) {
                            // Selecting a property changes what is in scope and could potentially create duplicates if the property is an array
                            let propertyAttributeRaw = currentTemplateNode.getAttribute("property");
                            if (propertyAttributeRaw!==null){
                                // Inject a handle for updating the property
                                let outerPropertyHandle = targetDocument.createProcessingInstruction("varv-property-handle", propertyAttributeRaw);
                                insertList.push(outerPropertyHandle); // Only expose this handle to the outside, we take care of the rest ourselves
                                currentViewElement.insertBefore(outerPropertyHandle, localInsertBeforeElement);
                                let outerPropertyHandleChildren = [];
                                
                                // Handle changes to looked up property type attribute itself (i.e. when dynamically using {...} as the attribute
                                let selfUpdatingPropertyAttribute = new UpdatingStringEvaluation(propertyAttributeRaw, scope, async function propertyAttributeUpdated(propertyType){
                                    // Remove previously rendered children
                                    for (let child of outerPropertyHandleChildren){
                                        self.tearDownElement(child);
                                    }
                                    outerPropertyHandleChildren = [];
                                    
                                    let handle = targetDocument.createProcessingInstruction("varv-property-handle", propertyType);
                                    outerPropertyHandleChildren.push(handle); // This handle is intentionally only exposed to the outerPropertyHandle
                                    currentViewElement.insertBefore(handle, outerPropertyHandle);
                                    
                                    // Insert the new ones
                                    try {
                                        if (propertyType === undefined){
                                            console.warn("DOM varv template selecting property '"+propertyAttributeRaw+"' that evaluates to undefined", scope, currentTemplateNode);
                                            throw new Error("Cannot render property '"+propertyAttributeRaw+"' which evaluates to undefined");
                                        }
                                        let binding = await DOMView.getBindingFromScope(propertyType, scope);
                                        if (!binding) {
                                            console.warn("DOM varv template selecting undefined property '"+propertyType+"' not bound in scope: ", scope, currentTemplateNode);
                                            throw new Error("Selecting undefined property '"+propertyType+"' not bound in scope");
                                        }                        
                                        if (!(binding instanceof ConceptInstanceBinding)){
                                            console.warn("DOM varv template selecting property that was bound on something else than a concept, this is a bug: ", propertyType, scope, currentTemplateNode);
                                            throw new Error("Cannot select a property that was bound to something else than a concept");
                                        }
                                        let propertyValue = await binding.getValueFor(propertyType);
                                        if (propertyValue === undefined) {
                                            console.warn("DOM varv template selecting property that evaluates to undefined value: ", propertyType, scope, currentTemplateNode);
                                            throw new Error("Value is undefined and cannot be rendered");
                                        }

                                        if (Array.isArray(propertyValue)) {
                                            // We need duplication
                                            // STUB: No filtering of property values in SPEC?
                                            // STUB: No sorting of property values in SPEC?  
                                            let index = 0;
                                            for(let arrayEntry of propertyValue) {
                                                let childScope = scope.slice(); // Copy the scope
                                                let newBinding = {};
                                                if (arrayEntry instanceof ConceptInstance) {
                                                    childScope.push(arrayEntry); // If this was a concept, add it to the scope
                                                    childScope.push(new ValueBinding({
                                                        'concept::uuid': arrayEntry.uuid
                                                    })); // Make the uuid referenceable for debug etc                                             
                                                    newBinding[propertyType + ".value"] = arrayEntry.uuid;
                                                } else {
                                                    newBinding[propertyType + ".value"] = arrayEntry; // otherwise then the value becomes bound under X.value
                                                }
                                                newBinding[propertyType + ".index"] = index;
                                                index++;
                                                childScope.push(new PropertyBinding(binding.concept.getProperty(propertyType), binding.uuid));
                                                childScope.push(new ValueBinding(newBinding));

                                                await conditionalIf(handle, outerPropertyHandleChildren, childScope);
                                            }
                                        } else {
                                            // Single property value, no duplication                            
                                            // Warn if this is not a concept as non-concept non-list values make no sense
                                            if (!(propertyValue instanceof ConceptInstance)){
                                                console.warn("DOM varv template using something that is not a list of simple values, a concept or a list of concepts as a property, this is not valid", propertyType, scope, currentTemplateNode);
                                                throw new Error("Cannot use a type for the property attribute that is not a list of simple values or a concept reference");                                                
                                            }
                                            let newBinding = {'concept::uuid': propertyValue.uuid};
                                            newBinding[propertyType + ".value"] = propertyValue.uuid;
                                            scope.push(new ConceptInstanceBinding(propertyValue.uuid));
                                            scope.push(new PropertyBinding(binding.concept.getProperty(propertyType), binding.uuid));
                                            scope.push(new ValueBinding(newBinding));
                                            await conditionalIf(handle, outerPropertyHandleChildren, scope);
                                        }        
                                        
                                        // Register update callbacks for the final looked up property                                    
                                        let property = binding.concept.getProperty(propertyType);
                                        let callback = ()=>{
                                            propertyAttributeUpdated(propertyType); // Re-render ourselves
                                        };
                                        property.addUpdatedCallback(callback);
                                        // Clean it up later
                                        self.addCleanup(handle, ()=>{
                                            property.removeUpdatedCallback(callback);
                                        })
                                    } catch (exception){                                    
                                        console.warn("DOM varv template selecting property where value evaluation caused an error: ", exception, propertyType, scope, currentTemplateNode);
                                        let child = self.createErrorElement("Evaluating '"+propertyType+"' caused "+exception, targetDocument);
                                        currentViewElement.insertBefore(child, handle);
                                        outerPropertyHandleChildren.push(child); // intentionally only exposed to outerPropertyHandle
                                    }
                                });
                                self.addCleanup(outerPropertyHandle, ()=>{
                                    selfUpdatingPropertyAttribute.destroy();
                                    for (let child of outerPropertyHandleChildren){
                                        self.tearDownElement(child);
                                    }
                                    outerPropertyHandleChildren = [];                                    
                                });   
                            } else {
                                // No property, straight clone
                                await conditionalIf(localInsertBeforeElement, insertList, scope);
                            }
                        }
                        

                        // Concept Attribute: Do we need to clone multiple nodes due to a concept selection?
                        let conceptAttributeRaw = currentTemplateNode.getAttribute("concept");
                        if (conceptAttributeRaw!==null){
                            // Inject a handle for updating the attribute
                            let conceptHandle = targetDocument.createProcessingInstruction("varv-concept-handle", conceptAttributeRaw);
                            results.push(conceptHandle); // Expose this handle to the outside
                            try {
                                currentViewElement.insertBefore(conceptHandle, currentInsertBeforeElement);
                            } catch (ex) {
                                console.error("Concept insert before failed with ", conceptHandle, currentInsertBeforeElement);
                            }
                            let conceptChildren = [];
                            
                            // Handle changes to looked up concept type attribute itself (i.e. when dynamically using {...} as the attribute                         
                            let selfUpdatingConceptAttribute = new UpdatingStringEvaluation(conceptAttributeRaw, currentScope, async function conceptAttributeUpdated(conceptType){
                                if (!conceptHandle.parentNode) {
                                    if (DOMView.DEBUG){
                                        console.warn("FIXME: Harmless conceptAttributeUpdated while handle was not in DOM anymore, be sure to destroy the evaluator before causing any updates, ignored for now", conceptHandle);
                                    }
                                    return;
                                }
                                // Remove previously rendered children
                                for (let child of conceptChildren){
                                    self.tearDownElement(child);
                                }
                                conceptChildren = [];
                            
                                // Insert the new ones
                                try {
                                    if (conceptType === undefined) {
                                        console.warn("DOM varv template selecting concept '"+conceptAttributeRaw+"' that evaluates to undefined", currentScope, currentTemplateNode);
                                        throw new Error("Cannot render concept '"+conceptAttributeRaw+"' which evaluates to undefined");                                        
                                    }

                                    let concept = VarvEngine.getConceptFromType(conceptType);
                                    if (!concept){
                                        console.warn("DOM varv template selects concept '"+conceptType+"' that doesn't currently exist", conceptAttributeRaw, currentScope, currentTemplateNode);
                                        throw new Error("Cannot render concept '"+conceptAttributeRaw+"' which evaluates to "+conceptType+" which does not exist");                                        
                                    }
                                    
                                    let conceptUUIDs = VarvEngine.getAllUUIDsFromType(conceptType, true);
                                    // STUB: No filtering of concepts in SPEC?
                                    // STUB: No sorting of concepts in SPEC?
                                    for(let uuid of conceptUUIDs) {
                                        let childScope = currentScope.slice(); // Copy current
                                        childScope.push(new ConceptInstanceBinding(uuid)); // Add this new concept to lookup scope but with the concrete type
                                        childScope.push(new ValueBinding({
                                            'concept::uuid': uuid
                                        })); // Make the uuid referenceable for debug etc

                                        await splitProperty(conceptHandle, conceptChildren, childScope);
                                    }
                                } catch (exception){
                                    console.warn("DOM varv template selecting concept where value evaluation caused an error: ", exception, conceptAttributeRaw, currentScope, currentTemplateNode);
                                    let child = self.createErrorElement("Evaluating '"+conceptAttributeRaw+"' caused "+exception, targetDocument);

                                    // TODO: Check if this if test is correct
                                    if(conceptHandle.parentNode != null) {
                                        currentViewElement.insertBefore(child, conceptHandle);
                                        conceptChildren.push(child); // intentionally only exposed to conceptChildren
                                    }
                                }
                            });
                            self.addCleanup(conceptHandle, ()=>{
                                selfUpdatingConceptAttribute.destroy();          
                                // Remove previously rendered children
                                for (let child of conceptChildren){
                                    self.tearDownElement(child);
                                }
                                conceptChildren = [];                                
                            });  
                        } else {
                            // No concept attribute just append directly and add to results directly
                            await splitProperty(currentInsertBeforeElement, results, currentScope);
                        }

                        break;
                }                
                break;
            default:
                // Unknown non-element nodes are copied verbatim
                let unknown = currentTemplateNode.cloneNode(false);
                currentViewElement.insertBefore(unknown, currentInsertBeforeElement);
                results.push(unknown);
        }

        return results;
    }

    /**
     * Returns element with evaluation of values for a single template element, can return multiple
     * @param {HTMLElement} templateElement
     * @param {any[]} scope
     * @returns {Promise<Node[]>} A list of the immediate nodes that were appended to currentViewElement
     */
    async insertFromTemplateElement(targetDocument, currentViewElement, templateElement, scope, insertBeforeElement=null) {
        const self = this;
        let topLevelResults = [];                

        switch (templateElement.tagName){
            case "TEMPLATE-REF":
                // Find and jump into DOM template and recurse through it                
                let templateAttributeRaw = templateElement.getAttribute("template-name");
                if (templateAttributeRaw === null) {
                    console.warn("template-ref without template-name, ignoring", templateElement);
                    return [];
                }
                
                // Check for children and warn since this is invalid
                if (templateElement.childElementCount>0){
                    console.warn("template-ref with children elements, the children are ignored", templateElement);
                }

                // Immediately inject our handle, this is where we create our nodes asynchroneously
                let handle = targetDocument.createProcessingInstruction("varv-template-handle", templateAttributeRaw);
                topLevelResults.push(handle); // The handle is our only visible top-level result, we handle our children ourselves
                currentViewElement.insertBefore(handle, insertBeforeElement);
                let ourChildren = [];
                
                let render = async function renderTemplateReference(templateName){
                    // Clean up any previous render
                    for (let child of ourChildren){
                        self.tearDownElement(child);
                    }
                    ourChildren = [];
                    
                    if (!handle.parentNode){
                        // We have been torn out of the tree yet still got an update
                        if (DOMView.DEBUG){
                            console.log("STUB: Tried to render a template ref while outside of the document, this is likely fine if the result still works ok but should be avoided");
                        }
                        return;
                    }
                    
                    // Find the template and insert it
                    let templates = document.querySelectorAll("template[name='" + templateName+"'], varv-template[name='" + templateName+"']");
                    let template = templates[templates.length - 1];
                    if (!template) {
                        // Reffed template does not exist (yet?), insert temporary failure node and wait for it
                        let child = self.createErrorElement("template-ref with template-name '"+templateName+"' that does not exist (yet?)", targetDocument);
                        ourChildren.push(child);
                        currentViewElement.insertBefore(child, handle);
                    } else {
                        for(let childTemplateNode of Array.from(template.content?template.content.childNodes:template.childNodes)){  // Could be a HTML template element
                            for (let child of await self.cloneToView(targetDocument, currentViewElement, childTemplateNode, scope, handle)){
                                ourChildren.push(child);
                            }                    
                        }
                    }
                };
                
                let appearCallback = null;
                let disappearCallback = null;
                
                // Handle changes to looked up template attribute itself (i.e. when dynamically using {...} as the attribute             
                await new Promise(initialUpdateResolve => {
                    let selfUpdatingTemplateAttribute = new UpdatingStringEvaluation(templateAttributeRaw, scope, async function templateAttributeUpdated(templateName){
                        // Clean up old template callbacks (if set)
                        if (appearCallback) appearCallback.delete();
                        if (disappearCallback) disappearCallback.delete();       

                        let updateTimer = setTimeout(function(){
                            render(templateName);
                            initialUpdateResolve();
                        }, 0);

                        // Listen to template updates
                        appearCallback = EventSystem.registerEventCallback("domview.template.appeared", async (evt)=>{
                            if (evt.detail===templateName){
                                clearTimeout(updateTimer);
                                updateTimer = setTimeout(function(){
                                    render(templateName);
                                    initialUpdateResolve();                                        
                                }, 0);
                            }
                        });                
                        disappearCallback = EventSystem.registerEventCallback("domview.template.disappeared", async (evt)=>{
                            if (evt.detail===templateName){
                                clearTimeout(updateTimer);
                                updateTimer = setTimeout(function(){
                                    render(templateName);
                                    initialUpdateResolve();                                    
                                }, 0);
                            }
                        });
                    });

                    self.addCleanup(handle, ()=>{
                        selfUpdatingTemplateAttribute.destroy();
                        if (appearCallback) appearCallback.delete();
                        if (disappearCallback) disappearCallback.delete();     
                        for (let child of ourChildren){
                            self.tearDownElement(child);
                        }                    
                    });
                });
                
                break;
            default:
                let element = templateElement.cloneNode(false);
                element.templateElement = templateElement;

                // Evaluate all attributes
                for(let attr of Array.from(templateElement.attributes)) {
                    let selfUpdatingString = new UpdatingStringEvaluation(attr.value, scope, function attributeNodeUpdated(value){
                        element.setAttribute(attr.name, value);
                        
                        // Check for special attributes
                        if (attr.name==="value"){
                            if (element.tagName==="INPUT" || element.tagName==="TEXTAREA"){
                                if (element.type==="checkbox"){
                                    element.checked = value==="true" || value===true;
                                } else {
                                    element.value = value;
                                }                                    
                            } else if (element.tagName==="SELECT"){
                                // STUB: wait for the rest of the tree to render so that our OPTIONS nodes are ready
                                // TODO: Move this into a post-render queue to avoid flickering
                                setTimeout(()=>{
                                    element.value = value;
                                },0);
                            }
                        } else if(attr.name === "disabled") {
                            if(value === "false") {
                                element.removeAttribute(attr.name);
                            }
                        }
                    });
                    this.addCleanup(element, ()=>{
                        selfUpdatingString.destroy();
                    });
                }

                // Recurse to children nodes with this new element as viewtop                
                for(let templateChild of Array.from(templateElement.childNodes)) {
                    await self.cloneToView(targetDocument, element, templateChild, scope);
                }
                
                // Check for special elements that can push data back to the concepts
                if (element.tagName==="INPUT" || element.tagName==="TEXTAREA"){
                    let valueLookupName = self.getLookupNameFromAttribute(templateElement, "value");
                    if (valueLookupName!==null){
                        let binding = DOMView.getBindingFromScope(valueLookupName,scope);
                        if (!(binding instanceof ConceptInstanceBinding)){
                            console.warn("Input field values cannot be bound to something that is not a concept property", valueLookupName, templateElement);
                        } else {
                            switch (element.getAttribute("type")){
                                case "checkbox":
                                    element.addEventListener("input", ()=>{
                                        binding.setValueFor(valueLookupName, element.checked);
                                    });
                                    break;
                                default:
                                    element.addEventListener("input", ()=>{
                                        binding.setValueFor(valueLookupName, element.value);
                                    });
                            }
                        }
                    }
                } else if (element.tagName==="SELECT"){
                    let valueLookupName = self.getLookupNameFromAttribute(templateElement, "value");
                    if (valueLookupName!==null){
                        let binding = DOMView.getBindingFromScope(valueLookupName,scope);
                        if (!(binding instanceof ConceptInstanceBinding)){
                            console.warn("DOMView: Select option group cannot be bound to something that is not a concept property", valueLookupName, templateElement);
                        } else {
                            element.addEventListener("input", ()=>{
                                binding.setValueFor(valueLookupName, element.value);
                            });
                        }                    
                    }
                }

                topLevelResults.push(element);
                currentViewElement.insertBefore(element, insertBeforeElement);
        }
        
        // Store a reference to the current scope in the elements
        for (let element of topLevelResults){
            element.scope = scope.slice();
        }
        
        return topLevelResults;
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
                    result.push(binding.uuid);
                }
            }
        }
        return result;
    }
    
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
    
    addCleanup(element, cleanupFunction){
        if (!element.cleanup) element.cleanup = [];
        element.cleanup.push(cleanupFunction);
    }
    
    createErrorElement(message, targetDocument){
        let element = targetDocument.createElement("varv-failure");
        element.setAttribute("title", message);
        return element;
    }
    
    tearDownElement(element){
        if(element.alreadyCleaned) {
            if (DOMView.DEBUG) console.warn("STUB: Double teardown, this is most likely fine", element);
            return;
        }
        element.alreadyCleaned = true;
        // If the element had any cleanup to do, run it now
        if (element.cleanup){
            for (let entry of element.cleanup){
                entry();
            }
        }
        
        // If the element has any children, tear them down too
        for(let node of Array.from(element.childNodes)){ // copy to avoid concurrent mods
            this.tearDownElement(node);
        }
        
        // Then remove it from the DOM
        element.remove();
    }
    
    stubTriggerFullRebuild(templateNode, message=""){
        // STUB: All rebuilds are full rebuilds rather than incremental rebuilds for now        
        if (DOMView.DEBUG) {
            console.warn("FIXME: Unimplemtented partial update logic triggered full DOMView rebuild", templateNode, message);
        }
        if (templateNode.tagName==="DOM-VIEW-TEMPLATE"){
            this.rebuildView(templateNode);
        } else {
            this.rebuildView(cQuery(templateNode).closest("dom-view-template")[0]);
        }
    }

    
    
    /**
     * Returns a value lookup name if this attribute is on the form \{name\}, null
     * if the attribute does not exist
     * @param {HTMLElement} templateElement
     * @param {string} attributeName
     * @returns {undefined}
     */
    getLookupNameFromAttribute(templateElement, attributeName){
        if (!templateElement || !templateElement.getAttribute) {
            console.warn("Evaluate attribute called without sensible input ", templateElement);
        }

        let attribute = templateElement.getAttribute(attributeName);
        if (attribute === null) return null;
        
        if (attribute.startsWith("{") && attribute.endsWith("}")) {
            return attribute.substr(1, attribute.length - 2);
        } else {
            return null;
        }        
    }

    /**
     * Returns null if attribute does not exist, undefined if lookup does not exist
     * @param {HTMLElement} templateElement
     * @param {string} attributeName
     * @param {type} scope
     * @returns {undefined}
     */
    async evaluateAttribute(templateElement, attributeName, scope) {
        let lookupName = this.getLookupNameFromAttribute(templateElement, attributeName);        
        let result = undefined;
        if (lookupName!==null) {
            result = await this.evaluateValueInScope(lookupName, scope);
        } else {
            result = templateElement.getAttribute(attributeName);
        }
        if (result===null) return undefined;
        return result;
    };
    
    static getBindingFromScope(bindingName, scope){
        for (let i = scope.length - 1; i >= 0; i--) {
            if (scope[i].hasBindingFor(bindingName)) {
                return scope[i];
            }
        }
        return undefined;
    }

    async evaluateValueInScope(bindingName, scope) {
        let binding = DOMView.getBindingFromScope(bindingName, scope);
        if (binding===undefined) return undefined;
        
        return await binding.getValueFor(bindingName);
    }
}


class UpdatingStringEvaluation {
    constructor(originalText, scope, onChangeCallback){
        this.originalText = originalText;
        this.bindings = new Map();
        this.tokens = originalText.match(/{(\S+?)}/g);
        if (!this.tokens) this.tokens = [];
        this.onChangeCallback = onChangeCallback;
        this.updateCallbacks = [];
        this.destroyed = false;
        
        let self = this;
        
        // Prepare it once manually
        for(let token of this.tokens) {
            token = token.trim();
            let lookupQuery = token.substr(1, token.length - 2);

            let binding = null;
            let propertyName;
            if (lookupQuery.includes("?")){
                // Fancy { x ? y } query
                let propertyAndResult = lookupQuery.split("?");
                propertyName = propertyAndResult[0].trim();
                binding = DOMView.getBindingFromScope(propertyName, scope);
                this.bindings.set(lookupQuery, async ()=>{
                    if (binding===undefined) return undefined;
                    let value = await binding.getValueFor(propertyName);
                    return value?propertyAndResult[1]:"";
                });
                
            } else {
                // Normal {} query, the entire thing is the name
                propertyName = lookupQuery;
                binding = DOMView.getBindingFromScope(propertyName, scope);
                this.bindings.set(lookupQuery, async ()=>{
                    if (binding===undefined) return undefined;
                    return binding.getValueFor(propertyName);
                });
            }
            if (binding && binding.concept){
                let property = binding.concept.getProperty(propertyName);
                let callback = async function updateUpdatingStringEvaluation(){
                    await self.update();
                };
                property.addUpdatedCallback(callback);
                this.updateCallbacks.push({property: property, callback: callback});
            }
        }
        this.update();
            
    }
    
    async update(){        
        try {
            let text = this.originalText;
            for(let token of this.tokens) {
                token = token.trim();
                let lookupQuery = token.substr(1, token.length - 2);

                let value = await this.bindings.get(lookupQuery)();
                if (value !== undefined){
                    text = text.replace(token, value); // STUB: This can fail if the first token is replaced with something that looks like the second token
                }
            }

            await this.onChangeCallback(text);
        } catch (ex){
            console.error(ex);
        }
    }
    
    destroy(){
        if (this.destroyed) {
            if (DOMView.DEBUG){
                console.warn("FIXME: Harmless double desctruction, ignoring - but try not to destroy me this much");
            }
            return;
        }
        for (let entry of this.updateCallbacks){
            entry.property.removeUpdatedCallback(entry.callback);
        }
        this.destroyed = true;
    }
}



class ConceptInstance {
    constructor(concept, uuid) {
        if (!uuid) throw new Error("Invalid reference to concept instance with a null or undefined uuid '"+uuid+"' and concept '"+concept+"'");
        if (!concept) throw new Error("Invalid reference to unknown concept with uuid '"+uuid+"', concept is "+concept);
        this.concept = concept;
        this.uuid = uuid;
    }
}

class PropertyBinding {
    constructor(property, uuid) {
        this.uuid = uuid;
        this.property = property;
    }
    
    hasBindingFor(name){
        // We don't supply this ourselves
        return false;
    }
}

class ConceptInstanceBinding extends ConceptInstance {
    constructor(uuid) {
        super(VarvEngine.getConceptFromUUID(uuid), uuid);
    }

    hasBindingFor(name) {
        let lookupName = name;
        if(lookupName.startsWith(this.concept.name+".")) {
            lookupName = lookupName.substr(this.concept.name.length+1);
        }
        
        try {
            this.concept.getProperty(lookupName);
            return true;
        } catch (ex) {
            // Ignored
        }
        
        return false;
    }

    async getValueFor(name) {
        let lookupName = name;
        if(lookupName.startsWith(this.concept.name+".")) {
            lookupName = lookupName.substr(this.concept.name.length+1);
        }
        
        let property = null;
        
        try {
            property = this.concept.getProperty(lookupName);
        } catch(e) {
            //Ignore
        }

        if(property === null) {
            return undefined;
        }

        let value = await property.getValue(this.uuid);
        if (property.isConceptType()) {
            if (!value) return undefined; // No uuid set
            return new ConceptInstanceBinding(value);
        } else if (property.isConceptArrayType()) {
            let conceptArray = [];
            value.forEach((entry) => {
                conceptArray.push(new ConceptInstanceBinding(entry))
            });
            return conceptArray;
        } else {
            return value;
        }
    }
    
    async setValueFor(name, value){
        const property = this.concept.getProperty(name);
        property.setValue(this.uuid, property.typeCast(value));
    }
}

class ValueBinding {
    constructor(bindings) {
        this.bindings = bindings;
    }

    hasBindingFor(name) {
        return this.bindings.hasOwnProperty(name);
    }

    async getValueFor(name) {
        return this.bindings[name];
    }
}
DOMView.DEBUG = false;
DOMView.singleton = new DOMView();
window.DOMView = DOMView;
