class AudioRouterFragment extends Fragment {
    constructor(html) {
        super(html);
    }

    async require(options = {}) {
        let fragment = Fragment.create(ConceptDefinitionFragment.type());

        fragment.raw = JSON.stringify(MirrorVerseAudioRouter.toVarv(JSON.parse(this.raw)));
        fragment.auto = true;

        return fragment.html[0];
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