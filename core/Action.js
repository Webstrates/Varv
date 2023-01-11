<!DOCTYPE html>
<html>
    <head>
        <title>Varv library repository</title>
        <meta charset="UTF-8">
    </head>
    <body>
        <div class="packages">   
            <div class="package" id="varv">
                <script src="descriptor.json" type="descriptor"></script>
            </div>
            
            <div class="package" id="varv-engine">
                <script src="core/descriptor.json" type="descriptor"></script>
                <script src="core/VarvPerformance.js" type="disabled"></script>
                <script src="core/YAMLJSONConverter.js" type="disabled"></script>
                <script src="core/Concept.js" type="disabled"></script>
                <script src="core/Property.js" type="disabled"></script>
                <script src="core/PropertyCache.js" type="disabled"></script>
                <script src="core/Datastore.js" type="disabled"></script>
                <script src="core/DirectDatastore.js" type="disabled"></script>
                <script src="core/Trigger.js" type="disabled"></script>
                <script src="core/Filter.js" type="disabled"></script>
                <script src="core/Action.js" type="disabled"></script>
                <script src="core/Behaviour.js" type="disabled"></script>
                <script src="core/ConceptLoader.js" type="disabled"></script>
                <script src="core/VarvEngine.js" type="disabled"></script>
            </div>
            <div class="package" id="varv-builtin-actions">
                <script src="actions/descriptor.json" type="descriptor"></script>
                <script src="actions/ArrayActions.js" type="disabled"></script>
                <script src="actions/ContextActions.js" type="disabled"></script>
                <script src="actions/MathActions.js" type="disabled"></script>
                <script src="actions/PropertyActions.js" type="disabled"></script>
                <script src="actions/TextActions.js" type="disabled"></script>
                <script src="actions/TimingActions.js" type="disabled"></script>
                <script src="actions/FlowActions.js" type="disabled"></script>
                <script src="actions/CustomActions.js" type="disabled"></script>
                <script src="actions/DebugActions.js" type="disabled"></script>
            </div>
            <div class="package" id="varv-builtin-triggers">
                <script src="triggers/descriptor.json" type="descriptor"></script>
                <script src="triggers/TimingTriggers.js" type="disabled"></script>
                <script src="triggers/PropertyTriggers.js" type="disabled"></script>
                <script src="triggers/FlowTriggers.js" type="disabled"></script>
            </div>

            <!--------------------- Datastores ---------------->
            <div class="package" id="varv-dom">
                <script src="datastores/dom/descriptor.json" type="descriptor"></script>
                <script src="datastores/dom/DOMDataStore.js" type="disabled"></script>
            </div>   
            <div class="package" id="varv-dom-view">
                <script src="views/dom/descriptor.json" type="descriptor"></script>
                <script src="views/dom/DOMTriggers.js" type="disabled"></script>
                <script src="views/dom/DOMView.js" type="disabled"></script>
                <link href="views/dom/domview.scss" rel="stylesheet" type="text/css"/>                
            </div>             
            <div class="package" id="varv-memory">
                <script src="datastores/memory/descriptor.json" type="descriptor"></script>
                <script src="datastores/memory/MemoryDataStore.js" type="disabled"></script>
            </div>     
            <div class="package" id="varv-localstorage">
                <script src="datastores/localstorage/descriptor.json" type="descriptor"></script>
                <script src="datastores/localstorage/LocalStorageDataStore.js" type="disabled"></script>
            </div>            
            <div class="package" id="varv-cauldron">
                <script src="integration/cauldron/descriptor.json" type="descriptor"></script>
                <script src="integration/cauldron/ConceptTreeGenerator.js" type="disabled"></script>
                <script src="integration/cauldron/CauldronDatastore.js" type="disabled"></script>
                <script src="integration/cauldron/InspectorConceptBinding.js" type="disabled"></script>
                <script src="integration/cauldron/ConceptDecorator.js" type="disabled"></script>
                <script src="integration/cauldron/ConceptMenuActions.js" type="disabled"></script>
                <link href="integration/cauldron/base.scss" rel="stylesheet" type="text/css"/>
            </div>
            <div class="package" id="varv-cauldron-delayloader">
                <script src="integration/cauldron-delayloader/descriptor.json" type="descriptor"></script>
                <script src="integration/cauldron-delayloader/cauldron-delayloader.js" type="disabled"></script>
            </div>
            
            
            
            <div class="package" id="varv-codestrates-extensions">
                <script src="codestrates/descriptor.json" type="descriptor"></script>
                <script src="codestrates/ConceptDefinitionFragment.js" type="disabled"></script>
            </div>
            <div class="package" id="varv-blockly">
                <script src="codestrates/blockly-editor/descriptor.json" type="descriptor"></script>
                <script src="codestrates/blockly-editor/SVGIconButtonField.js" type="disabled"></script>
                <script src="codestrates/blockly-editor/blockly-editor.js" type="disabled"></script>
                <link href="codestrates/blockly-editor/blockly-editor.scss" rel="stylesheet" type="text/css"/>
                <inline src="codestrates/blockly-editor/blockly_editor_plus.svg"></inline>
            </div>
            <div class="package" id="varv-inspector">
                <link href="views/dom/inspector/inspector.css" rel="stylesheet" type="text/css"/>
                <script src="views/dom/inspector/descriptor.json" type="descriptor"></script>
                <script src="views/dom/inspector/Inspector.js" type="disabled"></script>
            </div>
            
            <div class="package" id="varv-giga">
                <script src="datastores/giga/descriptor.json" type="descriptor"></script>
                <script src="datastores/giga/GigaVarvDatastore.js" type="disabled"></script>
            </div>            
            <div class="package" id="varv-sql">
                <script src="datastores/sql/descriptor.json" type="descriptor"></script>
                <script src="datastores/sql/SQLDataStore.js" type="disabled"></script>
                <script src="datastores/sql/SQLFilter.js" type="disabled"></script>
            </div>    
            <div class="package" id="varv-location">
                <script src="datastores/location/descriptor.json" type="descriptor"></script>
                <script src="datastores/location/LocationDataStore.js" type="disabled"></script>
            </div>              
            
           <div class="package" id="varvscript">
                <script src="integration/varvscript/descriptor.json" type="descriptor"></script>
                <script src="integration/varvscript/varvscript.js" type="disabled"></script>
                <script src="integration/varvscript/VarvScriptFragment.js" type="disabled"></script>
            </div>                           
        </div>
    </body> 
</html> 
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               # Copyright 1999-2022 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

JAVA_PKG_IUSE="doc source"
MAVEN_ID="org.apache.tomcat:tomcat-el-api:10.1.2"

inherit java-pkg-2 java-pkg-simple verify-sig

DESCRIPTION="Tomcat's EL API 5.0 implementation"
HOMEPAGE="https://tomcat.apache.org/"
SRC_URI="mirror://apache/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz
	verify-sig? ( https://downloads.apache.org/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz.asc )"

LICENSE="Apache-2.0"
SLOT="5.0"
KEYWORDS="amd64 ~arm arm64 ppc64 x86 ~amd64-linux ~x86-linux ~x64-solaris ~x86-solaris"

DEPEND=">=virtual/jdk-11:*"
RDEPEND=">=virtual/jre-11:*"

BDEPEND="verify-sig? ( ~sec-keys/openpgp-keys-apache-tomcat-${PV}:${PV} )"
VERIFY_SIG_OPENPGP_KEY_PATH="${BROOT}/usr/share/openpgp-keys/tomcat-${PV}.apache.org.asc"

S="${WORKDIR}/apache-tomcat-${PV}-src"

JAVA_RESOURCE_DIRS="resources"
JAVA_SRC_DIR="java/jakarta/el"

src_prepare() {
	default
	# remove anything related to "el" or "jsp"
	find java/jakarta \( -name 'jsp' -o -name 'servlet' \) \
		-exec rm -rf {} + || die "removing jsp failed"

	mkdir resources || "creating \"resources\" failed"
	cp -r java/jakarta resources || "cannot copy to \"resources\" dir"
	find resources -name '*.java' -exec rm -rf {} + || die "removing *.java files failed"
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  # Copyright 1999-2022 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

JAVA_PKG_IUSE="doc source"
MAVEN_ID="org.apache.tomcat:tomcat-el-api:10.1.4"

inherit java-pkg-2 java-pkg-simple verify-sig

DESCRIPTION="Tomcat's EL API 5.0 implementation"
HOMEPAGE="https://tomcat.apache.org/"
SRC_URI="mirror://apache/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz
	verify-sig? ( https://downloads.apache.org/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz.asc )"

LICENSE="Apache-2.0"
SLOT="5.0"
KEYWORDS="~amd64 ~arm ~arm64 ~ppc64 ~x86 ~amd64-linux ~x86-linux ~x64-solaris ~x86-solaris"

DEPEND=">=virtual/jdk-11:*"
RDEPEND=">=virtual/jre-11:*"

BDEPEND="verify-sig? ( ~sec-keys/openpgp-keys-apache-tomcat-${PV}:${PV} )"
VERIFY_SIG_OPENPGP_KEY_PATH="${BROOT}/usr/share/openpgp-keys/tomcat-${PV}.apache.org.asc"

S="${WORKDIR}/apache-tomcat-${PV}-src"

JAVA_RESOURCE_DIRS="resources"
JAVA_SRC_DIR="java/jakarta/el"

src_prepare() {
	default
	# remove anything related to "el" or "jsp"
	find java/jakarta \( -name 'jsp' -o -name 'servlet' \) \
		-exec rm -rf {} + || die "removing jsp failed"

	mkdir resources || "creating \"resources\" failed"
	cp -r java/jakarta resources || "cannot copy to \"resources\" dir"
	find resources -name '*.java' -exec rm -rf {} + || die "removing *.java files failed"
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              # Copyright 1999-2022 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

JAVA_PKG_IUSE="doc source"
MAVEN_ID="org.apache.tomcat:tomcat-el-api:8.5.84"

inherit java-pkg-2 java-pkg-simple verify-sig

DESCRIPTION="Tomcat's EL API 3.0 implementation"
HOMEPAGE="https://tomcat.apache.org/"
SRC_URI="mirror://apache/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz
	verify-sig? ( https://downloads.apache.org/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz.asc )"

LICENSE="Apache-2.0"
SLOT="3.0"
KEYWORDS="amd64 ~arm arm64 ppc64 x86 ~amd64-linux ~x86-linux ~x64-solaris ~x86-solaris"

DEPEND=">=virtual/jdk-1.8:*"
RDEPEND=">=virtual/jre-1.8:*"

BDEPEND="verify-sig? ( ~sec-keys/openpgp-keys-apache-tomcat-${PV}:${PV} )"
VERIFY_SIG_OPENPGP_KEY_PATH="${BROOT}/usr/share/openpgp-keys/tomcat-${PV}.apache.org.asc"

S="${WORKDIR}/apache-tomcat-${PV}-src"

JAVA_RESOURCE_DIRS="resources"
JAVA_SRC_DIR="java/javax/el"

src_prepare() {
	default
	# remove anything related to "el" or "jsp"
	find java/javax \( -name 'jsp' -o -name 'servlet' \) \
		-exec rm -rf {} + || die "removing jsp failed"

	mkdir resources || "creating \"resources\" failed"
	cp -r java/javax resources || "cannot copy to \"resources\" dir"
	find resources -name '*.java' -exec rm -rf {} + || die "removing *.java files failed"
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      # Copyright 1999-2022 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

JAVA_PKG_IUSE="doc source"
MAVEN_ID="org.apache.tomcat:tomcat-el-api:9.0.69"

inherit java-pkg-2 java-pkg-simple verify-sig

DESCRIPTION="Tomcat's EL API 5.0 implementation"
HOMEPAGE="https://tomcat.apache.org/"
SRC_URI="mirror://apache/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz
	verify-sig? ( https://downloads.apache.org/tomcat/tomcat-$(ver_cut 1)/v${PV}/src/apache-tomcat-${PV}-src.tar.gz.asc )"

LICENSE="Apache-2.0"
SLOT="3.0"
KEYWORDS="amd64 ~arm arm64 ppc64 x86 ~amd64-linux ~x86-linux ~x64-solaris ~x86-solaris"

DEPEND=">=virtual/jdk-1.8:*"
RDEPEND=">=virtual/jre-1.8:*"

BDEPEND="verify-sig? ( ~sec-keys/openpgp-keys-apache-tomcat-${PV}:${PV} )"
VERIFY_SIG_OPENPGP_KEY_PATH="${BROOT}/usr/share/openpgp-keys/tomcat-${PV}.apache.org.asc"

S="${WORKDIR}/apache-tomcat-${PV}-src"

JAVA_RESOURCE_DIRS="resources"
JAVA_SRC_DIR="java/javax/el"

src_prepare() {
	default
	# remove anything related to "el" or "jsp"
	find java/javax \( -name 'jsp' -o -name 'servlet' \) \
		-exec rm -rf {} + || die "removing jsp failed"

	mkdir resources || "creating \"resources\" failed"
	cp -r java/javax resources || "cannot copy to \"resources\" dir"
	find resources -name '*.java' -exec rm -rf {} + || die "removing *.java files failed"
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            