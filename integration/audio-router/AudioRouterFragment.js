class AudioRouterFragment extends Fragment {
    constructor(html) {
        super(html);

        //Setup raw on start
        this.oldRaw = this.raw;
    }

    async require(options = {}) {
        let fragment = Fragment.create(ConceptDefinitionFragment.type());

        let json = null;

        try {
            json = JSON.parse(this.raw);
        } catch(e) {
            console.warn("Unable to parse json:", this.raw);
            json = {};
        }

        if(options.pretty) {
            fragment.raw = JSON.stringify(MirrorVerseAudioRouter.toVarv(json), null, 2);
        } else {
            fragment.raw = JSON.stringify(MirrorVerseAudioRouter.toVarv(json));
        }
        fragment.auto = true;

        return fragment.html[0];
    }

    setupAutoDomHandling() {
        if(!this.supportsAutoDom()) {
            return;
        }

        let self = this;

        function sanitize(jsonRaw) {
            let json = JSON.parse(jsonRaw);

            if(json.unused != null) {
                json.unused.forEach((unused) => {
                    if (unused.type === "DecisionNode") {
                        delete json.nodes[unused.id];
                    }
                });
            }

            return JSON.stringify(json, (key, value)=>{
                if(key === "position") {
                    return null;
                }
                if(key === "unused") {
                    return null;
                }
                return value;
            }, 0);
        }

        this.registerOnFragmentChangedHandler((context) => {
            //Check if really updated, or just a position change
            let sanitizedNew = null;
            try {
                sanitizedNew = sanitize(self.raw);
            } catch(e) {
                console.warn(e);
            }

            let sanitizedOld = null;

            try {
                sanitizedOld = sanitize(this.oldRaw);
            } catch(e) {
                console.warn(e);
            }

            if(sanitizedOld !== sanitizedNew) {
                //Save new raw
                this.oldRaw = this.raw;
                self.autoDomDirty = true;
                if (self.auto && !Fragment.disableAutorun) {
                    self.insertAutoDom();
                }
            }
        });
    }

    supportsAutoDom() {
        return true;
    }

    static type() {
        return "text/mirrorverse-audio-router";
    }
}
window.AudioRouterFragment = AudioRouterFragment;
MonacoEditor.registerExtraType(AudioRouterFragment.type(), "json");
Fragment.registerFragmentType(AudioRouterFragment);
