/*global define, window */

// An object based pub/sub
define('eventAggregator', [], function() {
    var self;
    function isArray(obj) {
        return Object.prototype.toString.call( obj ) === '[object Array]';
    }
    
    function toArray(obj) {
        return Array.prototype.slice.call(obj);
    }

    function Aggregator(){
        this._callbacks = {};
    }

    Aggregator.prototype = {
        // Subscribe for events
        on: function(type, callback) {
            if (typeof this._callbacks[type] === "undefined"){
                this._callbacks[type] = [];
            }
            this._callbacks[type].push(callback);
            return self;
        },

        // Unsbscribe
        off: function(type, callback) {
            var listeners,
                i = 0,
                len;

            if (isArray( this._callbacks[type] )){
                listeners = this._callbacks[type];
                for ( len=listeners.length; i < len; i++ ){
                    if (callback) {
                        if (listeners[i] === callback){
                            listeners.splice(i, 1);
                            break;
                        }
                    }
                    else {
                        listeners.splice(i, 1);
                    }
                }
            }
            return self;
        },

        // Fire a custom event
        trigger: function(event) {
            var listeners,
                i = 0,
                params = toArray(arguments).slice(1),
                len;

            if (typeof event === "string"){
                event = {
                    type: event
                };
            }
            if (!event.target){
                event.target = this;
            }

            if (!event.type){
                throw new Error("Event object missing 'type' property.");
            }

            if (isArray( this._callbacks[event.type] )){
                listeners = this._callbacks[event.type];
                for ( len=listeners.length; i < len; i++ ){
                    listeners[i].apply(this, params);
                }
            }
            return self;
        }
    };
    
    self = new Aggregator();
    return self;
});