class TemplateBinding {
    constructor(templateRootElement) {
        this.templateElement = templateRootElement;
    }
    
    getTemplateElement(){
        return this.templateElement;
    }

    hasBindingFor(name) {
        return false;
    }
}

window.TemplateBinding = TemplateBinding;