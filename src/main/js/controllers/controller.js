/*global define, $, window */

/*
 * All controllers are inherited from this base controller,
 * using create() method
 */
define('Controller', [], function() {
    return {
        // Create new controller with Controller object as prototype
        // Accepts an object specifying new properties, that child controller must have
        create: function(o) {
            var object = Object.create(this);
            object.__parent = this;
            
            $.extend(object, o);
            
            return object;
        },
        // initialize controller
        init: function() {
            // override, when extending
        },
        
        generateContent: function() {
            // Override when extending
        },

        initializeListeners: function() {
            // Override when extending
        }
    };
});