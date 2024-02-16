class JSXQueryParseNode extends QueryParseNode {
    constructor(reactParamsObject, scopeUpdateCallback){
        super({
            getAttribute: (attribute)=>reactParamsObject.hasOwnProperty(attribute)?reactParamsObject[attribute]:null
        });
        this.scopeUpdateCallback = scopeUpdateCallback;
    }

    onScopesUpdated(view, newChildScopes){ 
        this.scopeUpdateCallback(newChildScopes);
    }
}

window.JSXQueryParseNode = JSXQueryParseNode;