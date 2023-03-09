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
        this.svgArea = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        this.svgArea.classList.add("mirrorverse-audio-router-maximized");
        this.editorDiv[0].appendChild(this.playArea);
        this.editorDiv[0].appendChild(this.svgArea);

        this.playAreaContextMenu = MenuSystem.MenuManager.createMenu("mirrorverse-audio-router-playAreaContext",{
            groupDividers: true
        });
        this.audioRouterNodeContextMenu = MenuSystem.MenuManager.createMenu("mirrorverse-audio-router-audioRouterNodeContext");

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

        function makeid(length) {
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

        function getRelativePos(menuPos) {

            let playAreaBounds = self.playArea.getBoundingClientRect();

            return {
                x: menuPos.x - playAreaBounds.x,
                y: menuPos.y - playAreaBounds.y
            }
        }

        MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext", {
            label: "Insert Decision Node",
            icon: IconRegistry.createIcon("mdc:schema"),
            group: "DecisionNode",
            groupOrder: 10,
            order: 0,
            onAction: (evt)=>{
                let id = makeid(10);
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
                let node = new DecisionNode(id, fakeJson, self.svgArea, ()=>{self.updatedCallback()});
                node.render(self.playArea);
                self.updatedCallback();
            }
        });

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

            MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext", {
                label: "Insert "+rootName+" root node",
                icon: IconRegistry.createIcon(icon),
                group: "RootNode",
                groupOrder: 0,
                order: 0,
                onAction: (evt)=>{
                    let id = makeid(10);
                    let fakeJson = {
                        "rootConnections": {}
                    }

                    fakeJson.rootConnections[rootName] = {
                        position: getRelativePos(evt.menu.openPosition),
                        connection: null
                    }

                    let node = new RootNode(rootName, fakeJson, self.svgArea, ()=>{self.updatedCallback()});
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
            });

            MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-playAreaContext", {
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

                    let node = new ValueNode(rootName, value, getRelativePos(evt.menu.openPosition), self.svgArea, ()=>{self.updatedCallback()});
                    node.render(self.playArea);

                    self.updatedCallback();
                }
            });
        })

        MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-audioRouterNodeContext", {
            label: "Delete",
            icon: IconRegistry.createIcon("mdc:extension"),
            order: 0,
            onAction: (evt)=>{
                let audioRouterElm = evt.menu.context.closest(".mirrorVerseAudioRouterNode");

                console.log(audioRouterElm);

                if(audioRouterElm != null) {
                    audioRouterElm.audioRoutingNode.delete();
                }
            }
        });

        MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-audioRouterNodeContext", {
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
                console.log(evt);

                let audioRouterElm = evt.context.closest(".mirrorVerseAudioRouterNode");

                if(audioRouterElm != null) {
                    if(audioRouterElm.audioRoutingNode instanceof DecisionNode || audioRouterElm.audioRoutingNode instanceof ValueNode) {
                        return true;
                    }
                }

                return false;
            }
        });

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
            elm.audioRoutingNode.checkType();
        });
    }

    load(jsonRaw) {
        const self = this;

        self.handleModelChanges = false;

        let json = JSON.parse(jsonRaw);

        //Clear editor
        while(this.playArea.lastChild != null) {
            this.playArea.lastChild.remove();
        }

        if(json.rootConnections != null) {
            Array.from(Object.keys(json.rootConnections)).forEach((rootName) => {
                let rootNode = new RootNode(rootName, json, self.svgArea, ()=>{self.updatedCallback()});
                rootNode.render(self.playArea);
            });
        }

        if(json.unused != null) {
            json.unused.forEach((unused)=>{
                switch(unused.nodeType) {
                    case "ValueNode": {
                        let node = new ValueNode(unused.type, unused.value, unused.position, self.svgArea, ()=>{self.updatedCallback()});
                        //Append?
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
                            let node = new DecisionNode(unused.id, json, self.svgArea, () => {
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

        this.redrawSvgLines();

        this.checkTypes();

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

        function handleDecision(decision) {
            let decisionResult = {
                "comparator": decision.decision.comparator,
                "value": decision.decision.value
            };

            if(decision.children.length === 1) {
                let connectionNode = decision.children[0];

                if(connectionNode instanceof DecisionNode) {
                    let decisionNodeResult = handleDecisionNode(connectionNode);
                    result.nodes[connectionNode.id] = decisionNodeResult;
                    decisionResult.connection = connectionNode.id;
                } else if(connectionNode instanceof ValueNode) {
                    connectionNode.html.classList.remove("unused");
                    decisionResult.connection = {"value": connectionNode.value, "position": connectionNode.getPosition(), type: connectionNode.type}
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
                result.unused.push({
                    "nodeType": "ValueNode",
                    "position": node.getPosition(),
                    "value": node.value,
                    "type": node.type
                });
            }
            if(node instanceof DecisionNode) {
                let decisionResult = handleDecisionNode(node);
                result.nodes[node.id] = decisionResult;
                result.unused.push({
                    "nodeType": "DecisionNode",
                    "id": node.id
                })
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

    static types() {
        return [
            AudioRouterFragment.type()
        ]
    }
}
window.AudioRouterGUIEditor = AudioRouterGUIEditor;
EditorManager.registerEditor(AudioRouterGUIEditor);

class Node {
    constructor(svg, updateCallback) {
        this.children = [];
        this.svg = svg;
        this.updateCallback = updateCallback;
    }

    checkType() {
        console.warn("Override in subclass:", this);
    }

    findRootNode() {
        let parent = this.findParentNode();
        while(parent != null) {
            if(parent instanceof RootNode) {
                return parent;
            }

            parent = parent.findParentNode();
        }

        return null;
    }

    findParentNode() {
        for(let line of this.svg.querySelectorAll("line")) {
            if(line.svgLine.endElement === this.html) {
                let audioNodeElm = line.svgLine.startElement.closest(".mirrorVerseAudioRouterNode");
                if(audioNodeElm != null) {
                    let audioRouterNode = audioNodeElm.audioRoutingNode;
                    return audioRouterNode;
                }
            }
        }

        return null;
    }

    delete() {
        console.warn("Override in subclass:", this);
    }

    disconnectFromParent() {
        console.warn("Override in subclass:", this);
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
        console.warn("Override in subclass:", this);
    }

    render(container) {
        const self = this;

        this.renderSelf(container);

        this.setupDrag(this.html, (offsetX, offsetY)=>{
            let x = parseFloat(self.html.getAttribute("data-x"));
            let y = parseFloat(self.html.getAttribute("data-y"));

            if(isNaN(x)) {
                x = 0;
            }

            if(isNaN(y)) {
                y = 0;
            }

            x += offsetX;
            y += offsetY;

            self.html.setAttribute("data-x", x);
            self.html.setAttribute("data-y", y);

            self.html.style.left = x + "px";
            self.html.style.top = y + "px";

            self.updated();
        }, (dropTarget)=>{
            //Ignore drop
        });

        this.children.forEach((child)=>{
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
}

class ValueNode extends Node {
    constructor(type, value, position, svg, updateCallback) {
        super(svg, updateCallback);
        
        this.type = type;
        this.value = value;
        this.position = position;

        this.setup();
    }

    checkType() {
        //Do nothing
        let root = this.findRootNode();

        this.html.classList.remove("error");

        if(root != null && root.rootName !== this.type) {
            this.html.classList.add("error");
        }
    }

    disconnectFromParent() {
        const self = this;

        this.svg.querySelectorAll("line").forEach((line)=>{
            if(line.svgLine.endElement === self.html) {
                let decisionNode = line.svgLine.startElement.closest(".mirrorVerseAudioRouterNode").audioRoutingNode;
                decisionNode.children.forEach((decision)=>{
                    if(decision.connectionLine === line.svgLine) {
                        decision.connect(null);
                    }
                });
            }
        });

        this.checkType();
    }

    delete() {
        const self = this;

        //Find connection and remove
        this.disconnectFromParent();

        this.html.remove();

        this.updated();
    }

    setup() {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-ValueNode");
        this.html.audioRoutingNode = this;
        this.html.querySelectorAll(".type").forEach((elm)=>{
            elm.classList.add("hidden");
        });

        this.setPosition(this.position);

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
                    self.value = this.html.querySelector(".type.volume input").value;
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
}

class RootNode extends Node {
    constructor(rootName, json, svg, updateCallback) {
        super(svg, updateCallback);

        this.rootName = rootName;

        this.connectionLine = null;

        this.setup(json);
    }

    checkType() {
        //Do nothing
    }

    delete() {
        this.connect(null);

        this.html.remove();

        this.updated();
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-rootNode");
        this.html.audioRoutingNode = this;

        this.setPosition(json.rootConnections[this.rootName].position);

        let nodeId = json.rootConnections[this.rootName].connection;
        if(nodeId != null) {
            let decisionNode = new DecisionNode(nodeId, json, this.svg, this.updateCallback);
            this.connect(decisionNode);
        }

        let lineDragElement = null;
        let svgLine = null;

        let connectionOut = this.html.querySelector(".connectionOut");

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

    renderSelf(container) {
        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }

        this.html.querySelector(".title").textContent = this.rootName;
    }

    connect(decisionNode) {
        if(decisionNode != null) {
            decisionNode.disconnectFromParent();
        }

        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        this.children = [];

        if(decisionNode != null) {
            this.children.push(decisionNode);

            this.connectionLine = new SVGLine(this.html.querySelector(".connectionOut"), decisionNode.html, this.svg, true);

            decisionNode.onConnection(this);
        }

        this.updated();
    }
}

class Decision extends Node {
    constructor(decision, node, json, svg, updateCallback) {
        super(svg, updateCallback);

        this.decision = decision;
        this.node = node;

        this.setup(json);
    }

    delete() {
        this.connect(null);
        this.html.remove();
        this.updateCallback();
    }

    checkType() {
        let concept = VarvEngine.getConceptFromType(this.node.data.concept);
        let property = concept.getProperty(this.node.data.property);

        let type = property.type;

        let oldType = this.html.getAttribute("data-type");

        if(oldType !== type) {
            this.html.setAttribute("data-type", type);

            switch (type) {
                case "boolean": {
                    this.decision.comparator = "equals";
                    this.html.querySelector(".boolean .value").value = this.decision.value;
                    let value = this.html.querySelector(".boolean .value").value === "true";

                    //If we dont have a correct value, default to true
                    this.html.querySelector(".boolean .value").value = value;

                    this.decision.value = value;

                    break;
                }

                case "number": {
                    this.html.querySelector(".select .number").value = this.decision.value;
                    this.html.querySelector(".select .comparator").value = this.decision.comparator;

                    let value = parseFloat(this.html.querySelector(".select .number").value);

                    if(isNaN(value) || value == null) {
                        value = 1.0;
                        this.html.querySelector(".select .number").value = 1.0;
                    }

                    this.decision.value = value;

                    break;
                }

                case "string": {
                    this.html.querySelector(".select .string").value = this.decision.value;
                    this.html.querySelector(".select .comparator").value = this.decision.comparator;
                    break;
                }

                default:
                    console.warn("Unknown proprety type:", type);
            }

            this.updated();
        }
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decision");
        this.html.audioRoutingNode = this;

        this.checkType();

        this.html.querySelector(".boolean .value").addEventListener("change", ()=>{
            self.decision.value = self.html.querySelector(".boolean .value").value;
            self.updated();
        });

        this.html.querySelector(".select .number").addEventListener("change", ()=>{
            let value = parseFloat(self.html.querySelector(".select .number").value);

            if(value < 0) {
                value = 0;
                self.html.querySelector(".select .number").value = value;
            } else if(value > 1) {
                value = 1;
                self.html.querySelector(".select .number").value = value;
            }

            self.decision.value = value;
            self.updated();
        });
        this.html.querySelector(".select .string").addEventListener("change", ()=>{
            self.decision.value = self.html.querySelector(".select .string").value;
            self.updated();
        });
        this.html.querySelector(".select .comparator").addEventListener("change", ()=>{
            self.decision.comparator = self.html.querySelector(".select .comparator").value;
            self.updated();
        });

        if(typeof this.decision.connection === "string") {
            let connectionNode = new DecisionNode(this.decision.connection, json, this.svg, this.updateCallback);;
            this.connect(connectionNode);
        } else if(typeof this.decision.connection === "object" && this.decision.connection != null) {
            let valueNode = new ValueNode(this.decision.connection.type, this.decision.connection.value, this.decision.connection.position, this.svg, this.updateCallback);
            this.connect(valueNode);
        }

        let lineDragElement = null;
        let svgLine = null;

        let connectionOut = this.html.querySelector(".connectionOut");

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
                possibleConnection = possibleConnection.closest(".decisionConnectTarget");
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

        if(node != null) {
            node.disconnectFromParent();
        }

        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        this.decision.connection = null;

        this.children = [];

        if(node != null) {
            this.children.push(node);

            this.connectionLine = new SVGLine(this.html.querySelector(".connectionOut"), node.html, this.svg, true);

            node.onConnection(this);
        }

        this.updated();
    }

    renderSelf(container) {

    }
}

class DecisionNode extends Node {
    constructor(nodeId, json, svg, updateCallback) {
        super(svg, updateCallback);

        this.id = nodeId;
        this.data = json.nodes[this.id];

        this.setup(json);
    }

    checkType() {
        //Do nothing
    }

    disconnectFromParent() {
        const self = this;

        this.svg.querySelectorAll("line").forEach((line) => {
            if (line.svgLine.endElement === self.html) {
                let audioRoutingNode = line.svgLine.startElement.closest(".mirrorVerseAudioRouterNode").audioRoutingNode;
                if (audioRoutingNode instanceof DecisionNode) {
                    audioRoutingNode.children.forEach((decision) => {
                        if (decision.connectionLine === line.svgLine) {
                            decision.connect(null);
                        }
                    });
                } else if (audioRoutingNode instanceof RootNode) {
                    audioRoutingNode.connect(null);
                }
            }
        });
    }

    delete() {
        const self = this;

        //Find connection and remove
        this.disconnectFromParent();

        this.children.forEach((decision)=>{
            decision.connect(null);
        });

        this.html.remove();

        this.updated();
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decisionNode");
        this.html.audioRoutingNode = this;

        this.setPosition(this.data.position);

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
            self.children.push(new Decision(decision, self, json, self.svg, self.updateCallback));
        })

        this.html.querySelector(".addDecision").addEventListener("click", ()=>{
            let fakeJson = {value: "", comparator: "equals"};
            let decision = new Decision(fakeJson, self, json, self.svg, self.updateCallback);
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
        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }

        this.html.querySelector(".title").textContent = this.data.name;
        this.html.querySelector(".id").textContent = this.id;
        this.html.querySelector(".concept select").value = this.data.concept;

        this.updatePropertyDropdown(true);

        this.html.querySelector(".property select").value = this.data.property;

        let decisionsDiv = this.html.querySelector(".decisions");

        decisionsDiv.innerHTML = "";
        this.children.forEach((decision)=>{
            decisionsDiv.appendChild(decision.html);
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
    icon: IconRegistry.createIcon("mdc:extension"),
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
