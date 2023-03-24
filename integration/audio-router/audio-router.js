class MirrorVerseAudioRouter {
    static toVarv(json) {
        let outputVarv = {"concepts": {"audioManager":{"actions":{}}}};

        let usedNames = new Set();
        let uniqueIdMap = new Map();
        let alreadySetup = new Set();

        function getUniqueId(nodeId, nodeData) {
            if(uniqueIdMap.has(nodeId)) {
                return uniqueIdMap.get(nodeId);
            }

            let uniqueId = nodeId;

            if(nodeData.name != null && nodeData.name.length > 0) {
                uniqueId = nodeData.name;

                if(usedNames.has(uniqueId)) {
                    let i = 1;
                    while(usedNames.has(uniqueId+""+i)) {
                        i++;
                    }
                    uniqueId = uniqueId+""+i;
                }
            }

            usedNames.add(uniqueId);
            uniqueIdMap.set(nodeId, uniqueId);

            return uniqueId;
        }

        function createConnectionNode(uniqueId, index, nodeId, rootName) {
            let connectionActions = [];
            outputVarv.concepts.audioManager.actions[uniqueId+"NodeConnection"+index] = connectionActions;

            if(typeof nodeId === "string") {
                let nodeData = json.nodes[nodeId];
                let uniqueId = getUniqueId(nodeId, nodeData);

                if(nodeData.nodeType === "DecisionNode") {
                    connectionActions.push(uniqueId+"NodeIn");

                    if(alreadySetup.has(nodeId)) {
                        return;
                    }
                    alreadySetup.add(nodeId);

                    createDecisionNode(nodeData, uniqueId, rootName);
                } else {
                    //Value node
                    connectionActions.push("selectOriginalAudioStream");
                    let setAction = {"set":{}};

                    let value = nodeData.value;

                    if(rootName === "volume") {
                        value = parseFloat(value);
                    }

                    setAction.set[rootName] = nodeData.value;
                    connectionActions.push(setAction);
                }
            }
        }

        function createDecisionNode(nodeData, uniqueId, rootName) {
            let nodeInActions = [];
            outputVarv.concepts.audioManager.actions[uniqueId+"NodeIn"] = nodeInActions;

            //Select correct node
            switch(nodeData.concept) {
                case "client":
                    nodeInActions.push("selectClient")
                    break;
                case "currentRoom":
                    nodeInActions.push("selectCurrentRoom")
                    break;
                case "toolManager":
                    nodeInActions.push("selectToolManager")
                    break;
                default:
                    console.warn("Unknown concept:", nodeData.concept);
            }

            //Push decisions
            for(let decisionIndex = 1; decisionIndex<nodeData.decisions.length+1; decisionIndex++) {
                let decision = nodeData.decisions[decisionIndex-1];

                let decisionActions = [];
                outputVarv.concepts.audioManager.actions[uniqueId+"NodeDecision"+decisionIndex] = decisionActions;
                nodeInActions.push({"run": uniqueId+"NodeDecision"+decisionIndex});

                let where = {
                    "where": {
                        "property": nodeData.property,
                        "stopIfEmpty": true
                    }
                };

                where.where[decision.comparator] = decision.value;

                decisionActions.push(where);

                if(decision.connection != null) {
                    createConnectionNode(uniqueId, decisionIndex, decision.connection, rootName);
                    decisionActions.push(uniqueId + "NodeConnection" + decisionIndex);
                }
            }
        }

        if(json.rootConnections != null) {
            for(let rootName of Object.keys(json.rootConnections)) {
                let nodeId = json.rootConnections[rootName].connection;

                if(nodeId != null) {

                    if(json.nodes != null) {
                        let nodeData = json.nodes[nodeId];
                        let uniqueId = getUniqueId(nodeId, nodeData);

                        let actionKey = rootName + "RootConnection";
                        outputVarv.concepts.audioManager.actions[actionKey] = [
                            uniqueId + "NodeIn"
                        ];

                        try {
                            createDecisionNode(nodeData, uniqueId, rootName);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                }
            }
        }

        console.log("Compiled varv:", outputVarv);

        return outputVarv;
    }

    static concepts() {
        return Object.assign({}, MirrorVerseAudioRouter.conceptPropertyList);
    }
}

MirrorVerseAudioRouter.conceptPropertyList = {
    "client": [
        "name",
        "local",
        "muted",
        "logicalDistance",
        "logicalVolume",
        "analyserVolume",
        "inHoveredRoom",
        "distance",
        "onPedestal",
        "whisperTarget",
        "broadcasting"
    ],
    "currentRoom": [
        "name",
        "audioFilter"
    ],
    "toolManager": [
        "listeningInActive",
        "listeningInHoveredExists",
        "gatherActive",
        "whisperActive",
        "whisperTargeted",
        "whisperTargetedBy"
    ]
};

window.MirrorVerseAudioRouter = MirrorVerseAudioRouter;
