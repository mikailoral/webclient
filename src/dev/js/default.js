/*global require,$, window, GCFWVersion */

$(document).ready(function(){
    // Launch the application after pageshow has fired
    require(['Application', 'Setup'],function(Application) {
        new Application().init();
        });
    });