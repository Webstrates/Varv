class MirrorVerseAudioRouter {
    static toVarv(json) {
        let outputVarv = {"concepts": {"audioManager":{"actions":{}}}};

        function createConnectionNode(nodeId, index, connection, rootName) {
            let connectionActions = [];
            outputVarv.concepts.audioManager.actions[nodeId+"NodeConnection"+index] = connectionActions;

            if(typeof connection === "string") {
                connectionActions.push(connection+"NodeIn");
                createDecisionNode(connection, rootName);
            } else {
                connectionActions.push("selectOriginalAudioStream");
                let setAction = {"set":{}};
                setAction.set[rootName] = connection.value;
                connectionActions.push(setAction);
            }
        }

        function createDecisionNode(nodeId, rootName) {
            if(json.nodes != null) {
                let nodeData = json.nodes[nodeId];
                let nodeInActions = [];
                outputVarv.concepts.audioManager.actions[nodeId+"NodeIn"] = nodeInActions;

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
                    outputVarv.concepts.audioManager.actions[nodeId+"NodeDecision"+decisionIndex] = decisionActions;
                    nodeInActions.push(nodeId+"NodeDecision"+decisionIndex);

                    let where = {
                        "where": {
                            "property": nodeData.property,
                            "stopIfEmpty": true
                        }
                    };

                    where.where[decision.comparator] = decision.value;

                    decisionActions.push(where);

                    if(decision.connection != null) {
                        createConnectionNode(nodeId, decisionIndex, decision.connection, rootName);
                        decisionActions.push(nodeId + "NodeConnection" + decisionIndex);
                    }
                }
            }
        }

        if(json.rootConnections != null) {
            for(let rootName of Object.keys(json.rootConnections)) {
                let nodeId = json.rootConnections[rootName].connection;

                if(nodeId != null) {

                    let actionKey = rootName + "RootConnection";
                    outputVarv.concepts.audioManager.actions[actionKey] = [
                        nodeId + "NodeIn"
                    ];

                    try {
                        createDecisionNode(nodeId, rootName);
                    } catch (e) {
                        console.error(e);
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
