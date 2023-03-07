class AudioRouterGUIEditor extends Editor {
    constructor(fragment, options = {}) {
        super("mirrorverse-audio-router", fragment, options);

        this.setupEditor();
    }

    setupEditor() {
        const self = this;

        this.playArea = document.createElement("div");
        this.playArea.classList.add("mirrorverse-audio-router-maximized");
        this.svgArea = document.createElementNS('http://www.w3.org/2000/svg', "svg");
        this.svgArea.classList.add("mirrorverse-audio-router-maximized");
        this.editorDiv[0].appendChild(this.playArea);
        this.editorDiv[0].appendChild(this.svgArea);

        this.rightClickMenu = MenuSystem.MenuManager.createMenu("mirrorverse-audio-router-rightClick");

        this.editorDiv[0].appendChild(this.rightClickMenu.html);

        this.playArea.addEventListener("contextmenu", (evt)=>{
            evt.preventDefault();
            self.rightClickMenu.open({
                x: evt.clientX,
                y: evt.clientY
            });
        });

        MenuSystem.MenuManager.registerMenuItem("mirrorverse-audio-router-rightClick", {
            label: "Insert Decision Node",
            icon: IconRegistry.createIcon("mdc:extension"),
            order: 0,
            onAction: (evt)=>{
            }
        });

        if(VarvEngine.concepts.length > 0) {
            this.load(this.fragment.raw);
        } else {
            VarvEngine.registerEventCallback("engineReloaded", ()=>{
                this.load(this.fragment.raw);
            });
        }

        let mutationObserver = new MutationObserver((mutations)=>{
            self.redrawSvgLines();
        });
        mutationObserver.observe(this.playArea, {
            attributes: true,
            attributeFilter: ["data-x", "data-y"],
            subtree: true
        });
    }

    redrawSvgLines() {
        this.svgArea.querySelectorAll("line").forEach((line)=>{
            line.svgLine.redraw();
        });
    }

    load(jsonRaw) {
        const self = this;

        let json = JSON.parse(jsonRaw);

        //Clear editor
        while(this.playArea.lastChild != null) {
            this.playArea.lastChild.remove();
        }

        if(json.rootConnections != null) {
            Array.from(Object.keys(json.rootConnections)).forEach((rootName) => {
                let rootNode = new RootNode(rootName, json, self.svgArea);
                rootNode.render(self.playArea);
            });

            this.redrawSvgLines();
        }
    }

    setValue(value) {
        this.load(value);
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
    constructor(svg) {
        this.children = [];
        this.svg = svg;
    }

    renderSelf(container) {
        console.warn("Override in subclass!");
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
        }, (dropTarget)=>{
        });

        this.children.forEach((child)=>{
            child.render(container);
        });
    }

    setupDrag(element, dragCallback, dropCallback) {
        const self = this;

        let lastDragPosition = null;

        element.addEventListener("pointerdown", (evt)=>{
            evt.stopPropagation();
            lastDragPosition = {
                x: evt.clientX,
                y: evt.clientY
            };
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

            /*
            if(connectionDragPosition != null) {
                connectionDragPosition = null;

                if(lineDragElement != null) {
                    lineDragElement.remove();
                    lineDragElement = null;
                }

                if(svgLine != null) {
                    svgLine.remove();
                    svgLine = null;
                }

                //Check for connection made!
                let possibleConnection = document.elementFromPoint(evt.clientX, evt.clientY);
                if(possibleConnection != null) {
                    possibleConnection = possibleConnection.closest(".connectionTarget");
                    if(possibleConnection != null) {
                        let source = connectionOut.closest(".mirrorVerseAudioRouterNode");
                        source.audioRoutingNode.connect(possibleConnection.audioRoutingNode);
                    }
                }
            }*/
        });
    }
}

class ValueNode extends Node {
    constructor(type, value, svg) {
        super(svg);
        
        this.type = type;
        this.value = value;

        this.setup();
    }

    setup() {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-ValueNode");
        this.html.audioRoutingNode = this;
        this.html.querySelectorAll(".type").forEach((elm)=>{
            elm.classList.add("hidden");
        });

        switch(this.type) {
            case "muted":
                this.html.querySelector(".type.muted").classList.remove("hidden");
                this.html.querySelector(".type.muted input").checked = this.value;

                this.html.querySelector(".type.muted input").addEventListener("change", ()=>{
                    self.value = this.html.querySelector(".type.muted input").checked;
                });

                break;
            case "volume":
                this.html.querySelector(".type.volume").classList.remove("hidden");
                this.html.querySelector(".type.volume input").value = this.value;

                this.html.querySelector(".type.volume input").addEventListener("change", ()=>{
                    self.value = this.html.querySelector(".type.volume input").value;
                });

                break;
            case "audioFilter":
                this.html.querySelector(".type.audioFilter").classList.remove("hidden");
                this.html.querySelector(".type.audioFilter select").value = this.value;

                this.html.querySelector(".type.audioFilter select").addEventListener("change", ()=>{
                    self.value = this.html.querySelector(".type.audioFilter select").value;
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
    constructor(rootName, json, svg) {
        super(svg);

        this.rootName = rootName;

        this.connectionLine = null;

        this.setup(json);
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-rootNode");
        this.html.audioRoutingNode = this;

        let nodeId = json.rootConnections[this.rootName];
        if(nodeId != null) {
            let decisionNode = new DecisionNode(nodeId, json, this.svg);
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
        this.svg.querySelectorAll("line").forEach((line)=>{
            if(line.svgLine.endElement == decisionNode.html) {
                line.svgLine.remove();
            }
        });

        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        this.children = [decisionNode];

        this.connectionLine = new SVGLine(this.html.querySelector(".connectionOut"), decisionNode.html, this.svg, true);
    }
}

class Decision extends Node {
    constructor(decision, node, json, svg) {
        super(svg);

        this.decision = decision;
        this.node = node;

        this.setup(json);
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decision");
        this.html.audioRoutingNode = this;

        let concept = VarvEngine.getConceptFromType(this.node.data.concept);
        let property = concept.getProperty(this.node.data.property);

        let type = property.type;

        this.html.classList.add(type);

        switch(type) {
            case "boolean":
                this.html.querySelector(".boolean .value").value = this.decision.value;
                break;
            default:
                this.html.querySelector(".select .value").value = this.decision.value;
                this.html.querySelector(".select .comparator").value = this.decision.comparator;
        }

        if(typeof this.decision.connection === "string") {
            let connectionNode = new DecisionNode(this.decision.connection, json, this.svg);;
            this.connect(connectionNode);
        } else if(typeof this.decision.connection === "object") {
            let valueNode = new ValueNode("muted", this.decision.connection.value, this.svg);
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
        this.svg.querySelectorAll("line").forEach((line)=>{
            if(line.svgLine.endElement == node.html) {
                line.svgLine.remove();
            }
        });

        if(this.connectionLine != null) {
            this.connectionLine.remove();
        }

        this.children = [node];

        this.connectionLine = new SVGLine(this.html.querySelector(".connectionOut"), node.html, this.svg, true);
    }

    renderSelf(container) {

    }
}

class DecisionNode extends Node {
    constructor(nodeId, json, svg) {
        super(svg);

        this.id = nodeId;
        this.data = json.nodes[this.id];

        this.setup(json);
    }

    setup(json) {
        const self = this;

        this.html = WebstrateComponents.Tools.loadTemplate("#mirrorverse-audio-router-decisionNode");
        this.html.audioRoutingNode = this;

        let conceptSelect = this.html.querySelector(".concept select");

        conceptSelect.addEventListener("change", ()=>{
            self.data.concept = conceptSelect.value;
            self.updatePropertyDropdown();
        });

        let propertySelect = this.html.querySelector(".property select");
        propertySelect.addEventListener("change", ()=>{
            self.data.property = propertySelect.value;
        });

        this.data.decisions.forEach((decision)=>{
            self.children.push(new Decision(decision, self, json, self.svg));
        })
    }

    renderSelf(container) {
        if(this.html.closest("html") == null) {
            container.appendChild(this.html);
        }

        this.html.querySelector(".title").textContent = this.data.name;
        this.html.querySelector(".id").textContent = this.id;
        this.html.querySelector(".concept select").value = this.data.concept;

        this.updatePropertyDropdown();

        this.html.querySelector(".property select").value = this.data.property;

        let decisionsDiv = this.html.querySelector(".decisions");

        decisionsDiv.innerHTML = "";
        this.children.forEach((decision)=>{
            decisionsDiv.appendChild(decision.html);
        })
    }

    updatePropertyDropdown() {
        let propertySelect = this.html.querySelector(".property select");
        propertySelect.innerHTML = "";

        MirrorVerseAudioRouter.concepts()[this.data.concept].forEach((property)=>{
            let option = document.createElement("option");
            option.value = property;
            option.textContent = property;

            propertySelect.appendChild(option);
        });
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
