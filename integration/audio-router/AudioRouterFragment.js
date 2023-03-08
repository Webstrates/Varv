class AudioRouterFragment extends Fragment {
    constructor(html) {
        super(html);

        //Setup raw on start
        this.oldRaw = this.raw;
    }

    async require(options = {}) {
        let fragment = Fragment.create(ConceptDefinitionFragment.type());

        fragment.raw = JSON.stringify(MirrorVerseAudioRouter.toVarv(JSON.parse(this.raw)));
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
            let sanitizedNew = sanitize(self.raw);
            let sanitizedOld = sanitize(this.oldRaw);

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
