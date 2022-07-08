/**
 *  Timing Triggers - triggers based on time
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
 * A trigger 'interval' that triggers at a given interval, this trigger event has no target.
 * @memberOf Triggers
 * @example
 * //Trigger every 10 seconds
 * {
 *     "interval": 10
 * }
 */
class IntervalTrigger extends Trigger {
    static options() {
        return {
            "interval": "number"
        }
    }

    constructor(name, options, concept) {
        //Shorthand
        if(typeof options === "number") {
            options = {
                interval: options
            }
        }

        super(name, options, concept);

        this.intervalId = null;
    }

    enable() {
        const self = this;

        let interval = this.options.interval;

        let currentRepetition = 0;

        this.intervalId = setInterval(async ()=>{
            await Trigger.trigger(self.name, {
                target: null,
                variables:{
                    repetition: currentRepetition
                }
            });

            currentRepetition++;
        }, interval);
    }

    disable() {
        if(this.intervalId != null) {
            clearInterval(this.intervalId);
        }
        this.intervalId = null;
    }
}
Trigger.registerTrigger("interval", IntervalTrigger);
window.IntervalTrigger = IntervalTrigger;
