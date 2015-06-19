function JL(loggerName) {

    function log(logObject) {
        var message = logObject.timestamp + " - " + logObject.logger + " - " + logObject.level + " - " + logObject.message;
        window.console.log(message, logObject.args ? logObject.args : " ");
    }

    return {
        loggerName: loggerName,
        setOptions: function() {
        },
        trace: log,
        debug: log,
        info: log,
        warn: log,
        error: log,
        fatal: log
    };
}

var JL;
(function(JL) {
    JL.setOptions = function() {
    };
    JL.getAllLevel = function() {
    };
    JL.getTraceLevel = function() {
    };
    JL.getDebugLevel = function() {
    };
    JL.getInfoLevel = function() {
    };
    JL.getWarnLevel = function() {
    };
    JL.getErrorLevel = function() {
    };
    JL.getFatalLevel = function() {
    };
    JL.getOffLevel = function() {
    };
    JL.Exception = function() {
    };
    JL.createAjaxAppender = function() {
    };
    JL.createConsoleAppender = function() {
    };
})(JL || (JL = {}));