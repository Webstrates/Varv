/**
 *  Blockly Editor - Add Varv support to Blockly
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

/* global wpm, astring */

const SKIP_UPDATE = false;

wpm.onRemoved(() => {
    EditorManager.unregisterEditor(BlocklyVarvEditor, "blockly-varv-editor");
});

//Set saturation and hue
Blockly.HSV_SATURATION = 0.99;
Blockly.HSV_VALUE = 0.5;

//SNAP_RADIUS is used to disable bumping, but also disables snapping statements together...
//Blockly.SNAP_RADIUS = 15;

class VarvConnectionChecker extends Blockly.ConnectionChecker {
    constructor() {
        super();
    }

    findTopConnectionBlock(block) {
        let previousBlock = block;
        while(previousBlock.getPreviousBlock() != null) {
            previousBlock = previousBlock.getPreviousBlock();
        }

        return previousBlock;
    }

    doTypeChecks(a, b) {
        const checkArrayOne = a.getCheck();
        const checkArrayTwo = b.getCheck();

        //console.log("Comparing connections: ", checkArrayOne, checkArrayTwo, a, b);

        if (!checkArrayOne || !checkArrayTwo) {
            // Null arrays can only connect to other null arrays.
            return checkArrayOne === checkArrayTwo;
        }

        // Find any intersection in the check lists.
        for (let i = 0; i < checkArrayOne.length; i++) {
            if (checkArrayTwo.indexOf(checkArrayOne[i]) != -1) {
                return true;
            }
        }
        // No intersection.
        return false;
    }
}

const registrationType = Blockly.registry.Type.CONNECTION_CHECKER;
const registrationName = 'VarvConnectionChecker';

// Register the checker so that it can be used by name.
Blockly.registry.register(registrationType, registrationName, VarvConnectionChecker);

const varvConnectionCheckerPluginInfo = {
    [registrationType]: registrationName,
};

window.BlocklyVarvEditor = class BlocklyVarvEditor extends Editor {
    constructor(fragment, options = {}) {
        super("blockly-varv-editor", fragment, options);

        this.setupEditor();
    }

    setupEditor() {
        let self = this;

        self.contentArea = cQuery("<div id='blocklyDiv' class='blockly-content'></div>")[0];
        self.editorDiv.append(self.contentArea);

        //Empty toolbox, we build it dynamically later
        const toolbox = {
            "kind": "categoryToolbox",
            "contents": [
                {
                    "kind": "category",
                    "name": "Core",
                    "contents": []
                }
            ]
        };

        const options = {
            toolbox: toolbox,
            plugins: {
                ...varvConnectionCheckerPluginInfo
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 1.0,
                maxScale: 3,
                minScale: 0.3,
                scaleSpeed: 1.1,
                pinch: true
            },
            trashcan: true,
            renderer: "thrasos",
            sounds: false
        };

        self.updateEnabled = false;

        setTimeout(() => {
            setTimeout(() => {
                self.workspace = Blockly.inject(self.contentArea, options);

                Blockly.JavaScript.init(self.workspace);

                self.workspace._blocklyEditor = self;

                self.workspace.addChangeListener((evt) => {
                    if (evt.isUiEvent) {
                        //UI events never change the model, this stops dragging events from updating pos comment
                        return;
                    }

                    self.triggerHandleModelChanged();
                });

                self.onSizeChanged();

                self.setupBlocks();

                self.triggerBlocklyUpdate(true);

                //Ugly hack to move blockly widgets out of body?
                const widgetDiv = document.querySelector(".blocklyWidgetDiv");
                const dropDownDiv = document.querySelector(".blocklyDropDownDiv");
                const tooltipDiv = document.querySelector(".blocklyTooltipDiv");

                widgetDiv.classList.add("docking-area--ignore");
                dropDownDiv.classList.add("docking-area--ignore");
                tooltipDiv.classList.add("docking-area--ignore");

                document.querySelector("html").appendChild(widgetDiv);
                document.querySelector("html").appendChild(dropDownDiv);
                document.querySelector("html").appendChild(tooltipDiv);

                self.workspace.addChangeListener((event)=>{
                    if(Blockly.Events.MOVE === event.type) {
                        let movedBlock = this.workspace.getBlockById(event.blockId);

                        if(movedBlock?.previousConnection?.getCheck().includes("Filter")) {
                            let surroundBlock = movedBlock.getSurroundParent();

                            if(surroundBlock?.varvSingleFilterRestriction) {
                                let block = surroundBlock.getInputTargetBlock(surroundBlock.varvSingleFilterRestriction);
                                while(block != null) {
                                    if(block !== movedBlock) {
                                        block.unplug(true);
                                        let pos = movedBlock.getRelativeToSurfaceXY();
                                        block.moveTo({x: pos.x+25, y: pos.y+25});
                                    }
                                    block = block.getNextBlock();
                                }
                                console.warn("Only 1 filter is allowed here, popping old filter out!");
                            }
                        }
                    }
                });
            }, 0);
        }, 0);
    }

    triggerHandleModelChanged(force = false) {
        const self = this;

        if(self.handleModelChangesTimeout == null) {
            if(self.updateEnabled || force) {
                self.handleModelChangesTimeout = setTimeout(()=>{
                    self.handleModelChanged();
                    self.handleModelChangesTimeout = null;

                    //If fragment was auto, try to run fragment again?
                    if(self.fragment.auto) {
                        self.fragment.require();
                    }
                },0);
            }
        }
    }

    triggerBlocklyUpdate(loadFromCode) {
        const self = this;

        this.shouldLoadFromCode = this.shouldLoadFromCode || loadFromCode;

        if(this.blocklyUpdateTimeout == null) {
            this.blocklyUpdateTimeout = setTimeout(() => {
                self.fragment.executeObserverless(() => {
                    if(self.workspace != null) {
                        const scrollX = self.workspace.scrollX;
                        const scrollY = self.workspace.scrollY;

                        self.updateEnabled = false;

                        if (self.shouldLoadFromCode) {
                            self.loadFromCode();
                            self.workspace.render();
                        }

                        self.updateToolbox();
                        Blockly.svgResize(this.workspace);

                        if (self.shouldLoadFromCode) {
                            self.workspace.scroll(scrollX, scrollY);
                        }
                    }

                    self.shouldLoadFromCode = false;
                    self.blocklyUpdateTimeout = null;

                    //Timeout to wait until blockly is done
                    setTimeout(() => {
                        self.updateEnabled = true;
                    }, 0);
                }, self);
            }, 0);
        }
    }

    setValue(value) {
        if (this.workspace == null) {
            return;
        }

        if(!this.updateEnabled) {
            return;
        }

        this.triggerBlocklyUpdate(true);
    }

    setupBlocks() {
        if(BlocklyVarvEditor.setupBlocksDone) {
            return;
        }

        const self = this;

        BlocklyVarvEditor.setupBlocksDone = true;

        //Setup Concept Block
        Blockly.Blocks["varv_concept"] = {
            init: function () {
                const self = this;

                this.mixin(hideCommentsMixin);

                this.appendDummyInput().appendField("Concept");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                const plusPropertyButton = new SVGIconButtonField("#blockly_editor_plus");
                plusPropertyButton.registerClickCallback(() => {
                    const propertyBlock = BlocklyVarvEditor.createPropertyBlock(null, self.workspace);

                    let connection = self.getInput("PROPERTIES").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(propertyBlock.previousConnection);

                    propertyBlock.initSvg();
                    requestAnimationFrame(()=>{
                        propertyBlock.render();
                    });
                });

                let propertiesLabel = new Blockly.FieldLabel("Properties:")
                this.appendDummyInput().appendField(propertiesLabel).appendField(plusPropertyButton);
                this.appendStatementInput("PROPERTIES").setCheck("Property");

                const plusMappingButton = new SVGIconButtonField("#blockly_editor_plus");
                plusMappingButton.registerClickCallback(() => {
                    const mappingBlock = BlocklyVarvEditor.createMappingBlock(null, self.workspace);

                    let connection = self.getInput("MAPPINGS").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(mappingBlock.previousConnection);

                    mappingBlock.initSvg();
                    requestAnimationFrame(()=>{
                        mappingBlock.render();
                    });
                });

                this.appendDummyInput().appendField("Mappings:").appendField(plusMappingButton);
                this.appendStatementInput("MAPPINGS").setCheck("Mapping");

                const plusActionButton = new SVGIconButtonField("#blockly_editor_plus");
                plusActionButton.registerClickCallback(() => {
                    const actionBlock = BlocklyVarvEditor.createBehaviourBlock(null, self.workspace);

                    let connection = self.getInput("BEHAVIOURS").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(actionBlock.previousConnection);

                    actionBlock.initSvg();
                    requestAnimationFrame(()=>{
                        actionBlock.render();
                    });
                });

                let actionsLabel = new Blockly.FieldLabel("Actions:")
                this.appendDummyInput().appendField(actionsLabel).appendField(plusActionButton);
                this.appendStatementInput("BEHAVIOURS").setCheck("Behaviour");

                this.setColour(230);
            }
        }
        Blockly.JavaScript["varv_concept"] = function (block) {
            let conceptJson = {
                "schema": {

                },
                "actions": {

                },
                "mappings": {

                }
            };

            let propertyBlock = block.getInputTargetBlock("PROPERTIES")
            while (propertyBlock != null) {
                const propertyJson = JSON.parse(Blockly.JavaScript.blockToCode(propertyBlock, true));

                let propertyName = Object.keys(propertyJson);
                let propertyValue = propertyJson[propertyName];

                conceptJson.schema[propertyName] = propertyValue;

                propertyBlock = propertyBlock.getNextBlock();
            }

            let behaviourBlock = block.getInputTargetBlock("BEHAVIOURS");
            while(behaviourBlock != null) {
                const behaviourJson = JSON.parse(Blockly.JavaScript.blockToCode(behaviourBlock, true));
                Object.assign(conceptJson.actions, behaviourJson);
                behaviourBlock = behaviourBlock.getNextBlock();
            }

            let mappingBlock = block.getInputTargetBlock("MAPPINGS");
            while(mappingBlock != null) {
                const mappingJson = JSON.parse(Blockly.JavaScript.blockToCode(mappingBlock, true));
                Object.assign(conceptJson.mappings, mappingJson);
                mappingBlock = mappingBlock.getNextBlock();
            }

            if(Object.keys(conceptJson.actions).length === 0) {
                delete conceptJson.actions;
            }
            if(Object.keys(conceptJson.mappings).length === 0) {
                delete conceptJson.mappings;
            }
            if(Object.keys(conceptJson.schema).length === 0) {
                delete conceptJson.schema;
            }

            let name = block.getFieldValue("NAME");
            return "{\""+name+"\":" + JSON.stringify(conceptJson)+"}";
        };

        //Setup Property Block
        Blockly.Blocks["varv_property"] = {
            init: function () {
                this.appendDummyInput().appendField("Property");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                let typeLabel = new Blockly.FieldLabel("Type:");
                let typeOptions = [
                    ["string", "string"],
                    ["number", "number"],
                    ["boolean", "boolean"],
                    ["concept", "concept"],
                    ["array", "array"]
                ];
                this.appendDummyInput().appendField(typeLabel).appendField(new Blockly.FieldDropdown(typeOptions, this.handleTypeSelection.bind(this)), "TYPE");

                this.appendDummyInput().appendField("Options:").appendField(new Blockly.FieldMultilineInput(), "OPTIONS");

                this.setColour(125);

                this.propertyType = this.getFieldValue("TYPE");
                this.updateBlock();

                this.setPreviousStatement(true, ["Property"]);
                this.setNextStatement(true, ["Property"]);
            },
            domToMutation: function() {

            },
            mutationToDom: function() {

            },
            handleTypeSelection: function(newType) {
                if(this.propertyType !== newType) {
                    this.propertyType = newType;
                    this.updateBlock();
                }
            },
            handleArrayTypeSelection: function(newType) {
                if(this.arrayType !== newType) {
                    this.arrayType = newType;
                    this.updateBlock();
                }
            },
            updateBlock: function() {
                //Remove old extra, as we are switching now
                if(this.getInput("extraType")) {
                    this.removeInput("extraType");
                }
                if(this.getInput("arrayType")) {
                    this.removeInput("arrayType");
                }
                switch(this.propertyType) {
                    case "string":
                    case "number":
                    case "boolean":
                        //The type is already correct
                        break;

                    case "concept":
                        //Read the concept type from extra parameter
                        this.appendDummyInput("extraType").appendField("Concept:").appendField(new Blockly.FieldTextInput(), "CONCEPT_TYPE");
                        break;
                    case "array":
                        if(this.getInput("arrayType")) {
                            this.removeInput("arrayType");
                        }

                        //Read the array type from extra parameter
                        let typeOptions = [
                            ["string", "string"],
                            ["number", "number"],
                            ["boolean", "boolean"],
                            ["concept", "concept"]
                        ];
                        let arrayDropDown = new Blockly.FieldDropdown(typeOptions, this.handleArrayTypeSelection.bind(this));
                        arrayDropDown.setValue(this.arrayType);
                        this.appendDummyInput("extraType").appendField("Items:").appendField(arrayDropDown, "ARRAY_TYPE");
                        this.arrayType = this.getFieldValue("ARRAY_TYPE");

                        if(this.arrayType === "concept") {
                            this.appendDummyInput("arrayType").appendField("ItemsConcept:").appendField(new Blockly.FieldTextInput(), "CONCEPT_TYPE");
                        }
                        break;
                }
            }
        };
        Blockly.JavaScript["varv_property"] = function (block) {
            let name = block.getFieldValue("NAME");
            let type = block.getFieldValue("TYPE");

            let arrayType = null;

            switch(type) {
                case "string":
                case "number":
                case "boolean":
                    //The type is already correct
                    break;

                case "concept":
                    //Read the concept type from extra parameter
                    type = block.getFieldValue("CONCEPT_TYPE");
                    break;
                case "array":
                    //Read the array type from extra parameter
                    arrayType = block.getFieldValue("ARRAY_TYPE");
                    if(arrayType === "concept") {
                        arrayType = block.getFieldValue("CONCEPT_TYPE");
                    }
                    break;
            }

            let result = {};

            let options = block.getFieldValue("OPTIONS");

            try {
                options = JSON.parse(options);
            } catch(e) {
                //Ignore
            }

            result[name] = {
                [type]: options
            };

            if(arrayType != null) {
                result[name][type].items = arrayType;
            }

            result[name] = BlocklyVarvEditor.flatten(result[name]);

            return JSON.stringify(result);
        };

        //Setup Behaviour Block
        Blockly.Blocks["varv_behaviour"] = {
            init: function () {
                const self = this;

                this.appendDummyInput().appendField("Behaviour");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                const plusWhenButton = new SVGIconButtonField("#blockly_editor_plus");
                plusWhenButton.registerClickCallback(() => {
                    const triggerBlock = BlocklyVarvEditor.createTriggerBlock(null, self.workspace);

                    let connection = self.getInput("WHEN").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(triggerBlock.previousConnection);

                    triggerBlock.initSvg();
                    requestAnimationFrame(()=>{
                        triggerBlock.render();
                    });
                });

                let whenLabel = new Blockly.FieldLabel("When:");
                this.appendDummyInput().appendField(whenLabel).appendField(plusWhenButton);
                this.appendStatementInput("WHEN").setCheck("Trigger");

                const plusThenButton = new SVGIconButtonField("#blockly_editor_plus");
                plusThenButton.registerClickCallback(() => {
                    const actionBlock = BlocklyVarvEditor.createActionBlock(null, self.workspace);

                    let connection = self.getInput("THEN").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(actionBlock.previousConnection);

                    actionBlock.initSvg();
                    requestAnimationFrame(()=>{
                        actionBlock.render();
                    });
                });

                let thenLabel = new Blockly.FieldLabel("Then:");
                this.appendDummyInput().appendField(thenLabel).appendField(plusThenButton);
                this.appendStatementInput("THEN").setCheck("Action");


                this.setColour(0);

                this.setPreviousStatement(true, ["Behaviour"]);
                this.setNextStatement(true, ["Behaviour"]);
            },
        };
        Blockly.JavaScript["varv_behaviour"] = function (block) {
            let behaviourName = block.getFieldValue("NAME");

            let result = {
                [behaviourName]: {
                    "when": [],
                    "then": []
                }
            };
            let whenBlock = block.getInputTargetBlock("WHEN");
            while(whenBlock != null) {
                try {
                    let whenJson = JSON.parse(Blockly.JavaScript.blockToCode(whenBlock, true));

                    whenJson = BlocklyVarvEditor.flatten(whenJson);

                    result[behaviourName].when.push(whenJson);
                } catch(e) {
                    console.warn(e);
                }
                whenBlock = whenBlock.getNextBlock();
            }

            let thenBlock = block.getInputTargetBlock("THEN");
            while(thenBlock != null) {
                try {
                    let thenJson = JSON.parse(Blockly.JavaScript.blockToCode(thenBlock, true));

                    thenJson = BlocklyVarvEditor.flatten(thenJson);

                    result[behaviourName].then.push(thenJson);
                } catch(e) {
                    console.warn(e);
                }
                thenBlock = thenBlock.getNextBlock();
            }

            if(result[behaviourName].then.length === 0) {
                delete result[behaviourName].then;
            }

            if(Object.keys(result[behaviourName].when).length === 0) {
                result[behaviourName] = result[behaviourName].then;
            } else {
                result[behaviourName].when = BlocklyVarvEditor.flatten(result[behaviourName].when);
            }

            return JSON.stringify(result);
        };

        //Setup Action Block
        Blockly.Blocks["varv_action"] = {
            init: function () {
                this.appendDummyInput().appendField("Action");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                this.setColour(50);

                let optionsLabel = new Blockly.FieldLabel("Options:");
                this.appendDummyInput().appendField(optionsLabel).appendField(new Blockly.FieldMultilineInput(), "OPTIONS");

                this.setPreviousStatement(true, ["Action"]);
                this.setNextStatement(true, ["Action"]);
            }
        };
        Blockly.JavaScript["varv_action"] = function (block) {
            let name = block.getFieldValue("NAME");
            let options = block.getFieldValue("OPTIONS");

            try {
                options = JSON.parse(options);
            } catch(e) {
                //Ignore
            }

            if(typeof options === "string" && options.trim().length === 0) {
                options = {};
            }

            return JSON.stringify({[name]: options});
        };

        //Setup Action Block
        Blockly.Blocks["varv_trigger"] = {
            init: function () {
                this.appendDummyInput().appendField("Trigger");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                let optionsLabel = new Blockly.FieldLabel("Options:");
                this.appendDummyInput().appendField(optionsLabel).appendField(new Blockly.FieldTextInput(), "OPTIONS");

                this.setColour(300);

                this.setPreviousStatement(true, ["Trigger"]);
                this.setNextStatement(true, ["Trigger"]);
            }
        };
        Blockly.JavaScript["varv_trigger"] = function (block) {
            return "ACTION";
        };

        //Setup DataStore Block
        Blockly.Blocks["varv_datastore"] = {
            init: function () {
                this.appendDummyInput().appendField("DataStore");

                let nameLabel = new Blockly.FieldLabel("Name:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "NAME");

                let types = [];

                Datastore.datastoreTypes.forEach((datastoreClass, datastoreType)=>{
                    types.push([datastoreType, datastoreType]);
                });

                let typeLabel = new Blockly.FieldLabel("Type:");
                this.appendDummyInput().appendField(typeLabel).appendField(new Blockly.FieldDropdown(types), "TYPE");

                let optionsLabel = new Blockly.FieldLabel("Options:");
                this.appendDummyInput().appendField(optionsLabel).appendField(new Blockly.FieldTextInput(), "OPTIONS");
            }
        };
        Blockly.JavaScript["varv_datastore"] = function (block) {
            let result = {};

            let name = block.getFieldValue("NAME");
            let options = block.getFieldValue("OPTIONS");
            let type = block.getFieldValue("TYPE");

            try {
                options = JSON.parse(options);
            } catch(e) {
                //Ignore
            }

            result[name] = {
                type,
                options
            }

            return JSON.stringify(result);
        };

        //Setup Mapping Block
        Blockly.Blocks["varv_mapping"] = {
            init: function () {
                const self = this;

                this.appendDummyInput().appendField("Mapping");

                let nameLabel = new Blockly.FieldLabel("Property:");
                this.appendDummyInput().appendField(nameLabel).appendField(new Blockly.FieldTextInput(), "PROPERTY");

                const plusButton = new SVGIconButtonField("#blockly_editor_plus");

                plusButton.registerClickCallback(() => {
                    const stringBlock = BlocklyVarvEditor.createStringBlock("", self.workspace);

                    let connection = self.getInput("DATASTORES").connection;

                    while (connection.targetBlock() != null) {
                        connection = connection.targetBlock().nextConnection;
                    }

                    connection.connect(stringBlock.previousConnection);

                    stringBlock.initSvg();
                    requestAnimationFrame(()=>{
                        stringBlock.render();
                    });
                });

                this.appendDummyInput().appendField("Datastores:").appendField(plusButton);
                this.appendStatementInput("DATASTORES").setCheck("String");

                this.setPreviousStatement(true, ["Mapping"]);
                this.setNextStatement(true, ["Mapping"]);
            }
        };
        Blockly.JavaScript["varv_mapping"] = function (block) {
            let propertyName = block.getFieldValue("PROPERTY");

            let result = {
                [propertyName]: []
            };

            let dataStoreBlock = block.getInputTargetBlock("DATASTORES");
            while(dataStoreBlock != null) {
                let value = Blockly.JavaScript.blockToCode(dataStoreBlock, true);

                result[propertyName].push(value);

                dataStoreBlock = dataStoreBlock.getNextBlock();
            }

            return JSON.stringify(result);
        };

        Blockly.Blocks["varv_string"] = {
            init: function() {
                this.appendDummyInput().appendField(new Blockly.FieldTextInput(), "STRING");

                this.setPreviousStatement(true, ["String"]);
                this.setNextStatement(true, ["String"]);
            }
        };
        Blockly.JavaScript["varv_string"] = function (block) {
            return block.getFieldValue("STRING");
        };

        Blockly.Blocks["varv_filterand"] = {
            init: function() {
                this.appendDummyInput().appendField("and");
                this.setColour(300);

                this.appendStatementInput("FILTERS").setCheck("Filter");

                this.setPreviousStatement(true, ["Filter"]);
                this.setNextStatement(true, ["Filter"]);
            }
        };
        Blockly.JavaScript["varv_filterand"] = function (block) {
            let result = {
                "and":[]
            };

            let filterBlock = block.getInputTargetBlock("FILTERS");
            while(filterBlock != null){
                try {
                    let json = JSON.parse(Blockly.JavaScript.blockToCode(filterBlock, true));
                    result.and.push(json);
                } catch(e) {

                }
                filterBlock = filterBlock.getNextBlock();
            }

            return JSON.stringify(result);
        };

        Blockly.Blocks["varv_filteror"] = {
            init: function() {
                this.appendDummyInput().appendField("or");
                this.setColour(300);

                this.appendStatementInput("FILTERS").setCheck("Filter");

                this.setPreviousStatement(true, ["Filter"]);
                this.setNextStatement(true, ["Filter"]);
            }
        };
        Blockly.JavaScript["varv_filteror"] = function (block) {
            let result = {
                "or":[]
            };

            let filterBlock = block.getInputTargetBlock("FILTERS");
            while(filterBlock != null){
                try {
                    let json = JSON.parse(Blockly.JavaScript.blockToCode(filterBlock, true));
                    result.or.push(json);
                } catch(e) {

                }
                filterBlock = filterBlock.getNextBlock();
            }

            return JSON.stringify(result);
        };

        Blockly.Blocks["varv_filternot"] = {
            init: function() {
                this.appendDummyInput().appendField("not");
                this.setColour(300);

                this.appendStatementInput("FILTER").setCheck("Filter");

                this.setPreviousStatement(true, ["Filter"]);
                this.setNextStatement(true, ["Filter"]);

                this.varvSingleFilterRestriction = "FILTER";
            }
        };
        Blockly.JavaScript["varv_filternot"] = function (block) {
            let result = {
                "not":{}
            };

            let filterBlock = block.getInputTargetBlock("FILTER");
            if(filterBlock != null){
                try {
                    let json = JSON.parse(Blockly.JavaScript.blockToCode(filterBlock, true));
                    result.not = json;
                } catch(e) {

                }
            }

            return JSON.stringify(result);
        };

        Blockly.Blocks["varv_filter"] = {
            init: function() {
                this.appendDummyInput().appendField("filter");
                this.setColour(300);

                let typeOptions = [
                    ["property", "property"],
                    ["variable", "variable"]
                ];
                this.appendDummyInput().appendField(new Blockly.FieldDropdown(typeOptions), "TYPE").appendField(new Blockly.FieldTextInput(), "VALUE");

                let opOptions = Array.from(Object.keys(window.FilterOps)).map((op)=>{
                    return [op, op];
                });
                this.appendDummyInput().appendField(new Blockly.FieldDropdown(opOptions), "OP").appendField(new Blockly.FieldTextInput(), "COMPARE_VALUE");

                this.setPreviousStatement(true, ["Filter"]);
                this.setNextStatement(true, ["Filter"]);
            }
        };
        Blockly.JavaScript["varv_filter"] = function (block) {
            let type = block.getFieldValue("TYPE");
            let value = block.getFieldValue("VALUE");
            let op = block.getFieldValue("OP");
            let compareValue = block.getFieldValue("COMPARE_VALUE");

            try {
                compareValue = eval(compareValue);
            } catch(e) {
                console.warn(e);
            }

            let result = {
                [type]: value,
                [op]: compareValue
            };

            return JSON.stringify(result);
        };

        Action.primitiveActions.forEach((action, key)=>{
            if(action.options != null) {
                let options = action.options();

                Blockly.Blocks["varv_action_"+key] = {
                    init: function() {
                        //Name of action
                        this.appendDummyInput().appendField(key);
                        this.setColour(60);

                        this.mixin(hideCommentsMixin);
                        this.mixin(parameterMixin);

                        this.initParameters(options);

                        this.setPreviousStatement(true, ["Action"]);
                        this.setNextStatement(true, ["Action"]);
                    }
                };
                Blockly.JavaScript["varv_action_"+key] = function (block) {
                    let actionOptions = block.getValues();

                    return JSON.stringify({[key]: actionOptions});
                };

                BlocklyVarvEditor.primitiveActionBlocks.push(key);
            }
        });

        Trigger.triggers.forEach((trigger, key)=>{
            if(trigger.options != null) {
                let options = trigger.options();

                Blockly.Blocks["varv_trigger_"+key] = {
                    init: function() {
                        //Name of action
                        this.appendDummyInput().appendField(key);
                        this.setColour(20);

                        this.mixin(parameterMixin);

                        this.initParameters(options);

                        this.setPreviousStatement(true, ["Trigger"]);
                        this.setNextStatement(true, ["Trigger"]);
                    }
                };
                Blockly.JavaScript["varv_trigger_"+key] = function (block) {
                    let triggerOptions = block.getValues();

                    return JSON.stringify({[key]: triggerOptions});
                };

                BlocklyVarvEditor.primitiveTriggerBlocks.push(key);
            }
        });

        Blockly.Blocks["varv_propertylistvalue"] = {
            init: function() {
                this.setColour(80);

                this.appendDummyInput().appendField("property:").appendField(new Blockly.FieldTextInput(), "PROPERTY").appendField("value:").appendField(new Blockly.FieldTextInput(), "VALUE");

                this.setPreviousStatement(true, ["PropertyListValue"]);
                this.setNextStatement(true, ["PropertyListValue"]);
            }
        };
        Blockly.JavaScript["varv_propertylistvalue"] = function (block) {
            return JSON.stringify({[block.getFieldValue("PROPERTY")]: block.getFieldValue("VALUE")});
        };

        Blockly.Blocks["varv_switchcase"] = {
            init: function() {
                this.setColour(100);

                this.appendDummyInput().appendField("where:");
                this.appendStatementInput("WHERE").setCheck("Filter");
                this.varvSingleFilterRestriction = "WHERE";

                this.appendDummyInput().appendField("then:");
                this.appendStatementInput("THEN").setCheck("Action");

                this.appendDummyInput().appendField("break").appendField(new Blockly.FieldCheckbox(), "BREAK");
                this.setFieldValue(true, "BREAK");

                this.setPreviousStatement(true, ["SwitchCase"]);
                this.setNextStatement(true, ["SwitchCase"]);
            }
        };
        Blockly.JavaScript["varv_switchcase"] = function (block) {
            let result = {};

            let whereBlock = block.getInputTargetBlock("WHERE");
            if(whereBlock != null) {
                result.where = JSON.parse(Blockly.JavaScript.blockToCode(whereBlock, true));
            }

            let thenBlock = block.getInputTargetBlock("THEN");
            while(thenBlock != null) {
                if(result.then == null) {
                    result.then = [];
                }
                result.then.push(BlocklyVarvEditor.flatten(JSON.parse(Blockly.JavaScript.blockToCode(thenBlock, true))));

                thenBlock = thenBlock.getNextBlock();
            }

            let shouldBreak = block.getFieldValue("BREAK") === "TRUE";
            result.break = shouldBreak;

            return JSON.stringify(result);
        };
    }

    static createPropertyListValueBlock(options, workspace) {
        let block = workspace.newBlock("varv_propertylistvalue");

        return block;
    }

    static isConnectedToParent(block) {
        return block.getTopStackBlock().getParent() != null;
    }

    static flatten(obj) {
        let keys = Object.keys(obj);

        if(keys.length === 1) {
            let key = Object.keys(obj)[0];
            let value = obj[key];

            if (Object.keys(value).length === 0) {
                return key;
            }
        }

        return obj;
    }

    updateToolbox() {
        const self = this;

        const dynamicContent = [
        ];

        let toolboxContents = [
            {
                "kind": "category",
                "name": "Core",
                "contents": [
                    {
                        "kind": "block",
                        "type": "varv_concept"
                    },
                    {
                        "kind": "block",
                        "type": "varv_datastore"
                    }
                ]
            },
            {
                "kind": "category",
                "name": "Filter",
                "contents": [
                    {
                        "kind": "block",
                        "type": "varv_filterand"
                    },
                    {
                        "kind": "block",
                        "type": "varv_filteror"
                    },
                    {
                        "kind": "block",
                        "type": "varv_filternot"
                    },
                    {
                        "kind": "block",
                        "type": "varv_filter"
                    }
                ]
            }
        ];

        let primitiveActionsToolbox = {
            "kind": "category",
            "name": "PrimitiveActions",
            "contents": []
        };

        dynamicContent.push(primitiveActionsToolbox);

        BlocklyVarvEditor.primitiveActionBlocks.forEach((actionName)=>{
            primitiveActionsToolbox.contents.push({
                "kind": "block",
                "type": "varv_action_"+actionName
            });
        });

        let primitiveTriggersToolbox = {
            "kind": "category",
            "name": "PrimitiveTriggers",
            "contents": []
        };

        dynamicContent.push(primitiveTriggersToolbox);

        BlocklyVarvEditor.primitiveTriggerBlocks.forEach((triggerName)=>{
            primitiveTriggersToolbox.contents.push({
                "kind": "block",
                "type": "varv_trigger_"+triggerName
            });
        });

        toolboxContents.push(...dynamicContent);

        const toolbox = {
            "kind": "categoryToolbox",
            "contents": toolboxContents
        }

        this.workspace.updateToolbox(toolbox);
    }

    static trimQuotes(str) {
        if (typeof str === "string") {

            let match = str.match(/^\s*\"(.*?)\"\s*$/);

            if (match != null) {
                str = match[1];
            }
        }

        if (Array.isArray(str)) {
            str = str.map((v) => {
                return BlocklyVarvEditor.trimQuotes(v);
            });
        }

        return str;
    }

    static beautify(code) {
        //Beautify JSON?
        try {
            code = JSON.stringify(JSON.parse(code), null, 4);
        } catch(e) {

        }

        return code;
    }

    static stringifyArgument(argument) {
        if(argument == null) {
            return "null";
        }

        if (typeof argument === "string") {
            return argument;
        }

        if (Array.isArray(argument)) {
            let stringifiedArray = argument.map((elm) => {
                return BlocklyVarvEditor.stringifyArgument(elm);
            })
            return "[" + stringifiedArray.join(", ") + "]";
        }

        if (typeof argument === "object") {
            let objString = "{";

            let first = true;

            Object.keys(argument).forEach((key) => {
                if (first) {
                    first = false;
                } else {
                    objString += ", ";
                }

                const value = argument[key];
                objString += "\"" + key + "\": " + BlocklyVarvEditor.stringifyArgument(value);
            });

            return objString + "}";
        }

        if (typeof argument === "function") {
            return argument.toString();
        }

        return argument;
    }

    loadFromCode() {
        let self = this;

        //Remove all blocks
        this.workspace.setResizesEnabled(false);

        Blockly.Events.disable();
        this.workspace.clear();

        function finishBlock(block, comment, line) {
            block.initSvg();

            /*
            if (comment != null) {
                try {
                    let commentObj = JSON.parse(comment.value);

                    if(commentObj.text != null) {
                        block.setCommentText(commentObj.text.replaceAll("\\n", "\n"));
                    }
                    if(commentObj.position != null) {
                        block.moveTo(commentObj.position);
                    }

                    if(commentObj.hideFromToolbox) {
                        block.hideFromToolbox = true;
                    }
                } catch (e) {
                    if(typeof comment === "string") {
                        block.setCommentText(comment);
                    }
                }
            }
             */
        }

        try {
            let convertResult = YAMLJSONConverter.loadFromString(this.fragment.raw);

            let spec = ConceptLoader.parseSpec(convertResult.obj);

            spec.concepts.forEach((concept)=>{
                let conceptBlock = BlocklyVarvEditor.createConceptBlock(concept, self.workspace);

                //Setup properties on concept
                Array.from(concept.properties.values()).reverse().forEach((property)=>{
                    let propertyBlock = BlocklyVarvEditor.createPropertyBlock(property, self.workspace);
                    finishBlock(propertyBlock);

                    conceptBlock.getInput("PROPERTIES").connection.connect(propertyBlock.previousConnection);
                });

                Array.from(concept.behaviours.values()).reverse().forEach((behaviour)=>{
                    let behaviourBlock = BlocklyVarvEditor.createBehaviourBlock(behaviour, self.workspace);

                    Array.from(behaviour.cloneData.triggers).reverse().forEach((triggerJson)=>{
                        let triggerBlock = BlocklyVarvEditor.createTriggerBlock(triggerJson, self.workspace);
                        finishBlock(triggerBlock);

                        behaviourBlock.getInput("WHEN").connection.connect(triggerBlock.previousConnection);
                    });

                    Array.from(behaviour.cloneData.actions).reverse().forEach((actionJson)=>{
                        let actionBlock = BlocklyVarvEditor.createActionBlock(actionJson, self.workspace);
                        finishBlock(actionBlock);

                        behaviourBlock.getInput("THEN").connection.connect(actionBlock.previousConnection);
                    });

                    finishBlock(behaviourBlock);

                    conceptBlock.getInput("BEHAVIOURS").connection.connect(behaviourBlock.previousConnection);
                });

                Array.from(concept.mappings.entries()).reverse().forEach((mappingEntry)=>{
                    let mappingBlock = BlocklyVarvEditor.createMappingBlock(mappingEntry, self.workspace);
                    finishBlock(mappingBlock);

                    conceptBlock.getInput("MAPPINGS").connection.connect(mappingBlock.previousConnection);
                });

                finishBlock(conceptBlock);
            });

            spec.dataStores.forEach((datastore)=>{
                if(datastore.options.default) {
                    return;
                }
                let dataStoreBlock = BlocklyVarvEditor.createDataStoreBlock(datastore, self.workspace);
                finishBlock(dataStoreBlock);
            });

        } catch(e) {
            console.warn(e);
        }

        Blockly.Events.enable();
        this.workspace.setResizesEnabled(true);

        setTimeout(()=>{
            this.packBlocks();
        });
    }

    onSizeChanged() {
        this.contentArea.style.width = this.html[0].clientWidth + 'px';
        this.contentArea.style.height = this.html[0].clientHeight + 'px';
        if (this.workspace != null) {
            Blockly.svgResize(this.workspace);
        }
    }

    getValue() {
        let spec = {
            "concepts": {},
            "dataStores": {}
        }

        try {

            let conceptBlocks = this.workspace.getBlocksByType("varv_concept");

            conceptBlocks.forEach((conceptBlock) => {
                let conceptBlockCode = Blockly.JavaScript.blockToCode(conceptBlock, true);
                try {
                    let conceptBlockJson = JSON.parse(conceptBlockCode);
                    Object.assign(spec.concepts, conceptBlockJson);
                } catch (e) {
                    console.warn(e, conceptBlockCode);
                }
            });

            let dataStoreBlocks = this.workspace.getBlocksByType("varv_datastore");
            dataStoreBlocks.forEach((dataStoreBlock) => {
                let dataStoreBlockJson = JSON.parse(Blockly.JavaScript.blockToCode(dataStoreBlock, true));
                Object.assign(spec.dataStores, dataStoreBlockJson);
            });

            if (Object.keys(spec.dataStores).length === 0) {
                delete spec.dataStores;
            }

            if (Object.keys(spec.concepts).length === 0) {
                delete spec.concepts;
            }
        } catch(e) {
            console.warn("Some error in blockly parsing, dont set value yet");
            return this.fragment.raw;
        }

        // TODO: Remove this debug, makes sure code is not changed during testing
        if(SKIP_UPDATE) {
            return this.fragment.raw;
        }

        return JSON.stringify(spec, null, 2);
    }

    unload() {
        this.updateEnabled = false;
        super.unload();
        Blockly.Events.disable();
        this.workspace.clear();
        this.workspace.dispose();
        Blockly.Events.enable();
        this.workspace = null;
    }

    packBlocks() {
        Blockly.Events.disable();
        this.workspace.setResizesEnabled(false);

        let topBlocks = this.workspace.getTopBlocks(true);

        let boxes = [];

        const PADDING = 10;

        topBlocks.forEach((block)=>{
            let widthHeight = block.getHeightWidth();
            boxes.push({block, w: widthHeight.width+PADDING, h: widthHeight.height+PADDING});
        });

        potpack(boxes);

        boxes.forEach((box)=>{
            box.block.moveTo(box);
            box.block.snapToGrid();
        });

        this.workspace.setResizesEnabled(true);
        Blockly.Events.enable();
    }

    static createDataStoreBlock(datastore, workspace) {
        let block = workspace.newBlock("varv_datastore");
        block.setFieldValue(datastore.name, "NAME");

        let options = datastore.options;

        if(typeof options === "object") {
            options = JSON.stringify(options);
        }

        block.setFieldValue(options, "OPTIONS");

        let type = null;

        Datastore.datastoreTypes.forEach((dataStoreClass, dataStoreType)=>{
            if(datastore instanceof dataStoreClass) {
                type = dataStoreType;
            }
        });

        block.setFieldValue(type, "TYPE");

        return block;
    }

    static createConceptBlock(concept, workspace) {
        let block = workspace.newBlock("varv_concept");
        block.setFieldValue(concept.name, "NAME");
        return block;
    }

    static createBehaviourBlock(behaviour, workspace) {
        let block = workspace.newBlock("varv_behaviour");
        if(behaviour != null) {
            block.setFieldValue(behaviour.name, "NAME");
        }
        return block;
    }

    static createTriggerBlock(triggerJson, workspace) {
        let block = null;

        let type = "";
        let options = {};

        if(triggerJson != null) {
            if (typeof triggerJson === "string") {
                type = triggerJson;
            } else {
                type = Object.keys(triggerJson)[0];
                options = triggerJson[type];
            }

            try {
                BlocklyVarvEditor.primitiveTriggerBlocks.forEach((primitiveTriggerBlockName)=>{
                    if(primitiveTriggerBlockName === type) {
                        //Let the trigger handle all shorthand stuff, so we get the generalized options object
                        let trigger = Trigger.getTrigger(type, "DONT_USE_ME", options);

                        block = workspace.newBlock("varv_trigger_"+primitiveTriggerBlockName);
                        block.setFromOptions(trigger.options);
                    }
                });
            } catch(e) {
                //Ignore
                console.warn(e);
            }
        }

        if(block == null) {
            if (typeof options === "object") {
                options = JSON.stringify(options, null, 2);
            }

            block = workspace.newBlock("varv_trigger");
            block.setFieldValue(type, "NAME");
            block.setFieldValue(options, "OPTIONS");
        }

        return block;
    }

    static createActionBlock(actionJson, workspace) {
        let block = null;

        let name = "";
        let options = "";

        if(actionJson != null) {
            if (typeof actionJson === "string") {
                name = actionJson;
            } else {
                name = Object.keys(actionJson)[0];
                options = actionJson[name];
            }

            try {
                BlocklyVarvEditor.primitiveActionBlocks.forEach((primitiveActionBlockName)=>{
                    if(primitiveActionBlockName === name) {
                        //Let the action handle all shorthand stuff, so we get the generalized options object
                        let primitiveAction = Action.getPrimitiveAction(name, options);

                        block = workspace.newBlock("varv_action_"+primitiveActionBlockName);
                        block.setFromOptions(primitiveAction.options);
                    }
                });
            } catch(e) {
                //Ignore
            }
        }

        if(block == null) {
            if (typeof options === "object") {
                options = JSON.stringify(options, null, 2);
            }

            block = workspace.newBlock("varv_action");
            block.setFieldValue(name, "NAME");
            block.setFieldValue(options, "OPTIONS");
        }

        return block;
    }

    static createPropertyBlock(property, workspace) {
        let block = workspace.newBlock("varv_property");
        if(property != null) {
            block.setFieldValue(property.name, "NAME");

            let clonedOptions = JSON.parse(JSON.stringify(property.options));

            let type = property.type;
            let arrayType = null;
            let conceptType = null;
            switch (type) {
                case "string":
                case "number":
                case "boolean":
                    break;
                case "array":
                    arrayType = clonedOptions.items;
                    delete clonedOptions.items;
                    break;
                default:
                    //Must be a concept type
                    conceptType = type;
                    type = "concept";
            }

            block.setFieldValue(type, "TYPE");

            if (arrayType != null) {
                switch (arrayType) {
                    case "number":
                    case "string":
                    case "boolean":
                        break;
                    default:
                        //Concept type
                        conceptType = arrayType;
                        arrayType = "concept";
                }
            }

            if (arrayType != null) {
                block.setFieldValue(arrayType, "ARRAY_TYPE");
            }

            if (conceptType != null) {
                block.setFieldValue(conceptType, "CONCEPT_TYPE");
            }

            if (typeof clonedOptions === "object") {
                clonedOptions = JSON.stringify(clonedOptions, null, 2);
            }

            block.setFieldValue(clonedOptions, "OPTIONS");
        }

        return block;
    }

    static createMappingBlock(mapping, workspace) {
        let block = workspace.newBlock("varv_mapping");
        if(mapping != null) {
            let propertyName = mapping[0];
            let mappings = mapping[1];

            block.setFieldValue(propertyName, "PROPERTY");

            mappings.slice().reverse().forEach((value)=>{
                let stringBlock = BlocklyVarvEditor.createStringBlock(value, workspace);
                stringBlock.initSvg();

                block.getInput("DATASTORES").connection.connect(stringBlock.previousConnection);
            });
        }
        return block;
    }

    static createFilterBlock(config, workspace) {
        let block = null;

        let keys = Object.keys(config);

        let key = keys[0];

        function insertBlockLastInConnection(newBlock, connection) {
            while(connection.targetBlock() != null) {
                connection = connection.targetBlock().nextConnection;
            }
            connection.connect(newBlock.previousConnection);
        };

        switch(key) {
            case "and": {
                block = workspace.newBlock("varv_filterand");

                config[key].forEach((andElmConfig)=>{
                    let elmBlock = BlocklyVarvEditor.createFilterBlock(andElmConfig, workspace);
                    insertBlockLastInConnection(elmBlock, block.getInput("FILTERS").connection);
                });
                break;
            }
            case "or": {
                block = workspace.newBlock("varv_filteror");
                config[key].forEach((orElmConfig)=>{
                    let elmBlock = BlocklyVarvEditor.createFilterBlock(orElmConfig, workspace);
                    insertBlockLastInConnection(elmBlock, block.getInput("FILTERS").connection);
                });
                break;
            }
            case "not": {
                block = workspace.newBlock("varv_filternot");
                let elmBlock = BlocklyVarvEditor.createFilterBlock(config[key], workspace);
                block.getInput("FILTER").connection.connect(elmBlock.previousConnection);
                break;
            }

            default: {
                block = workspace.newBlock("varv_filter");

                if(config.property != null) {
                    block.setFieldValue("property", "TYPE");
                    block.setFieldValue(config.property, "VALUE");
                } else if(config.variable != null) {
                    block.setFieldValue("variable", "TYPE");
                    block.setFieldValue(config.variable, "VALUE");
                }

                Object.keys(config).forEach((op)=>{
                    if(window.FilterOps[op] != null) {
                        block.setFieldValue(op, "OP");
                        block.setFieldValue(JSON.stringify(config[op]), "COMPARE_VALUE");
                    }
                });
            }
        }

        block.initSvg();

        return block;
    }

    static createStringBlock(value, workspace) {
        let block = workspace.newBlock("varv_string");
        if(value != null) {
            block.setFieldValue(value, "STRING");
        }
        return block;
    }

    static createSwitchCaseBlock(options, workspace) {
        let block = workspace.newBlock("varv_switchcase");

        if(options != null) {
            if(options.where != null) {
                let filterBlock = BlocklyVarvEditor.createFilterBlock(options.where, workspace);
                filterBlock.initSvg();
                block.getInput("WHERE").connection.connect(filterBlock.previousConnection);
            }
            if(options.then != null) {
                if(!Array.isArray(options.then)) {
                    options.then = [options.then];
                }

                options.then.reverse().forEach((actionJson)=>{
                    let actionBlock = BlocklyVarvEditor.createActionBlock(actionJson, workspace);
                    actionBlock.initSvg();
                    block.getInput("THEN").connection.connect(actionBlock.previousConnection);
                });
            }
        }

        return block;
    }

    static types() {
        return [
            "text/varv"
        ];
    }
}
BlocklyVarvEditor.primitiveActionBlocks = [];
BlocklyVarvEditor.primitiveTriggerBlocks = [];
EditorManager.registerEditor(BlocklyVarvEditor);

//Setup blockly chaff hider
window.addEventListener("mousedown", (evt) => {
    if(cQuery(evt.target).is("#blocklyDiv, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv")) {
        return;
    }

    const blocklyDiv = cQuery(evt.target).closest("#blocklyDiv, .blocklyWidgetDiv, .blocklyDropDownDiv, .blocklyTooltipDiv");

    if(blocklyDiv.length === 0) {
        //Close chaff
        try {
            Blockly.hideChaff();
        } catch(e) {
            //Supressing hideChaff error
        }
    }
}, {
    capture: true
})

//Setup cauldron menu item
MenuSystem.MenuManager.registerMenuItem("TreeBrowser.TreeNode.ContextMenu", {
    label: "Edit with Blockly",
    icon: IconRegistry.createIcon("mdc:extension"),
    group: "EditActions",
    groupOrder: 0,
    order: 200,
    onOpen: (menu) => {
        if (menu.context.type == "DomTreeNode" && menu.context.context.matches("code-fragment[data-type='text/varv']")) {
            return true;
        }
    },
    onAction: (menuItem) => {
        EventSystem.triggerEvent("Varv.Open.BlocklyEditor", {
            fragment: Fragment.one(menuItem.menu.context.context)
        });
    }
});

EventSystem.registerEventCallback("Varv.Open.BlocklyEditor", (evt)=>{
    const detail = {
        fragment: evt.detail.fragment,
        editorClass: BlocklyVarvEditor,
        titleWrapper: (t) => {
            return t + " - Blockly"
        }
    };

    EventSystem.triggerEvent("Cauldron.Open.FragmentEditor", detail);
});

const hideCommentsMixin = {
    customContextMenu: function(menuOptions) {
        let commentOptionIndex = menuOptions.findIndex((menuOption)=>{
            return menuOption.text === "Add Comment";
        });

        menuOptions.splice(commentOptionIndex, 1);
    }
}

const parameterMixin = {
    mutationToDom: function() {
        let optionsJson = JSON.stringify(this.options);
        let container = document.createElement("mutation");
        container.setAttribute("options", optionsJson);
        return container;
    },
    domToMutation: function(xmlElement) {
        let optionsJson = xmlElement.getAttribute("options");
        if(optionsJson != null && this.options == null) {
            //Loading options
            this.initParameters(JSON.parse(optionsJson));
        }
    },
    extractOptionConfig: function(optionType) {
        let optionConfig = {};

        optionConfig.optional = optionType.startsWith("@");
        optionType = optionType.replace("@", "");

        optionConfig.defaultValue = null;

        if(optionType.indexOf("%") !== -1) {
            let split = optionType.split("%");
            try {
                optionConfig.defaultValue = eval(split[1]);
            } catch(e) {
                console.warn(e);
            }
            optionType = split[0];
        }

        if(optionType.startsWith("enumValue")) {
            let split = optionType.split("[");
            optionType = split[0];

            optionConfig.enums = split[1].replace("]", "").split(",");
        } else if(optionType.startsWith("enum")) {
            let split = optionType.split("[");
            optionType = split[0];

            optionConfig.enums = split[1].replace("]", "").split(",");
        }

        optionConfig.type = optionType;

        return optionConfig;
    },
    setupTooltip: function(field, optionConfig) {
        let tooltip = "A field that holds a value of type ["+optionConfig.type+"]";

        if(optionConfig.optional) {
            tooltip += " - This field is optional, if empty it will be omitted from generated code";
        }

        field.setTooltip(tooltip);
    },
    initParameters: function(options) {
        const self = this;
        this.options = options;
        Object.keys(this.options).forEach((optionName)=>{
            let optionType = self.options[optionName];

            let labeledInput = self.appendDummyInput("FIELD_INPUT");

            let optionConfig = this.extractOptionConfig(optionType);

            if(!optionName.startsWith("$")) {
                let labelField = new Blockly.FieldLabel(optionName);
                labeledInput.appendField(labelField);
                this.setupTooltip(labelField, optionConfig);
            }

            switch(optionConfig.type) {
                case "raw":
                case "number":
                case "string": {
                    let field = new Blockly.FieldTextInput();
                    this.setupTooltip(field, optionConfig);
                    labeledInput.appendField(field, optionName);
                    if (optionConfig.defaultValue != null) {
                        self.setFieldValue(optionConfig.defaultValue, optionName);
                    }
                    break;
                }

                case "boolean": {
                    let field = new Blockly.FieldCheckbox();
                    this.setupTooltip(field, optionConfig);
                    labeledInput.appendField(field, optionName);
                    if (optionConfig.defaultValue != null) {
                        self.setFieldValue(optionConfig.defaultValue, optionName);
                    }
                    break;
                }

                case "propertyList": {
                    const plusButton = new SVGIconButtonField("#blockly_editor_plus");
                    plusButton.registerClickCallback(() => {
                        const propertyListValueBlock = BlocklyVarvEditor.createPropertyListValueBlock(null, self.workspace);

                        let connection = self.getInput(optionName).connection;

                        while (connection.targetBlock() != null) {
                            connection = connection.targetBlock().nextConnection;
                        }

                        connection.connect(propertyListValueBlock.previousConnection);

                        propertyListValueBlock.initSvg();
                        requestAnimationFrame(()=>{
                            propertyListValueBlock.render();
                        });
                    });

                    labeledInput.appendField(plusButton);
                    self.appendStatementInput(optionName).setCheck("PropertyListValue");
                    break;
                }

                case "enumValue": {
                    let choices = optionConfig.enums.map((value)=>{
                        return [value, value];
                    });
                    labeledInput.appendField(new Blockly.FieldDropdown(choices), optionName);
                    labeledInput.appendField(new Blockly.FieldTextInput(), optionName+".value");
                    break;
                }

                case "enum": {
                    let choices = optionConfig.enums.map((value)=>{
                        return [value, value];
                    });
                    labeledInput.appendField(new Blockly.FieldDropdown(choices), optionName);
                    break;
                }

                case "range": {
                    labeledInput.appendField(new Blockly.FieldTextInput(), optionName+".min").appendField("to").appendField(new Blockly.FieldTextInput(), optionName+".max");
                    break;
                }

                case "filter": {
                    self.appendStatementInput(optionName).setCheck("Filter");
                    self.varvSingleFilterRestriction = optionName;
                    break;
                }

                case "switch": {
                    const plusButton = new SVGIconButtonField("#blockly_editor_plus");
                    plusButton.registerClickCallback(() => {
                        const switchCaseBlock = BlocklyVarvEditor.createSwitchCaseBlock(null, self.workspace);

                        let connection = self.getInput(optionName).connection;

                        while (connection.targetBlock() != null) {
                            connection = connection.targetBlock().nextConnection;
                        }

                        connection.connect(switchCaseBlock.previousConnection);

                        switchCaseBlock.initSvg();
                        requestAnimationFrame(()=>{
                            switchCaseBlock.render();
                        });
                    });

                    labeledInput.appendField(plusButton);
                    self.appendStatementInput(optionName).setCheck("SwitchCase");
                    break;
                }

                default:
                    console.warn("Unknown option type:", optionConfig.type);
            }

            if(labeledInput.fieldRow.length === 0) {
                self.removeInput("FIELD_INPUT", true);
            }
        });
    },
    setFromOptions(optionValues) {
        const self = this;

        function lookupValue(name, values) {
            let currentValue = values;

            try {
                for (let namePart of name.split(".")) {
                    if(namePart.startsWith("$")) {
                        continue;
                    }
                    currentValue = currentValue[namePart];
                }
            } catch(e) {
                console.warn(e);
            }

            return currentValue;
        }

        Object.keys(this.options).forEach((optionName)=>{
            let optionType = self.options[optionName];
            let optionValue = lookupValue(optionName, optionValues);

            let optionConfig = self.extractOptionConfig(optionType);

            switch (optionConfig.type) {
                case "string":
                case "number":
                case "boolean":
                    if(optionValue != null) {
                        self.setFieldValue(optionValue, optionName);
                    }
                    break;

                case "raw":
                    if(optionValue != null) {
                        self.setFieldValue(JSON.stringify(optionValue), optionName);
                    }
                    break;
                case "propertyList": {
                    Array.from(Object.keys(optionValue)).reverse().forEach((key)=>{
                        let value = optionValue[key];

                        let block = BlocklyVarvEditor.createPropertyListValueBlock(null, self.workspace);
                        block.setFieldValue(key, "PROPERTY");
                        block.setFieldValue(JSON.stringify(value), "VALUE");
                        block.initSvg();

                        self.getInput(optionName).connection.connect(block.previousConnection);
                    });
                    break;
                }
                case "enumValue": {
                    let foundEnum = {};
                    optionConfig.enums.forEach((enumName)=>{
                        let lookup = lookupValue(optionName+"."+enumName, optionValues);
                        if(lookup != null) {
                            foundEnum.value = lookup;
                            foundEnum.enumName = enumName;
                        }
                    });

                    if(foundEnum.enumName != null) {
                        self.setFieldValue(foundEnum.enumName, optionName);
                        self.setFieldValue(foundEnum.value, optionName + ".value");
                    }
                    break;
                }

                case "enum": {
                    let foundEnum = {};
                    optionConfig.enums.forEach((enumName)=>{
                        let lookup = lookupValue(optionName+"."+enumName, optionValues);
                        if(lookup != null) {
                            foundEnum.value = lookup;
                            foundEnum.enumName = enumName;
                        }
                    });

                    if(foundEnum.enumName != null) {
                        self.setFieldValue(foundEnum.enumName, optionName);
                    }
                    break;
                }

                case "range": {
                    if(optionValue != null && Array.isArray(optionValue) && optionValue.length === 2) {
                        self.setFieldValue(optionValue[0], optionName+".min");
                        self.setFieldValue(optionValue[1], optionName+".max");
                    }
                }

                case "filter": {
                    if(optionValue != null) {
                        let block = BlocklyVarvEditor.createFilterBlock(optionValue, self.workspace);
                        block.initSvg();
                        self.getInput(optionName).connection.connect(block.previousConnection);
                    }

                    break;
                }

                case "switch": {
                    if(optionValue != null && Array.isArray(optionValue)) {
                        optionValue.forEach((caseOptions)=>{
                            let block = BlocklyVarvEditor.createSwitchCaseBlock(caseOptions, self.workspace);
                            block.initSvg();
                            self.getInput(optionName).connection.connect(block.previousConnection);
                        });
                    }

                    break;
                }

                default:
                    console.warn("Unknown option type:", optionConfig.type);
            }
        });
    },
    getValues: function () {
        const self = this;

        let actionOptions = {};

        function setValue(path, value, obj, optional) {
            if(optional && (value == null || (typeof value === "string" && value.trim().length === 0))) {
                return;
            }

            let currentEntry = obj;
            let pathParts = path.split(".");
            for(let i = 0; i<pathParts.length - 1; i++) {
                let pathPart = pathParts[i];
                if(pathPart.startsWith("$")) {
                    continue;
                }

                if(currentEntry[pathPart] == null) {
                    currentEntry[pathPart] = {};
                }
                currentEntry = currentEntry[pathPart];
            }

            let lastPathPart = pathParts[pathParts.length-1];

            //Last path entry, set value
            if(lastPathPart.startsWith("$")) {
                Object.assign(currentEntry, value);
            } else {
                currentEntry[lastPathPart] = value;
            }
        }

        Object.keys(this.options).forEach((optionName)=> {
            let optionType = self.options[optionName];

            let optionConfig = self.extractOptionConfig(optionType);

            switch(optionConfig.type) {
                case "string": {
                    let value = self.getFieldValue(optionName);
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }
                case "number": {
                    let value = parseFloat(self.getFieldValue(optionName));
                    if(isNaN(value)) {
                        value = null;
                    }
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }
                case "boolean": {
                    let value = self.getFieldValue(optionName) === "TRUE";
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }
                case "raw": {
                    try {
                        let value = eval(self.getFieldValue(optionName));
                        setValue(optionName, value, actionOptions, optionConfig.optional);
                    } catch(e) {
                        console.warn(e);
                    }
                    break;
                }

                case "propertyList": {
                    let propertyListBlock = self.getInputTargetBlock(optionName);

                    let value = {};

                    while(propertyListBlock != null) {
                        let code = Blockly.JavaScript.blockToCode(propertyListBlock, true);

                        try {
                            let json = JSON.parse(code);

                            let key = Object.keys(json)[0];
                            json[key] = eval(json[key]);

                            Object.assign(value, json);
                        } catch(e) {
                            console.warn(e);
                        }

                        propertyListBlock = propertyListBlock.getNextBlock();
                    }
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }

                case "enumValue": {
                    let value = self.getFieldValue(optionName+".value");
                    let realName = self.getFieldValue(optionName);
                    setValue(optionName+"."+realName, value, actionOptions, optionConfig.optional);
                    break;
                }

                case "enum": {
                    let value = self.getFieldValue(optionName);
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }

                case "range": {
                    let value = [];
                    value.push(parseFloat(self.getFieldValue(optionName+".min")));
                    value.push(parseFloat(self.getFieldValue(optionName+".max")));
                    setValue(optionName, value, actionOptions, optionConfig.optional);
                    break;
                }

                case "switch": {
                    let caseStatements = [];
                    let switchCaseBlock = self.getInputTargetBlock(optionName);
                    while(switchCaseBlock != null) {
                        let json = JSON.parse(Blockly.JavaScript.blockToCode(switchCaseBlock, true));

                        caseStatements.push(json);

                        switchCaseBlock = switchCaseBlock.getNextBlock();
                    }

                    if(optionName.startsWith("$")) {
                        actionOptions = caseStatements;
                    } else {
                        if(optionName.includes("$")) {
                            console.warn("Dragons ahead ($ option used with switch type):", optionName, )
                        }
                        setValue(optionName, caseStatements, actionOptions, optionConfig.optional);
                    }
                    break;
                }

                case "filter": {
                    let filterBlock = self.getInputTargetBlock(optionName);
                    if(filterBlock != null) {
                        try {
                            let json = JSON.parse(Blockly.JavaScript.blockToCode( filterBlock, true));
                            setValue(optionName, json, actionOptions, optionConfig.optional);
                        } catch(e) {
                            console.log(e);
                        }
                    }
                    break;
                }

                default:
                    console.warn("Unknown option type:", optionConfig.type);
            }
        });

        return actionOptions;
    }
}
