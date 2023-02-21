class ScopedParseNode extends ParseNode {
    constructor(templateElement){
        super(templateElement); 
    }
    
    getView(targetDocument, scope){
        console.log("instantiating scopedparsenode abstract view for ", this.templateElement);
        let self = this;        
        let view = new ViewParticle(targetDocument.createProcessingInstruction("varv-scope-anchor", {}), this, scope);
        view.childViews = [];        
        this.generateScopes(view);
        
        view.addOnMountedCallback(()=>{
            self.stubResetView(view);
        });
        view.addCleanup(()=>{
            // Empty the view
            self.onScopesUpdated(view, []);
        });
        return view;
    }

    onScopesUpdated(view, newChildScopes){      
        // Destroy views that are no longer in the new child scopes
        let self = this;
        for (let i = view.childViews.length-1; i>=0; i--){
            let found = false;
            newChildScopes.forEach((newChildScope)=>{
                if (ScopedParseNode.fastDeepEqual(view.childViews[i].localScope,newChildScope)) found = true;
            });
            if (!found){         
                view.childViews[i].destroy();
                view.childViews.splice(i,1);
            }
        }
                
        // Move scopes that are in the child list but wrong order
        // TODO: Actually reorder views

        // Add new views for newly added scopes
        // TODO: Actually insert in correct place
        console.log("Updating view scope, old=>new",view.childViews, newChildScopes);
        newChildScopes.forEach((newChildScope)=>{
            let found = false;
            view.childViews.forEach((childView)=>{
                if (ScopedParseNode.fastDeepEqual(childView.localScope,newChildScope)) found = true;
            });
            if (!found){
                let childView = self.children[0].getView(view.getTargetDocument(),[...view.scope, ...newChildScope]);
                childView.localScope = newChildScope;
                view.childViews.push(childView);
            }            
        });
        
        this.stubResetView(view);
    }
    
    stubResetView(view){
        if (view.getNode().parentNode === null) return; // Not in any document yet
        
        // Move all our children with us, in order
        view.childViews.forEach((childView)=>{
            // Insert them before our anchor node
            childView.mountInto(view.getNode().parentNode, view.getNode());
        });
        
        view.onRendered();
    }
    
    showError(view, message, ex){
        this.onScopesUpdated(view, []);
        view.childViews.push(this.getErrorView(view.getTargetDocument(), view.scope, message, ex));
        this.stubResetView(view);        
        console.log(ex);
    }
    
    static fastDeepEqual(a,b){
        if (a === b) return true;

        if (a && b && typeof a == 'object' && typeof b == 'object') {
          if (a.constructor !== b.constructor) return false;

          var length, i, keys;
          if (Array.isArray(a)) {
            length = a.length;
            if (length != b.length) return false;
            for (i = length; i-- !== 0;)
              if (!ScopedParseNode.fastDeepEqual(a[i], b[i])) return false;
            return true;
          }

          if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
          if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
          if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();

          keys = Object.keys(a);
          length = keys.length;
          if (length !== Object.keys(b).length) return false;

          for (i = length; i-- !== 0;)
            if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;

          for (i = length; i-- !== 0;) {
            var key = keys[i];

            if (!ScopedParseNode.fastDeepEqual(a[key], b[key])) return false;
          }

          return true;
        }

        if(typeof a === "function" && typeof b === "function") {
            return true;
        }

        // true if both NaN, false otherwise
        return a!==a && b!==b;
        
    };
};

window.ScopedParseNode = ScopedParseNode;