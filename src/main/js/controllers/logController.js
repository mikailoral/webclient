/*global define,window, $, CONSTANTS*/

define('logController', ['Controller', 'configController'], function(Controller, configController) {
    var webLoggers = {},
            WEB_ROOT_NAMESPACE = CONSTANTS.LOG.WEB_ROOT_NAMESPACE,
            LOG_LEVEL = CONSTANTS.LOG.LEVEL,
            JL = window.JL, loggingEnabled = true,
            LogObject = function(loggerName, loggerLevel, msg, argument) {
        this.logger = loggerName;
        this.level = loggerLevel;
        this.timestamp = new Date().getTime();
        this.message = msg;
        this.args = argument;
    };

    function WebLogger(loggerName) {
        var name = loggerName,
                logger = JL(WEB_ROOT_NAMESPACE + "." + name);

        this.getName = function() {
            return name;
        };

        this.trace = function trace(msg, argument) {
            if (loggingEnabled) {
                logger.trace(new LogObject(logger.loggerName, LOG_LEVEL.TRACE, msg, argument));
            }
        };

        this.debug = function debug(msg, argument) {
            if (loggingEnabled) {
                logger.debug(new LogObject(logger.loggerName, LOG_LEVEL.DEBUG, msg, argument));
            }
        };

        this.info = function info(msg, argument) {
            if (loggingEnabled) {
                logger.info(new LogObject(logger.loggerName, LOG_LEVEL.INFO, msg, argument));
            }
        };

        this.warn = function warn(msg, argument) {
            if (loggingEnabled) {
                logger.warn(new LogObject(logger.loggerName, LOG_LEVEL.WARN, msg, argument));
            }
        };

        this.error = function error(msg, argument) {
            if (loggingEnabled) {
                logger.error(new LogObject(logger.loggerName, LOG_LEVEL.ERROR, msg, argument));
            }
        };

        this.fatal = function fatal(msg, argument) {
            if (loggingEnabled) {
                logger.fatal(new LogObject(logger.loggerName, LOG_LEVEL.FATAL, msg, argument));
            }
        };
    }

    return Controller.create({
        init: function() {
            var logConfiguration = configController.getConf("logging", null),
                    allAppenders = {}, appenderName, appender, appenderConfig,
                    webLoggerConfig, rootLoggerConfig;

            function getAllAppenders() {
                var list, appenderName = [];
                for (appenderName in allAppenders) {
                    list.push(allAppenders[appenderName]);
                }

                return list;
            }

            function getAppendersOfLogger(logger) {
                var i, loggerAppenders = logger.appenders, list = [];
                for (i = 0; i < loggerAppenders.length; i++) {
                    list.push(allAppenders[loggerAppenders[i]]);
                }
                return list;
            }

            function buildLogConfig(data) {
                var conf = $.extend(true, {}, data);
                if (conf.appenders) {
                    conf.appenders = getAppendersOfLogger(conf);
                }
                //remove the nested log property so we have just the config options
                delete conf.loggers;
                return conf;
            }

            function configureChildLoggersOfLogger(namespace, logger) {
                var loggerInstance, name, enabled = false, loggerConfig;
                for (loggerInstance in logger) {
                    loggerConfig = buildLogConfig(logger[loggerInstance]);
                    name = namespace + "." + loggerInstance;
                    JL(name).setOptions(loggerConfig);

                }
                return enabled;
            }

            if (!logConfiguration) {
                loggingEnabled = false;
                return;
            }
            //configure the global options for logging
            if (logConfiguration.global) {
                JL.setOptions(logConfiguration.global);
                if (typeof logConfiguration.global.enabled !== 'undefined') {
                    loggingEnabled = logConfiguration.global.enabled;
                }
            }
            //check to see if there are any appenders configured
            if (logConfiguration.appenders) {
                for (appenderName in logConfiguration.appenders) {

                    appenderConfig = logConfiguration.appenders[appenderName];

                    if (appenderConfig.type === 'console') {
                        appender = JL.createConsoleAppender(appenderName);

                    } else if (appenderConfig.type === 'ajax') {
                        appender = JL.createAjaxAppender(appenderName);
                    }
                    if (appender) {
                        appender.setOptions(appenderConfig);
                        allAppenders[appenderName] = appender;
                    }
                }
            }

            if (allAppenders.length <= 0) {
                return;
            }

            if (!logConfiguration.loggers.rootLogger &&
                    !logConfiguration.loggers.webLogger) {
                JL().setOptions({
                    "appenders": getAllAppenders()
                });
                return;
            }

            if (logConfiguration.loggers.rootLogger) {
                rootLoggerConfig = buildLogConfig(logConfiguration.loggers.rootLogger);

                JL().setOptions(rootLoggerConfig);

            }

            if (logConfiguration.loggers.webLogger) {
                webLoggerConfig = buildLogConfig(logConfiguration.loggers.webLogger);
                JL(WEB_ROOT_NAMESPACE).setOptions(webLoggerConfig);

                configureChildLoggersOfLogger(WEB_ROOT_NAMESPACE, logConfiguration.loggers.webLogger.loggers);
            }
        },
        getLogger: function(loggerName) {
            var logger, _loggerName;
            _loggerName = loggerName ? loggerName.trim().length !== 0 ? loggerName : "Default" : "Default";
            if (webLoggers[_loggerName]) {
                logger = webLoggers[_loggerName];
            }
            else {
                logger = new WebLogger(_loggerName);
                webLoggers[logger.getName()] = logger;
            }

            return logger;
        }
    });
});