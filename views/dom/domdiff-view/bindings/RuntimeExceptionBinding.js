class RuntimeExceptionBinding {
    constructor(errorMessage, ex) {
        this.errorMessage = errorMessage;
        this.ex = ex;
    }

    hasBindingFor(name) {
        return false;
    }

    getValueFor(name) {
        throw new Error("Unsupported operation");
    }
}

window.RuntimeExceptionBinding = RuntimeExceptionBinding;