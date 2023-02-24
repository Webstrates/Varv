class ScopedParseNode extends ParseNode {
    constructor(templateElement){
        super(templateElement); 
    }
    
    getView(targetDocument, scope){
        if (DOMView.DEBUG) console.log("instantiating scopedparsenode abstract view for ", this.templateElement);
        let self = this;        
        let view = new ViewParticle(targetDocument.createProcessingInstruction("varv-scope-anchor", {}), this, scope);
        view.topGuardElement = view.getTargetDocument().createProcessingInstruction("varv-scope-topguard", {});
        view.childViews = [];        
        this.generateScopes(view);
        
        view.addOnMountedCallback(()=>{
            // Plain move everything to new parent
            view.getNode().parentElement.insertBefore(view.topGuardElement, view.getNode());
            view.childViews.forEach((childView)=>{
                // Insert them before our anchor node
                childView.mountInto(view.getNode().parentElement, view.getNode());
            });
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
                
        // Add new views for newly added scopes while reordering
        if (DOMView.DEBUG) console.log("Updating view scope, old=>new",view.childViews, newChildScopes);
        let oldChildViews = view.childViews;
        view.childViews = [];
        newChildScopes.forEach((newChildScope)=>{
            let existingView = false;
            oldChildViews.forEach((childView)=>{
                if (ScopedParseNode.fastDeepEqual(childView.localScope,newChildScope)) existingView = childView;
            });
            if (existingView){
                view.childViews.push(existingView);
            } else {
                let childView = self.children[0].getView(view.getTargetDocument(),[...view.scope, ...newChildScope]);
                childView.localScope = newChildScope;
                view.childViews.push(childView);
            }            
        });
        
        this.stubResetView(view);
    }
    
    stubResetView(view){
        if (view.getNode().parentNode === null) return; // Not in any document yet
        
        let parent = view.getNode().parentNode;
        let potentiallyInvalid = [...view.childViews];
        let viewCount = view.childViews.length;
             
        for (let i = 0; i < viewCount; i++){
            console.log("Validating view", view.childViews[i]);
            let alreadyMountedCorrectly = true;
            
            // A view is mounted correctly if it is mounted here and no view that is supposed to be later is mounted before it
            if (view.childViews[i].getNode().parentElement!==parent){
                console.log("Wrong parent",view.childViews[i].getNode().parentElement);
                alreadyMountedCorrectly = false;
            }
            let anchorIndex = [...parent.childNodes].indexOf(view.childViews[i].getNode());
            if (i!==viewCount-1){
                for (let o = i+1; o < viewCount; o++){
                    let thisIndex = [...parent.childNodes].indexOf(view.childViews[o].getNode());
                    if (thisIndex < anchorIndex && view.childViews[o].getNode().parentElement===parent) {
                        console.log("Wrong location, found",anchorIndex, thisIndex,view.childViews[o].getNode());
                        
                        alreadyMountedCorrectly = false;
                        break;
                    }
                }
            }
            
            // If not mounted correctly, mount after previous view (or top guard if first view)
            if (!alreadyMountedCorrectly){
                let mountAfter = view.topGuardElement;                
                if (i!==0){
                    mountAfter = view.childViews[i-1].getNode();
                }
                view.childViews[i].mountInto(view.getNode().parentElement, mountAfter.nextSibling);
            }
        }

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