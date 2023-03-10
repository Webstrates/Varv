class MirrorVerseAudioRouter {
    static toVarv(json) {
        let outputVarv = {"concepts": {"audioManager":{"actions":{}}}};

        let usedNames = new Set();

        function getUniqueId(nodeData) {
            let uniqueId = nodeData.id;

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

            return uniqueId;
        }

        function createConnectionNode(uniqueId, index, connection, rootName) {
            let connectionActions = [];
            outputVarv.concepts.audioManager.actions[uniqueId+"NodeConnection"+index] = connectionActions;

            if(typeof connection === "string") {
                let nodeData = json.nodes[connection];
                let uniqueId = getUniqueId(nodeData);

                connectionActions.push(uniqueId+"NodeIn");
                createDecisionNode(nodeData, uniqueId, rootName);
            } else {
                connectionActions.push("selectOriginalAudioStream");
                let setAction = {"set":{}};
                setAction.set[rootName] = connection.value;
                connectionActions.push(setAction);
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
                        let uniqueId = getUniqueId(nodeData);

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
        return {
            "client": [
                    "name",
                    "local",
                    "muted",
                    "logicalDistance",
                    "logicalVolume",
                    "analyserVolume",
                    "inHoveredRoom",
                    "distance"
            ],
            "currentRoom": [
                "name",
                "audioFilter"
            ],
            "toolManager": [
                "listeningIn",
                "gather"
            ]
        }
    }
}
window.MirrorVerseAudioRouter = MirrorVerseAudioRouter;
