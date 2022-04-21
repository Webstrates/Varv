/**
 *  ConceptTreeGenerator - Generate program/state structure to explore in Cauldron TreeBrowser
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

MenuSystem.MenuManager.registerMenuItem("TreeBrowser.TreeNode.ContextMenu", {
    label: "Create Instance",
    group: "ConceptActions",
    groupOrder: 0,
    icon: IconRegistry.createIcon("mdc:class"),                                
    onOpen: (menu)=>{
        return menu.context.type == "ConceptNode";
    },
    onAction: async (menuItem) =>{
        let id = await menuItem.menu.context.context.create();
        setTimeout(()=>{
            let treeBrowser = menuItem.menu.context.getTreeBrowser();
            let treeNodes = treeBrowser.findTreeNode(id);
            if(treeNodes.length > 0) {
                let treeNode = treeNodes[0];
                treeNode.reveal();
                treeNode.select();
            }
        }, 0);
    }
});

MenuSystem.MenuManager.registerMenuItem("TreeBrowser.TreeNode.ContextMenu", {
    label: "Delete",
    group: "ConceptActions",
    groupOrder: 0,
    icon: IconRegistry.createIcon("mdc:delete"),                                
    onOpen: (menu)=>{
        return menu.context.type == "ConceptInstanceNode";
    },
    onAction: async (menuItem) =>{
        console.log(menuItem.menu.context.context);
        menuItem.menu.context.context.concept.delete(menuItem.menu.context.context.uuid);
    }
});

MenuSystem.MenuManager.registerMenuItem("Cauldron.Help.Documentation", {
    label: "Varv",
    icon: IconRegistry.createIcon("webstrates:varv"),    
    onAction: () => {
        window.open("http://when-js.projects.cavi.au.dk/varv/");
    }
});