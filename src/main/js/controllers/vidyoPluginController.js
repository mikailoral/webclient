/*global define, window, $ , CONSTANTS*/
/*jslint bitwise: false */

define('VidyoPluginController', ['Controller', 'eventAggregator', 'logController', 'configController', 'utils'],
        function(Controller, vent, logController, configController, utils) {
            var vidyoPluginOutEventCallbackObject = {}, vidyoAPI = window.VIDYO_API,
                    logger = logController.getLogger('VidyoPluginController'),
                    vidyoConfig,
                    vidyoClient,
                    userAccount,
                    pluginContainerSelector,
                    currentShareId,
                    currentRemoteShareUserId,
                    shareStack = [],
                    currentShares,
                    isPluginStarted = false,
                    isLicenseError = false,
                    currentRequestId = 1,
                    loginType,
                    guestNickName,
                    kickParticipant,
                    isPluginStartTriggeredByClientLogin = false,
                    isConferenceEndend = false,
                    EVENT = CONSTANTS.EVENT,
                    ERROR_CODE = CONSTANTS.ERROR_CODE,
                    LOGIN_TYPE = CONSTANTS.LOGIN_TYPE,
                    PROXY_SETTINGS = CONSTANTS.PROXY_SETIINGS,
                    DEVICE_NAMES = CONSTANTS.DEVICE_NAMES,
                    PROXY_TYPE = CONSTANTS.PROXY_SETIINGS.PROXY_TYPE;
            function isGuest() {
                if (loginType && loginType === LOGIN_TYPE.GUEST) {
                    return true;
                }
                return false;
            }

            function getPluginVersion() {
                return configController.getConf("vidyoPluginConfiguration", null).pluginVersion;
            }

            function sendSoapRequest(action, body) {
                logger.info("sendSoapRequest(" + JSON.stringify(action) + ", " + JSON.stringify(body) + ")");
                var soapClient = window.VIDYO_API.proxy();
                try {
                    return soapClient.request({
                        ajaxDataType: 'jsonp',
                        proxyUrl: vidyoConfig.soapProxyURL,
                        soapAction: action,
                        soapServerUrl: vidyoConfig.loginParameters.portalUri,
                        soapServiceUsername: vidyoConfig.loginParameters.userName,
                        soapServicePassword: vidyoConfig.loginParameters.userPass,
                        soapServicePath: vidyoConfig.soapUserServicePath,
                        soapBody: (body || "")
                    });
                } catch (e) {
                    logger.warn("soap: sendSoapRequest failure: ", action, e);
                }
            }

            function getMyAccount() {
                logger.info("soap: getMyAccount()");
                return sendSoapRequest("myAccount");
            }

            function disconnectConferenceAllRequest(conferenceID) {
                logger.info("disconnectConferenceAllRequest(" + conferenceID + ")");
                var body = {
                    conferenceID: conferenceID
                };
                return sendSoapRequest("disconnectConferenceAll", body);
            }

            function disconnectParticipant(conferenceID, participantID) {
                logger.info("disconnectParticipant(" + conferenceID + ", " + participantID + ")");
                var body = {
                    conferenceID: conferenceID,
                    participantID: participantID
                };
                return sendSoapRequest("leaveConference", body);
            }

            function muteAudioClientAllRequest(conferenceID) {
                logger.info("muteAudioClientAllRequest(" + conferenceID + ")");
                var body = {
                    conferenceID: conferenceID
                };
                return sendSoapRequest("muteAudioClientAll", body);
            }

            function muteAudioServerAllRequest(conferenceID, muteState) {
                logger.info("muteAudioServerAllRequest(" + conferenceID + ", " + muteState + ")");
                var body = {
                    conferenceID: conferenceID,
                    muteState: muteState
                };
                return sendSoapRequest("muteAudioServerAll", body);
            }

            function muteVideoServerAllRequest(conferenceID, muteState) {
                logger.info("muteVideoServerAllRequest(" + conferenceID + ", " + muteState + ")");
                var body = {
                    conferenceID: conferenceID,
                    muteState: muteState
                };
                return sendSoapRequest("muteVideoServerAll", body);
            }

            function muteVideoClientAllRequest(conferenceID) {
                logger.info("muteVideoClientAllRequest(" + conferenceID + ")");
                var body = {
                    conferenceID: conferenceID
                };
                return sendSoapRequest("muteVideoClientAll", body);
            }

            function muteParticipantAudioRequest(conferenceID, participantID) {
                logger.info("muteParticipantAudioRequest(" + conferenceID + ", " + participantID + ")");
                var body = {
                    conferenceID: conferenceID,
                    participantID: participantID
                };
                return sendSoapRequest("muteAudio", body);
            }

            function unmuteParticipantAudioRequest(conferenceID, participantID) {
                logger.info("unmuteParticipantAudioRequest(" + conferenceID + ", " + participantID + ")");
                var body = {
                    conferenceID: conferenceID,
                    participantID: participantID
                };
                return sendSoapRequest("unmuteAudio", body);
            }

            function startParticipantVideoRequest(conferenceID, participantID) {
                logger.info("startParticipantVideoRequest(" + conferenceID + ", " + participantID + ")");
                var body = {
                    conferenceID: conferenceID,
                    participantID: participantID
                };
                return sendSoapRequest("startVideo", body);
            }

            function stopParticipantVideoRequest(conferenceID, participantID) {
                logger.info("stopParticipantVideoRequest(" + conferenceID + ", " + participantID + ")");
                var body = {
                    conferenceID: conferenceID,
                    participantID: participantID
                };
                return sendSoapRequest("stopVideo", body);
            }

            function logFailCase(prefix, errorParam1, errorParam2) {
                logger.error(prefix + " Error parameter 1: " + JSON.stringify(errorParam1)
                        + ", error parameter 2: " + JSON.stringify(errorParam2));
            }

            function muteMicrophone(mute) {
                logger.info("muteMicrophone(" + mute + ")");
                var params = {}, inEvent, msg, deferred = $.Deferred();
                params.willMute = mute;
                inEvent = vidyoAPI.messages.inEventMuteAudioIn(params);
                if (vidyoClient.sendEvent(inEvent)) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                    deferred.resolve();
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                    deferred.reject();
                }
                logger.info("muteMicrophone(): " + msg);
                return deferred;
            }
            function muteSpeakers(mute) {
                logger.info("muteSpeakers(" + mute + ")");
                var params = {}, inEvent, msg, deferred = $.Deferred();
                params.willMute = mute;
                inEvent = vidyoAPI.messages.inEventMuteAudioOut(params);
                if (vidyoClient.sendEvent(inEvent)) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                    deferred.resolve();
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                    deferred.reject();
                }
                logger.info("muteSpeakers(): " + msg);
                return deferred;
            }

            function muteVideo(mute) {
                logger.info("muteVideo(" + mute + ")");
                var params = {}, inEvent, msg, deferred = $.Deferred();
                params.willMute = mute;
                inEvent = vidyoAPI.messages.inEventMuteVideo(params);
                if (vidyoClient.sendEvent(inEvent)) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                    deferred.resolve();
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                    deferred.reject();
                }
                logger.info("muteVideo(): " + msg);
                return deferred;
            }

            function basicRequestSender(request) {
                var result = vidyoClient.sendRequest(request);
                if (result === "ErrorOk") {
                    logger.info(request.type + " is called successfully", request);
                    return {
                        isRequestSuccess: true,
                        response: request
                    };
                } else {
                    logger.error(((request && request.type) ? (request.type + " ") : "Request ")
                            + "could not be sent successfully! Result: " + result, request);
                    return {
                        isRequestSuccess: false,
                        errorText: result
                    };
                }
            }

            function getParticipantArray(count, participantData) {
                var participants;
                if (count === 0) {
                    participants = [];
                }
                else if (count === 1) {
                    participants = [participantData];
                }
                else {
                    participants = participantData;
                }
                return participants;
            }

            function getParticipants(conferenceId) {
                logger.info("getParticipants(" + conferenceId + ")");
                var deferred = $.Deferred();
                sendSoapRequest("getParticipants", {
                    conferenceID: conferenceId
                }).done(function(data) {
                    logger.info("Participants is gotton successfully.", data);
                    deferred.resolve(getParticipantArray(data.total, data.Entity));
                }).fail(function(errorParam1, errorParam2) {
                    logFailCase("Participants could not be gotton successfully.", errorParam1, errorParam2);
                    deferred.reject(errorParam1, errorParam2);
                });
                return deferred;
            }

            function lockRoomRequest(conferenceId, lock) {
                logger.info('lockRoomRequest(', conferenceId, lock, ') start');
                if (lock) {
                    return sendSoapRequest("lockRoom", {
                        roomID: conferenceId
                    });
                } else {
                    return sendSoapRequest("unlockRoom", {
                        roomID: conferenceId
                    });
                }
            }

            /*
             * Synchronous version (without using deferred) of this method is also needed
             * in some cases. If isSynchRequest is set to true, blocking (synchronous) version runs.
             */
            function getClientConfiguration(isSynchRequest) {
                logger.info("getClientConfiguration(" + isSynchRequest + ")");
                var request, result, deferred = $.Deferred();
                request = vidyoAPI.messages.requestGetConfiguration({});
                result = vidyoClient.sendRequest(request);
                if (result === "ErrorOk") {
                    logger.info(request.type + " is called successfully.", request);
                    if (isSynchRequest) {
                        return {isRequestSuccess: true, configuration: request};
                    } else {
                        deferred.resolve(request);
                    }
                } else {
                    logger.error(request.type + " could not be sent successfully! Result: " + result, request);
                    if (isSynchRequest) {
                        return {isRequestSuccess: false, errorText: result};
                    } else {
                        deferred.reject({errorText: result});
                    }
                }

                return deferred;
            }

            /*
             * Synchronous version (without using deferred) of this method is also needed
             * in some cases. If isSynchRequest is set to true, blocking (synchronous) version runs.
             */
            function setClientConfiguration(vidyoConfig, isSynchRequest) {
                logger.info("setClientConfiguration(" + JSON.stringify(vidyoConfig) + ", " + isSynchRequest + ")");
                var request, result, deferred = $.Deferred();
                vidyoConfig.currentMicrophone = vidyoConfig.currentMicrophone < 0 ? 0 : vidyoConfig.currentMicrophone;
                vidyoConfig.currentSpeaker = vidyoConfig.currentSpeaker < 0 ? 0 : vidyoConfig.currentSpeaker;
                vidyoConfig.currentCamera = vidyoConfig.currentCamera < 0 ? 0 : vidyoConfig.currentCamera;
                request = vidyoAPI.messages.requestSetConfiguration(vidyoConfig);
                result = vidyoClient.sendRequest(request);
                if (result === "ErrorOk") {
                    logger.info(request.type + " is called successfully.", request);
                    /*
                     * Intentionally the configuration set is not returned. Encountered some cases where
                     * the plug-in makes some manipulations on the actual configuration parameters it stores 
                     * It might be better for our clients to get client configuration if they need after setting.
                     * e.g. setting always use proxy bit in the proxySettings (see updateProxyConfiguration()) 
                     * also sets enableForceProxy parameter. But we can notice it if we get the configuration after 
                     * setting the configuration. Plug-in does not manipulate the enableForceProxy parameter in 
                     * our request but it manipulates the one it stores.
                     */
                    if (isSynchRequest) {
                        return {isRequestSuccess: true};
                    } else {
                        deferred.resolve();
                    }
                } else {
                    logger.error(request.type + " could not be sent successfully! Result: " + result, request);
                    logger.error("Configuration: " + JSON.stringify(request));
                    if (isSynchRequest) {
                        return {isRequestSuccess: false, errorText: result};
                    } else {
                        deferred.reject({errorText: result});
                    }
                }

                return deferred;
            }

            /*
             * Synchronous version (without using deferred) of this method is also needed
             * in some cases. If isSynchRequest is set to true, blocking (synchronous) version runs.
             */
            function clientConfigurationBootstrap(conf, isSynchRequest) {
                logger.info("clientConfigurationBootstrap(" + JSON.stringify(conf) + ", " + isSynchRequest + ")");
                var deferred = $.Deferred();
                conf.enableAutoStart = 0;
                //conf.enableShowConfParticipantName = self.config.enableShowConfParticipantName ? 1 : 0;
                conf.userID = "";
                conf.password = "";
                conf.serverAddress = "";
                conf.serverPort = "";
                conf.portalAddress = "";
                if (isSynchRequest) {
                    return setClientConfiguration(conf, isSynchRequest);
                } else {
                    setClientConfiguration(conf).done(function() {
                        deferred.resolve();
                    }).fail(function(e) {
                        deferred.reject(e);
                    });
                    return deferred;
                }
            }

            function updateProxyConfiguration(proxyConfig) {
                logger.info("updateProxyConfiguration( "+ JSON.stringify(proxyConfig) + ")");
                var requestResult, conf, isSynchRequest = true,isAlwaysUseProxy,webProxyConfig;
                requestResult = getClientConfiguration(isSynchRequest);
                if (requestResult.isRequestSuccess) {
                    conf = requestResult.configuration;
                    if (proxyConfig && proxyConfig.vidyoProxyConfig) {
                        if (proxyConfig.vidyoProxyConfig.isAlwaysUseProxy) {
                            conf.proxySettings |= PROXY_SETTINGS.FORCE_PROXY;
                        } else {
                            conf.proxySettings &= ~PROXY_SETTINGS.FORCE_PROXY;
                        }
                        isAlwaysUseProxy=proxyConfig.vidyoProxyConfig.isAlwaysUseProxy;
                    }

                    if (proxyConfig && proxyConfig.webProxyConfig) {
                        if (proxyConfig.webProxyConfig.proxyType === PROXY_TYPE.MANUAL) {
                            logger.info("Set WebProxy Type : " + proxyConfig.webProxyConfig.proxyType);
                            conf.proxySettings |= PROXY_SETTINGS.PROXY_WEB_LOCAL;
                            conf.proxySettings |= PROXY_SETTINGS.PROXY_WEB_LOCAL_MANUAL;
                            conf.webProxyAddress = proxyConfig.webProxyConfig.webProxyAddress;
                            conf.webProxyPort = proxyConfig.webProxyConfig.webProxyPort;
                            conf.webProxyUsername = proxyConfig.webProxyConfig.webProxyUsername;
                            conf.webProxyPassword = proxyConfig.webProxyConfig.webProxyPassword;
                        }
                        else if (proxyConfig.webProxyConfig.proxyType === PROXY_TYPE.AUTO) {
                            logger.info("Set WebProxy Type : " + proxyConfig.webProxyConfig.proxyType);
                            conf.proxySettings &= ~PROXY_SETTINGS.PROXY_WEB_LOCAL;
                            conf.proxySettings &= ~PROXY_SETTINGS.PROXY_WEB_LOCAL_MANUAL;
                            conf.proxySettings |= (PROXY_SETTINGS.PROXY_WEB_ENABLE | PROXY_SETTINGS.PROXY_WEB_IE);
                            conf.webProxyUsername = proxyConfig.webProxyConfig.webProxyUsername;
                            conf.webProxyPassword = proxyConfig.webProxyConfig.webProxyPassword;
                        }
                        else {
                            logger.info("Set WebProxy Type : " + proxyConfig.webProxyConfig.proxyType);
                            conf.proxySettings &= ~(PROXY_SETTINGS.PROXY_WEB_ENABLE | PROXY_SETTINGS.PROXY_WEB_IE);
                        }
                        webProxyConfig=proxyConfig.webProxyConfig;
                    }

                    requestResult = setClientConfiguration(conf, isSynchRequest);
                    if (requestResult.isRequestSuccess) {
                        logger.info("Updated proxy configuration parameter = "+JSON.stringify(proxyConfig));
                        return {isRequestSuccess: true, alwaysUseProxy: isAlwaysUseProxy, useWebProxyConfig: webProxyConfig};
                    } else {
                        logger.error("Could not update proxy configuration. Could not set client configuration. Error: " + JSON.stringify(requestResult.errorText));
                        return {isRequestSuccess: false, errorText: "Could not set client configuration."};
                    }
                } else {
                    logger.error("Could not update proxy configuration. Could not get client configuration. Error: " + JSON.stringify(requestResult.errorText));
                    return {isRequestSuccess: false, errorText: "Could not get client configuration."};
                }
            }


            function updateEnableEchoCancellationConfiguration(isSet, successCallback, failureCallback) {
                logger.info("updateEnableEchoCancellationConfiguration(" + isSet + ")");
                isSet = isSet ? 1 : 0;
                getClientConfiguration().done(function(conf) {
                    conf.enableEchoCancellation = isSet;
                    setClientConfiguration(conf).done(function() {
                        successCallback();
                    }).fail(function(e) {
                        failureCallback({errorText: "Could not set client configuration."});
                    });
                }).fail(function(e) {
                    failureCallback({errorText: "Could not get client configuration."});
                });
            }

            function updateEnableAudioAGCConfiguration(isSet, successCallback, failureCallback) {
                logger.info("updateEnableAudioAGCConfiguration(" + isSet + ")");
                isSet = isSet ? 1 : 0;
                getClientConfiguration().done(function(conf) {
                    conf.enableAudioAGC = isSet;
                    setClientConfiguration(conf).done(function() {
                        successCallback();
                    }).fail(function(e) {
                        failureCallback({errorText: "Could not set client configuration."});
                    });
                }).fail(function(e) {
                    failureCallback({errorText: "Could not get client configuration."});
                });
            }


            function getShares() {
                logger.info('getShares()');
                var request = vidyoAPI.messages.requestGetWindowShares({}), msg, sendRequest;
                sendRequest = vidyoClient.sendRequest(request);
                if (sendRequest === "ErrorOk") {
                    msg = "VidyoPluginController sent " + request.type + " request successfully";
                } else {
                    msg = "VidyoPluginController did not send " + request.type + " request successfully!";
                }
                logger.info("getShares(): " + msg, request);
                return request;
            }

            function setPreviewMode(selfView, participantNumber) {
                var previewMode, shares = getShares(), params = {}, inEvent, msg, result, deferred = $.Deferred();
                if (selfView) {
                    if (shares.numApp > 0 || participantNumber >= 3) {
                        previewMode = "Dock";
                    } else {
                        previewMode = "PIP";
                    }
                } else {
                    previewMode = "None";
                }

                logger.info("setPreviewMode('" + previewMode + "')");
                params.previewMode = previewMode;
                inEvent = vidyoAPI.messages.eventPreview(params);
                result = vidyoClient.sendEvent(inEvent);
                if (result) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                    deferred.resolve(inEvent);
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                    deferred.reject({
                        errorText: result,
                        requestType: "eventPreview"
                    });
                }
                logger.info("setPreviewMode(): " + msg);
                return deferred;
            }

            function setLayoutMode(numPreferred) {
                logger.info("setLayoutMode('" + numPreferred + "')");
                var params = {}, inEventLayout, msg, deferred = $.Deferred(), result;
                params.numPreferred = numPreferred;
                inEventLayout = vidyoAPI.messages.inEventLayout(params);
                result = vidyoClient.sendEvent(inEventLayout);
                if (result) {
                    msg = "VidyoPluginController sent " + inEventLayout.numPreferred + " event successfully";
                    deferred.resolve(inEventLayout);
                } else {
                    msg = "VidyoPluginController did not send " + inEventLayout.numPreferred + " event successfully!";
                    deferred.reject({
                        errorText: result,
                        requestType: "inEventLayout"
                    });
                }
                logger.info("setLayoutMode(): " + msg);
                return deferred;
            }

            /**
             * @returns see basicRequestSender for return values.
             */
            function getLocalShares() {
                logger.info("getLocalShares()");
                var request = vidyoAPI.messages.requestGetWindowsAndDesktops({});
                return basicRequestSender(request);
            }

            function joinConference(conferenceId, pin) {
                logger.info('portal: joinConference(', conferenceId, ')');
                sendSoapRequest("joinConference", {
                    conferenceID: conferenceId,
                    PIN: pin
                }).done(function(response) {
                    logger.info('portal: joinConference()::sendSoapRequest.done', response);
                }).fail(function(errorParam1, errorParam2) {
                    vent.trigger(EVENT.VIDYO_API, EVENT.JOIN_CONF_FAILURE, {
                        errorMessage: window.lang.VidyoClient.JOIN_CONFERENCE_REQUEST_FAILURE,
                        errorParam1: errorParam1,
                        errorParam2: errorParam2
                    });
                    logFailCase("portal: joinConference()::sendSoapRequest.fail.", errorParam1, errorParam2);
                });
                return true;
            }

            function leaveConference() {
                logger.info("call: leaveConference()");
                var inEvent = vidyoAPI.messages.inEventLeave();
                if (!vidyoClient.sendEvent(inEvent)) {
                    vent.trigger(EVENT.VIDYO_API, EVENT.LEAVE_CONF_FAILURE, {
//do not press this error message in login template, because login screen is not visible.
//errorMessage : window.lang.VidyoClient.LEAVE_CONFERENCE_REQUEST_FAILURE
                    });
                    return false;
                }
                vent.trigger(EVENT.VIDYO_API, EVENT.LEAVE_CONF_SUCCESS, {
                    successMessage: window.lang.VidyoClient.LEAVE_CONFERENCE
                });
                return true;
            }

            function setCurrentShare(currApp) {
                logger.info('setCurrentShare()');
                var request = getShares(), msg, sendRequest;
                request.newApp = currApp + 1;
                request.type = "RequestSetWindowShares";
                request.requestType = "ChangeSharingWindow";
                sendRequest = vidyoClient.sendRequest(request);
                if (sendRequest === "ErrorOk") {
                    msg = "VidyoPluginController sent " + request.type + " request successfully";
                } else {
                    msg = "VidyoPluginController did not send " + request.type + " request successfully!";
                }
                logger.info("setCurrentShare() : " + msg, request);
                return request;
            }

            function getConfigurationList(successCallback, failureCallback) {
                logger.info('configurationUpdateEvent::done');
                var data = {
                    camera: [],
                    speaker: [],
                    microphone: [],
                    echoCancellation: 0
                };
                getClientConfiguration().done(function(newConfig) {
                    $.each(newConfig.cameras, function(i, name) {
                        data.camera.push({
                            name: name,
                            id: i,
                            isSelected: (i === newConfig.currentCamera)
                        });
                    });
                    $.each(newConfig.speakers, function(i, name) {
                        data.speaker.push({
                            name: name,
                            id: i,
                            isSelected: (i === newConfig.currentSpeaker)
                        });
                    });
                    $.each(newConfig.microphones, function(i, name) {
                        data.microphone.push({
                            name: name,
                            id: i,
                            isSelected: (i === newConfig.currentMicrophone)
                        });
                    });
                    data.enableEchoCancellation = (parseInt(newConfig.enableEchoCancellation, 10) === 0 ? false : true);
                    data.enableAudioAGC = (parseInt(newConfig.enableAudioAGC, 10) === 0 ? false: true);
                    logger.info('configurationUpdateEvent::done - Devices detected ' + data);
                    successCallback(data);
                }).fail(function(e) {
                    failureCallback(e);
                });
            }

            function setCurrentRemoteShare(remoteShareId) {
                logger.info("callback: setCurrentRemoteShare(" + remoteShareId + ")");
                var shares = getShares(), request, msg, one = 1;
                currentRemoteShareUserId = shares.remoteAppUri[remoteShareId];
                shareStack.push(currentRemoteShareUserId);
                remoteShareId = (remoteShareId * one) + 1;
                shares.currApp = remoteShareId;
                shares.newApp = shares.currApp || 0;
                this.vyTempAssign(shares, {
                    requestType: 'ChangeSharingWindow',
                    type: 'RequestSetWindowShares'
                }, function(req) {
                    if (vidyoClient.sendRequest(req) === "ErrorOk") {
                        msg = "VidyoWeb sent " + req.type + " request successfully";
                    } else {
                        msg = "VidyoWeb did not send " + req.type + " request successfully!";
                    }
                    logger.info("setCurrentRemoteShare() : " + msg, req);
                });
                return request;
            }

            function vyTempAssign(object, values, block) {
                var key, oldValues = {};
                for (key in values) {
                    if (values.hasOwnProperty(key)) {
                        oldValues[key] = object[key];
                        object[key] = values[key];
                    }
                }
                try {
                    block(object);
                } finally {
                    for (key in values) {
                        if (values.hasOwnProperty(key)) {
                            object[key] = oldValues[key];
                        }
                    }
                }
            }

            function setConfigurationList(deviceName, selection, successCallback, failureCallback) {
                logger.info("callback: setConfigurationList()");
                getClientConfiguration().done(function(conf) {
                    if (deviceName === DEVICE_NAMES.CAMERA) {
                        conf.currentCamera = selection;
                    }
                    if (deviceName === DEVICE_NAMES.SPEAKER) {
                        conf.currentSpeaker = selection;
                    }
                    if (deviceName === DEVICE_NAMES.MICROPHONE) {
                        conf.currentMicrophone = selection;
                    }
                    clientConfigurationBootstrap(conf).done(function() {
                        successCallback(conf);
                    }).fail(function(e) {
                        failureCallback(e);
                    });
                }).fail(function(e) {
                    failureCallback(e);
                });
            }

            function windowType(type, mactype) {

                if (window.navigator.appVersion.indexOf("Mac") !== -1) {
                    if (type.indexOf("Keynote") > -1
                            || mactype.indexOf(".ppt") > -1) {
                        return "ppt";
                    } else if (type.indexOf("Pages") > -1
                            || mactype.indexOf(".doc") > -1) {
                        return "doc";
                    } else if (type.indexOf("Numbers") > -1
                            || mactype.indexOf(".xls") > -1) {
                        return "xls";
                    } else if (type.indexOf("Mail") > -1) {
                        return "outlook";
                    } else if (type.indexOf("TextEdit") > -1
                            || mactype.indexOf(".txt") > -1) {
                        return "txt";
                    } else if (type.indexOf("IPhoto") > -1
                            || mactype.indexOf(".jpg") > -1
                            || mactype.indexOf(".png") > -1
                            || mactype.indexOf(".gif") > -1) {
                        return "jpg";
                    } else if (type.indexOf("Google Chrome") > -1) {
                        return "chrome";
                    } else if (type.indexOf("Firefox") > -1) {
                        return "firefox";
                    } else if (type.indexOf("Safari") > -1) {
                        return "safari";
                    } else if (type.indexOf("Adobe Reader") > -1
                            || mactype.indexOf(".pdf") > -1) {
                        return "pdf";
                    } else if (type.indexOf("Finder") > -1) {
                        return "folder";
                    } else {
                        return "other";
                    }
                } else {
                    if (type.indexOf("Microsoft PowerPoint") > -1
                            || type.indexOf(".ppt") > -1) {
                        return "ppt";
                    } else if (type.indexOf("Microsoft Word") > -1
                            || type.indexOf(".doc") > -1) {
                        return "doc";
                    } else if (type.indexOf("Microsoft Excel") > -1
                            || type.indexOf(".xls") > -1) {
                        return "xls";
                    } else if (type.indexOf("Microsoft Outlook") > -1
                            || type.indexOf("Message (HTML)") > -1) {
                        return "outlook";
                    } else if (type.indexOf(".txt") > -1) {
                        return "txt";
                    } else if (type.indexOf("Windows Photo Viewer") > -1
                            || type.indexOf(".jpg") > -1
                            || type.indexOf(".png") > -1
                            || type.indexOf(".gif") > -1) {
                        return "jpg";
                    } else if (type.indexOf("Google Chrome") > -1) {
                        return "chrome";
                    } else if (type.indexOf("Mozilla Firefox") > -1) {
                        return "firefox";
                    } else if (type.indexOf("Internet Explorer") > -1) {
                        return "explorer";
                    } else if (type.indexOf("Adobe Reader") > -1
                            || type.indexOf(".pdf") > -1) {
                        return "pdf";
                    } else {
                        return "other";
                    }
                }
            }

            function getScreenShareList() {
                logger.info("getScreenShareList::click");
                var requestResult = getLocalShares(), data, map = {}, shares = getShares(), transformedData = {
                    windows: [],
                    desktops: [],
                    sharing: [],
                    failed: {}
                }, i, name, mywindow, desktop, share;
                if (!requestResult.isRequestSuccess) {
                    transformedData.failed = true;
                    vent.trigger(EVENT.VIDYO_API, EVENT.SCREEN_SHARE_LIST_FAILED, transformedData);
                    requestResult = {
                        sysDesktopId: "0000000000000001",
                        sysDesktopName: "Display",
                        numSystemDesktops: 1
                    };
                } else {
                    transformedData.failed = false;
                    data = requestResult.response;
                }


//()
                currentShares = shares;
                if (requestResult.isRequestSuccess) {
                    for (i = 0; i < data.numApplicationWindows; i++) {
                        name = (data.appWindowName[i] && data.appWindowName[i].length) ? data.appWindowName[i] : data.appWindowAppName[i];
                        mywindow = {
                            id: data.appWindowId[i],
                            name: name,
                            highlight: (currentShareId === data.appWindowId[i]) ? true : false,
                            type: windowType(data.appWindowAppName[i], data.appWindowName[i])
                        };
                        transformedData.windows.push(mywindow);
                    }

                    for (i = 0; i < data.numSystemDesktops; i++) {
                        desktop = {
                            id: data.sysDesktopId[i],
                            name: data.sysDesktopName[i],
                            highlight: (currentShareId === data.sysDesktopId[i]) ? true : false
                        };
                        transformedData.desktops.push(desktop);
                    }
                } else {

                    desktop = {
                        id: requestResult.sysDesktopId,
                        name: requestResult.sysDesktopName,
                        highlight: (currentShareId === requestResult.sysDesktopId) ? true : false
                    };
                    transformedData.desktops.push(desktop);
                }


                for (i = 0; i < shares.numApp; i++) {
                    share = {
                        name: shares.remoteAppName[i],
                        id: i,
                        highlight: (currentRemoteShareUserId === shares.remoteAppUri[i]) ? true : false
                    };
                    transformedData.sharing.push(share);
                }

                vent.trigger(EVENT.VIDYO_API, EVENT.SCREEN_SHARE_LIST_READY, transformedData);
            }

            function startLocalShare(shareId) {
                logger.info("clientLocalShareStart('", shareId, "')");
                var inEvent, msg;
                if (shareId === undefined) {
                    inEvent = vidyoAPI.messages.inEventUnshare();
                } else {
                    inEvent = vidyoAPI.messages.inEventShare({
                        window: shareId
                    });
                }

                currentShareId = shareId;
                if (vidyoClient.sendEvent(inEvent)) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                }
                logger.info("clientLocalShareStart(): " + msg);
                return true;
            }

            function loadConfiguration() {
                var vidyoPluginLink;
                vidyoConfig = configController.getConf("vidyoPluginConfiguration", null);
                if (!vidyoConfig) {
                    vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                        retryLogin: false,
                        errorMessage: window.lang.VidyoClient.NO_CONFIGURATION
                    });
                    return undefined;
                }

                if (window.navigator.appVersion.indexOf("Mac") !== -1) {
                    vidyoPluginLink = vidyoConfig.macOsVideoPluginLink;
                }
                else {
                    vidyoPluginLink = vidyoConfig.windowsVidyoPluginLink;
                }
                vidyoConfig.vidyoPluginDownloadLink = vidyoPluginLink;
                return vidyoConfig;
            }

            function requestGetEchoRecommendation(speakerIndex, micIndex) {
                logger.info("requestGetEchoRecommendation()");
                var result, request;
                request = vidyoAPI.messages.requestGetEchoRecommendation(
                        {speakerIndex: speakerIndex,
                            micIndex: micIndex});
                result = vidyoClient.sendRequest(request);
                if (result === "ErrorOk") {
                    logger.info(request.type + " is called successfully", request);
                    return {
                        isRequestSuccess: true,
                        disableEcho: request.disableEcho
                    };
                } else {
                    logger.error(request.type + " could not be sent successfully! Result: " + result, request);
                    return {
                        isRequestSuccess: false,
                        errorText: result
                    };
                }
            }

            function logCurrentSpeakerAndMicrophone(conf) {
                logger.info("Current speaker: " + conf.speakers[conf.currentSpeaker]
                        + ", current microphone: " + conf.microphones[conf.currentMicrophone]);
                var fieldsToLog = ["currentSpeaker", "speakers", "currentMicrophone", "microphones"];
                logger.debug("Audio device info: " + JSON.stringify(conf, fieldsToLog));
            }

            function disableEchoCancellationIfRecommended(echoCancellationDisabledCallback, failureCallback) {
                logger.info("disableEchoCancellationIfRecommended()");
                var result;
                getClientConfiguration().done(function(conf) {
                    logCurrentSpeakerAndMicrophone(conf);
                    result = requestGetEchoRecommendation(conf.currentSpeaker, conf.currentMicrophone);
                    if (result.isRequestSuccess) {
                        if (result.disableEcho) {
                            logger.info("Disable echo cancellation is recommended for current speaker - microphone pair. Will try to disable echo cancellation configuration.");
                            updateEnableEchoCancellationConfiguration(false, echoCancellationDisabledCallback, failureCallback);
                        } else {
                            logger.info("No disable echo cancellation recommendation exists for current speaker - microphone pair.");
                            failureCallback({errorText: "No disable echo cancellation recommendation exists for current speaker - microphone pair."});
                        }
                    } else {
                        logger.error("Disable echo cancellation if recommended failure. Could not get echo recommendation.");
                        failureCallback({errorText: "Could not get echo recommendation."});
                    }
                }).fail(function(e) {
                    logger.error("Disable echo cancellation if recommended failure. Could not get client configuration.");
                    failureCallback({errorText: "Could not get client configuration."});
                });
            }

            /**
             * @returns see basicRequestSender for return values.
             */
            function requestGetParticipants() {
                logger.info('requestGetParticipants()');
                var request = vidyoAPI.messages.requestGetParticipants({});
                return basicRequestSender(request);
            }

            function requestGetMutedMediaWorker(request) {
                var result;
                result = vidyoClient.sendRequest(request);
                if (result === "ErrorOk") {
                    logger.info(request.type + " is called successfully.", request);
                    return {
                        isRequestSuccess: true,
                        isMuted: request.isMuted
                    };
                } else {
                    logger.error(request.type + " could not be sent successfully! Result: " + result, request);
                    return {
                        isRequestSuccess: false,
                        errorText: result
                    };
                }
            }

            function requestGetMutedServerVideo() {
                logger.info("requestGetMutedServerVideo()");
                var request = vidyoAPI.messages.requestGetMutedServerVideo({});
                return requestGetMutedMediaWorker(request);
            }

            function requestGetMutedServerAudioIn() {
                logger.info("requestGetMutedServerAudioIn()");
                var request = vidyoAPI.messages.requestGetMutedServerAudioIn({});
                return requestGetMutedMediaWorker(request);
            }

            function participantsChangeForGuestFailureWorker(isClientRequest, errorCode, errorParams, isRequestSuccess) {
                if (isClientRequest) {
                    return {
                        isRequestSuccess: isRequestSuccess,
                        errorCode: errorCode,
                        errorParams: errorParams
                    };
                } else {
                    logger.error("Triggering PARTICIPANTS_CHANGED_FAILURE_FOR_GUEST.");
                    vent.trigger(EVENT.VIDYO_API, EVENT.PARTICIPANTS_CHANGED_FAILURE_FOR_GUEST, {
                        errorCode: errorCode,
                        errorParams: errorParams
                    });
                    return;
                }
            }

            function participantsChangeForGuestSuccessWorker(isClientRequest, participants) {
                if (isClientRequest) {
                    return {isRequestSuccess: true, participantsList: participants};
                } else {
                    logger.info("Triggering PARTICIPANTS_CHANGED_FOR_GUEST.");
                    vent.trigger(EVENT.VIDYO_API, EVENT.PARTICIPANTS_CHANGED_FOR_GUEST, participants);
                    return;
                }
            }


            function getCurrentParticipantsListForGuest(isClientRequest) {
                logger.info("getCurrentParticipantsListForGuest(" + isClientRequest + ")");
                var requestResult, participants, i, isMeSet = false;
                requestResult = requestGetParticipants();
                if (requestResult.isRequestSuccess) {
                    participants = requestResult.response.name;
                    logger.info("Participants list is gotton successfully. Participants list (" + participants.length + "): "
                            + JSON.stringify(participants));
                    for (i = 0; i < participants.length; i++) {
// First participant that has the same name with me is set as me.
// We do not have much information, such as entityID, as a guest.
                        if (!isMeSet && participants[i] === guestNickName) {
                            logger.info("Setting isMe to my record: " + JSON.stringify(participants[i]));
                            participants[i] = {displayName: participants[i], isMe: true};
                            isMeSet = true;
                        } else {
                            participants[i] = {displayName: participants[i]};
                        }
                    }

                    return participantsChangeForGuestSuccessWorker(isClientRequest, participants);
                } else {
                    logger.error("Participants list could not be gotton. Error: " + JSON.stringify(requestResult.errorText));
                    return participantsChangeForGuestFailureWorker(isClientRequest, ERROR_CODE.GET_PARTICIPANTS_ERROR,
                            {errorParam1: requestResult.errorText}, requestResult.isRequestSuccess);
                }
            }

            function participantsChangeForUserFailureWorker(isClientRequest, errorData, deferred) {
                if (isClientRequest) {
                    deferred.reject(errorData);
                } else {
                    logger.error("Triggering PARTICIPANTS_CHANGED_FAILURE_FOR_USER.");
                    vent.trigger(EVENT.VIDYO_API, EVENT.PARTICIPANTS_CHANGED_FAILURE_FOR_USER, errorData);
                }
            }

            function participantChangeForUserSuccessWorker(isClientRequest, participants, deferred) {
                if (isClientRequest) {
                    deferred.resolve(participants);
                } else {
                    logger.info("Triggering PARTICIPANTS_CHANGED_FOR_USER.");
                    vent.trigger(EVENT.VIDYO_API, EVENT.PARTICIPANTS_CHANGED_FOR_USER, participants);
                }
            }

            function getCurrentParticipantsListForUser(isClientRequest) {
                logger.info("getCurrentParticipantsListForUser(" + isClientRequest + ")");
                var i, fieldsToLog = ["participantID", "displayName", "audio", "video"], errorMessage, errorData, deferred = $.Deferred();
                if (!userAccount || !userAccount.entityID) {

                    errorMessage = "User account or its entityID is not set.";
                    logger.error(errorMessage);
                    errorData = {
                        errorCode: ERROR_CODE.USER_ACCOUNT_ERROR,
                        errorParams: {errorParam1: errorMessage}
                    };
                    participantsChangeForUserFailureWorker(isClientRequest, errorData, deferred);
                } else {
                    getParticipants(userAccount.entityID).done(function(participants) {
                        logger.info("Participants list is gotton successfully. Participants list (" + participants.length + "): "
                                + JSON.stringify(participants, fieldsToLog));
                        for (i = 0; i < participants.length; i++) {
                            if (participants[i].entityID === userAccount.entityID) {
                                logger.info("Setting isMe to my record: " + JSON.stringify(participants[i], fieldsToLog));
                                $.extend(participants[i], {isMe: true});
                            }
                        }
                        participantChangeForUserSuccessWorker(isClientRequest, participants, deferred);
                    }).fail(function(errorParam1, errorParam2) {

                        logFailCase("Participants list could not be gotton.", errorParam1, errorParam2);
                        errorData = {
                            errorCode: ERROR_CODE.GET_PARTICIPANTS_ERROR,
                            errorParams: {errorParam1: errorParam1, errorParam2: errorParam2}
                        };
                        participantsChangeForUserFailureWorker(isClientRequest, errorData, deferred);
                    });
                }

                if (isClientRequest) {
                    return deferred;
                }
            }

            function handleParticipantsChange() {
                if (isGuest()) {
                    getCurrentParticipantsListForGuest(false);
                } else {
                    getCurrentParticipantsListForUser(false);
                }
            }

            function genericLoginError(error) {
                return window.lang.VidyoClient.GENERIC_LOGIN_ERROR + " (" + error + ")";
            }

            function logOutEvent(e) {
                logger.info("Received " + e.type + ". Parameter(s): " + JSON.stringify(e));
            }

            function successHandlerForGetMyAccountInSignIn(response) {
                userAccount = response.Entity;
                logger.info("User account is set, triggering login success.", response);
                logger.debug("My account: " + JSON.stringify(userAccount));
                vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_SUCCESS);
            }

            function failHandlerForGetMyAccountInSignIn(errorParam1, errorParam2) {
                logFailCase("Could not get user account. Triggering login failure.", errorParam1, errorParam2);
                vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                    errorMessage: window.lang.VidyoClient.FAILED_GETTING_USER_ACCOUNT
                });
                loginType = LOGIN_TYPE.NONE;
            }

            function retryHandlerForGetMyAccountInSignIn(errorParam1, errorParam2) {
                logFailCase("Could not get user account. Will retry getting user account.", errorParam1, errorParam2);
                getMyAccount().done(successHandlerForGetMyAccountInSignIn).fail(
                        failHandlerForGetMyAccountInSignIn);
            }

            function isAlwaysUseProxySet(conf) {
                var isAlwaysUseSet;
                isAlwaysUseSet = conf.proxySettings & PROXY_SETTINGS.FORCE_PROXY;
                if (isAlwaysUseSet === 0) {
                    return false;
                } else {
                    return true;
                }
            }

            function getWebProxyConfig(conf) {
                return {
                    proxyType: conf.proxySettings & PROXY_SETTINGS.PROXY_WEB_LOCAL ? PROXY_TYPE.MANUAL : PROXY_TYPE.AUTO,
                    webProxyUsername: conf.webProxyUsername,
                    webProxyPassword: conf.webProxyPassword,
                    webProxyAddress: conf.webProxyAddress,
                    webProxyPort: conf.webProxyPort
                };
            }

            function getUpToDateValueOfProxy() {
                logger.info("getUpToDateValueOfProxy()");
                var requestResult, isSet, isSynchRequest = true, webProxyConfig;
                requestResult = getClientConfiguration(isSynchRequest);
                if (requestResult.isRequestSuccess) {
                    isSet = isAlwaysUseProxySet(requestResult.configuration);
                    webProxyConfig = getWebProxyConfig(requestResult.configuration);
                    logger.info("getUpToDateValueOfProxy success. Always use proxy: " + isSet + " and Web Proxy Config : " + JSON.stringify(webProxyConfig));
                    return {isRequestSuccess: true, alwaysUseProxy: isSet, webProxyConfig: webProxyConfig};
                } else {
                    logger.error("getUpToDateValueOfProxy failure. Could not get client configuration. Error: " + JSON.stringify(requestResult.errorText));
                    return {isRequestSuccess: false, errorText: "Could not get client configuration."};
                }
            }

            function getUpToDateValueOfEnableEchoCancellation() {
                logger.info("getUpToDateValueOfEnableEchoCancellation()");
                var requestResult, isSet, isSynchRequest = true;
                requestResult = getClientConfiguration(isSynchRequest);
                if (requestResult.isRequestSuccess) {
                    isSet = parseInt(requestResult.configuration.enableEchoCancellation, 10);
                    logger.info("getUpToDateValueOfEnableEchoCancellation success. Enable echo cancellation: " + isSet);
                    return {isRequestSuccess: true, enableEchoCancellation: (isSet === 0 ? false : true)};
                } else {
                    logger.error("getUpToDateValueOfEnableEchoCancellation failure. Could not get client configuration. Error: " + JSON.stringify(requestResult.errorText));
                    return {isRequestSuccess: false, errorText: "Could not get client configuration."};
                }
            }

            function getUpToDateValueOfEnableAudioAGC() {
                logger.info("getUpToDateValueOfEnableAudioAGC()");
                var requestResult, isSet, isSynchRequest = true;
                requestResult = getClientConfiguration(isSynchRequest);
                if (requestResult.isRequestSuccess) {
                    isSet = parseInt(requestResult.configuration.enableAudioAGC, 10);
                    logger.info("getUpToDateValueOfEnableAudioAGC success. Enable audio AGC: " + isSet);
                    return {isRequestSuccess: true, enableAudioAGC: (isSet === 0 ? false : true)};
                } else {
                    logger.error("getUpToDateValueOfEnableAudioAGC failure. Could not get client configuration. Error: " + JSON.stringify(requestResult.errorText));
                    return {isRequestSuccess: false, errorText: "Could not get client configuration."};
                }
            }

            function resetRequiredClientConfigurationParams() {
                logger.info("resetRequiredClientConfigurationParams()");
                var getResult, setResult, isSynchRequest = true;
                getResult = getClientConfiguration(isSynchRequest);
                if (getResult.isRequestSuccess) {

                    setResult = clientConfigurationBootstrap(getResult.configuration, isSynchRequest);
                    if (setResult.isRequestSuccess) {
                        logger.info("Reset required client configuration parameters success.");
                        return {isRequestSuccess: true};
                    } else {
                        logger.error("Reset required client configuration parameters error. Could not set client configuration.");
                        return {isRequestSuccess: false, errorText: "Could not set client configuration."};
                    }

                } else {
                    logger.error("Reset required client configuration parameters error. Could not get client configuration.");
                    return {isRequestSuccess: false, errorText: "Could not get client configuration."};
                }
            }

            function bindVidyoCallbacks() {
                logger.info("callback: bindVidyoCallbacks()");
                vidyoPluginOutEventCallbackObject.callbacks = {
                    PrivateOutEventLog: function(event) {
                        logger.debug('plugin: ', event);
                    },
                    OutEventLogin: function(e) {
                        logOutEvent(e);
                    },
                    OutEventLinked: function(e) {
                        logOutEvent(e);
                    },
                    OutEventGuestLink: function(e) {
                        logOutEvent(e);
                    },
                    OutEventSignIn: function(e) {
                        logOutEvent(e);
                        if (e.activeEid === 0 || e.activeEid === "0") {
                            logger.debug("OutEventSignIn(): will start license procedure");
                            var inEvent = vidyoAPI.messages.inEventLicense();
                            vidyoClient.sendEvent(inEvent);
                        }
                    },
                    OutEventJoinProgress: function(e) {
                        logOutEvent(e);
                    },
                    OutEventLicense: function(e) {
                        logOutEvent(e);
                        if (e.outOfLicenses === true) {
                            logger.error("Out of licenses. Details: " + JSON.stringify(e));
                            isLicenseError = true;
                            vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                                errorMessage: window.lang.VidyoClient.OUT_OF_LICENSE_ERROR
                            });
                        }
                    },
                    OutEventSignedIn: function(e) {
                        logOutEvent(e);
                        if (isPluginStartTriggeredByClientLogin) {
                            if (isGuest()) {
                                vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_SUCCESS);
                            }
                            else {
                                getMyAccount().done(successHandlerForGetMyAccountInSignIn).fail(
                                        retryHandlerForGetMyAccountInSignIn);
                            }
                        } else {
// Plugin frequently sends OutEventSignedIn event after each refresh in just one computer.
// It causes login success scenarios to run even though there is no login attempt.
// To recover this unexpected behavior this case is implemented. 
// (plugin version: 1.1.1.00075). isPluginStartTriggeredByClientLogin is
// defined and used to recover this scenario.
                            logger.warn("Client did not try to login, but signed in event is received. Will not trigger anything.");
                        }
                    },
                    OutEventLogicStarted: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.LOGIC_STARTED);
                    },
                    OutEventConferenceActive: function(e) {
                        logOutEvent(e);
                        // For logging always use proxy value. In URL login scenarios we do not
                        // see its value in logs otherwise..
                        logger.info("Get up-to-date value of use proxy for logging...");
                        getUpToDateValueOfProxy();
                        vent.trigger(EVENT.VIDYO_API, EVENT.CONF_ACTIVE);
                    },
                    OutEventJoining: function(e) {
                        logOutEvent(e);
                    },
                    PrivateOutEventVcsoapGuestLink: function(e) {
                        logOutEvent(e);
                        var error = parseInt(e.error, 10), fault = e.fault, msg;
                        if (error === 500 && fault === "ConferenceLocked") {
                            msg = window.lang.VidyoClient.ROOM_LOCKED;
                        } else if (error === 500 && fault === "None") {
// We have receive this params in "All Lines in use." case, yet.
// But the fault param is too generic. So we set a generic error message.
                            msg = window.lang.VidyoClient.GENERIC_GUEST_LINK_ERROR;
                        } else {
                            msg = window.lang.VidyoClient.GENERIC_GUEST_LINK_ERROR;
                        }

                        vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                            errorMessage: msg
                        });
                    },
                    OutEventMouseDown: function(e) {
                        logOutEvent(e);
                    },
                    OutEventAddShare: function(e) {
                        logOutEvent(e);
                        var shares = getShares(), transformedShares, i;
                        transformedShares = {
                            shares: []
                        };
                        for (i = 0; i < shares.numApp; i++) {
                            transformedShares.shares.push({
                                name: shares.remoteAppName[i],
                                id: i,
                                highlight: ((shares.numApp - 1) === i) ? true : false
                            });
                        }

                        for (i = 0; i < shares.numApp; i++) {
                            if (e.URI.indexOf(shares.remoteAppUri[i]) > -1) {
                                currentRemoteShareUserId = shares.remoteAppUri[i];
                                shareStack.push(currentRemoteShareUserId);
                                setCurrentShare(i);
                                break;
                            }
                        }
                        vent.trigger(EVENT.VIDYO_API, EVENT.SCREEN_SHARE_ADDED);
                    },
                    OutEventRemoveShare: function(e) {
                        logOutEvent(e);
                        // getScreenShareList();
                        var shares = getShares(), i, j;
                        for (i = 0; i < shareStack.length; i++) {
                            if (shareStack[i] === e.URI) {
                                shareStack.splice(i, 1);
                            }
                        }

                        if ($.inArray(e.URI, shares.remoteAppUri) === -1) {

                            for (i = 0; i < shares.numApp; i++) {
                                if (shares.remoteAppUri[i] === shareStack[shareStack.length - 1] && shares.remoteAppUri[i] !== currentRemoteShareUserId) {
                                    currentRemoteShareUserId = shares.remoteAppUri[i];
                                    setCurrentShare(i);
                                    break;
                                }
                            }
                        }

                        if (shares.numApp.length === 1) {
                            currentRemoteShareUserId = shares.remoteAppUri[0];
                            setCurrentShare(0);
                        }
                        vent.trigger(EVENT.VIDYO_API, EVENT.SCREEN_SHARE_REMOVED);
                    },
                    OutEventSignedOut: function(e) {
                        logOutEvent(e);
                        var retry = false, errorMessage, error;
                        error = parseInt(e.error, 10);
                        if (error !== 0) {
                            logger.error("OutEventSignedOut error. Details: " + JSON.stringify(e));
                            if (e.cause === "UserSignedIn") { // Means login error
                                if (error === 401) {
                                    errorMessage = window.lang.VidyoClient.INVALID_CREDENTIALS;
                                } else if (error === 28) {
// (vidyo API VIDYO_CLIENT_ERROR_TCP_OPERATION_TIMED_OUT = 28)
                                    errorMessage = window.lang.VidyoClient.ERROR_TCP_OPERATION_TIMED_OUT;
                                } else if (error === 408) {
// (vidyo API VIDYO_CLIENT_ERROR_HTTP_408_TIMED_OUT = 408)
                                    errorMessage = window.lang.VidyoClient.ERROR_HTTP_408_TIMED_OUT;
                                } else if (error === 500) {
                                    errorMessage = window.lang.VidyoClient.MAXIMUM_NUMBER_OF_PARTICIPANTS_REACHED;
                                } else if (error === 2002) {
                                    if (isLicenseError) {
                                        logger.info("Error 2002, but license error has happened. OutEventLicense triggers login failure.");
                                    } else {
                                        logger.info("Error 2002, will retry.");
                                        retry = true;
                                    }
                                } else {
                                    errorMessage = genericLoginError(error);
                                }
                            } else {
                                errorMessage = window.lang.VidyoClient.FAILURE + e.cause;
                            }

                            if (errorMessage) {
                                vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                                    errorMessage: errorMessage
                                });
                            }

                            loginType = LOGIN_TYPE.NONE;
                            if (retry) {
                                vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                    retryLogin: true,
                                    errorMessage: undefined
                                });
                            }
                        }
                    },
                    OutEventParticipantsChanged: function(e) {
                        logOutEvent(e);
                        handleParticipantsChange();
                    },
                    OutEventConferenceEnded: function(e) {
                        logOutEvent(e);
                        if (!isConferenceEndend) {
                            isConferenceEndend = true;
                            vent.trigger(EVENT.VIDYO_API, EVENT.CONF_ENDED, {
                                successMessage: kickParticipant ? kickParticipant : window.lang.VidyoClient.LEFT_CONFERENCE
                            });
                        }
                    },
                    OutEventUserMessage: function(e) {
                        logOutEvent(e);
                        if (e.messageType === "ConnectionToServerLost") {
                            if (!kickParticipant) {
                                kickParticipant = window.lang.VidyoClient.CONNECTION_LOST;
                            }
                        }
                        else if (e.messageType === "DisconnectedFromConference") {
                            if (isGuest()) {
                                kickParticipant = window.lang.VidyoClient.DISCONNECTED_BY_MODERATOR;
                            }
                        }
                    },
                    OutEventCallState: function(e) {
                        logOutEvent(e);
                    },
                    OutEventIncomingCall: function(e) {
                        logOutEvent(e);
                    },
                    OutEventIncomingCallEnded: function(e) {
                        logOutEvent(e);
                    },
                    OutEventPinParticipantDone: function(e) {
                        logOutEvent(e);
                    },
                    OutEventGroupChat: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.RECEIVED_GROUP_CHAT_MESSAGES, e);
                    },
                    OutEventPrivateChat: function(e) {
                        logOutEvent(e);
                    },
                    OutEventConferenceInfoUpdate: function(e) {
                        logOutEvent(e);
                    },
                    OutEventDevicesChanged: function(e) {
                        logOutEvent(e);
                        getClientConfiguration().done(function(newConfig) {
                            if (e.deviceType === "Video") {
                                if (newConfig.cameras.length > 0) {
                                    setConfigurationList(DEVICE_NAMES.CAMERA, newConfig.cameras.length - 1, function() {
                                        logger.info("setConfigurationList() success for Camera");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.CAMERA});
                                    }, function(e) {
                                        logger.info("setConfigurationList() fail for Camera");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CONFIGURATION_ERROR, e);
                                    });
                                }
                                else {
                                    vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.CAMERA});
                                }
                            } else if (e.deviceType === "AudioOut") {
                                if (newConfig.speakers.length > 0) {
                                    setConfigurationList(DEVICE_NAMES.SPEAKER, newConfig.speakers.length - 1, function() {
                                        logger.info("setConfigurationList() success for Speaker");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.SPEAKER});
                                    }, function(e) {
                                        logger.info("setConfigurationList() fail for Camera");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CONFIGURATION_ERROR, e);
                                    });
                                }
                                else {
                                    vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.SPEAKER});
                                }
                            } else if (e.deviceType === "AudioIn") {
                                if (newConfig.microphones.length > 0) {
                                    setConfigurationList(DEVICE_NAMES.MICROPHONE, newConfig.microphones.length - 1, function() {
                                        logger.info("setConfigurationList() success for Microphone");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.MICROPHONE});
                                    }, function(e) {
                                        logger.info("setConfigurationList() fail for Camera");
                                        vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CONFIGURATION_ERROR, e);
                                    });
                                }
                                else {
                                    vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CHANGE_OUT_EVENT, {deviceName: DEVICE_NAMES.MICROPHONE});
                                }
                            }
                            else {
                                logger.error("not handle OutEventDevicesChanged callback for this device" + e.deviceType);
                            }
                        }).fail(function(e) {
                            vent.trigger(EVENT.VIDYO_API, EVENT.DEVICE_CONFIGURATION_ERROR, e);
                        });
                    },
                    OutEventEchoDetected: function(e) {
                        logOutEvent(e);
                    },
                    OutEventMutedAudioIn: function(e) {
                        /*
                         * TODO: How does the errorCode parameter is used?
                         * It is received with all mute events with 0 value??
                         */
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.LOCAL_MEDIA_UPDATE_EVENT, {
                            device: "microphone",
                            isMuted: e.isMuted
                        });
                    },
                    OutEventMutedAudioOut: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.LOCAL_MEDIA_UPDATE_EVENT, {
                            device: "speaker",
                            isMuted: e.isMuted
                        });
                    },
                    OutEventMutedVideo: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.LOCAL_MEDIA_UPDATE_EVENT, {
                            device: "video",
                            isMuted: e.isMuted
                        });
                    },
                    OutEventMutedServerAudioIn: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.SERVER_MEDIA_UPDATE_EVENT, {
                            serverMedia: "audio",
                            isServerMediaMuted: e.isMuted
                        });
                    },
                    OutEventMutedServerVideo: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.SERVER_MEDIA_UPDATE_EVENT, {
                            serverMedia: "video",
                            isServerMediaMuted: e.isMuted
                        });
                    },
                    OutEventMediaControl: function(e) {
                        logOutEvent(e);
                        vent.trigger(EVENT.VIDYO_API, EVENT.SERVER_BASED_MEDIA_CONTROL_EVENT, {
                            command: e.mediaCommand,
                            media: e.mediaType,
                            source: e.mediaSource
                        });
                    },
                    OutEventRoomLink: function(e) {
                        logOutEvent(e);
                    }
                };
                return vidyoPluginOutEventCallbackObject;
            }

            function vidyoPluginLoad() {
                var localConfig = {
                    plugin: $(pluginContainerSelector).children(":first").get()[0],
                    defaultOutEventCallbackMethod: function(event) {
                        logger.debug("default callback for client lib: ", event);
                    },
                    useCallbackWithPlugin: true,
                    outEventCallbackObject: vidyoPluginOutEventCallbackObject,
                    logCallback: function(message) {
                        logger.debug("jsVidyoClient: ", message);
                    }
                };
                vidyoClient = vidyoAPI.client(localConfig);
                return vidyoClient;
            }

            function vidyoPluginIsInstalled() {
                return utils.vidyoPluginIsInstalled(vidyoConfig.pluginMimeType, getPluginVersion(), vidyoConfig.activexType);
            }

            function vidyoClientGuestLoginAndJoin(guestURL, nickname) {
                logger.info('vidyoClientGuestLoginAndJoin(', guestURL, ')');
                var inEventLoginParams = {}, fullURIArray, inEvent;
                // Test http://dev20.vidyo.com/flex.html?roomdirect.html&key=U6AnrCjEaMBx
                inEventLoginParams.fullURI = guestURL;
                /* Split full URI into tokens that Vidyo Client library understands */
                fullURIArray = inEventLoginParams.fullURI.split('flex.html?roomdirect.html&key=');
                inEventLoginParams.portalUri = fullURIArray[0];
                inEventLoginParams.roomKey = fullURIArray[1];
                inEventLoginParams.guestName = nickname;
                guestNickName = nickname;
                //inEventLoginParams.pin = self.cache.$guestPIN.val();


                inEvent = vidyoAPI.privateMessages.privateInEventVcsoapGuestLink(inEventLoginParams);
                //inEvent.typeRequest = "GuestLink";
                inEvent.requestId = currentRequestId++;
                if (!vidyoClient.sendEvent(inEvent)) {
                    vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                        errorMessage: window.lang.VidyoClient.LOGIN_REGUEST_SENDING_FAILURE
                    });
                    return undefined;
                }
                loginType = LOGIN_TYPE.GUEST;
                return true;
            }

            function vidyoClientUserLogin(username, password, portalUri) {
                logger.info('login: clientUserLogin()');
                vidyoConfig.loginParameters.userName = username;
                vidyoConfig.loginParameters.userPass = password;
                vidyoConfig.loginParameters.portalUri = portalUri;
                var inEvent = vidyoAPI.messages.inEventLogin(vidyoConfig.loginParameters);
                if (!vidyoClient.sendEvent(inEvent)) {
                    vent.trigger(EVENT.VIDYO_API, EVENT.LOGIN_FAILURE, {
                        errorMessage: window.lang.VidyoClient.LOGIN_REGUEST_SENDING_FAILURE
                    });
                    return undefined;
                }
                loginType = LOGIN_TYPE.USER;
                return true;
            }

            function vidyoClientUserLogout() {
                logger.info('vidyoClientUserLogout()');
                var inEvent = vidyoAPI.messages.inEventSignoff({});
                if (!vidyoClient.sendEvent(inEvent)) {
                    return undefined;
                }
                return true;
            }

            function vidyoPluginIsLoaded() {
                logger.info('plugin: vidyoPluginIsLoaded()');
                return vidyoClient.isLoaded();
            }

            function vidyoPluginIsStarted() {
                logger.info('plugin: vidyoPluginIsStarted');
                return vidyoClient.isStarted();
            }

            function initializeVariablesOnPluginStart() {
                isPluginStartTriggeredByClientLogin = false;
            }

            function vidyoPluginStart() {
                logger.info('plugin: vidyoPluginStart');
                var msg;
                if (!vidyoClient) {
                    if (!vidyoPluginLoad()) {
                        return false;
                    }
                }

                /* Set all callbacks */
                try {
                    $.each(vidyoPluginOutEventCallbackObject.callbacks, function(key, val) {
                        vidyoClient.setOutEventCallbackMethod(key, val);
                    });
                } catch (e) {
                    logger.warn("plugin: vidyoPluginStartFailed -  to set callbacks");
                }

                if (vidyoClient.start()) {
                    msg = "VidyoPluginController started successfully";
                    initializeVariablesOnPluginStart();
                } else {
                    msg = "VidyoPluginController did not start successfully!";
                    return false;
                }

                logger.info("plugin: vidyoPluginStart(): " + msg);
                return true;
            }

            /**
             * Start plugin detection
             *
             * @return None
             * @param {Boolean} runWhenDetected 
             */
            function uiStartPluginDetection(runWhenDetected) {
                logger.info('uiStartPluginDetection(' + runWhenDetected + ')');
                /* Check if installed */
                if (vidyoPluginIsInstalled()) {
                    /* Check for browser blockade */
                    if (runWhenDetected) {
                        /* Load plugin into dome */
                        vidyoPluginLoad();
                        /* Check if loaded. In case it was not loaded it is likely blockaded by browser */
                        if (vidyoPluginIsLoaded()) {
                            logger.info("uiStartPluginDetection() -- plugin is found and loaded - reloading page");
                            if (vidyoPluginIsStarted()) { // started already
                                vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                    retryLogin: false,
                                    errorMessage: window.lang.VidyoClient.PLUGIN_ALREADY_STARTED
                                });
                            } else { // not started yet
                                if (vidyoPluginStart()) {
                                    logger.info('plugin: started...');
                                    isPluginStarted = true;
                                } else { //failed to start
                                    vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                        retryLogin: false,
                                        errorMessage: window.lang.VidyoClient.START_LIB_FAILURE
                                    });
                                }
                            }
                            return;
                        }
                    } else {
                        logger.info("uiStartPluginDetection() -- plugin is found, reloading");
                        /* IE and Safari does not like loading plugin in the same page after install so reloading page */
                        location.reload();
                        return;
                    }
                }
                /* in case of no plugin detected, try again */
                window.setTimeout(function() {
                    uiStartPluginDetection(runWhenDetected);
                },
                        1000);
                return;
            }

            /**
             * waitForIE9 is a deferred function that only check for the VidyoPlugin availibility 
             * in predefined time intervals, in other browsers this function returns as fast as it can
             * without entering the loop, when the plugin is loaded, the function quits checking it.
             * @returns {unresolved}
             */
            function waitForIE9() {
                var deferred = $.Deferred(), waitfunction, start = new Date().getTime(), end = 0, browserName = utils.getBrowser();
                if (browserName.indexOf("IE") >= 0 && browserName.indexOf("9") > 0 && vidyoPluginIsInstalled()) {
                    logger.info("waitForIE9() : Waiting...");
                    waitfunction = function wait() {
                        window.setTimeout(function() {
                            if (!vidyoPluginIsLoaded()) {
                                waitfunction();
                            }
                            end = new Date().getTime();
                            logger.info("waitForIE9(): Waiting...Done. In : " + (end - start) + " ms.");
                            deferred.resolve();
                        }, 20);
                    };
                    waitfunction();
                } else {
                    deferred.resolve();
                }
                return deferred;
            }

            function vidyoPluginInitAndStart() {
                logger.info('plugin: vidyoPluginInitAndStart()');
                var promise = $.Deferred();
                /* Attaches plugin object to the JS vidyo.client library */
                vidyoPluginLoad();
                /*wait for IE9 to load plugin data into*/
                promise = waitForIE9();
                promise.done(function() {
                    /* Check if started correctly */
                    if (vidyoPluginIsLoaded()) {
                        if (vidyoPluginIsStarted()) { // started already
                            vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                retryLogin: false,
                                errorMessage: window.lang.VidyoClient.PLUGIN_ALREADY_STARTED
                            });
                        } else { // not started yet
                            if (vidyoPluginStart()) {
                                logger.info('plugin: started...');
                                vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_SUCCESS, {
                                    errorMessage: window.lang.VidyoClient.PLUGIN_READY
                                });
                                isPluginStarted = true;
                            } else { //failed to start
                                vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                    retryLogin: false,
                                    errorMessage: window.lang.VidyoClient.START_LIB_FAILURE
                                });
                            }
                        }
                    } else {
                        /* Failed to load plugin */
                        logger.info("plugin: Failed to load plugin.");
                        if (vidyoPluginIsInstalled()) {
                            /* Plugin is installed but not loaded. Probably blocked by the browser. */
                            vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                retryLogin: false,
                                errorMessage: window.lang.VidyoClient.PLUGIN_BLOCKED
                            });
                            uiStartPluginDetection(true);
                        } else {
                            vent.trigger(EVENT.VIDYO_API, EVENT.PLUGIN_FAILURE, {
                                retryLogin: false,
                                errorMessage: window.lang.VidyoClient.PLUGIN_NOT_FOUND
                            });
                            uiStartPluginDetection(false);
                        }
                    }
                    promise.resolve();
                });
                return promise;
            }

            function sendMessageClientGroupChat(message) {
                logger.info("plugin: Group Chat send message for " + message + ".");
                var params = {}, inEvent, msg, deferred = $.Deferred();
                params.message = message;
                inEvent = vidyoAPI.messages.inEventGroupChat(params);
                if (vidyoClient.sendEvent(inEvent)) {
                    msg = "VidyoPluginController sent " + inEvent.type + " event successfully";
                    deferred.resolve();
                } else {
                    msg = "VidyoPluginController did not send " + inEvent.type + " event successfully!";
                    deferred.reject();
                }
                logger.info('info', 'call', "clientGroupChatSend(): " + msg);
                return deferred;
            }

            function initializePluginContainer() {
                logger.info("application: initializePluginContainer()");
                var pluginContainer = $(pluginContainerSelector), htmlData;
                htmlData = "<object id='" + vidyoConfig.pluginIdName + "' type='" + vidyoConfig.pluginMimeType + getPluginVersion() + "'>";
                pluginContainer.html(htmlData);
                return true;
            }

            function loadAndInitializePlugin(pluginElement) {
                var deferred = $.Deferred();
                if (!isPluginStarted) {
                    pluginContainerSelector = pluginElement;
                    if (loadConfiguration()) {
                        bindVidyoCallbacks();
                        initializePluginContainer();
                        vidyoPluginInitAndStart().done(function() {
                            if (isPluginStarted) {
                                deferred.resolve();
                            }
                        });
                    }
                    else {
                        deferred.reject();
                    }
                }
                else {
                    deferred.resolve();
                }
                return deferred;
            }

            function initializeRequiredGlobalVariables() {
                logger.info("Initializing required variables.");
                isLicenseError = false;
                guestNickName = undefined;
                userAccount = undefined;
                loginType = undefined;
            }

            function pluginStartIsTriggeredByClientLogin() {
                isPluginStartTriggeredByClientLogin = true;
            }

            return Controller.create({
                EVENT: EVENT,
                ERROR_CODE: ERROR_CODE,
                init: loadAndInitializePlugin,
                initAndUserLogin: function(username, password, portalUri) {
                    var deferred = $.Deferred();
                    initializeRequiredGlobalVariables();
                    loadAndInitializePlugin().done(function() {
                        pluginStartIsTriggeredByClientLogin();
                        if (vidyoClientUserLogin(username, password, portalUri)) {
                            deferred.resolve();
                        }
                        else {
                            deferred.reject();
                        }
                    }).fail(function() {
                        deferred.reject();
                    });
                    return deferred;
                },
                initAndGuestLoginAndJoinRoom: function(guestUrl, nickname) {
                    var deferred = $.Deferred();
                    initializeRequiredGlobalVariables();
                    loadAndInitializePlugin().done(function() {
                        pluginStartIsTriggeredByClientLogin();
                        if (vidyoClientGuestLoginAndJoin(guestUrl, nickname)) {
                            deferred.resolve();
                        }
                        else {
                            deferred.reject();
                        }
                    }).fail(function() {
                        deferred.reject();
                    });
                    return deferred;
                },
                joinMyConferenceRoom: function() {
                    if (!userAccount || !userAccount.entityID) {
                        return false;
                    }

                    return joinConference(userAccount.entityID);
                },
                joinConfereneceWithRoomId: function(roomId) {
                    return joinConference(roomId);
                },
                leaveMyConferenceRoom: leaveConference,
                getScreenShareList: getScreenShareList,
                startLocalShare: startLocalShare,
                setCurrentShare: setCurrentShare,
                setPreviewMode: function(selfView, participantNumber, successCallback, failureCallback) {
                    setPreviewMode(selfView, participantNumber)
                            .done(function(data) {
                        successCallback(data);
                    })
                            .fail(function(e) {
                        failureCallback(e);
                    });
                },
                setLayoutMode: function(numPreferred, successCallback, failureCallback) {
                    setLayoutMode(numPreferred)
                            .done(function(data) {
                        successCallback(data);
                    })
                            .fail(function(e) {
                        failureCallback(e);
                    });
                },
//                vidyoClientPrivateChat: vidyoClientPrivateChat,
                sendMessageClientGroupChat: function(messages, successCallback, failureCallback) {
                    sendMessageClientGroupChat(messages).
                            done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                getConfigurationList: getConfigurationList,
                setConfigurationList: setConfigurationList,
                getShares: getShares,
                setCurrentRemoteShare: setCurrentRemoteShare,
                vyTempAssign: vyTempAssign,
                getCurrentRoomId: function() {
                    if (userAccount && userAccount.entityID) {
                        return userAccount.entityID;
                    }
                },
                getRoomIsLocked: function() {
                    if (userAccount && userAccount.RoomMode) {
                        return userAccount.RoomMode.isLocked;
                    }
                },
                setRoomIsLocked: function(lock) {
                    if (userAccount && userAccount.RoomMode) {
                        userAccount.RoomMode.isLocked = lock;
                    }
                },
                getGuestUserLink: function() {
                    if (userAccount && userAccount.RoomMode && userAccount.RoomMode.roomURL) {
                        return userAccount.RoomMode.roomURL;
                    }
                },
                logout: vidyoClientUserLogout,
                muteMicrophone: function(successCallback, failureCallback) {
                    muteMicrophone(true)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                unmuteMicrophone: function(successCallback, failureCallback) {
                    muteMicrophone(false)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                muteSpeakers: function(successCallback, failureCallback) {
                    muteSpeakers(true)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                unmuteSpeakers: function(successCallback, failureCallback) {
                    muteSpeakers(false)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                muteVideo: function(successCallback, failureCallback) {
                    muteVideo(true)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                unmuteVideo: function(successCallback, failureCallback) {
                    muteVideo(false)
                            .done(function() {
                        successCallback();
                    })
                            .fail(function() {
                        failureCallback();
                    });
                },
                isGuest: isGuest,
                disconnectConferenceAll: function() {
                    return disconnectConferenceAllRequest(userAccount.entityID);
                },
                lockRoom: function(lock) {
                    return lockRoomRequest(userAccount.entityID, lock);
                },
                muteAudioServerAll: function(muteState) {
                    return muteAudioServerAllRequest(userAccount.entityID, muteState);
                },
                muteAudioClientAll: function() {
                    return muteAudioClientAllRequest(userAccount.entityID);
                },
                muteVideoServerAll: function(muteState) {
                    /*
                     * TODO: Can check if userAccount and userAccount.entityID is not null
                     * and return a deferred object, later. For now, in our bussiness logic
                     * userAccount should have been set before this function is called.
                     * Therefore not critical currently.
                     * Do the required implementation in all similar functions
                     * (muteVideoClientAll, muteParticipantAudio, lockRoom etc.)
                     * when implementing.
                     */
                    return muteVideoServerAllRequest(userAccount.entityID, muteState);
                },
                muteVideoClientAll: function() {
                    return muteVideoClientAllRequest(userAccount.entityID);
                },
                muteParticipantAudio: function(participantID) {
                    return muteParticipantAudioRequest(userAccount.entityID, participantID);
                },
                unmuteParticipantAudio: function(participantID) {
                    return unmuteParticipantAudioRequest(userAccount.entityID, participantID);
                },
                startParticipantVideo: function(participantID) {
                    return startParticipantVideoRequest(userAccount.entityID, participantID);
                },
                stopParticipantVideo: function(participantID) {
                    return stopParticipantVideoRequest(userAccount.entityID, participantID);
                },
                kickParticipant: function(participantID) {
                    return disconnectParticipant(userAccount.entityID, participantID);
                },
                getMyAccount: function() {
                    return userAccount;
                },
                getPluginVersion: getPluginVersion,
                updateParticipantsList: handleParticipantsChange,
                requestIsServerVideoMuted: requestGetMutedServerVideo,
                requestIsServerAudioInMuted: requestGetMutedServerAudioIn,
                getUpToDateParticipantsListForGuest: function() {
                    var isClientRequest = true;
                    return getCurrentParticipantsListForGuest(isClientRequest);
                },
                getUpToDateParticipantsListForUser: function() {
                    var isClientRequest = true;
                    return getCurrentParticipantsListForUser(isClientRequest);
                },
                // TODO: If required a second getClientConfiguration (asynch version) of 
                // this method can also be implemented. 
                // There are some cases where synch version is needed ,so the following method is implemented.
                getClientConfiguration: function() {
                    var isSynchRequest = true;
                    return getClientConfiguration(isSynchRequest);
                },
                updateProxyConfiguration: updateProxyConfiguration,
                resetRequiredClientConfigurationParams: resetRequiredClientConfigurationParams,
                getUpToDateValueOfProxy: getUpToDateValueOfProxy,
                updateEnableEchoCancellationConfiguration: function(isSet, successCallback, failureCallback) {
                    updateEnableEchoCancellationConfiguration(isSet, successCallback, failureCallback);
                },
                getUpToDateValueOfEnableEchoCancellation: getUpToDateValueOfEnableEchoCancellation,
                updateEnableAudioAGCConfiguration: function(isSet, successCallback, failureCallback) {
                    updateEnableAudioAGCConfiguration(isSet, successCallback, failureCallback);
                },
                getUpToDateValueOfEnableAudioAGC: getUpToDateValueOfEnableAudioAGC,
                disableEchoCancellationIfRecommended: function(echoCancellationDisabledCallback, failureCallback) {
                    disableEchoCancellationIfRecommended(echoCancellationDisabledCallback, failureCallback);
                }
            });
        });
