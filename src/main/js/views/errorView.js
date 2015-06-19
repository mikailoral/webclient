
/*global define, $, window */

/*
 * For managing dialog view
 */

define('errorView', ['view', 'configController'], function(View, configController) {
    var self, connectivityCheckTimer, backButtonCallback,okButtonCallback;

    function initializeListeners() {
        
        $("#error_buton").on("click", function() {
            if (backButtonCallback) {
                backButtonCallback();
            }
        });
        $("#ok_button").on("click", function() {
            if (okButtonCallback) {
                okButtonCallback();
            }
        });
        window.onbeforeunload = function() {
            //don't is run refresh control for error page
        };
    }

    function check_connectivity() {
        return $.ajax({
            url: "/app/check_connectivity/",
            dataType: 'text',
            cache: false
        });
    }
    function isInternetConnection() {
        check_connectivity().done(function() {
            window.location.reload();//auto connectivityCheckTimer end//
        }).fail(function(e) {
            if (e.status === 404) {
                window.location.reload();//auto connectivityCheckTimer end//
            }
            else {
                return false;
            }
        });
    }
    function timerStart() {
        connectivityCheckTimer = setInterval(function() {
            isInternetConnection();
        }, 2000);
    }   
    
    return View.create({
        init: function(errorInfo) {
            var deferred = $.Deferred();
            self = this;
            if (errorInfo.createBackButton) {
                backButtonCallback = errorInfo.createBackButton.buttonFunction;
            }
            if (errorInfo.createOKButton) {
                okButtonCallback = errorInfo.createOKButton.buttonFunction;
            }
            View.replaceContent('#home_page', errorInfo.connectionLost ? configController.getErrorTemplate() : 'error-template', {
                errorMessage: errorInfo.errorMessage,
                step_warning_message : errorInfo.step_warning_message,
                roomOwner: errorInfo.roomOwner ? errorInfo.roomOwner : configController.getRoomData().roomOwner,
                createBackButtonText: errorInfo.createBackButton ? errorInfo.createBackButton.text : undefined,
                createOKButtonText: errorInfo.createOKButton ? errorInfo.createOKButton.text : undefined
            }).done(function() {
                deferred.resolve();
                initializeListeners();
                if (errorInfo.connectionLost) {
                    timerStart();
                }
            });
            return deferred;
        }
    });
});


