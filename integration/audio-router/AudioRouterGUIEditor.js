class AudioRouterGUIEditor extends Editor {
    constructor(fragment, options = {}) {
        super("mirrorverse-audio-router", fragment, options);

        this.setupEditor();
    }

    updatedCallback() {
        const self = this;
        if(this.updateCallbackTimeout == null) {
            this.updateCallbackTimeout = setTimeout(()=>{
                self.handleModelChanged();
                self.updateCallbackTimeout = null;
            }, 0);
        }
    }

    setupEditor() {
        const self = this;

        this.playArea = document.createElement("div");
        this.playArea.classList.add("mirrorverse-audio-router-maximized");
        //this.playArea.classList.add("mirrorverse-audio-router");
        this.svgArea = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        this.svgArea.classList.add("mirrorverse-audio-router-maximized");
        this.editorDiv[0].appendChild(this.playArea);
        this.editorDiv[0].appendChild(this.svgArea);

        let lastDragPosition = null;

        this.playArea.addEventListener("pointerdown", (evt)=>{
            if(evt.button === 0) {
                evt.stopPropagation();
                lastDragPosition = {
                    x: evt.clientX,
                    y: evt.clientY
                }
            }
        });

        document.addEventListener("pointermove", (evt)=>{
            if(lastDragPosition != null) {
                evt.stopPropagation();

                let offsetX = evt.clientX - lastDragPosition.x;
                let offsetY = evt.clientY - lastDragPosition.y;

                let x = parseFloat(self.playArea.getAttribute("data-x"));
                let y = parseFloat(self.playArea.getAttribute("data-y"));

                if (isNaN(x)) {
                    x = 0;
                }

                if (isNaN(y)) {
                    y = 0;
                }

                x += offsetX;
                y += offsetY;

                if(x > 2500) {
                    x = 2500;
                }

                if(x < -2500) {
                    x = -2500;
                }

                if(y > 2500) {
                    y = 2500;
                }

                if(y < -2500) {
                    y = -2500;
                }

                self.playArea.setAttribute("data-x", x);
                self.playArea.setAttribute("data-y", y);

                self.playArea.style.left = x + "px";
                self.playArea.style.top = y + "px";

                lastDragPosition = {
                    x: evt.clientX,
                    y: evt.clientY
                }
            }
        });

        document.addEventListener("pointerup", (evt)=>{
            if(evt.button === 0) {
                lastDragPosition = null;
            }
        });

        function makeId(length) {
            let result = '';
            const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const charactersLength = characters.length;
            let counter = 0;
            while (counter < length) {
                result += characters.charAt(Math.floor(Math.random() * charactersLength));
                counter += 1;
            }
            return result;
        }

        let menuId = makeId(10);

        this.playAreaContextMenu = MenuSystem.MenuManager.createMenu("mirrorverse-audio-router-playAreaContext"+menuId,{
            groupDividers: true
        });
        this.audioRouterNodeContextMenu = MenuSystem.MenuManager.createMenu("mirrorverse-audio-router-audioRouterNodeContext"+menuId);

        this.editorDiv[0].appendChild(this.playAreaContextMenu.html);
        this.editorDiv[0].appendChild(this.audioRouterNodeContextMenu.html);

        this.playArea.addEventListener("contextmenu", (evt)=>{
            evt.preventDefault();
            if(self.audioRouterNodeContextMenu.isOpen){
                self.audioRouterNodeContextMenu.close();
            }

            if(self.playAreaContextMenu.isOpen){
                self.playAreaContextMenu.close();
            }

            if(evt.target == this.playArea) {
                self.playAreaContextMenu.openPosition = {x:evt.clientX, y:evt.clientY};
                self.playAreaContextMenu.open({
                    x: evt.clientX,
                    y: evt.clientY
                });
            } else {
                self.audioRouterNodeContextMenu.context = evt.target;

                //Open node context
                self.audioRouterNodeContextMenu.open({
                    x: evt.clientX,
                    y: evt.clientY
                });
            }
        });

        function getRelativePos(menuPos) {

            let playAreaBounds = self.playArea.getBoundingClientRect();

            return {
                x: menuPos.x - playAreaBounds.x,
                y: menuPos.y - playAreaBounds.y
            }
        }

        this.menuItems = [];

        this.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext"+menuId, {
            label: "Recenter View",
            icon: IconRegistry.createIcon("mdc:zoom_in_map"),
            group: "View",
            groupOrder: 0,
            order: 0,
            onAction: (evt)=>{
                self.playArea.setAttribute("data-x", 0);
                self.playArea.setAttribute("data-y", 0);

                self.playArea.style.left = "0px";
                self.playArea.style.top = "0px";
            }
        }));
        this.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext"+menuId, {
            label: "Recenter Nodes",
            icon: IconRegistry.createIcon("mdc:shuffle"),
            group: "View",
            groupOrder: 0,
            order: 0,
            onAction: (evt)=>{
                let audioNodes = self.playArea.querySelectorAll(".mirrorVerseAudioRouterNode");

                let minX = 9999999999999;
                let minY = 9999999999999;

                let maxX = -9999999999999;
                let maxY = -9999999999999;

                audioNodes.forEach((elm)=>{
                    if(elm.hasAttribute("data-x")) {
                        let x = parseFloat(elm.getAttribute("data-x")) + elm.offsetWidth / 2.0;
                        let y = parseFloat(elm.getAttribute("data-y")) + elm.offsetHeight / 2.0;
                        minX = Math.min(minX, x);
                        minY = Math.min(minY, y);
                        maxX = Math.max(maxX, x);
                        maxY = Math.max(maxY, y);
                    }
                });

                let centerX = minX + (maxX - minX) / 2.0;
                let centerY = minY + (maxY - minY) / 2.0;

                let editorCoreDiv = self.playArea.closest(".codestrates-editor-core");

                let centerViewX = Math.floor(2500 + editorCoreDiv.offsetWidth / 2.0);
                let centerViewY = Math.floor(2500 + editorCoreDiv.offsetHeight / 2.0);

                let offsetX = centerViewX - centerX;
                let offsetY = centerViewY - centerY;

                console.log("Center view:", centerViewX, centerViewY, centerX, centerY, offsetX, offsetY);

                audioNodes.forEach((elm)=>{
                    if(elm.hasAttribute("data-x")) {
                        let x = parseFloat(elm.getAttribute("data-x"));
                        let y = parseFloat(elm.getAttribute("data-y"));
                        x += offsetX;
                        y += offsetY;

                        elm.setAttribute("data-x", x);
                        elm.setAttribute("data-y", y);

                        elm.style.left = x+"px";
                        elm.style.top = y+"px";
                    }
                });
            }
        }));

        this.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext"+menuId, {
            label: "Insert Decision Node",
            icon: IconRegistry.createIcon("mdc:schema"),
            group: "DecisionNode",
            groupOrder: 10,
            order: 0,
            onAction: (evt)=>{
                let id = makeId(10);
                let fakeJson = {
                    "nodes": {}
                }

                fakeJson.nodes[id] = {
                    name: "",
                    concept: "client",
                    property: "name",
                    decisions: [],
                    position: getRelativePos(evt.menu.openPosition)
                }
                let node = new DecisionNode(id, fakeJson, self, ()=>{self.updatedCallback()});
                node.render(self.playArea);
                self.updatedCallback();
            }
        }));

        ["muted", "volume", "audioFilter"].forEach((rootName)=>{
            let icon = "";

            if(rootName == "volume") {
                icon = "mdc:volume_up";
            }

            if(rootName == "muted") {
                icon = "mdc:volume_mute";
            }

            if(rootName == "audioFilter") {
                icon = "mdc:filter_alt";
            }

            self.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext"+menuId, {
                label: "Insert "+rootName+" root node",
                icon: IconRegistry.createIcon(icon),
                group: "RootNode",
                groupOrder: 5,
                order: 0,
                onAction: (evt)=>{
                    let fakeJson = {
                        "rootConnections": {}
                    }

                    fakeJson.rootConnections[rootName] = {
                        position: getRelativePos(evt.menu.openPosition),
                        connection: null
                    }

                    let node = new RootNode(rootName, fakeJson, self, ()=>{self.updatedCallback()});
                    node.render(self.playArea);
                    self.updatedCallback();
                },
                onOpen: (evt)=>{
                    let found = false;
                    for(let node of self.playArea.querySelectorAll(".mirrorVerseAudioRouterRootNode")) {
                        if(node.audioRoutingNode.rootName === rootName) {
                            found = true;
                            break;
                        }
                    }

                    return !found;
                }
            }));

            self.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext"+menuId, {
                label: "Insert "+rootName+" value node",
                icon: IconRegistry.createIcon(icon),
                group: "ValueNode",
                groupOrder: 20,
                order: 0,
                onAction: (evt)=>{
                    let value = true;

                    if(rootName === "volume") {
                        value = 0.0;
                    } else if(rootName === "audioFilter") {
                        value = "none";
                    }

                    let id = makeId(10);

                    let fakeJson = {
                        type: rootName,
                        value: value,
                        position: getRelativePos(evt.menu.openPosition)
                    }

                    let node = new ValueNode(id, fakeJson, self, ()=>{self.updatedCallback()});
                    node.render(self.playArea);

                    self.updatedCallback();
                }
            }));
        })

        self.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-audioRouterNodeContext"+menuId, {
            label: "Delete",
            icon: IconRegistry.createIcon("mdc:extension"),
            order: 0,
            onAction: (evt)=>{
                let audioRouterElm = evt.menu.context.closest(".mirrorVerseAudioRouterNode");

                if(audioRouterElm != null) {
                    audioRouterElm.audioRoutingNode.delete();
                }
            }
        }));

        self.menuItems.push(MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-audioRouterNodeContext"+menuId, {
            label: "Disconnect",
            icon: IconRegistry.createIcon("mdc:extension"),
            order: 0,
            onAction: (evt)=>{
                let audioRouterElm = evt.menu.context.closest(".mirrorVerseAudioRouterNode");

                if(audioRouterElm != null) {
                    audioRouterElm.audioRoutingNode.disconnectFromParent();
                    self.updatedCallback();
                }
            },
            onOpen: (evt)=>{
                return false;

                let audioRouterElm = evt.context.closest(".mirrorVerseAudioRouterNode");

                if(audioRouterElm != null) {
                    if(audioRouterElm.audioRoutingNode instanceof DecisionNode || audioRouterElm.audioRoutingNode instanceof ValueNode) {
                        return true;
                    }
                }

                return false;
            }
        }));

        if(VarvEngine.concepts.length > 0) {
            this.load(this.fragment.raw);
        } else {
            let first = true;
            VarvEngine.registerEventCallback("engineReloaded", ()=>{
                if(first) {
                    first = false;
                    self.load(this.fragment.raw);
                }
            });
        }

        let mutationObserver = new MutationObserver((mutations)=>{
            self.redrawSvgLines();
        });
        mutationObserver.observe(this.playArea, {
            attributes: true,
            childList: true,
            attributeFilter: ["data-x", "data-y"],
            subtree: true
        });

        let svgMutationObserver = new MutationObserver((mutations)=>{
            self.checkTypes();
        });
        svgMutationObserver.observe(this.svgArea, {
            childList: true,
            subtree: true
        });
    }

    redrawSvgLines() {
        this.svgArea.querySelectorAll("line").forEach((line)=>{
            line.svgLine.redraw();
        });
    }

    checkTypes() {
        this.playArea.querySelectorAll(".mirrorVerseAudioRouterNode").forEach((elm)=>{
            elm.audioRoutingNode.checkUnused();
            elm.audioRoutingNode.checkType();
        });
    }

    load(jsonRaw) {
        console.groupCollapsed("Load");
        console.trace();
        console.groupEnd();

        const self = this;

        self.handleModelChanges = false;

        let json = {};

        try {
            json = JSON.parse(jsonRaw);
        } catch(e) {

        }

        //Clear editor
        while(this.playArea.lastChild != null) {
            this.playArea.lastChild.remove();
        }

        if(json.rootConnections != null) {
            Array.from(Object.keys(json.rootConnections)).forEach((rootName) => {
                let rootNode = new RootNode(rootName, json, self, ()=>{self.updatedCallback()});
                rootNode.render(self.playArea);
            });
        }

        if(json.unused != null) {
            json.unused.forEach((unused)=>{
                let nodeData = json.nodes[unused.id];
                switch(nodeData.nodeType) {
                    case "ValueNode": {
                        let node = new ValueNode(unused.id,nodeData, self, ()=>{self.updatedCallback()});
                        node.render(self.playArea);
                        break;
                    }

                    case "DecisionNode": {
                        //Check if decision node already was loaded?
                        let found = false;
                        for(let decisionElm of self.playArea.querySelectorAll(".mirrorVerseAudioRouterDecisionNode")) {
                            if(decisionElm.audioRoutingNode.id === unused.id) {
                                found = true;
                                break;
                            }
                        }

                        if(!found) {
                            let node = new DecisionNode(unused.id, json, self, () => {
                                self.updatedCallback()
                            });
                            node.render(self.playArea);
                        }
                        break;
                    }

                    default:
                        console.warn("Unknown unused type:", unused);
                }
            });
        }

        setTimeout(()=>{
            this.redrawSvgLines();
            this.checkTypes();
        }, 0);

        self.handleModelChanges = true;
    }

    setValue(value) {
        if(this.loadAnimationId == null) {
            this.loadAnimationId = requestAnimationFrame(()=>{
                this.load(value);
                this.loadAnimationId = null;
            });
        }
    }

    getValue() {
        let result = {
            "rootConnections": {},
            "nodes": {},
            "unused": []
        };

        function handleValueNode(valueNode) {
            valueNode.html.classList.remove("unused");

            let valueNodeResult = {
                "nodeType": "ValueNode",
                value: valueNode.value,
                position: valueNode.getPosition(),
                type: valueNode.type
            };

            return valueNodeResult;
        }

        function handleDecision(decision) {
            let decisionResult = {
                "comparator": decision.decision.comparator,
                "value": decision.decision.value
            };

            if(decision.children.length === 1) {
                let connectionNode = decision.children[0];

                decisionResult.connection = connectionNode.id;

                if(connectionNode instanceof DecisionNode) {
                    let decisionNodeResult = handleDecisionNode(connectionNode);
                    result.nodes[connectionNode.id] = decisionNodeResult;
                } else if(connectionNode instanceof ValueNode) {
                    let valueNodeResult = handleValueNode(connectionNode);
                    result.nodes[connectionNode.id] = valueNodeResult;
                } else {
                    throw new Error("Unknown decision connection:"+JSON.stringify(connectionNode, null, 2));
                }
            } else if(decision.children.length > 1) {
                throw new Error("Weird setup, root node has more than 1 decision node beneath it?");
            }

            return decisionResult;
        }

        function handleDecisionNode(decisionNode) {
            decisionNode.html.classList.remove("unused");

            let decisionNodeResult = {
                "nodeType": "DecisionNode",
                "name": decisionNode.data.name,
                "concept": decisionNode.data.concept,
                "property": decisionNode.data.property,
                "decisionCount": decisionNode.children.length,
                "decisions": []
            }

            decisionNode.children.forEach((decision) =>{
                let decisionResult = handleDecision(decision);

                decisionNodeResult.decisions.push(decisionResult);
            });

            decisionNodeResult.position = decisionNode.getPosition();

            return decisionNodeResult;
        }

        //Mark all as unused
        this.playArea.querySelectorAll(".mirrorVerseAudioRouterNode").forEach((elm)=>{
            elm.classList.add("unused");
        });

        this.playArea.querySelectorAll(".mirrorVerseAudioRouterRootNode").forEach((rootElm)=>{
            //Handle root node
            rootElm.classList.remove("unused");
            let rootNode = rootElm.audioRoutingNode;

            let rootResult = {
                "position": rootNode.getPosition()
            };

            result.rootConnections[rootNode.rootName] = rootResult;

            if(rootNode.children.length === 1) {
                let decisionNode = rootNode.children[0];
                rootResult.connection = decisionNode.id;

                let decisionNodeResult = handleDecisionNode(decisionNode);

                result.nodes[decisionNode.id] = decisionNodeResult;

            } else if(rootNode.children.length > 1) {
                throw new Error("Weird setup, root node has more than 1 decision node beneath it?");
            }
        });

        function handleUnused(elm) {
            elm.classList.remove("unused");

            let node = elm.audioRoutingNode;

            if(node instanceof ValueNode) {
                let valueResult = handleValueNode(node);
                result.nodes[node.id] = valueResult;
                result.unused.push({
                    "id": node.id
                });
            }
            if(node instanceof DecisionNode) {
                let decisionResult = handleDecisionNode(node);
                result.nodes[node.id] = decisionResult;
                result.unused.push({
                    "id": node.id
                });
            }
        }

        this.playArea.querySelectorAll(".mirrorVerseAudioRouterDecisionNode.unused").forEach((elm)=>{
            handleUnused(elm);
        });

        this.playArea.querySelectorAll(".mirrorVerseAudioRouterValueNode.unused").forEach((elm)=>{
            handleUnused(elm);
        });

        return JSON.stringify(result, null, 2);
    }

    unload() {
        if(this.audioRouterNodeContextMenu != null) {
            this.audioRouterNodeContextMenu.destroy();
            this.audioRouterNodeContextMenu = null;
        }

        if(this.playAreaContextMenu != null) {
            this.playAreaContextMenu.destroy();
            this.playAreaContextMenu = null;
        }

        this.menuItems.forEach((menuItem)=>{
            menuItem.delete();
        });

        super.unload();
    }

    static types() {
        return [
            AudioRouterFragment.type()
        ]
    }
}
window.AudioRouterGUIEditor = AudioRouterGUIEditor;
EditorManager.registerEditor(AudioRouterGUIEditor);

class Node {
    constructor(editor, updateCallback) {
        this.children = [];
        this.editor = editor;
        this.svg = this.editor.svgArea;
        this.updateCallback = updateCallback;
        this.connectionLine = null;
        this.connectionPoint = null;
    }

    checkType() {
        console.warn("Override in subclass [checkType]:", this);
    }

    findRootNodes() {
        let rootNodes = [];

        let parents = this.findParentNodes();

        parents.forEach((parent)=>{
            if(parent instanceof RootNode) {
                rootNodes.push(parent);
            } else {
                rootNodes.push(...parent.findRootNodes());
            }
        });



        return Array.from(new Set(rootNodes));
    }

    findParentNodes() {
        let parents = [];

        for(let line of this.svg.querySelectorAll("line")) {
            if(line.svgLine.endElement === this.html) {
                let audioNodeElm = line.svgLine.startElement.closest(".mirrorVerseAudioRouterNode");
                if(audioNodeElm != null) {
                    let audioRouterNode = audioNodeElm.audioRoutingNode;
                    parents.push(audioRouterNode);
                }
            }
        }

        return parents;
    }

    checkUnused() {
        this.html.classList.remove("error");
        this.html.classList.remove("mirrorVerseUnused");

        if(this.findRootNodes().length === 0) {
            this.html.classList.add("mirrorVerseUnused");
        } else if(this.findRootNodes().length > 1) {
            this.html.classList.add("error");
        }
    }

    delete() {
        this.html.remove();

        this.disconnectAll();

        this.disconnectFromParents();

        this.updated();
    }

    disconnectFromParents() {
        const self = this;

        this.svg.querySelectorAll("line").forEach((line) => {
            if (line.svgLine.endElement === self.html) {
                let audioRoutingNode = line.svgLine.startElement.closest(".mirrorVerseAudioRouterNode").audioRoutingNode;
                if(audioRoutingNode != null) {
                    audioRoutingNode.disconnect(self);
                }
            }
        });
    }

    onConnection(parentNode) {
        this.checkType();
    }

    getPosition() {
        if(this.html != null) {
            let x = parseFloat(this.html.getAttribute("data-x"));
            if(isNaN(x)) {
                x = 0;
            }
            let y = parseFloat(this.html.getAttribute("data-y"));
            if(isNaN(y)) {
                y = 0;
            }
            return {
                x, y
            }
        }

        return null;
    }

    setPosition(pos) {
        if(pos != null && pos.x != null && pos.y != null) {
            this.html.setAttribute("data-x", pos.x);
            this.html.setAttribute("data-y", pos.y);
            this.html.style.left = pos.x + "px";
            this.html.style.top = pos.y + "px";
        }
    }

    updated() {
        this.updateCallback();
    }

    renderSelf(container) {
        console.warn("Override in subclass [renderSelf]:", this);
    }

    render(container) {
        const self = this;

        this.renderSelf(container);

        if(this.html.classList.contains("draggable")) {
            this.setupDrag(this.html, (offsetX, offsetY) => {
                let x = parseFloat(self.html.getAttribute("data-x"));
                let y = parseFloat(self.html.getAttribute("data-y"));

                if (isNaN(x)) {
                    x = 0;
                }

                if (isNaN(y)) {
                    y = 0;
                }

                x += offsetX;
                y += offsetY;

                self.html.setAttribute("data-x", x);
                self.html.setAttribute("data-y", y);

                self.html.style.left = x + "px";
                self.html.style.top = y + "px";

                self.updated();
            }, (dropTarget) => {
                //Ignore drop
            });
        }

        this.children.forEach((child) => {
            child.render(container);
        });
    }

    setupDrag(element, dragCallback, dropCallback) {
        const self = this;

        let lastDragPosition = null;

        if(element.draggingEnabled === true) {
            //Dragging already setup on this element, skip
            return;
        }

        element.draggingEnabled = true;

        element.addEventListener("pointerdown", (evt)=>{
            if(evt.target.matches("input, select, option, button")) {
                return;
            }

            if(evt.button === 0) {
                evt.stopPropagation();
                lastDragPosition = {
                    x: evt.clientX,
                    y: evt.clientY
                };
            }
        });

        document.addEventListener("pointermove", (evt)=>{
            if(lastDragPosition != null) {
                evt.stopPropagation();

                let offsetX = evt.clientX - lastDragPosition.x;
                let offsetY = evt.clientY - lastDragPosition.y;

                dragCallback(offsetX, offsetY, evt);

                lastDragPosition = {
                    x: evt.clientX,
                    y: evt.clientY
                }
            }
        })

        document.addEventListener("pointerup", (evt)=>{
            if(lastDragPosition != null) {
                lastDragPosition = null;
                dropCallback(evt);
            }
        });
    }

    setupConnectionDragging(connectionOut) {
        const self = this;

        let lineDragElement = null;
        let svgLine = null;

        this.setupDrag(connectionOut, (offsetX, offsetY, evt)=>{
            if(lineDragElement == null) {
                lineDragElement = document.createElement("div");
                lineDragElement.style.position = "absolute";
                lineDragElement.style.display = "inline-block";
                lineDragElement.style.height = "1em";
                lineDragElement.style.width = "1em";
                lineDragElement.style.backgroundColor = "lime";

                let elementX = parseFloat(self.html.getAttribute("data-x"));
                let elementY = parseFloat(self.html.getAttribute("data-y"));

                if(isNaN(elementX)) {
                    elementX = 0;
                }

                if(isNaN(elementY)) {
                    elementY = 0;
                }

                lineDragElement.setAttribute("data-x", (elementX+evt.target.offsetLeft));
                lineDragElement.setAttribute("data-y", (elementY+evt.target.offsetTop));

                svgLine = new SVGLine(connectionOut, lineDragElement, self.svg);

                self.html.parentNode.appendChild(lineDragElement);
            }

            let x = parseFloat(lineDragElement.getAttribute("data-x"));
            let y = parseFloat(lineDragElement.getAttribute("data-y"));

            if(isNaN(x)) {
                x = 0;
            }

            if(isNaN(y)) {
                y = 0;
            }

            x += offsetX;
            y += offsetY;

            lineDragElement.setAttribute("data-x", x);
            lineDragElement.setAttribute("data-y", y);

            lineDragElement.style.left = x + "px";
            lineDragElement.style.top = y + "px";

            //svgLine.redraw();
        }, (evt)=>{
            if(lineDragElement != null) {
                lineDragElement.remove();
                lineDragElement = null;
            }

            if(svgLine != null) {
                svgLine.remove();
                svgLine = null;
            }

            let possibleConnection = document.elementFromPoint(evt.clientX, evt.clientY);

            if(possibleConnection != null) {
                possibleConnection = possibleConnection.closest(".connectionTarget");
                if(possibleConnection != null) {
                    let source = possibleConnection.audioRoutingNode;
                    self.connect(source);
                }
            }
        });
    }

    connect(node) {
        if(node instanceof DecisionNode) {
            //Check if node is our own parent
            let ourNode = this.html.closest(".mirrorVerseAudioRouterNode")?.audioRoutingNode;

            //Check if we would create a loop
            let foundLoop = false;
            function findLoop(testNode) {
                if(testNode === ourNode) {
                    foundLoop = true;
                    return;
                }

                testNode.children.forEach((child)=>{
                    //Decisions inside here, as we are children of a DecisionNode
                    if(child.children.length > 0) {
                        if(child.children[0] instanceof DecisionNode) {
                            findLoop(child.children[0]);
                        }
                    }
                })
            }

            findLoop(node);

            if(foundLoop) {
                console.log("Found loop, unable to connect:", node);
                return;
            }
        }

        //No loop continue

        //Remove old connection out from us
        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        let connectPoint = this.html;

        if(this.connectionPoint != null) {
            connectPoint = this.connectionPoint;
        }

        this.connectionLine = new SVGLine(connectPoint, node.html, this.svg, true);

        this.updated();

        this.onConnected(node);

        node.onConnection(this);
    }

    onConnected(childNode) {
        console.warn("Override in subclass [onConnected]:", this);
    }

    disconnect(child) {
        const self = this;

        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        this.onDisconnected(child);
    }

    onDisconnected(child) {
        console.warn("Override in subclass [onDisconnected]", this);
    }

    disconnectAll() {
        console.warn("Override in subclass [disconnectAll]:", this);
    }

    getNodeFromId(id) {
        let foundNode = null;

        for(let nodeElm of this.editor.playArea.querySelectorAll(".mirrorVerseAudioRouterNode")) {
            if(nodeElm?.audioRoutingNode?.id === id) {
                foundNode = nodeElm.audioRoutingNode;
                break;
            }
        }

        return foundNode;
    }
}

class ValueNode extends Node {
    constructor(nodeId, data, editor, updateCallback) {
        super(editor, updateCallback);

        this.id = nodeId;
        this.type = data.type;
        this.value = data.value;
        this.position = data.position;

        this.setup();
        this.checkUnused();
    }

    checkType() {
        const self = this;

        let roots = this.findRootNodes();

        this.html.classList.remove("error");

        roots.forEach((root)=>{
            if(root != null && root.rootName !== self.type) {
                self.html.classList.add("error");
            }
        });
    }

    setup() {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-ValueNode");
        this.html.audioRoutingNode = this;
        this.html.querySelectorAll(".type").forEach((elm)=>{
            elm.classList.add("hidden");
        });

        this.setPosition(this.position);

        this.renderSelf(this.editor.playArea);

        switch(this.type) {
            case "muted":
                this.html.querySelector(".type.muted").classList.remove("hidden");
                this.html.querySelector(".type.muted input").checked = this.value;

                this.html.querySelector(".type.muted input").addEventListener("change", ()=>{
                    self.value = this.html.querySelector(".type.muted input").checked;
                    self.updated();
                });

                break;
            case "volume":
                this.html.querySelector(".type.volume").classList.remove("hidden");
                this.html.querySelector(".type.volume input").value = this.value;

                this.html.querySelector(".type.volume input").addEventListener("change", ()=>{
                    self.value = parseFloat(this.html.querySelector(".type.volume input").value);

                    if(self.value > 1) {
                        self.value = 1;
                    }

                    if(self.value < 0) {
                        self.value = 0;
                    }

                    self.updated();
                });

                break;
            case "audioFilter":
                this.html.querySelector(".type.audioFilter").classList.remove("hidden");
                this.html.querySelector(".type.audioFilter select").value = this.value;

                this.html.querySelector(".type.audioFilter select").addEventListener("change", ()=>{
                    self.value = this.html.querySelector(".type.audioFilter select").value;
                    self.updated();
                });

                break;
            default:
                console.warn("Unknown ValueNode type:", this);
        }
    }

    renderSelf(container) {
        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }
    }

    disconnectAll() {
        //Do nothing
    }
}

class RootNode extends Node {
    constructor(rootName, json, editor, updateCallback) {
        super(editor, updateCallback);

        this.rootName = rootName;

        this.connectionLine = null;

        this.setup(json);
    }

    disconnectAll() {
        if(this.children.length > 0) {
            this.disconnect(this.children[0]);
        }
    }

    onDisconnected() {
        this.children = [];
    }

    checkUnused() {
        //Do nothing
    }

    checkType() {
        //Do nothing
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-rootNode");
        this.html.audioRoutingNode = this;

        this.setPosition(json.rootConnections[this.rootName].position);

        this.connectionPoint = this.html.querySelector(".connectionOut");

        let nodeId = json.rootConnections[this.rootName].connection;
        if(nodeId != null) {
            let decisionNode = this.getNodeFromId(nodeId);
            if(decisionNode == null) {
                decisionNode = new DecisionNode(nodeId, json, this.editor, this.updateCallback);
            }

            this.connect(decisionNode);
        }

        this.setupConnectionDragging(this.connectionPoint);
    }

    renderSelf(container) {
        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }

        this.html.querySelector(".title").textContent = this.rootName;
    }

    onConnected(childNode) {
        if(! (childNode instanceof DecisionNode)) {
            this.disconnect(childNode);
            return;
        }
        this.children = [childNode];
    }
}

class Decision extends Node {
    constructor(decision, node, json, editor, updateCallback) {
        super(editor, updateCallback);

        this.decision = decision;
        this.node = node;

        this.setup(json);
    }

    checkType() {
        let conceptType = this.node.data.concept;

        if(conceptType === "currentRoom") {
            conceptType = "containerMirror";
        }

        let concept = VarvEngine.getConceptFromType(conceptType);
        let property = concept.getProperty(this.node.data.property);

        let type = property.type;
        let arrayType = null;

        if(property.isConceptType()) {
            type = "concept";
        }

        if(type === "array") {
            arrayType = property.getArrayType();

            if(property.isConceptArrayType()) {
                arrayType = "concept";
            }
        }

        let oldType = this.html.getAttribute("data-type");

        if(oldType !== type) {
            console.log("Setting property type:", type, arrayType, this.html.querySelector("."+type+" .value"));

            this.html.setAttribute("data-type", type);

            this.html.querySelectorAll(".type, .arrayType").forEach((elm)=>{
                elm.classList.add("hidden");
            });

            this.html.querySelectorAll(".type."+type).forEach((elm)=>{
                elm.classList.remove("hidden");
            });

            switch (type) {
                case "boolean": {
                    this.decision.comparator = "equals";
                    this.html.querySelector(".boolean:not(.hidden) .value").value = this.decision.value;
                    let value = this.html.querySelector(".boolean:not(.hidden) .value").value === "true";

                    //If we dont have a correct value, default to true
                    this.html.querySelector(".boolean:not(.hidden) .value").value = value;

                    this.decision.value = value;

                    break;
                }

                case "number": {
                    this.html.querySelector(".number:not(.hidden) .value").value = this.decision.value;
                    this.html.querySelector(".number:not(.hidden) .comparator").value = this.decision.comparator;

                    let value = parseFloat(this.html.querySelector(".number:not(.hidden) .value").value);

                    if(isNaN(value) || value == null) {
                        value = 1.0;
                        this.html.querySelector(".number:not(.hidden) .value").value = 1.0;
                    }

                    this.decision.value = value;

                    break;
                }

                case "string": {
                    console.log("String!");
                    this.html.querySelector(".string:not(.hidden) .value").value = this.decision.value;
                    this.html.querySelector(".string:not(.hidden) .comparator").value = this.decision.comparator;
                    break;
                }

                case "concept": {
                    this.html.querySelector(".concept:not(.hidden) .value").value = this.decision.value;
                    this.html.querySelector(".concept:not(.hidden) .comparator").value = this.decision.comparator;
                    break;
                }

                case "array": {
                    this.html.querySelectorAll(".arrayType."+arrayType).forEach((elm)=>{
                        elm.classList.remove("hidden");
                    });

                    this.decision.comparator = "includes";

                    switch(arrayType) {
                        case "boolean": {
                            this.html.querySelector(".array .boolean .value").value = this.decision.value;
                            let value = this.html.querySelector(".array .boolean .value").value === "true";

                            //If we dont have a correct value, default to true
                            this.html.querySelector(".array .boolean .value").value = value;

                            this.decision.value = value;

                            break;
                        }

                        case "number": {
                            this.html.querySelector(".array .number .value").value = this.decision.value;

                            let value = parseFloat(this.html.querySelector(".array .number .value").value);

                            if(isNaN(value) || value == null) {
                                value = 1.0;
                                this.html.querySelector(".array .number .value").value = 1.0;
                            }

                            this.decision.value = value;

                            break;
                        }

                        case "string": {
                            this.html.querySelector(".array .string .value").value = this.decision.value;
                            break;
                        }

                        case "concept": {
                            this.html.querySelector(".array .concept .value").value = this.decision.value;
                            break;
                        }

                        default:
                            console.warn("Unknown array type:", arrayType);
                    }

                    break;
                }

                default:
                    console.warn("Unknown proprety type:", type);
            }

            let currentComparator = this.html.querySelector(".type:not(.hidden) .comparator");

            if(currentComparator?.value === "") {
                currentComparator.selectedIndex = 0;
                this.decision.comparator = currentComparator.value;
                console.log("Reset comparator to:", this.decision.comparator);
            }

            this.updated();
        }
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decision");
        this.html.audioRoutingNode = this;

        this.checkType();

        this.html.querySelectorAll(".boolean .value, .string .value, .concept .value").forEach((elm)=>{
            elm.addEventListener("change", ()=>{
                console.log("Value changed:", elm, elm.value);
                self.decision.value = elm.value;
                self.updated();
            });
        });

        this.html.querySelectorAll(".number .value").forEach((elm)=>{
            elm.addEventListener("change", ()=>{
                let value = parseFloat(elm.value);

                console.log("Value changed:", elm, value);

                self.decision.value = value;
                self.updated();
            });
        });

        this.html.querySelectorAll(".comparator").forEach((comparatorElm)=>{
            comparatorElm.addEventListener("change", (evt)=>{
                console.log("Comparator changed:", evt);
                self.decision.comparator = evt.target.value;
                self.updated();
            });
        });

        this.connectionPoint = this.html.querySelector(".connectionOut");

        if(this.decision.connection != null) {
            let data = json.nodes[this.decision.connection];

            let connectionNode = this.getNodeFromId(this.decision.connection);

            if(connectionNode == null) {
                if (data?.nodeType === "DecisionNode") {
                    connectionNode = new DecisionNode(this.decision.connection, json, this.editor, this.updateCallback);
                } else if (data?.nodeType === "ValueNode") {
                    connectionNode = new ValueNode(this.decision.connection, data, this.editor, this.updateCallback);
                }
            }

            if(connectionNode != null) {
                this.connect(connectionNode);
            }
        }

        this.setupConnectionDragging(this.connectionPoint);
    }

    isConnected(child) {
        if(this.children.length > 0) {
            return this.children[0] === child;
        }

        return false;
    }

    disconnectAll() {
        if(this.children.length > 0) {
            this.disconnect(this.children[0]);
        }
    }

    onConnected(childNode) {
        this.children = [childNode];
    }

    onDisconnected() {
        this.children = [];
    }

    renderSelf(container) {

    }
}

class DecisionNode extends Node {
    constructor(nodeId, json, editor, updateCallback) {
        super(editor, updateCallback);

        this.id = nodeId;
        this.data = json.nodes[this.id];

        this.setup(json);

        this.checkUnused();
    }

    disconnectAll() {
        const self = this;

        this.children.forEach((decision)=>{
            decision.disconnectAll();
        });
    }

    disconnect(child) {
        this.children.forEach((decision)=>{
            if(decision.isConnected(child)) {
                decision.disconnect(child);
            }
        });
    }

    checkType() {
        //Do nothing
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decisionNode");
        this.html.audioRoutingNode = this;

        this.setPosition(this.data.position);

        this.renderSelf(this.editor.playArea);

        let conceptSelect = this.html.querySelector(".concept select");

        conceptSelect.addEventListener("change", ()=>{
            self.data.concept = conceptSelect.value;
            self.updatePropertyDropdown();
            self.updated();
        });

        let propertySelect = this.html.querySelector(".property select");
        propertySelect.addEventListener("change", ()=>{
            self.data.property = propertySelect.value;
            self.updateDecisions();
            self.updated();
        });

        this.data.decisions.forEach((decision)=>{
            self.children.push(new Decision(decision, self, json, self.editor, self.updateCallback));
        })

        this.html.querySelector(".addDecision").addEventListener("click", ()=>{
            let fakeJson = {value: "", comparator: "equals"};
            let decision = new Decision(fakeJson, self, json, self.editor, self.updateCallback);
            self.children.push(decision);
            self.render(self.html.parentNode);
            self.updated();
        });
        this.html.querySelector(".removeDecision").addEventListener("click", ()=>{
            if(self.children.length > 0) {
                let lastDecision = self.children.pop();

                lastDecision.delete();
            }
        });
    }

    updateDecisions() {
        this.children.forEach((decision)=>{
            decision.checkType();
        });
    }

    renderSelf(container) {
        const self = this;

        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }

        this.html.querySelector(".name input").value = this.data.name;
        this.html.querySelector(".id").textContent = this.id;
        this.html.querySelector(".concept select").value = this.data.concept;

        this.updatePropertyDropdown(true);

        this.html.querySelector(".property select").value = this.data.property;

        let decisionsDiv = this.html.querySelector(".decisions");

        decisionsDiv.innerHTML = "";
        this.children.forEach((decision)=>{
            decisionsDiv.appendChild(decision.html);
        });

        this.html.querySelector(".name input").addEventListener("change", ()=>{
            self.data.name = self.html.querySelector(".name input").value;
            self.updated();
        })
    }

    updatePropertyDropdown(skipSelect = false) {
        let propertySelect = this.html.querySelector(".property select");
        propertySelect.innerHTML = "";

        MirrorVerseAudioRouter.concepts()[this.data.concept].forEach((property)=>{
            let option = document.createElement("option");
            option.value = property;
            option.textContent = property;

            propertySelect.appendChild(option);
        });

        if(!skipSelect) {
            this.data.property = propertySelect.value;
            this.updateDecisions();
        }
    }
}

class SVGLine {
    constructor(startElement, endElement, svg, connectTopMiddle=false) {
        this.lineElement = document.createElementNS('http://www.w3.org/2000/svg', "line");
        this.lineElement.classList.add("mirrorverse-audio-routing-connection");
        this.startElement = startElement;
        this.endElement = endElement;
        this.svg = svg;
        this.connectTopMiddle = connectTopMiddle;

        this.lineElement.svgLine = this;

        this.svg.appendChild(this.lineElement);

        this.redraw();
    }

    redraw() {
        const self = this;

        function getPosition(elm, connectTopMiddle) {
            const bounds = elm.getBoundingClientRect();

            const svgBounds = self.svg.getBoundingClientRect();

            if(connectTopMiddle) {
                return {
                    x: (bounds.x - svgBounds.x) + bounds.width / 2.0,
                    y: (bounds.y - svgBounds.y)
                }
            } else {
                return {
                    x: (bounds.x - svgBounds.x) + bounds.width / 2.0,
                    y: (bounds.y - svgBounds.y) + bounds.height / 2.0
                }
            }
        }

        let start = getPosition(this.startElement);
        let end = getPosition(this.endElement, this.connectTopMiddle);

        this.lineElement.setAttribute("x1", start.x);
        this.lineElement.setAttribute("y1", start.y);
        this.lineElement.setAttribute("x2", end.x);
        this.lineElement.setAttribute("y2", end.y);
    }

    remove() {
        this.lineElement.remove();
    }
}

//Setup cauldron menu item
MenuSystem.MenuManager.registerMenuItem("TreeBrowser.TreeNode.ContextMenu", {
    label: "Edit with AudioRouter GUI",
    icon: IconRegistry.createIcon("mdc:account_tree"),
    group: "EditActions",
    groupOrder: 0,
    order: 200,
    onOpen: (menu) => {
        if (menu.context.type == "DomTreeNode" && menu.context.context.matches("code-fragment[data-type='"+AudioRouterFragment.type()+"']")) {
            return true;
        }
    },
    onAction: (menuItem) => {
        EventSystem.triggerEvent("Varv.Open.AudioRouterGUI", {
            fragment: Fragment.one(menuItem.menu.context.context)
        });
    }
});

EventSystem.registerEventCallback("Varv.Open.AudioRouterGUI", (evt)=>{
    const detail = {
        fragment: evt.detail.fragment,
        editorClass: AudioRouterGUIEditor,
        titleWrapper: (t) => {
            return t + " - AudioRouter"
        }
    };

    if(evt.detail.line != null) {
        detail.line = evt.detail.line;
    }

    EventSystem.triggerEvent("Cauldron.Open.FragmentEditor", detail);
});

MenuSystem.MenuManager.registerMenuItem("Cauldron.Editor.Toolbar", {
    label: "Export",
    icon: IconRegistry.createIcon("mdc:ios_share"),
    group: "EditActions",
    groupOrder: 0,
    order: 200,
    onOpen: (menu) => {
        return menu.context instanceof AudioRouterFragment;
    },
    onAction: (menuItem) => {
        let fragment = menuItem.menu.context;

        fragment.require({pretty: true, auto: false}).then((codeFragment)=>{
            codeFragment.auto = false;
            WPMv2.stripProtection(codeFragment);
            fragment.html[0].parentNode.insertBefore(codeFragment, fragment.html[0].nextElementSibling);
        }).catch((e)=>{
            console.warn("Unable to export AudioRouter to varv:")
        });
    }
});
