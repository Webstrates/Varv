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
        let changes = 0;
                      
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
                oldChildViews.splice(oldChildViews.indexOf(existingView),1);
                view.childViews.push(existingView);
            } else {
                view.childViews.push(()=>{
                    /**
                     * Very specific performance optimization:
                     * TODO: If the only change in the scope is a PropertyArrayEntryBinding index on the top of the scope stack
                     * we can migrate the view by performing binding updates instead of destroying it and recreating it here.
                     * This happens often when reordering list entries.
                     */
                    let newLastOfScope = newChildScope[newChildScope.length-1];
                    if (newLastOfScope instanceof PropertyArrayEntryBinding){
                        for (let oldChildView of oldChildViews){
                            let oldLastOfScope = oldChildView.localScope[oldChildView.localScope.length-1];
                            if (oldLastOfScope instanceof PropertyArrayEntryBinding){
                                if (oldLastOfScope.identicalExceptIndex(newLastOfScope)){
                                    // Identical tops (except index), compare rest of their localScope                                    
                                    if (DOMView.DEBUG || DOMView.DEBUG_PERFORMANCE) console.log("Could optimize maybe", newChildScope, oldChildView.localScope);
                                    if (ScopedParseNode.fastDeepEqual(newChildScope.slice(0,-1),oldChildView.localScope.slice(0,-1))){
                                        if (DOMView.DEBUG || DOMView.DEBUG_PERFORMANCE) console.log("Optimized",oldChildView);
                                        oldChildViews.splice(oldChildViews.indexOf(oldChildView),1);
                                        oldLastOfScope.updateIndex(newLastOfScope.index);
                                        return oldChildView;
                                    }
                                }                                
                            }
                        };
                    }
                    // /very specific performance optimization
                    
                    // Couldn't recover anything, just create a new view
                    let childView;
                    if (newLastOfScope instanceof RuntimeExceptionBinding){
                        childView = self.getErrorView(view.getTargetDocument(), [...view.scope, ...newChildScope], newLastOfScope.errorMessage, newLastOfScope.ex);
                    } else {
                        childView = self.children[0].getView(view.getTargetDocument(),[...view.scope, ...newChildScope]);
                    }
                    changes++;
                    childView.localScope = newChildScope;
                    return childView;
                });
            }            
        });
        
        // Run optimizing functions
        view.childViews = view.childViews.map((value)=>{
            if (typeof(value)==="function") return value();
            return value;
        });
        
        for (let i = oldChildViews.length-1; i>=0; i--){
            let found = false;
            view.childViews.forEach((childView)=>{
                if (childView===oldChildViews[i]) found = true;
            });
            if (!found){         
                oldChildViews[i].destroy();
                oldChildViews.splice(i,1);
                changes++;                
            }
        }        
        if (oldChildViews.length!==0) console.log("FIXME: DOMView oldChildViews postcondition inconsistency detected: 0!="+oldChildViews.length,oldChildViews);
        
        if ((DOMView.DEBUG||DOMView.DEBUG_PERFORMANCE) && changes===0 && newChildScopes.length>0){
            try { 
                console.log("FIXME: DOMDiffView: Potential performance optimization for ScopedParseNode. onScopesUpdated() called but returned no change in scope",this);
                throw new Error("stacktrace");
            } catch (ex) {
                console.log(ex);
            }
        }
        
        this.stubResetView(view);
    }
    
    stubResetView(view){
        if (view.getNode().parentNode === null) return; // Not in any document yet
        
        let parent = view.getNode().parentNode;
        let viewCount = view.childViews.length;
             
        for (let i = 0; i < viewCount; i++){
            if (DOMView.DEBUG) console.log("Validating view", view.childViews[i]);
            let alreadyMountedCorrectly = true;
            
            // A view is mounted correctly if it is mounted here and no view that is supposed to be later is mounted before it
            if (view.childViews[i].getNode().parentElement!==parent){
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
        console.log(ex);
        this.onScopesUpdated(view, []);
        view.childViews.push(this.getErrorView(view.getTargetDocument(), view.scope, message, ex));
        this.stubResetView(view);        
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
            if (key.startsWith("_")) continue;
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