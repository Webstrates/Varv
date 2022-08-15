/**
 *  DebugActions - Actions that make debugging easier
 * 
 *  This code is licensed under the MIT License (MIT).
 *  
 *  Copyright 2020, 2021, 2022 Rolf Bagge, Janus B. Kristensen, CAVI,
 *  Center for Advanced Visualization and Interaction, Aarhus University
 *  
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the “Software”), to deal
 *  in the Software without restriction, including without limitation the rights 
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell 
 *  copies of the Software, and to permit persons to whom the Software is 
 *  furnished to do so, subject to the following conditions:
 *  
 *  The above copyright notice and this permission notice shall be included in 
 *  all copies or substantial portions of the Software.
 *  
 *  THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, 
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN 
 *  THE SOFTWARE.
 *  
 */

/**
 * Actions related to debugging or benchmarking
 * @namespace DebugActions
 */

/**
 * An action "debugConcept" that prints the currently selected concepts to the console.
 * @memberOf DebugActions
 *
 * @example
 * {
 *     "debugConcept"
 * }
 */
class DebugConceptAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            console.groupCollapsed("ConceptDebug:", context.target);

            let concept = await VarvEngine.getConceptFromUUID(context.target);

            for(let key of concept.properties.keys()) {
                let property = concept.properties.get(key);
                let value = await property.getValue(context.target);
                console.log(key, "->", value);
            }

            console.groupEnd();

            return context;
        });
    }

    static options() {
        return {
        };
    }
}
Action.registerPrimitiveAction("debugConcept", DebugConceptAction);
window.DebugConceptAction = DebugConceptAction;

/**
 * An action "debugContext" that prints the current context to the console
 * @memberOf DebugActions
 * @example
 * {
 *     "debugContext"
 * }
 */
class DebugContextAction extends Action {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        console.groupCollapsed("ContextDebug");
        console.log("Contexts:", contexts.map((context)=>{return Action.cloneContext(context)}));
        console.log("ActionArguments:",actionArguments);
        console.log("SavedVariables:", contexts.savedVariables);

        console.group("forEachContext:")
        const result = await this.forEachContext(contexts, actionArguments, async (context, options)=>{

            console.log(JSON.parse(JSON.stringify(context)));

            return context;
        });
        console.groupEnd();

        console.groupEnd();

        return result;
    }

    static options() {
        return {
        };
    }
}
Action.registerPrimitiveAction("debugContext", DebugContextAction);
window.DebugContextAction = DebugContextAction;

/**
 * An action "debugMessage" that can debug a message to the console
 * @memberOf DebugActions
 * @example
 * {
 *     "debugMessage": {
 *         "message": "The message to debug"
 *     }
 * }
 *
 * @example
 * //Shorthand version
 * {
 *     "debugMessage": "The message to debug"
 * }
 */
class DebugMessageAction extends Action {
    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "string"){
            options = {
                message: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments) {
        if(this.options.bulk) {
            console.log(this.options.message);
            return contexts;
        }

        return this.forEachContext(contexts, actionArguments, async (context, options)=>{
            let message = options.msg;

            if(options.message != null) {
                message = options.message;
            }
            console.log(message);

            return context;
        });
    }

    static options() {
        return {
            "message": "string"
        };
    }
}
Action.registerPrimitiveAction("debugMessage", DebugMessageAction);
window.DebugMessageAction = DebugMessageAction;

/**
 * An action 'varvPrefix' that sets the current prefix to VarvPerformance logging.
 * @memberOf DebugActions
 * @example
 * // Set the VarvPerformance prefix to "myPrefix"
 *
 * {
 *     "varvPrefix": "myPrefix"
 * }
 *
 * @example
 * // Remove the current VarvPerformance prefix
 *
 * {
*       "varvPrefix": ""
 * }
 */
class VarvPerformancePrefix extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            options = {
                prefix: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let common = Action.getCommonVariables(contexts);
        options = await Action.lookupVariables(options, {variables: common, target: null});

        VarvPerformance.prefix = options.prefix

        return contexts;
    }
}
Action.registerPrimitiveAction("perfPrefix", VarvPerformancePrefix);
window.VarvPerformancePrefix = VarvPerformancePrefix;

/**
 * An action 'repeat' that can run a set of actions a number of times
 * @memberOf DebugActions
 * @example
 * // Runs the action "someAction" 10 times
 * {
 *     "repeat": {
 *         iterations: 10,
 *         actions: [
 *             "someAction"
 *         ]
 *     }
 * }
 */
class RepeatAction extends Action {
    constructor(name, options, concept) {
        const defaultOptions = {
            iterations: 1,
            actions: []
        };

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments = {}) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let actionOptions = options.actions;

        delete options.actions;

        let common = Action.getCommonVariables(contexts);
        options = await Action.lookupVariables(options, {variables: common, target: null});

        if(typeof options.iterations !== "number" || options.iterations <= 0) {
            throw new Error("RepeatAction is missing options iterations, must be a number larger than 0");
        }

        if(!Array.isArray(options.actions)) {
            options.actions = [options.actions];
        }

        let action = ConceptLoader.parseAction(UUIDGenerator.generateUUID("RepeatActions"), actionOptions, this.concept);

        let clonedContext = Action.cloneContext(contexts);

        for(let i = 0; i<options.iterations; i++) {

            await ActionTrigger.before(action, clonedContext);
            let mark = VarvPerformance.start();
            clonedContext = await action.apply(clonedContext);
            if (action.isPrimitive) {
                VarvPerformance.stop("PrimitiveAction-" + action.name, mark);
            } else {
                VarvPerformance.stop("CustomAction-" + action.name, mark);
            }
            await ActionTrigger.after(action, clonedContext);
        }

        return clonedContext;
    }
}
Action.registerPrimitiveAction("repeat", RepeatAction);
window.RepeatAction = RepeatAction;

/**
 * An action 'profile' that starts or stops the javascript profiler, supports only 1 profile running at a time
 * if another profile is running, that is stopped first before starting a new.
 * @memberOf DebugActions
 * @example
 * // Starts the profiler, and gives it the given name
 * {
 *     "profile": {
 *         "name": "A name for your profile"
 *     }
 * }
 *
 * @example
 * // Starts the profiler, and gives it the given name, shorthand version
 * {
 *     "profile": "A name for your profile"
 * }
 *
 * @example
 * // Stops the currently running profile
 * {
 *     "profile": null
 * }
 */
class ProfileAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            options = {
                "name": options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let common = Action.getCommonVariables(contexts);
        options = await Action.lookupVariables(options, {variables: common, target: null});

        if(console.profile == null) {
            console.warn("console.profile not supported");
        } else {
            //Stop any current profile
            if (ProfileAction.currentProfile != null) {
                console.profileEnd(ProfileAction.currentProfile);
                ProfileAction.currentProfile = null;
            }

            //Start new profile if requested
            if(options.name != null) {
                console.profile(options.name);
                ProfileAction.currentProfile = options.name;
            }
        }

        return contexts;
    }
}
ProfileAction.currentProfile = null;
Action.registerPrimitiveAction("profile", ProfileAction);
window.ProfileAction = ProfileAction;

/**
 * An action 'timer' that is used to record time between 2 points, only 1 timer is supported at a time
 * If another timer is running when a new one is to be started, the old timer is stopped first.
 * When the timer is stopped, the duration is debugged into the console
 * @memberOf DebugActions
 * @example
 * // Stats a timer, and names it "myTimerName"
 * {
 *     "timer": {
 *         "name": "myTimerName"
 *     }
 * }
 *
 * @example
 * // Stats a timer, and names it "myTimerName", shorthand
 * {
 *     "timer": "myTimerName"
 * }
 */
class TimerAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            options = {
                name: options
            }
        }

        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let common = Action.getCommonVariables(contexts);
        options = await Action.lookupVariables(options, {variables: common, target: null});

        //Stop any current timer
        if (TimerAction.currentTimer != null) {
            console.timeEnd(TimerAction.currentTimer);
            TimerAction.currentTimer = null;
        }

        //Start new timer if requested
        if(options.name != null) {
            console.time(options.name);
            TimerAction.currentTimer = options.name;
        }

        return contexts;
    }
}
TimerAction.currentTimer = null;
Action.registerPrimitiveAction("timer", TimerAction);
window.TimerAction = TimerAction;

/**
 * An action 'group' that can start/stop console groups. Only supports one group at a time, if another group is open, this will be closed first.
 * @memberOf DebugActions
 *
 * @example
 * // Starts a new console group "myGroupName" non collapsed
 * {
 *     "group": {
 *         "name": "myGroupName",
 *         "collapse": false
 *     }
 * }
 *
 * @example
 * // Starts a new console group "myGroupName" non collapsed, shorthand
 * {
 *     "group": "myGroupName"
 * }
 *
 * @example
 * // Closes the current group
 * {
 *     "group": null
 * }
 */
class GroupAction extends Action {
    constructor(name, options, concept) {
        if(typeof options === "string") {
            options = {
                name: options
            }
        }

        let defaultOptions =  {
            collapse: false
        };

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments = {}) {
        let options = await Action.lookupArguments(this.options, actionArguments);

        let common = Action.getCommonVariables(contexts);
        options = await Action.lookupVariables(options, {variables: common, target: null});

        //Stop any current profile
        if (GroupAction.currentGroup != null) {
            console.groupEnd();
            GroupAction.currentGroup = null;
        }

        //Start new profile if requested
        if(options.name != null) {
            if(options.collapse) {
                console.groupCollapsed(options.name);
            } else {
                console.group(options.name);
            }
            GroupAction.currentGroup = options.name;
        }

        return contexts;
    }
}
GroupAction.currentGroup = null;
Action.registerPrimitiveAction("group", GroupAction);
window.GroupAction = GroupAction;

/**
 * An action 'assert' that can be used to check that some state is as expected, uses filters
 * @memberOf DebugActions
 *
 * @example
 * // Assert that the property "myProperty" is less than 10
 * {
 *     "assert": {
 *         "where": {
 *             "property": "myProperty",
 *             "lessThan": 10
 *         }
 *     }
 * }
 */
class AssertAction extends Action {
    constructor(name, options, concept) {
        if(options.where == null) {
            //Lets assume we got the filter directly
            options = {
                where: options
            }

            if(options.where.showAndReset != null) {
                options.showAndReset = options.where.showAndReset;
                delete options.where.showAndReset;
            }
        }

        let defaultOptions = {
            where: null,
            showAndReset: false
        };

        super(name, Object.assign({}, defaultOptions, options), concept);
    }

    async apply(contexts, actionArguments = {}) {
        let self = this;

        if (this.options.showAndReset === true) {
            let color = "background: green; color: white;";

            if (AssertAction.failed > 0) {
                color = "background: red; color: white;";
            }

            console.log("%c Successfull asserts: " + (AssertAction.total - AssertAction.failed) + "/" + AssertAction.total, color);
            AssertAction.total = 0;
            AssertAction.failed = 0;

            return contexts;
        } else {
            return this.forEachContext(contexts, actionArguments, async (context, options, index)=>{
                AssertAction.total++;

                if(options.where == null) {
                    throw new Error("Missing option 'where' on action 'assert'")
                }

                let filter = FilterAction.constructFilter(options.where);

                let pass = await filter.filter(context, self.concept, true);
                if(!pass) {
                    AssertAction.failed++;
                }

                return context;
            });
        }
    }
}
Action.registerPrimitiveAction("assert", AssertAction);
window.AssertAction = AssertAction;
AssertAction.failed = 0;
AssertAction.total = 0;

/**
 * An action 'assertException' that works like 'run' but asserts that the action chain called by run, should throw an exception.
 *
 * @example
 * {
 *     "assertException": {
 *         "action": "myExceptionThrowingAction"
 *     }
 * }
 */
class AssertExceptionAction extends RunAction {
    constructor(name, options, concept) {
        super(name, options, concept);
    }

    async apply(contexts, actionArguments = {}) {
        let exception = false;

        try {
            await super.apply(contexts, actionArguments);
        } catch(e) {
            //Exception
            exception = true;
        }

        if(!exception) {
            console.assert(false, "No error, when one was expected!");
            AssertAction.failed++;
        }

        AssertAction.total++;

        return contexts;
    }
}
Action.registerPrimitiveAction("assertException", AssertExceptionAction);
window.AssertExceptionAction = AssertExceptionAction;
