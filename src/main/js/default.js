/*global require,$, window */

// Ensure the latest Mustache templates are always loaded

$.ajaxSetup({
    cache: false // TODO: allow caching to be enabled in production via external properties
});

$(document).on("mobileinit", function() {
    $.mobile.ajaxEnabled = false;
    $.mobile.pushStateEnabled = false;
});

// Returns the total non-content height for an element (in pixels). i.e.
// (top margin + top padding + top border + bottom margin + bottom padding + bottom border)
$.fn.extraHeight = function() {
    var $element = $( this[0] );

    return $element.outerHeight( true ) - $element.height();
};


$.instantDeferred = function() {
    var deferral = $.Deferred();

    setTimeout(
        function() {
            deferral.resolve( /*args*/ );
        },
        0
        );

    return deferral;
};


$.isNotActive = function( deferred ) {
    return !this.loadDeferred || !$.isPending( deferred );
};


$.isPending = function( deferred ) {
    return deferred && ( deferred.state() === 'pending' );
};


$.formatPeriod = function( startTime, endTime ) {
    var duration = endTime.getTime() - startTime.getTime(),
    minutes  = Math.floor( duration / 60000),
    seconds  = String(Math.floor( ( duration - minutes * 60000 ) / 1000 ));

    if ( +seconds.length === 1 ) {
        seconds = "0" + seconds;
    }

    // TODO: add localizable format string
    return minutes + ":" + seconds;
};


var setPageIconAndTitle = function(iconSrc, pageTitle) {
    $("#page_icon").html(iconSrc);
    $("#page_title").html(pageTitle);
};

$(document).ready(function(){
    // Launch the application after pageshow has fired
    require(['Application'],function(Application) {
        new Application().init();
        });
    });

document.onfocusout = function(e){
    if( e === undefined ){//ie
        var evt = event;//ie uses event
        if( evt.toElement === null ){//check where focus was lost to
            window.isActive = false;
        }
    }
};

window.onblur = function(e){
    if( e !== undefined ){//ie will have an undefined e here, so this screens them out
        window.isActive = false;
    }
};

$(window).focus(function () {
    window.isActive = true;
});