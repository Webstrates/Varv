/**
 *  ConceptDecorator - decorates Concept nodes in TreeBrowser trees
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
class ConceptTreeGenerator extends TreeGenerator {
    constructor(parentNode) {
        super();

        this.rootNode = new TreeNode({
            type: "ConceptRootNode",
            context: null
        });
        TreeGenerator.decorateNode(this.rootNode);
        parentNode.addNode(this.rootNode);
    }
    
    onAddDatastore(datastore){
        let activeElement = document.activeElement;

        let self = this;
        let datastoreNode = new TreeNode({
            type: "DatastoreNode",
            lookupKey: datastore.name,
            context: datastore
        });
        TreeGenerator.decorateNode(datastoreNode);
        this.rootNode.addNode(datastoreNode);
        this.rootNode.unfold();
        
        datastore.registerDestroyCallback(()=>{
            self.destroyNode(datastoreNode);
        });
        
        // Concepts
        datastore.registerConceptAddedCallback((concept)=>{
            datastoreNode.unfold();
            
            let conceptNode = new TreeNode({
                type: "ConceptNode",
                lookupKey: concept.name,
                context: concept
            });
            
            // Instances
            let instanceAddedCallback = datastore.registerConceptInstanceAddedCallback(concept, (uuid)=>{
                let node = self.addInstanceNode(datastore, conceptNode, concept, uuid);
                let instanceRemovedCallback = datastore.registerConceptInstanceRemovedCallback(concept, (removedUUID)=>{
                    if (removedUUID===uuid){
                        self.destroyNode(node);
                    }
                });
                node.cleanup = [()=>{
                    datastore.removeConceptInstanceRemovedCallback(concept, instanceRemovedCallback);
                }];
            });
            
            TreeGenerator.decorateNode(conceptNode);
            datastoreNode.addNode(conceptNode);
        });

        // STUB: Concepts cannot be removed right now but should be cleaned up here
        // datastore.removeConceptInstanceAddedCallback(concept, instanceAddedCallback);
        
    }    
    
    destroyNode(node){
        node.parentNode.removeNode(node);
        
        // Run cleanup
        if (node.cleanup){
            for (let entry of node.cleanup){
                entry();
            }
        }
        
        // Destroy children
        for (let child of Array.from(node.childNodes)){ // copy to avoid concurrent mods
            this.destroyNode(child);
        }
    }
    
    addInstanceNode(datastore, parentNode, concept, uuid){
        let instanceNode = new TreeNode({
            type: "ConceptInstanceNode",
            lookupKey: uuid,
            context: {concept, uuid, datastore}
        });    
        TreeGenerator.decorateNode(instanceNode);
        parentNode.addNode(instanceNode);
        return instanceNode;
    }
}


EventSystem.registerEventCallback("Cauldron.TreeBrowserSpawned", ({detail: {root: rootNode}})=>{
    let generator = new ConceptTreeGenerator(rootNode);
    EventSystem.triggerEvent("Varv.ConceptTreeGeneratorSpawned", generator);
    window.ConceptTreeGenerator.instances.push(generator);    
});

window.ConceptTreeGenerator = ConceptTreeGenerator;
window.ConceptTreeGenerator.instances = [];
