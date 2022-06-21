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
class ConceptDecorator {
    /**
     * Attempts to decorate the given TreeNode
     * @param {TreeNode} node - The node to decorate
     * @returns {boolean} True/False depending on if the node was decorated
     */
    static decorate(node) {
        if(node.type === "ConceptNode") {
            node.setProperty("content", node.context.name);
            node.setProperty("icon", IconRegistry.createIcon("mdc:api"));
            return true;
        } else if(node.type === "ConceptInstanceNode") {
            node.setProperty("content", node.context.uuid);
            node.setProperty("icon", IconRegistry.createIcon("mdc:class"));
            return true;
        } else if(node.type === "DatastoreNode") {
            node.setProperty("content", node.context.name);
            node.setProperty("icon", IconRegistry.createIcon("mdc:circle"));
            return true;
        } else if(node.type === "ConceptRootNode") {
            node.setProperty("content", "Concepts");
            node.setProperty("icon", IconRegistry.createIcon("mdc:all_out"));
            return true;
        }

        return false;
    }

    /**
     * Attempts to decorate the given DataTransfer based on the given TreeNode
     * @param {TreeNode} node
     * @param {DataTransfer} dataTransfer
     * @returns {boolean} True/False depending on if the DataTransfer was decorated
     */
    static decorateDataTransfer(node, dataTransfer) {
        return false;
    }
}

window.ConceptDecorator = ConceptDecorator;

TreeGenerator.registerDecorator(ConceptDecorator, 10);
