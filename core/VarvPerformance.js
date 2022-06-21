class VarvPerformance {
    static makeId(length) {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for ( let i = 0; i < length; i++ ) {
            result += characters.charAt(Math.floor(Math.random() *
                charactersLength));
        }
        return result;
    }

    static start() {
        if(!VarvPerformance.enabled) {
            return;
        }

        let mark = this.makeId(32);

        performance.mark(mark);

        return mark;
    }

    static stop(name, mark, details) {
        if(!VarvPerformance.enabled) {
            return;
        }

        let endMark = mark+"end";

        performance.mark(endMark);

        if(VarvPerformance.prefix.length > 0) {
            name = VarvPerformance.prefix+"."+name;
        }

        try {
            performance.measure(name, {
                start: mark,
                end: endMark,
                detail: JSON.stringify(details, (key, value) => {
                    if (typeof value === "object" && value?.hasOwnProperty("constructOptions")) {
                        return value.constructOptions;
                    }

                    return value;
                })
            });
        } catch(e) {
            performance.measure(name, mark, endMark);
        }
    }

    static showInternal(options, callback) {
        let defaultOptions = {
            regex: null,
            minInvocations: 0
        };

        options = Object.assign({}, defaultOptions, options);

        let measureMap = new Map();

        performance.getEntriesByType("measure").forEach((measure)=>{
            let list = measureMap.get(measure.name);
            if(list == null) {
                list = [];
                measureMap.set(measure.name, list);
            }

            list.push(measure);
        });

        let entryArray = Array.from(measureMap.entries());

        entryArray.sort((e1, e2)=>{
            let v1 = e1[1];
            let v2 = e2[1];

            return v2.length - v1.length;
        });

        entryArray.forEach((entry)=>{
            let measures = entry[1];
            let key = entry[0];

            if(measures.length < options.minInvocations) {
                return;
            }

            if(options.regex != null) {
                if(key.match(options.regex) == null) {
                    return;
                }
            }

            measures.sort((m1, m2)=>{
                return m2.duration - m1.duration;
            });

            callback(measures, key);
        });
    }

    static showDetails(options) {
        this.showInternal(options, (measures, key)=>{

            console.groupCollapsed(key+" x"+measures.length);

            measures.forEach((measure)=>{
                if(measure.detail != null) {
                    console.log(measure.duration.toFixed(3) + " ms - ", JSON.parse(measure.detail));
                } else {
                    console.log(measure.duration.toFixed(3) + " ms");
                }
            });

            console.groupEnd();
        });
    }

    static showStats(options) {
        let data = [];

        this.showInternal(options, (measures, key)=> {
            let measureDurations = measures.map((m)=>{
                return m.duration;
            });

            let min = 99999;
            let max = 0;
            let mean = 0;
            let median = -1;
            let sum = 0;

            measureDurations.forEach((d)=>{
                min = Math.min(min, d);
                max = Math.max(max, d);
                sum += d;
            });

            mean = sum / measureDurations.length;

            let middleIndex = Math.floor(measureDurations.length / 2);

            if(measureDurations.length % 2 === 1) {
                //Odd
                median = measureDurations[middleIndex];
            } else {
                //Even
                median = measureDurations[middleIndex-1]/2.0 + measureDurations[middleIndex] / 2.0;
            }

            data.push({
                "name": key,
                "invocations": measureDurations.length,
                "mean": +mean.toFixed(3),
                "min": +min.toFixed(3),
                "max": +max.toFixed(3),
                "median": +median.toFixed(3),
                "sum": +sum.toFixed(3)
            })
        });

        console.table(data);
    }

    static reset() {
        performance.clearMarks();
        performance.clearMeasures();
    }
}

VarvPerformance.enabled = false;
VarvPerformance.prefix = "";
window.VarvPerformance = VarvPerformance;
