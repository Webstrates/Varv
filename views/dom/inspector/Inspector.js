/**
 *  Inspector - Allow inspection of rendered DOMView elements
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
class Inspector {
    constructor() {
        const self = this;

        document.addEventListener("contextmenu", (evt)=>{
            if(evt.ctrlKey) {
                evt.preventDefault();
            }
        });

        document.addEventListener("mouseup", async (evt)=>{
            if(evt.button !== 2 || !evt.ctrlKey) {
                return;
            }
            await wpm.require(["MaterialDesignOutlinedIcons", "MaterialMenu"]);
            self.handleContextMenu(evt);
        });
    }

    async handleContextMenu(evt) {
        let conceptBindings = DOMView.singleton.getConceptPath(evt.target);
        let properties = DOMView.singleton.getPropertyPath(evt.target);
        let templates = DOMView.singleton.getTemplatePath(evt.target);

        //console.group("Inspecting:", evt.target);
        
        if(window.MenuSystem != null) {
            console.log("Adding menu ");
            
            //Setup context menus
            let contextMenu = MenuSystem.MenuManager.createMenu("Varv.Inspector.ContextMenu", {
                context: evt.target,
                groupDividers: true
            });            
            document.body.appendChild(contextMenu.html);
            
            contextMenu.registerOnCloseCallback(()=>{
                document.body.removeChild(contextMenu.html);
            });         
            
            // Concept path
            for(let conceptBinding of conceptBindings.reverse()) {
                let concept = conceptBinding.concept;
                let conceptMenu = MenuSystem.MenuManager.createMenu("ConceptInspectMenu");
                                
                if (typeof TreeBrowser !== "undefined"){
                    let treeBrowsers = TreeBrowser.findAllTreeBrowsers();
                    if (treeBrowsers){
                        conceptMenu.addItem({
                            label: "Inspect in Cauldron",
                            icon: IconRegistry.createIcon("mdc:gps_fixed"),
                            onAction: (menuItem) => {
                                for (let browser of treeBrowsers){
                                    let treeNodes = browser.findTreeNode(uuid);
                                    if(treeNodes.length > 0) {
                                        let treeNode = treeNodes[0];
                                        treeNode.reveal();
                                        treeNode.select();
                                    }                                    
                                }
                            }                        
                        });
                    }
                    contextMenu.addItem({
                        label: concept.name,
                        group: "Concepts",
                        groupOrder: 0,                    
                        icon: IconRegistry.createIcon("mdc:api"),
                        submenu: conceptMenu
                    });
                } else {
                    contextMenu.addItem({
                        label: concept.name,
                        group: "Concepts",
                        groupOrder: 0,                    
                        icon: IconRegistry.createIcon("mdc:api")
                    });
                }
            };
            
            // Template path
            let currentTemplateTop = null;
            for (let templateNode of templates.reverse()){
                let templateMenu = MenuSystem.MenuManager.createMenu("TemplateInspectMenu");
                let fragment = null;

                let parentAutoDom = cQuery(templateNode).closest(".autoDom")[0];
                if (parentAutoDom){
                    let id = parentAutoDom.getAttribute("id");
                    if (id){                        
                        fragment = Fragment.one("[transient-fragment-uuid='"+id+"']");
                    }
                }
                
                // Filter som levels
                let parentTemplate = cQuery(templateNode).closest("varv-template")[0];
                if (!parentTemplate){
                    parentTemplate = parentAutoDom; // Not a template, use main fragment as top
                }
                if (currentTemplateTop === parentTemplate){
                    // Only show one level from each template, skip the rest
                    continue;
                }
                currentTemplateTop = parentTemplate;
                
                if (typeof TreeBrowser !== "undefined"){
                    let treeBrowsers = TreeBrowser.findAllTreeBrowsers();
                    if (treeBrowsers){
                        templateMenu.addItem({
                            label: "Edit in Cauldron",
                            icon: IconRegistry.createIcon("mdc:mode_edit"),
                            onAction: (menuItem) => {
                                // If this is inside an autoDom fragment, use the fragment      
                                if (fragment){
                                    EventSystem.triggerEvent("Cauldron.Open.FragmentEditor", {
                                        fragment: fragment
                                    });
                                } else {
                                }
                                // TODO: If this was not autoDom, edit plain HTML template instead
                            }
                        });
                    }
                }  else {
                    templateMenu.addItem({
                        label: "Dump to console",
                        icon: IconRegistry.createIcon("mdc:mode_edit"),
                        onAction: (menuItem) => {
                            console.log(fragment);
                        }
                    });
                }
                
                // Text
                let textView = document.createElement("pre");
                textView.classList.add("varv-inspector-preview");
                textView.innerText = templateNode.outerHTML;
                let source = textView.innerHTML;
                let replacement = "<b style='background:rgba(255,0,0,0.2)'>"+textView.innerHTML+"</b>";
                textView.innerText = currentTemplateTop.outerHTML;
                templateMenu.registerOnOpenCallback(()=>{
                    textView.innerHTML = textView.innerHTML.replace(source,replacement);
                    templateMenu.html.appendChild(textView);
                });
                
                let content = templateNode.tagName;
                if (fragment){
                    console.log(fragment);
                    let name = fragment.html[0].getAttribute("name");
                    if (name != null && name != ""){
                        content = name+" ";
                    }
                    if(fragment.html[0].id != null && fragment.html[0].id!="") {
                        content += "#"+fragment.html[0].id;
                    }
                }
                
                contextMenu.addItem({
                    label: content,
                    group: "Templates",
                    groupOrder: 1,                    
                    icon: IconRegistry.createIcon("code-fragment:text/html"),
                    submenu: templateMenu
                });                
                
            }

            contextMenu.open({
                x: evt.x,
                y: evt.y
            });     
        };



        console.groupCollapsed("Concepts - Closest concept is last");
        for(let conceptBinding of conceptBindings) {
            let concept = conceptBinding.concept;
            let uuid = conceptBinding.uuid;

            console.group("Concept:", concept.name, uuid);

            console.groupCollapsed("Properties");
            for(let property of concept.properties.values()) {
                let value = await property.getValue(uuid);
                console.log(property.name+": ", value);
            }
            console.groupEnd();

            function debugAction(action) {
                if(action instanceof ActionChain) {
                    if(action.actions.length === 1) {
                        debugAction(action.actions[0]);
                    } else {
                        console.groupCollapsed(action.name+":", action.constructor.name);
                        for(let actionChainElement of action.actions) {
                            debugAction(actionChainElement);
                        }
                        console.groupEnd();
                    }
                } else {
                    let actionName = action.name;
                    if(actionName.length > 0) {
                        actionName += ":";
                    }
                    console.log(actionName, action.constructor.name, action.options);
                }
            }

            console.groupCollapsed("Actions");
            for(let action of concept.actions.values()) {
                debugAction(action);
            }
            console.groupEnd();

            console.groupCollapsed("Behaviours");
            for(let behaviour of concept.behaviours.values()) {
                console.groupCollapsed(behaviour.name+":", behaviour.constructor.name);
                console.group("When:");
                for(let triggerName of behaviour.triggers) {
                    let trigger = concept.getTrigger(triggerName);
                    console.log(trigger.name+":", trigger.constructor.name, trigger.options);
                }
                console.groupEnd();
                console.group("Then:");
                for(let action of behaviour.actionChain.actions) {
                    debugAction(action);
                }
                console.groupEnd();
                console.groupEnd();
            }
            console.groupEnd();

            console.groupEnd();
        }

        console.groupEnd();

        console.groupCollapsed("Views - Closest view is first");

        let parent = evt.target;

        while(parent != null && parent.parentNode != null) {
            if(parent.matches("[view]")) {
                let viewName = parent.getAttribute("view");
                console.log("View:", viewName, parent);
            }

            parent = parent.parentNode;
        }

        console.groupEnd();

        console.groupCollapsed("Properties - ");
        for(let property of properties) {
            let type = property.property.type;

            if(type === "array") {
                type = property.property.options.items+"[]";
            }

            console.log(property.property.name+":", type);
        }
        console.groupEnd();

        console.groupEnd();
    }
}
window.Inspector = Inspector;
Inspector.instance = new Inspector();
