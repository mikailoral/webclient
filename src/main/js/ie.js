/*global window*/

if ( typeof window.console === 'undefined' || !window.console ) {
    // Internet Explorer only defines a console window if the console is open during page load.
    // Mock a console if developer tools are not active.
    window.console = { log: function() {} };
}


if ( typeof( window.Event ) === 'undefined' ) {
    window.Event = function() {};
}


// Implement Object.create if it's not implemented in particular browser (e.g. IE 8)
if ( typeof( Object.create ) !== 'function' ) {
    Object.create = function( o ) {
        if ( arguments.length > 1 ) {
            throw new Error( 'Object.create implementation only accepts the first parameter.' );
        }

        function F() {}
        F.prototype = o;
        return new F();
    };
}


if ( typeof( Date.now ) === 'undefined' ) {
    Date.now = function() {
        return new Date().valueOf();
    };
}
