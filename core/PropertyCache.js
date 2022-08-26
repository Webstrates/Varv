

class PropertyCache {
    static getCachedProperty(lookupKey) {
        if(PropertyCache.cacheEnabled) {
            let value = PropertyCache.cacheMap.get(lookupKey);

            if(PropertyCache.DEBUG) {
                console.groupCollapsed("PropertyCache getting: ", lookupKey, value);
                console.trace();
                console.groupEnd();
            }

            return value;
        } else {
            return null;
        }
    }

    static removeCachedProperty(lookupKey) {
        if(PropertyCache.DEBUG) {
            console.log("PropertyCache deleting: ", lookupKey);
        }
        PropertyCache.cacheMap.delete(lookupKey);
    }

    static setCachedProperty(lookupKey, value) {
        if(PropertyCache.DEBUG) {
            console.log("PropertyCache setting: ", lookupKey, value);
        }
        PropertyCache.cacheMap.set(lookupKey, value);
    }

    static reset() {
        PropertyCache.cacheMap.clear();
    }
}
PropertyCache.DEBUG = false;
PropertyCache.cacheEnabled = true;
PropertyCache.cacheMap = new Map();
window.PropertyCache = PropertyCache;
