/*global define, window, $, CONSTANTS*/

define('vidyoController', ['Controller', 'eventAggregator', 'VidyoPluginController', 'vidyoView', 'DialogController', 'logController', 'errorView'],
        function(Controller, vent, vidyoPluginController, vidyoView, dialogController, logController, errorView) {
            var currentParticipants = [],
                    updateParticipantsListTimerID,
                    isConferenceActive = false,
                    // Local media constants/variables
                    DEVICE_TYPE_MICROPHONE = CONSTANTS.USED_MEDIA_TYPES.DEVICE_TYPE_MICROPHONE,
                    DEVICE_TYPE_SPEAKER = CONSTANTS.USED_MEDIA_TYPES.DEVICE_TYPE_SPEAKER,
                    DEVICE_TYPE_VIDEO = CONSTANTS.USED_MEDIA_TYPES.DEVICE_TYPE_VIDEO,
                    DEVICE_MAP_DEFAULT_VALUES = function() {
                return {
                    "microphone": {mute: false, disabled: false},
                    "speaker": {mute: false, disabled: false},
                    "video": {mute: false, disabled: false}
                };
            },
                    deviceMap = DEVICE_MAP_DEFAULT_VALUES(),
                    // Server media control constants/variables
                    SERVER_MEDIA_TYPE_AUDIO = CONSTANTS.USED_MEDIA_TYPES.SERVER_MEDIA_TYPE_AUDIO,
                    SERVER_MEDIA_TYPE_VIDEO = CONSTANTS.USED_MEDIA_TYPES.SERVER_MEDIA_TYPE_VIDEO,
                    ANIMATE_SILENCE_AUDIO = CONSTANTS.USED_MEDIA_TYPES.ANIMATE_SILENCE_AUDIO,
                    ANIMATE_SILENCE_VIDEO = CONSTANTS.USED_MEDIA_TYPES.ANIMATE_SILENCE_VIDEO,
                    portalUriData,
                    self,
                    SERVER_MEDIA_DEFAULT_VALUES = function() {
                return {
                    "audio": false,
                    "video": false,
                    "animateSilenceAudio": false,
                    "animateSilenceVideo": false};
            },
                    serverMediaMap = SERVER_MEDIA_DEFAULT_VALUES(),
                    isModeratorsMediaTurnedOn = false,
                    hasAlreadyReceivedFirstListWithMe = false,
                    // Media control event constants
                    MEDIA_CONTROL_COMMAND_SILENCE = CONSTANTS.USED_MEDIA_TYPES.MEDIA_CONTROL_COMMAND_SILENCE,
                    MEDIA_CONTROL_MEDIA_TYPE_AUDIO = CONSTANTS.USED_MEDIA_TYPES.MEDIA_CONTROL_MEDIA_TYPE_AUDIO,
                    MEDIA_CONTROL_MEDIA_TYPE_VIDEO = CONSTANTS.USED_MEDIA_TYPES.MEDIA_CONTROL_MEDIA_TYPE_VIDEO,
                    loginSuccessHandler,
                    logger = logController.getLogger('VidyoController'),
                    VIDYO_EVENT = CONSTANTS.EVENT,
                    VIDYO_ERROR_CODE = CONSTANTS.ERROR_CODE,
                    DEVICE_NAMES = CONSTANTS.DEVICE_NAMES;

            function handleSendGroupChatMessage(message, successCallback, failureCallback) {
                vidyoPluginController.sendMessageClientGroupChat(message, function() {
                    logger.info("sendMessageClientGroupChat request success for : " + message);
                    successCallback();
                }, function() {
                    logger.info("sendMessageClientGroupChat request failure for : " + message);
                    failureCallback();
                });
            }

            function refreshParticipantsOnClick() {
                var isClickEvent = true;
                logger.info("Participants list view will be refreshed.", currentParticipants);
                vidyoView.reloadParticipantsList(currentParticipants, vidyoPluginController.isGuest(), isClickEvent);
                //TODO: generates dummy participants for test purposes only
//              vidyoView.fillParticipantListWithFakeUsersForTest();
            }

            function refreshParticipantsListView() {
                /*  Let's display the participants counter in the left nav badge area */
                vidyoView.writeParticipantsCounter(currentParticipants);
                if (vidyoView.isCurrentTabInViewParticipants()) {
                    logger.info("Participants list view will be refreshed.", currentParticipants);
                    vidyoView.reloadParticipantsList(currentParticipants, vidyoPluginController.isGuest());
                    //TODO: generates dummy participants for test purposes only
//                    vidyoView.fillParticipantListWithFakeUsersForTest();
                }
            }

            function refreshModeratorControlsView(onclick) {
                logger.info("Moderator controls view will be refreshed. Server media information: " + JSON.stringify(serverMediaMap)
                        + ", isRoomLocked: " + JSON.stringify(vidyoPluginController.getRoomIsLocked()));
                if (onclick) {
                    vidyoView.reloadModeratorControlsTab(serverMediaMap,
                            vidyoPluginController.getRoomIsLocked(), onclick);
                } else {
                    if (vidyoView.isCurrentTabInViewModeratorControls()) {
                        vidyoView.reloadModeratorControlsTab(serverMediaMap,
                                vidyoPluginController.getRoomIsLocked());
                    }
                }
            }

            function getTheParticipantWithTheGivenParticipantID(participantID) {
                var i;
                for (i = 0; i < currentParticipants.length; i++) {
                    if (currentParticipants[i].participantID === participantID) {
                        return currentParticipants[i];
                    }
                }
            }

            function stringifyMuteParam(isMute) {
                return (isMute ? "Mute" : "Unmute");
            }

            function controlAnimation(animatedOperation, startStopFlag) {
                var d = new Date();
                logger.info((startStopFlag === true ? "Starting" : "Stopping")
                        + " animation for " + animatedOperation + ". Current time: " + d.getTime());
                serverMediaMap[animatedOperation] = startStopFlag;
                refreshModeratorControlsView();
            }

            function animate(animatedOperation) {
                controlAnimation(animatedOperation, true);
                setTimeout(function() {
                    controlAnimation(animatedOperation, false);
                }, CONSTANTS.GENERAL.SILENCE_ANIMATION_DURATION);
            }

            function stopAnimationImmediately(animatedOperation) {
                controlAnimation(animatedOperation, false);
            }

            function logFailCase(prefix, errorParam1, errorParam2) {
                logger.error(prefix + " Error parameter 1: " + JSON.stringify(errorParam1)
                        + ", error parameter 2: " + JSON.stringify(errorParam2));
            }

            function updateServerMediaControls(serverMedia, isServerMediaMuted) {
                logger.info("Updating server media information. Server media: "
                        + serverMedia + ", is muted: " + isServerMediaMuted);
                serverMediaMap[serverMedia] = isServerMediaMuted;
                refreshModeratorControlsView();
            }

            function updateAllParticipantsAudio(value) {
                var i;
                for (i = 0; i < currentParticipants.length; i++) {
                    currentParticipants[i].audio = value;
                }
            }

            function updateAllParticipantsVideo(value) {
                var i;
                for (i = 0; i < currentParticipants.length; i++) {
                    currentParticipants[i].video = value;
                }
            }

            function updateAllParticipantsControls(serverMedia, isServerMediaMuted) {
                logger.info("Updating media information for all participants. Server media: "
                        + serverMedia + ", is muted: " + isServerMediaMuted);
                if (serverMedia === SERVER_MEDIA_TYPE_AUDIO) {
                    updateAllParticipantsAudio(!isServerMediaMuted);
                }
                else if (serverMedia === SERVER_MEDIA_TYPE_VIDEO) {
                    updateAllParticipantsVideo(!isServerMediaMuted);
                }
                refreshParticipantsListView();
            }

            function handleServerMediaOperationSuccess(serverMedia, isServerMediaMuted) {
                updateServerMediaControls(serverMedia, isServerMediaMuted);
                updateAllParticipantsControls(serverMedia, isServerMediaMuted);
            }

            function compareCaseInsensitive(name1, name2) {
                var normalizedName1, normalizedName2;

                normalizedName1 = name1.toLocaleLowerCase();
                normalizedName2 = name2.toLocaleLowerCase();

                return normalizedName1.localeCompare(normalizedName2);
            }

            function meOnTopComparator(participant1, participant2) {
                if (participant1.isMe === true && participant2.isMe === true) {
                    return compareCaseInsensitive(participant1.displayName, participant2.displayName);
                } else if (participant1.isMe === true) {
                    return -1;
                } else if (participant2.isMe === true) {
                    return 1;
                } else {
                    return compareCaseInsensitive(participant1.displayName, participant2.displayName);
                }
            }

            function isTheParticipantsListChanged(newParticipants) {
                var i;
                if (currentParticipants.length !== newParticipants.length) {
                    return true;
                }

                if (vidyoPluginController.isGuest()) {
                    for (i = 0; i < currentParticipants.length; i++) {
                        if (currentParticipants[i].displayName !== newParticipants[i].displayName ||
                                currentParticipants[i].isMe !== newParticipants[i].isMe) {
                            return true;
                        }
                    }
                } else {
                    for (i = 0; i < currentParticipants.length; i++) {
                        if (currentParticipants[i].displayName !== newParticipants[i].displayName ||
                                currentParticipants[i].isMe !== newParticipants[i].isMe ||
                                currentParticipants[i].participantID !== newParticipants[i].participantID ||
                                currentParticipants[i].audio !== newParticipants[i].audio ||
                                currentParticipants[i].video !== newParticipants[i].video) {
                            return true;
                        }
                    }
                }
                return false;
            }

            function getMyRecord() {
                var i;
                for (i = 0; i < currentParticipants.length; i++) {
                    if (currentParticipants[i].isMe) {
                        return currentParticipants[i];
                    }
                }
            }

            function popUp(message, popupKey) {
                logger.info("Pop-up will be displayed: " + message);
                //change this to question popup
                switch (popupKey) {
                    case 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE':
                        vidyoView.showPopup(message, "", true, undefined, 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE');
                        break;
                    case "PARTICIPANTS_CHANGED":
                        //first show popup and then play sound. Show popup updates table that is necessary to play sound.
                        vidyoView.showPopup(message, "", false, 'bottomRight', popupKey);
                        vidyoView.playPopupSound(popupKey);
                        break;
                    default:
                        vidyoView.showPopup(message, "", false, undefined, popupKey);
                        break;
                }

            }

            function stringifyNameArray(partsList) {
                var namesString = "", i;

                for (i = 0; i < partsList.length; i++) {
                    namesString += partsList[i];
                    // Probably there will be just one element in the list in most cases....
                    if (i !== partsList.length - 1) {
                        namesString += ", ";
                    }
                }

                if (namesString.length > CONSTANTS.GENERAL.MAX_NAME_STRING_LENGTH_FOR_PARTS_CHANGE_POP_UP) {
                    namesString = namesString.substring(0, CONSTANTS.GENERAL.MAX_NAME_STRING_LENGTH_FOR_PARTS_CHANGE_POP_UP);
                    namesString += "...";
                }

                return namesString + " ";
            }

            function preparePopUpMessageForParticipantsListChange(partsList, postfix) {
                var message = "";

                if (partsList.length > 0) {
                    message = stringifyNameArray(partsList) + postfix;
                }

                return message;
            }

            // the list is sorted, so we can utilize this feature
            function diffOfListsSameNameElementsSensitive(oldList, newList, outs, ins) {
                var i = 0, j = 0, result;

                while (i < oldList.length && j < newList.length) {
                    // we have to use the same compare function which is used in sorting...
                    result = meOnTopComparator(oldList[i], newList[j]);
                    if (result === 0) {
                        i++;
                        j++;
                    } else if (result > 0) {
                        ins.push(newList[j].displayName);
                        j++;
                    } else { // (result < 0) 
                        outs.push(oldList[i].displayName);
                        i++;
                    }
                }

                // If there are remaining elements in oldList they are out elements.
                while (i < oldList.length) {
                    outs.push(oldList[i].displayName);
                    i++;
                }

                // Or, if there are remaining elements in newList they are in elements.
                while (j < newList.length) {
                    ins.push(newList[j].displayName);
                    j++;
                }
            }

            function popupTheDifferenceInParticipantsList(oldList, currentList) {
                var ins = [], outs = [];

                /*
                 * The diff used here and the one used in isTheParticipantsListChanged
                 * are diffent. For the moderator, if a guest leaves and joins conference
                 * and is assigned a different participantID between two participant updates
                 * he will not be sensed in the following function. (does not use participantID
                 * in comparison)
                 * 
                 * Encountered cases, in which a guest leaved the conference, and then joined the
                 * conference and assigned the same participantID. So it seems that any method 
                 * which takes participantID into account can not also guarantee to not to 
                 * miss any leaved and joined participants.
                 * 
                 * If the vidyo system generates a unique id for each joined participant during the
                 * conference, (if a participant leaves and joins with the same name, he is certainly 
                 * assigned a different id) a perfect solution can be developed??
                 * 
                 * For now i think this implementation is sufficient.
                 */
                diffOfListsSameNameElementsSensitive(oldList, currentList, outs, ins);

                if (ins.length > 0) {
                    if (ins.length === 1) {
                        popUp(preparePopUpMessageForParticipantsListChange(ins, window.lang.VidyoClient.POP_UP_JOINED_PARTICIPANT_POSTFIX), "PARTICIPANTS_CHANGED");
                    } else {
                        popUp(preparePopUpMessageForParticipantsListChange(ins, window.lang.VidyoClient.POP_UP_JOINED_PARTICIPANTS_POSTFIX), "PARTICIPANTS_CHANGED");
                    }
                }

                if (outs.length > 0) {
                    if (outs.length === 1) {
                        popUp(preparePopUpMessageForParticipantsListChange(outs, window.lang.VidyoClient.POP_UP_LEAVED_PARTICIPANT_POSTFIX), "PARTICIPANTS_CHANGED");
                    } else {
                        popUp(preparePopUpMessageForParticipantsListChange(outs, window.lang.VidyoClient.POP_UP_LEAVED_PARTICIPANTS_POSTFIX), "PARTICIPANTS_CHANGED");
                    }
                }
            }

            function handleNewParticipantsList(newParticipantsList) {
                logger.info("handleNewParticipantsList(" + newParticipantsList + ")");
                newParticipantsList.sort(meOnTopComparator);

                if (isTheParticipantsListChanged(newParticipantsList)) {
                    var oldParticipants, logFilter = vidyoPluginController.isGuest() ? ["displayName", "isMe"] : ["participantID", "displayName", "audio", "video", "isMe"];
                    logger.info("Updating participants list. New participants list (" + newParticipantsList.length + "): "
                            + JSON.stringify(newParticipantsList, logFilter));

                    oldParticipants = currentParticipants;
                    currentParticipants = newParticipantsList;

                    if (isConferenceActive) {
                        refreshParticipantsListView();

                        if (hasAlreadyReceivedFirstListWithMe && getMyRecord()) {
                            popupTheDifferenceInParticipantsList(oldParticipants, currentParticipants);
                        } else {
                            // Do not pop-up the initial list with me.
                            // Do not pop-up if me is not in the current list. 
                            // (To be more stable in conference start and end scenarios. E.g., 
                            // encountered cases where an empty list is received in conference end.)
                            logger.info("Will not pop-up difference in participants. This is the first list received which includes me or a list which does not include me.");
                        }

                        //change selfview according to participant number change
                        vidyoView.setSelfViewMode();
                    } else {
                        logger.info("Participants list changed but conference is not active.");
                    }

                } else {
                    logger.info("There is no difference in previous and new participants lists.");
                }

                if (!hasAlreadyReceivedFirstListWithMe && getMyRecord()) {
                    logger.info("This is the first participants list including me. Setting the flag.");
                    hasAlreadyReceivedFirstListWithMe = true;
                }
            }

            function updateParticipantsListForGuest() {
                logger.info("Getting up-to-date participant list.");
                var result = vidyoPluginController.getUpToDateParticipantsListForGuest();
                if (result.isRequestSuccess) {
                    handleNewParticipantsList(result.participantsList);
                } else {
                    logger.error("Could not get up-to-date participants list. Error: " + JSON.stringify(result));
                }
            }

            function deferredUpdateParticipantsListForGuest(duration) {
                logger.info("Will get up-to-date participant list after " + duration + " ms.");
                setTimeout(function() {
                    updateParticipantsListForGuest();
                }, duration);
            }

            function updateParticipantsListForModerator() {
                logger.info("Getting up-to-date participant list.");
                vidyoPluginController.getUpToDateParticipantsListForUser().done(function(newParticipantsList) {
                    handleNewParticipantsList(newParticipantsList);
                }).fail(function(error) {
                    logger.error("Could not get up-to-date participants list. Error: " + JSON.stringify(error));
                });
            }

            function deferredUpdateParticipantsListForModerator(duration) {
                logger.info("Will get up-to-date participant list after " + duration + " ms.");
                setTimeout(function() {
                    updateParticipantsListForModerator();
                }, duration);
            }

            /*
             * Vidyo conferencing system is a distributed system. One of the nodes
             * might not receive a participants change event. We set up a periodic 
             * participants list updater.
             * 
             * Might be more useful for moderator. Because guests get participants
             * list from the plugin, probably with no server interaction during
             * the get participants call. So getting the participants list periodically 
             * might not solve missed participants changed events. However, moderator
             * gets participants list from server (soap call), so might get correct list from
             * server in case of missed participants list changed event.
             * 
             * Might be set also for guests if required later.
             */
            function setUpPeriodicParticipantListUpdate() {
                var UPDATE_INTERVAL = 60000;
                if (!vidyoPluginController.isGuest()) {
                    logger.info("Setting up periodic participants list updater. Interval between updates: "
                            + UPDATE_INTERVAL + " ms.");
                    updateParticipantsListTimerID = setInterval(function() {
                        logger.info("Periodic participants list update.");
                        updateParticipantsListForModerator();
                    }, UPDATE_INTERVAL);
                }
            }

            function handleKickParticipant(participantID) {
                logger.info("handleKickParticipant(" + participantID + ")");
                var participant = getTheParticipantWithTheGivenParticipantID(participantID), UPDATE_AFTER = 5000;
                if (participant && participant.participantID) {
                    vidyoPluginController.kickParticipant(participant.participantID).done(function(response) {
                        // We do not remove the participant from participants list. We handle it with 
                        // "PARTICIPANTS_CHANGED" event.
                        logger.debug("kickParticipant.done response: " + JSON.stringify(response));
                        logger.info("Kick participant (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") is successful.");
                    }).fail(function(errorParam1, errorParam2) {
                        logFailCase("Kick participant (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") error.", errorParam1, errorParam2);
                        /**
                         * Once we encountered the following scenario:
                         * Moderator called kick participant. Participant is kicked, but
                         * moderator received soap failure error and did not receive 
                         * any OutEventParticipantsChanged out events. To recover this case
                         * we update our participant list after an appropriate interval.
                         */
                        deferredUpdateParticipantsListForModerator(UPDATE_AFTER);
                    });
                } else {
                    logger.warn("Participant (participantID: " + participantID + ") does not exist in the internal list!");
                }
            }


            function handleMuteParticipantAudio(participantID) {
                logger.info("handleMuteParticipantAudio(" + participantID + ")");
                var participant = getTheParticipantWithTheGivenParticipantID(participantID);
                if (participant && participant.participantID) {
                    vidyoPluginController.muteParticipantAudio(participant.participantID).done(function(response) {
                        logger.debug("muteParticipantAudio.done response: " + JSON.stringify(response));
                        logger.info("Mute participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") audio is successful.");
                        participant.audio = false;
                        refreshParticipantsListView();
                    }).fail(function(errorParam1, errorParam2) {
                        logFailCase("Mute participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") audio error.", errorParam1, errorParam2);
                    });
                } else {
                    logger.warn("Participant (participantID: " + participantID + ") does not exist in the internal list!");
                }
            }

            function handleUnMuteParticipantAudio(participantID) {
                logger.info("handleUnMuteParticipantAudio(" + participantID + ")");
                var participant = getTheParticipantWithTheGivenParticipantID(participantID);
                if (participant && participant.participantID) {
                    vidyoPluginController.unmuteParticipantAudio(participant.participantID).done(function(response) {
                        logger.debug("unmuteParticipantAudio.done response: " + JSON.stringify(response));
                        logger.info("Unmute participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") audio is successful.");
                        participant.audio = true;
                        refreshParticipantsListView();
                    }).fail(function(errorParam1, errorParam2) {
                        logFailCase("Unmute participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") audio error.", errorParam1, errorParam2);
                    });
                } else {
                    logger.warn("Participant (participantID: " + participantID + ") does not exist in the internal list!");
                }
            }

            function handleStopParticipantVideo(participantID) {
                logger.info("handleStopParticipantVideo(" + participantID + ")");
                var participant = getTheParticipantWithTheGivenParticipantID(participantID);
                if (participant && participant.participantID) {
                    vidyoPluginController.stopParticipantVideo(participant.participantID).done(function(response) {
                        logger.debug("stopParticipantVideo.done response: " + JSON.stringify(response));
                        logger.info("Stop participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") video is successful.");
                        participant.video = false;
                        refreshParticipantsListView();
                    }).fail(function(errorParam1, errorParam2) {
                        logFailCase("Stop participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") video error.", errorParam1, errorParam2);
                    });
                } else {
                    logger.warn("Participant (participantID: " + participantID + ") does not exist in the internal list!");
                }
            }

            function handleStartParticipantVideo(participantID) {
                logger.info("handleStartParticipantVideo(" + participantID + ")");
                var participant = getTheParticipantWithTheGivenParticipantID(participantID);
                if (participant && participant.participantID) {
                    vidyoPluginController.startParticipantVideo(participant.participantID).done(function(response) {
                        logger.debug("startParticipantVideo.done response: " + JSON.stringify(response));
                        logger.info("Start participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") video is successful.");
                        participant.video = true;
                        refreshParticipantsListView();
                    }).fail(function(errorParam1, errorParam2) {
                        logFailCase("Start participant's (participantID: " + participantID
                                + ", displayName: " + participant.displayName + ") video error.", errorParam1, errorParam2);
                    });
                } else {
                    logger.warn("Participant (participantID: " + participantID + ") does not exist in the internal list!");
                }
            }

            function enableMyMediaFromServerIfRequired(media, isMute) {
                if (isMute && !vidyoView.isRoomShareOnly()) {
                    logger.info("Will enable my media from server.");
                    var me = getMyRecord();
                    if (me) {
                        if (media === SERVER_MEDIA_TYPE_VIDEO) {
                            handleStartParticipantVideo(me.participantID);
                        } else if (media === SERVER_MEDIA_TYPE_AUDIO) {
                            handleUnMuteParticipantAudio(me.participantID);
                        }
                    } else {
                        logger.error("Me does not exist in the participants list. Will not enable my media from server. Participants list: "
                                + JSON.stringify(currentParticipants));
                    }
                }
            }

            function handleServerVideoClicked(isMute) {
                logger.info("handleServerVideoClicked(" + isMute + ")");

                vidyoPluginController.muteVideoServerAll(isMute ? 1 : 0).done(function(response) {
                    logger.debug("muteVideoServerAll.done response: " + JSON.stringify(response));
                    logger.info(stringifyMuteParam(isMute) + " server video is successful.");

                    handleServerMediaOperationSuccess(SERVER_MEDIA_TYPE_VIDEO, isMute);
                    enableMyMediaFromServerIfRequired(SERVER_MEDIA_TYPE_VIDEO, isMute);

                }).fail(function(errorParam1, errorParam2) {
                    logFailCase(stringifyMuteParam(isMute) + " server video error.", errorParam1, errorParam2);
                });
            }

            function handleServerAudioClicked(isMute) {
                logger.info("handleServerAudioClicked(" + isMute + ")");

                vidyoPluginController.muteAudioServerAll(isMute ? 1 : 0).done(function(response) {
                    logger.debug("muteAudioServerAll.done response: " + JSON.stringify(response));
                    logger.info(stringifyMuteParam(isMute) + " server audio is successful.");

                    handleServerMediaOperationSuccess(SERVER_MEDIA_TYPE_AUDIO, isMute);
                    enableMyMediaFromServerIfRequired(SERVER_MEDIA_TYPE_AUDIO, isMute);

                }).fail(function(errorParam1, errorParam2) {
                    logFailCase(stringifyMuteParam(isMute) + " server audio error.", errorParam1, errorParam2);
                });
            }

            function handleSilenceParticipantsVideoClicked() {
                logger.info("handleSilenceParticipantsVideoClicked()");

                animate(ANIMATE_SILENCE_VIDEO);

                vidyoPluginController.muteVideoClientAll().done(function(response) {
                    logger.debug("muteVideoClientAll.done response: " + JSON.stringify(response));
                    logger.info("Silence participants video is successful.");
                }).fail(function(errorParam1, errorParam2) {
                    logFailCase("Silence participants video error.", errorParam1, errorParam2);
                    stopAnimationImmediately(ANIMATE_SILENCE_VIDEO);
                });
            }

            function handleSilenceParticipantsAudioClicked() {
                logger.info("handleSilenceParticipantsAudioClicked()");

                animate(ANIMATE_SILENCE_AUDIO);

                vidyoPluginController.muteAudioClientAll().done(function(response) {
                    logger.debug("muteAudioClientAll.done response: " + JSON.stringify(response));
                    logger.info("Silence participants audio is successful.");
                }).fail(function(errorParam1, errorParam2) {
                    logFailCase("Silence participants audio error.", errorParam1, errorParam2);
                    stopAnimationImmediately(ANIMATE_SILENCE_AUDIO);
                });
            }



            function handleRemoteScreenSelected(id) {
                logger.info("handleRemoteScreenSelected");
                vidyoPluginController.setCurrentRemoteShare(id);
                vidyoPluginController.getScreenShareList();
            }

            function handleScreenSelected(id) {
                logger.info("handleScreenSelected");
                if (vidyoPluginController.startLocalShare(id)) {
                    vidyoPluginController.getScreenShareList();
                }
            }


            function setUpToDateValueOfEchoCancellationAtUI() {
                logger.info("Will set up-to-date value of echo cancellation at UI.");
                var result = vidyoPluginController.getUpToDateValueOfEnableEchoCancellation();
                if (result.isRequestSuccess) {
                    if (vidyoView.isCurrentTabInViewSettings()) {
                        logger.info("Current tab in view is settings. Setting echo cancellation to up-to-date value: " + result.enableEchoCancellation);
                        vidyoView.setEchoCancellationConfig(result.enableEchoCancellation);
                    }
                } else {
                    logger.error("Set up-to-date value of echo cancellation at UI failure. Could not get up-to-date value of enable echo cancellation. Error: " + JSON.stringify(result.errorText));
                }
            }

            function disableEchoCancellationIfRecommended(noUIUpdate) {
                var deferred = $.Deferred();
                vidyoPluginController.disableEchoCancellationIfRecommended(
                        function() {
                            logger.info("Echo cancellation is disabled because of recommendation.");
                            // We encountered cases that we updated config values successfully 
                            // but internally plugin does not apply updated value, so we read the 
                            // up-to-date value and reflect to the UI. 
                            if (!noUIUpdate) {
                                setUpToDateValueOfEchoCancellationAtUI();
                            }

                            deferred.resolve();
                        },
                        function(e) {
                            logger.info("Echo cancellation is not modified. Reason: " + JSON.stringify(e));
                            deferred.reject();
                        });
                return deferred;
            }

            function handleEchoCancellationConfigChange(isChecked) {
                logger.info("handleEchoCancellationConfigChange(" + isChecked + ")");

                vidyoPluginController.updateEnableEchoCancellationConfiguration(isChecked,
                        function() {
                            logger.info("Set echo cancellation success. Echo cancellation: " + isChecked);
                            // We encountered cases that we updated config values successfully 
                            // but internally plugin does not apply updated value, so we read the 
                            // up-to-date value and reflect to the UI. 
                            setUpToDateValueOfEchoCancellationAtUI();
                        },
                        function(e) {
                            logger.error("Set echo cancellation failure. Error: " + JSON.stringify(e));
                            setUpToDateValueOfEchoCancellationAtUI();
                        });
            }

            function setUpToDateValueOfAudioAGCAtUI() {
                logger.info("Will set up-to-date value of audio AGC at UI.");
                var result = vidyoPluginController.getUpToDateValueOfEnableAudioAGC();
                if (result.isRequestSuccess) {
                    if (vidyoView.isCurrentTabInViewSettings()) {
                        logger.info("Current tab in view is settings. Setting audio AGC to up-to-date value: " + result.enableAudioAGC);
                        vidyoView.setAudioAGCConfig(result.enableAudioAGC);
                    }
                } else {
                    logger.error("Set up-to-date value of audio AGC at UI failure. Could not get up-to-date value of enable audio AGC. Error: " + JSON.stringify(result.errorText));
                }
            }

            function handleAudioAGCConfigChange(isChecked) {
                logger.info("handleAudioAGCConfigChange(" + isChecked + ")");

                vidyoPluginController.updateEnableAudioAGCConfiguration(isChecked,
                        function() {
                            logger.info("Set audio AGC success. Audio AGC: " + isChecked);
                            // We encountered cases that we updated config values successfully 
                            // but internally plugin does not apply updated value, so we read the 
                            // up-to-date value and reflect to the UI. E.g., there
                            // is no mic, change the audio AGC state, after successful 
                            // update read the config, AGC state is not changed...
                            setUpToDateValueOfAudioAGCAtUI();
                        },
                        function(e) {
                            logger.error("Set audio AGC failure. Error: " + JSON.stringify(e));
                            setUpToDateValueOfAudioAGCAtUI();
                        });
            }

            function handleSetCurrentDevice(deviceName, selection) {
                logger.info("handleSetCurrentDevice(" + deviceName + ", " + selection + ")");
                vidyoPluginController.setConfigurationList(deviceName, selection, function(data) {
                    logger.info("setConfigurationList() success" + data);
                }, function(e) {
                    if (deviceName === DEVICE_NAMES.SPEAKER || deviceName === DEVICE_NAMES.MICROPHONE) {
                        disableEchoCancellationIfRecommended();
                    }
                }, function(e) {
                    logger.info("setConfigurationList() failure " + e);
                });
            }

            function handleGetDeviceSettings(forceOpen) {
                vidyoPluginController.getConfigurationList(function(data) {
                    logger.info("handleGetDeviceSettings() success " + data);
                    vidyoView.showDeviceConfigurationList(data, forceOpen);
                }, function(e) {
                    logger.info("handleGetDeviceSettings() failure " + e);
                });
            }

            function handlePreviewModeChange(type) {
                vidyoPluginController.setPreviewMode(type, currentParticipants.length, function(data) {
                    logger.info("setPreviewMode request success " + data);
                }, function(e) {
                    logger.error("setPreviewMode request failure " + e);
                });
            }

            function handleLayoutModeChange(type) {
                vidyoPluginController.setLayoutMode(type, function(data) {
                    logger.info("setLayoutMode request success. " + data);
                }, function(e) {
                    logger.error("setLayoutMode request failure. " + e);
                });
            }

            function handleGetMyAccount() {
                var userAccount = vidyoPluginController.getMyAccount();
                vidyoView.setUserAccount(userAccount);
            }

            function handleVidyoPluginIsInstalled() {
                var isFound = vidyoPluginController.vidyoPluginIsInstalled();
                vidyoView.vidyoPluginIsNotInstalledError(isFound);
            }




            function handleGroupChatMessages(arg) {
                vidyoView.onReceiveMessage(arg);
            }

            function handleShareScreen() {
                logger.info("handleShareScreen");
                vidyoPluginController.getScreenShareList();
            }
            
            function handleMuteMicrophone() {
                vidyoPluginController.muteMicrophone(function () {
                    logger.info("Local muteMicrophone request success.");
                }, function () {
                    logger.error("Local muteMicrophone request failure!");
                });
            }
            
            function handleUnmuteMicrophone() {
                vidyoPluginController.unmuteMicrophone(function () {
                    logger.info("Local unmuteMicrophone request success.");
                }, function () {
                    logger.error("Local unmuteMicrophone request failure!");
                });
            }
            
            function handleMuteVideo() {
                vidyoPluginController.muteVideo(function () {
                    logger.info("Local muteVideo request success.");
                }, function () {
                    logger.error("Local muteVideo request failure!");
                });
            }
            
            function handleUnmuteVideo() {
                vidyoPluginController.unmuteVideo(function () {
                    logger.info("Local unmuteVideo request success.");
                }, function () {
                    logger.error("Local unmuteVideo request failure!");
                });
            }
            
            function handleMuteSpeakers() {
                vidyoPluginController.muteSpeakers(function () {
                    logger.info("Local muteSpeakers request success.");
                }, function () {
                    logger.error("Local muteSpeakers request failure!");
                });
            }

            function handleUnmuteSpeakers() {
                vidyoPluginController.unmuteSpeakers(function () {
                    logger.info("Local unmuteSpeakers request success.");
                }, function () {
                    logger.error("Local unmuteSpeakers request failure!");
                });
            }

            function handleConferenceEnded(data) {
                isConferenceActive = false;

                if (updateParticipantsListTimerID !== undefined) {
                    clearInterval(updateParticipantsListTimerID);
                }

                if (!vidyoPluginController.isGuest()) {
                    data.moderator = true;
                }

                if (data.successMessage === window.lang.VidyoClient.CONNECTION_LOST) {
                    data.successMessage = window.lang.VidyoClient.LOGIN_CONNECTION_LOST;
                    window.localStorage.setItem('data', JSON.stringify(data));
                    vidyoView.deactivateVidyoPluginContainer();
                    vidyoView.cleanUpWindow();
                    errorView.init({
                        errorMessage: window.lang.VidyoClient.CONNECTION_LOST,
                        connectionLost: true
                    });
                } else
                {
                    window.localStorage.setItem('data', JSON.stringify(data));
                    vidyoView.deactivateVidyoPluginContainer();
                    vidyoView.cleanUpWindow();
                    vidyoView.deActiveSessionTemplate();
                }
            }

            function handleLeaveConferenceFailure(data) {
                logger.info('Failed to leave conference: handleLeaveConferenceFailure');
                //if necessary we can show popup vs. in case of failure.
//                if(data.errorMessage){
//                   vidyoView.showProgressIndicator("error", data.errorMessage);
//                   vidyoView.hideLoadingItem(); 
//                }
            }

            function handleLeaveConferenceSuccess(data) {
                logger.info('Successfully leaved conference: handleLeaveConferenceSuccess');
                if (data && data.successMessage) {
                    vidyoView.showProgressIndicator("info", data.successMessage);
                    vidyoView.hideLoadingItem();
                }
            }


            function isAllLinesInUseFailure(data) {
                if (data && data.errorParam2 && data.errorParam2.faultstring) {
                    var lowerCaseFault = data.errorParam2.faultstring.toLowerCase();
                    // String comparison is fragile. (at least fo a fault string)
                    // To reduce the possibility of fragility we do partial comparison.
                    return lowerCaseFault.indexOf("all lines in use") > -1;
                } else {
                    return false;
                }
            }


            function handleJoinConferenceFailure(data) {
                var msg;
                if (isAllLinesInUseFailure(data)) {
                    msg = window.lang.VidyoClient.ALL_LINES_IN_USE_ERROR;
                } else {
                    msg = data.errorMessage;
                }
                vidyoView.showProgressIndicator("error", msg);
                vidyoView.hideLoadingItem();
            }

            function handlePluginFailure(data) {
                if (data && data.errorMessage) {
                    if (data.errorMessage === window.lang.VidyoClient.PLUGIN_ALREADY_STARTED
                            || data.errorMessage === window.lang.VidyoClient.PLUGIN_BLOCKED
                            || data.errorMessage === window.lang.VidyoClient.PLUGIN_NOT_FOUND) {
                        if (data.errorMessage === window.lang.VidyoClient.PLUGIN_ALREADY_STARTED) {
                            errorView.init({
                                errorMessage: data.errorMessage
                            });
                        }
                        else {
                            vidyoView.showProgressIndicator("info", data.errorMessage);
                        }
                    } else {
                        vidyoView.showProgressIndicator("error", data.errorMessage);
                    }
                    vidyoView.hideLoadingItem();
                }
                if (data && data.retryLogin) {
                    vidyoView.retryLogin();
                }
            }

            function handlePluginInitSuccess(data) {
                if (data && data.errorMessage) {
                    vidyoView.showProgressIndicator("info", data.errorMessage);
                    vidyoView.hideLoadingItem();
                }
            }

            function handleDeviceConfigurationError(e) {
                //handleDeviceConfigurationError
                logger.error('Device Request Configuration Error from callback : ' + e);
            }

            function updateLocalMediaMuteView(device) {
                var isMuted = deviceMap[device].mute;
                if (device === DEVICE_TYPE_MICROPHONE) {
                    vidyoView.toggleMuteMicrophoneButton(isMuted);
                }
                else if (device === DEVICE_TYPE_VIDEO) {
                    vidyoView.toggleMuteVideoButton(isMuted);
                }
                else if (device === DEVICE_TYPE_SPEAKER) {
                    vidyoView.toggleMuteSpeakersButton(isMuted);
                }
                logger.debug("Current device map: " + JSON.stringify(deviceMap));
            }

            function handleLocalMediaMuteUpdate(data) {
                logger.info("Updating mute state of local device: " + JSON.stringify(data));
                deviceMap[data.device].mute = data.isMuted;
                updateLocalMediaMuteView(data.device);
            }

            function handleLocalMediaUpdate(data) {
                handleLocalMediaMuteUpdate(data);
            }

            function updateLocalMediaDisableView(device) {
                var isDisabled = deviceMap[device].disabled;
                if (device === DEVICE_TYPE_MICROPHONE) {
                    vidyoView.disableEnableMuteMicrophoneButton(isDisabled);
                }
                else if (device === DEVICE_TYPE_VIDEO) {
                    vidyoView.disableEnableMuteVideoButton(isDisabled);
                }
                else if (device === DEVICE_TYPE_SPEAKER) {
                    vidyoView.disableEnableMuteSpeakersButton(isDisabled);
                }
                logger.debug("Current device map: " + JSON.stringify(deviceMap));
            }

            function handleLocalMediaDisableUpdate(data) {
                logger.info("Updating disable state of local device. Server media info: "
                        + JSON.stringify(data));
                if (data.serverMedia === SERVER_MEDIA_TYPE_AUDIO) {
                    deviceMap[DEVICE_TYPE_MICROPHONE].disabled = data.isServerMediaMuted;
                    updateLocalMediaDisableView(DEVICE_TYPE_MICROPHONE);
                } else if (data.serverMedia === SERVER_MEDIA_TYPE_VIDEO) {
                    deviceMap[DEVICE_TYPE_VIDEO].disabled = data.isServerMediaMuted;
                    updateLocalMediaDisableView(DEVICE_TYPE_VIDEO);
                }
            }

            function handleAudioAndCameraOnAtLogin() {
                if (!vidyoView.isRoomShareOnly()) {
                    if (deviceMap[DEVICE_TYPE_MICROPHONE].disabled === false
                            && deviceMap[DEVICE_TYPE_MICROPHONE].mute === true) {
                        handleUnmuteMicrophone();
                    }
                    if (deviceMap[DEVICE_TYPE_VIDEO].disabled === false
                            && deviceMap[DEVICE_TYPE_VIDEO].mute === true) {
                        handleUnmuteVideo();
                    }
                }
            }
            function handleAudioOnAndCameraOffAtLogin() {
                if (!vidyoView.isRoomShareOnly()) {
                    if (deviceMap[DEVICE_TYPE_MICROPHONE].disabled === false
                            && deviceMap[DEVICE_TYPE_MICROPHONE].mute === true) {
                        handleUnmuteMicrophone();
                    }
                    if (deviceMap[DEVICE_TYPE_VIDEO].disabled === false
                            && deviceMap[DEVICE_TYPE_VIDEO].mute === false) {
                        handleMuteVideo();
                    }
                }
            }
            function handleAudioOffAndCameraOffAtLogin() {
                if (!vidyoView.isRoomShareOnly()) {
                    if (deviceMap[DEVICE_TYPE_MICROPHONE].disabled === false
                            && deviceMap[DEVICE_TYPE_MICROPHONE].mute === false) {
                        handleMuteMicrophone();
                    }
                    if (deviceMap[DEVICE_TYPE_VIDEO].disabled === false
                            && deviceMap[DEVICE_TYPE_VIDEO].mute === false) {
                        handleMuteVideo();
                    }
                }
            }



            function displayServerMediaPopupMessages(data) {
                if (data.serverMedia === SERVER_MEDIA_TYPE_AUDIO) {
                    if (data.isServerMediaMuted) {
                        popUp(window.lang.VidyoClient.SERVER_AUDIO_MUTED_POP_UP_MESSAGE, 'SERVER_AUDIO_MUTED_POP_UP_MESSAGE');
                    } else {
                        popUp(window.lang.VidyoClient.SERVER_AUDIO_UNMUTED_POP_UP_MESSAGE, 'SERVER_AUDIO_UNMUTED_POP_UP_MESSAGE');
                    }
                }
                else if (data.serverMedia === SERVER_MEDIA_TYPE_VIDEO) {
                    if (data.isServerMediaMuted) {
                        popUp(window.lang.VidyoClient.SERVER_VIDEO_STOPPED_POP_UP_MESSAGE, 'SERVER_VIDEO_STOPPED_POP_UP_MESSAGE');
                    } else {
                        popUp(window.lang.VidyoClient.SERVER_VIDEO_STARTED_POP_UP_MESSAGE, 'SERVER_VIDEO_STARTED_POP_UP_MESSAGE');
                    }
                }
            }

            function handleServerMediaUpdate(data) {
                handleLocalMediaDisableUpdate(data);
                // For better synchronization of UI events (popup, button change etc.). 
                // We popup sever media events in this handler.
                if (vidyoPluginController.isGuest()) {
                    if (!vidyoView.isRoomShareOnly() && isConferenceActive) {
                        displayServerMediaPopupMessages(data);
                    }
                }
            }

            function displaySilencePopupMessages(media) {
                if (media === MEDIA_CONTROL_MEDIA_TYPE_AUDIO) {
                    if (vidyoPluginController.isGuest()) {
                        popUp(window.lang.VidyoClient.SILENCE_AUDIO_POP_UP_MESSAGE, 'SILENCE_AUDIO_POP_UP_MESSAGE');
                    } else {
                        popUp(window.lang.VidyoClient.SILENCE_AUDIO_POP_UP_MESSAGE_FOR_MODERATOR, 'SILENCE_AUDIO_POP_UP_MESSAGE_FOR_MODERATOR');
                    }
                } else if (media === MEDIA_CONTROL_MEDIA_TYPE_VIDEO) {
                    if (vidyoPluginController.isGuest()) {
                        popUp(window.lang.VidyoClient.SILENCE_VIDEO_POP_UP_MESSAGE, 'SILENCE_VIDEO_POP_UP_MESSAGE');
                    } else {
                        popUp(window.lang.VidyoClient.SILENCE_VIDEO_POP_UP_MESSAGE_FOR_MODERATOR, 'SILENCE_VIDEO_POP_UP_MESSAGE_FOR_MODERATOR');
                    }
                }
            }

            function handleServerBasedMediaControlEvent(data) {
                // We are not able to differentiate local mute and
                // silence via OUMAI (and OEMV). Thus, we popup here for
                // silence events.
                if (!vidyoView.isRoomShareOnly() && isConferenceActive && data.command === MEDIA_CONTROL_COMMAND_SILENCE) {
                    displaySilencePopupMessages(data.media);
                }
            }

            function refreshLocalMediaControls() {
                logger.info("Refreshing local media views. Current device map: "
                        + JSON.stringify(deviceMap));
                updateLocalMediaMuteView(DEVICE_TYPE_MICROPHONE);
                updateLocalMediaMuteView(DEVICE_TYPE_VIDEO);
                updateLocalMediaMuteView(DEVICE_TYPE_SPEAKER);
                updateLocalMediaDisableView(DEVICE_TYPE_MICROPHONE);
                updateLocalMediaDisableView(DEVICE_TYPE_VIDEO);
                updateLocalMediaDisableView(DEVICE_TYPE_SPEAKER);
            }

            function handleSelfviewActivation() {
                logger.info("handleSelfviewActivation()");
                vidyoView.setSelfViewMode();
            }

            function handleScreenShareAdded(data) {
                logger.info("handleScreenShareAdded()");
//                vidyoView.toggleScreenShareIcon(true);
                vidyoPluginController.getScreenShareList();
            }

            function handleScreenShareRemoved(data) {
                logger.info("handleScreenShareRemoved()");
//                vidyoView.toggleScreenShareIcon(false);
                vidyoPluginController.getScreenShareList();
            }

            function popupIfMicrophoneAndCameraIsOff() {
                if (!vidyoView.isRoomShareOnly()) {
                    if (deviceMap[DEVICE_TYPE_MICROPHONE].disabled === false
                            && deviceMap[DEVICE_TYPE_MICROPHONE].mute === true
                            && deviceMap[DEVICE_TYPE_VIDEO].disabled === false
                            && deviceMap[DEVICE_TYPE_VIDEO].mute === true) {
                        popUp(window.lang.VidyoClient.MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE, 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE');
                    }
                }
            }

            function updateServerMediaMap() {
                if (!vidyoPluginController.isGuest()) {
                    var result;
                    logger.info("Server media information will be updated.");
                    /*
                     * Moderator's server media state is equal to his room's server media state
                     * at the beginning of the conference, if no operation is called to change
                     * his server media state before conference active.
                     */

                    result = vidyoPluginController.requestIsServerVideoMuted();
                    if (result.isRequestSuccess) {
                        serverMediaMap[SERVER_MEDIA_TYPE_VIDEO] = result.isMuted;
                    } else {
                        logger.error("Could not get up-to-date server video state. Error: " + result.errorText);
                    }

                    result = vidyoPluginController.requestIsServerAudioInMuted();
                    if (result.isRequestSuccess) {
                        serverMediaMap[SERVER_MEDIA_TYPE_AUDIO] = result.isMuted;
                    } else {
                        logger.error("Could not get up-to-date server audio state. Error: " + result.errorText);
                    }
                    logger.info("Server media information after update: " + JSON.stringify(serverMediaMap));
                }
            }

            function handleConferenceActive() {
                logger.info("Activating conference.");

                vidyoView.activeSessionTemplate(vidyoPluginController.isGuest());
                vidyoView.activateVidyoPluginContainer();

                // In some cases OutEventParticipantsChanged is received before
                // OutEventConferenceActive. Therefore, we refresh participants list view
                // when we activate the conference.
                refreshParticipantsListView();
                refreshLocalMediaControls();

                //restore lockroom status after refresh
                vidyoView.lockRoomUpdate(vidyoPluginController.getRoomIsLocked());
                updateServerMediaMap();
                // Probably moderator menu will not be in view, but to guard against any
                // extreme scenarios we call the following function.
                refreshModeratorControlsView();
                if (vidyoView.isRoomShareOnly() && !vidyoPluginController.isGuest()) {
                    logger.info("Moderator login to share-only room. Mute media of the conference.");
                    handleServerVideoClicked(true);
                    handleServerAudioClicked(true);
                }

                popupIfMicrophoneAndCameraIsOff();

                //based on the status of the chat panel, change status icon of chat button
                //if not updated here, tooltip of button does not shown to user once the page loads
                vidyoView.toggleChatButton();


                //set default layout to preffered
                vidyoPluginController.setLayoutMode(1, function(data) {
                    logger.info("setLoyoutMode request success." + data);
                }, function(e) {
                    logger.error("setLoyoutMode request failure." + e);
                });

                disableEchoCancellationIfRecommended();

                //set selfview according to participant number
                vidyoView.setSelfViewMode();

                setUpPeriodicParticipantListUpdate();
                isConferenceActive = true;
            }

            function handleLeaveConference() {
                logger.info('handleLeaveConference');
                vidyoView.cleanUpWindow();
                vidyoPluginController.leaveMyConferenceRoom();
            }

            function handleEndConf() {
                logger.info("handleEndConf()");
                vidyoView.cleanUpWindow();
                vidyoPluginController.disconnectConferenceAll().done(function() {
                    logger.info("handleEndConf() done.");
                }).fail(function(errorParam1, errorParam2) {
                    logFailCase("handleEndConf() fail.", errorParam1, errorParam2);
                });
            }


            function handleLockRoomChange(isLocked) {
                logger.info("handleLockRoomChange(" + isLocked + ")");


                vidyoPluginController.lockRoom(isLocked).done(function() {
                    logger.info("handleLockRoomChange(" + isLocked + ") done.");
                    vidyoPluginController.setRoomIsLocked(isLocked);
                    vidyoView.lockRoomUpdate(vidyoPluginController.getRoomIsLocked());
                    refreshModeratorControlsView();
                }).fail(function(errorParam1, errorParam2) {
                    logFailCase("handleLockRoomChange(" + isLocked + ") fail.", errorParam1, errorParam2);
                });
            }

            function handleFullScreen() {
                /* WARNING: It is a known problem in Safari that Safari does not support keyboard input in the full screen mode. */
                vidyoView.handleFullScreen();
            }

            function initializeRequiredGlobalVariables() {
                logger.info("Initializing required variables.");
                deviceMap = DEVICE_MAP_DEFAULT_VALUES();
                serverMediaMap = SERVER_MEDIA_DEFAULT_VALUES();
                /*
                 * OutEventParticipantsChanged is sent before OutEventConferenceActive
                 * in some scenarios. Moreover OutEventParticipantsChanged is sent frequently.
                 * Even when the participant disconnects it receives OutEventParticipantsChanged 
                 * events and updates its participants list, even though it does not refresh view.
                 * It is better to reset participants list early in every login. 
                 */
                currentParticipants = [];
                isConferenceActive = false;
                isModeratorsMediaTurnedOn = false;
                hasAlreadyReceivedFirstListWithMe = false;
                updateParticipantsListTimerID = undefined;
            }

            function setInitialPluginCongifurationValues(isURLLogin) {
                logger.info("setInitialPluginCongifurationValues()");
                if (!isURLLogin) {
                    var proxyConfig={},requestResult;
                    proxyConfig = {
                          vidyoProxyConfig: { 
                              isAlwaysUseProxy : vidyoView.getProxyConfig()
                          },
                          webProxyConfig : vidyoView.getWebProxyConfig()
                    };
                    requestResult = vidyoPluginController.updateProxyConfiguration(proxyConfig);
                    if (requestResult.isRequestSuccess) {
                        logger.info("Always use proxy configuration is updated successfully. Current value: " + requestResult.alwaysUseProxy);
                        logger.info("Web proxy configuration is updated successfully. Current configuration: " + JSON.stringify(requestResult.useWebProxyConfig));   
                    } else {
                        logger.error("Always use proxy configuration could not be updated. Error: " + requestResult.errorText);
                        // We are just logging this case... Do not stop running the application.
                    }
                } else {
                    logger.info("Login from URL. Will not update always use proxy configuration. The value stored in the plugin will be used.");
                }
                // Other plugin configuration values may be set.
            }

            function handleModeratorJoinRoom(username, password, portalUri, isURLLogin) {
                initializeRequiredGlobalVariables();
                setInitialPluginCongifurationValues(isURLLogin);
                vidyoPluginController.initAndUserLogin(username, password, portalUri).done(function() {
                    loginSuccessHandler = function() {
                        vidyoView.maximizePluginContainer();
                        vidyoPluginController.joinMyConferenceRoom();
                    };
                });
            }

            function handleGuestJoinRoom(guestURL, nickname) {
                initializeRequiredGlobalVariables();
                setInitialPluginCongifurationValues();
                vidyoPluginController.initAndGuestLoginAndJoinRoom(guestURL, nickname);
            }

            function handleLogout() {
                vidyoPluginController.logout();
            }

            function handleVidyoApiScreenShareListReady(data) {
                logger.info("handleScreenShareRemoved()");
                vidyoView.showScreenShareList(data);
            }

            function handleVidyoApiScreenShareListFailed(data) {
                logger.info("handleVidyoApiScreenShareListFailed()");
                vidyoView.showScreenShareList(data);
            }

            function isFirstListInParticipantsChangedWithMeIsSet() {
                return !isModeratorsMediaTurnedOn && getMyRecord();
            }

            function turnOnModeratorsMediaFromServerOnFirstParticipantsChange() {
                if (!vidyoPluginController.isGuest() && !vidyoView.isRoomShareOnly()
                        && isFirstListInParticipantsChangedWithMeIsSet()) {
                    logger.info("First participants change which includes the moderator. Will try to turn on moderator's media from server.");
                    // Harmless to try to turn on if already turned on, so no need to check
                    // whether it is turned on or not. Turn on operation is best effort for now.
                    enableMyMediaFromServerIfRequired(SERVER_MEDIA_TYPE_VIDEO, true);
                    enableMyMediaFromServerIfRequired(SERVER_MEDIA_TYPE_AUDIO, true);
                    // In fact, if participants changed event and related out event of any of the
                    // enable my media from server operations is received before conference active 
                    // event, the server media state that we get at the begginning of the
                    // conference might be wrong. This is a race condition. But to keep code simple, 
                    // we do not prevent this race contion unless we actually encounter this case in practice.
                    isModeratorsMediaTurnedOn = true;
                }
            }

            function handleParticipantsChangedFailureForGuest(error) {
                logger.error("Participants changed failure for guest. Error: " + JSON.stringify(error));
                if (error.errorCode === VIDYO_ERROR_CODE.GET_PARTICIPANTS_ERROR) {
                    // Try getting the participants list after a while
                    var UPDATE_AFTER = 5000;
                    deferredUpdateParticipantsListForGuest(UPDATE_AFTER);
                }
            }

            function handleParticipantsChangedFailureForModerator(error) {
                logger.error("Participants changed failure for moderator. Error: " + JSON.stringify(error));
                if (error.errorCode === VIDYO_ERROR_CODE.GET_PARTICIPANTS_ERROR) {
                    // Try getting the participants list after a while
                    var UPDATE_AFTER = 5000;
                    deferredUpdateParticipantsListForModerator(UPDATE_AFTER);
                }
            }

            function handleParticipantsChangedForGuest(newParticipantsList) {
                logger.info("Participants changed handler.");
                handleNewParticipantsList(newParticipantsList);
            }

            function handleParticipantsChangedForModerator(newParticipantsList) {
                logger.info("Participants changed handler.");
                handleNewParticipantsList(newParticipantsList);
                // Moderator's server media is automatically turned on. To do this we need 
                // participantID of the moderator. We get participantIDs of participants 
                // at participants changed events. At the first of these events in which moderator is 
                // also in the list, we get the participantID of the moderator and turn his/her media on.
                turnOnModeratorsMediaFromServerOnFirstParticipantsChange();

                // After a participant leaves the conference moderator receives participants
                // changed event and then gets the participants with a soap call. The participant
                // list sometimes includes also the leaved participant. So in even success cases
                // we again get the participants list after a while. 
                // 
                // The vidyo server might be first sending participants changed events to the end users and 
                // then removing the participant from his db. Since the moderator is requesting the
                // participants from the vidyo server, he might be getting an incorrect list in first trial.
                var UPDATE_AFTER = 5000;
                deferredUpdateParticipantsListForModerator(UPDATE_AFTER);
            }

            function handleVidyoApiLoginSuccess() {
                if (loginSuccessHandler) {
                    loginSuccessHandler();
                    loginSuccessHandler = null;
                }
            }

            function handleVidyoApiLoginFailure(data) {
                if (data && data.errorMessage) {
                    if (data.errorMessage === window.lang.VidyoClient.ROOM_LOCKED) {
                        vidyoView.showProgressIndicator("info", data.errorMessage);
                    } else {
                        vidyoView.showProgressIndicator("error", data.errorMessage);
                    }
                    vidyoView.hideLoadingItem();
                }
            }

            function initializeUseProxyAtView() {
                logger.info("initializeUseProxyAtView()");

                var requestResult;
                requestResult = vidyoPluginController.getUpToDateValueOfProxy();
                if (requestResult.isRequestSuccess) {
                    vidyoView.setProxyConfig(requestResult.alwaysUseProxy);
                    vidyoView.setWebProxyConfig(requestResult.webProxyConfig);
                    logger.info("Initial value of proxy is set at view. Initial always use proxy value: " + requestResult.alwaysUseProxy
                            + " and web proxy values : " + JSON.stringify(requestResult.webProxyConfig));
                    return true;
                } else {
                    logger.error("Initial value of proxy could not be set at view. Could not get up-to-date value of proxy. Error: "
                            + JSON.stringify(requestResult.errorText));
                    return false;
                }
            }

            function handleLogicStarted() {
                logger.info("handleLogicStarted()");
                var requestResult;

                // TODO: The reason for bootstratting (resetting) may be investigated.
                // Is it required to display some error to the user to refresh plugin etc. in
                // fail case??? 
                // TODO: In URL login scenario, the following reset code may work after
                // some login steps???           
                requestResult = vidyoPluginController.resetRequiredClientConfigurationParams();
                if (requestResult.isRequestSuccess) {
                    logger.info("Required client configuration parameters are reset.");
                } else {
                    // For now in the error cases we are only logging. If we consider taking some actions 
                    // like displaying error to the user etc, we might need to stop the continuing
                    // code flow.. (e.g., initializeUseProxyAtView ...)
                    logger.error("Error in resetting required client configuration parameters. Error: " + JSON.stringify(requestResult.errorText));
                }

                // In URL login scenarios, logic started might execute after some login steps...
                if (vidyoView.isLoginScreenOnView()) {
                    // Initialize "always use proxy" in view. Even though we receive logic 
                    // started after login page is loaded to screen, it is an early step,
                    // getting initial value in this steps seems reasonable.
                    initializeUseProxyAtView();
                }
            }

            function handleDeviceChangeOutEvent(data) {
                logger.info("handleDeviceChangeOutEvent(" + JSON.stringify(data) + ")");
                if (data.deviceName === DEVICE_NAMES.SPEAKER
                        || data.deviceName === DEVICE_NAMES.MICROPHONE) {
                    var noUIUpdate = true;
                    // In device change scenarios where more than one device exist in one device two
                    // OutEventDevicesChanged is received (e.g. headset, web cam with mic). In these
                    // scenarios some view operations in showDeviceConfigurationList calls from handleGetDeviceSettings
                    // are asynchronous. The following scenario may happen: disableEchoCancellationIfRecommended
                    // converts echo from true to false at UI. Than two buffered showDeviceConfigurationList will be called.
                    // 1st call converts echo from false to true, 2nd call converts echo from true to false.
                    // To prevent these scenarios we do not update UI at disableEchoCancellationIfRecommended, but we
                    // update at handleGetDeviceSettings.
                    disableEchoCancellationIfRecommended(noUIUpdate).always(function() {
                        handleGetDeviceSettings();
                    });
                } else {
                    handleGetDeviceSettings();
                }
                handleSelfviewActivation();
            }

            function handleVidyoApiEvent(event, data) {
                switch (event) {
                    case VIDYO_EVENT.LOGIN_SUCCESS:
                        handleVidyoApiLoginSuccess();
                        break;
                    case VIDYO_EVENT.LOGIN_FAILURE:
                        handleVidyoApiLoginFailure(data);
                        break;
                    case VIDYO_EVENT.CONF_ACTIVE:
                        handleConferenceActive();
                        break;
                    case VIDYO_EVENT.CONF_ENDED:
                        handleConferenceEnded(data);
                        break;
                    case VIDYO_EVENT.JOIN_CONF_FAILURE:
                        handleJoinConferenceFailure(data);
                        break;
                    case VIDYO_EVENT.LEAVE_CONF_FAILURE:
                        handleLeaveConferenceFailure(data);
                        break;
                    case VIDYO_EVENT.LEAVE_CONF_SUCCESS:
                        handleLeaveConferenceSuccess(data);
                        break;
                    case VIDYO_EVENT.LOCAL_MEDIA_UPDATE_EVENT:
                        handleLocalMediaUpdate(data);
                        break;
                    case VIDYO_EVENT.SERVER_MEDIA_UPDATE_EVENT:
                        handleServerMediaUpdate(data);
                        break;
                    case VIDYO_EVENT.SERVER_BASED_MEDIA_CONTROL_EVENT:
                        handleServerBasedMediaControlEvent(data);
                        break;
                    case VIDYO_EVENT.SCREEN_SHARE_LIST_READY:
                        handleVidyoApiScreenShareListReady(data);
                        break;
                    case VIDYO_EVENT.SCREEN_SHARE_LIST_FAILED:
                        handleVidyoApiScreenShareListFailed(data);
                        break;
                    case VIDYO_EVENT.PARTICIPANTS_CHANGED_FOR_GUEST:
                        handleParticipantsChangedForGuest(data);
                        break;
                    case VIDYO_EVENT.PARTICIPANTS_CHANGED_FOR_USER:
                        handleParticipantsChangedForModerator(data);
                        break;
                    case VIDYO_EVENT.PARTICIPANTS_CHANGED_FAILURE_FOR_GUEST:
                        handleParticipantsChangedFailureForGuest(data);
                        break;
                    case VIDYO_EVENT.PARTICIPANTS_CHANGED_FAILURE_FOR_USER:
                        handleParticipantsChangedFailureForModerator(data);
                        break;
                    case VIDYO_EVENT.SCREEN_SHARE_ADDED:
                        handleScreenShareAdded();
                        handleSelfviewActivation();
                        break;
                    case VIDYO_EVENT.SCREEN_SHARE_REMOVED:
                        handleScreenShareRemoved();
                        handleSelfviewActivation();
                        break;
                    case VIDYO_EVENT.DEVICE_CHANGE_OUT_EVENT:
                        handleDeviceChangeOutEvent(data);
                        break;
                    case VIDYO_EVENT.PLUGIN_FAILURE:
                        handlePluginFailure(data);
                        break;
                    case VIDYO_EVENT.RECEIVED_GROUP_CHAT_MESSAGES:
                        handleGroupChatMessages(data);
                        break;
                    case VIDYO_EVENT.PLUGIN_SUCCESS:
                        handlePluginInitSuccess(data);
                        break;
                    case VIDYO_EVENT.DEVICE_CONFIGURATION_ERROR:
                        handleDeviceConfigurationError(data);
                        break;
                    case VIDYO_EVENT.LOGIC_STARTED:
                        handleLogicStarted();
                        break;
                }
            }

            function handleShowDialog(title, type, buttons, data) {
                dialogController.showDialog(title, type, buttons, data);
            }
            function handleAboutPopup(isShow) {
                if (isShow) {
                    vidyoView.deactivateVidyoPluginContainer(false);
                    dialogController.showAbout();
                }
                else {
                    if (isConferenceActive) {
                        vidyoView.activateVidyoPluginContainer(true);
                    }
                    dialogController.hideAbout();
                }
            }

            function loginSuccessMessageIdentifier(message) {
                switch (message) {
                    case window.lang.VidyoClient.CONNECTION_LOST:
                        vidyoView.showProgressIndicator('info', message);
                        break;
                    case window.lang.VidyoClient.LEFT_CONFERENCE:
                        vidyoView.showProgressIndicator('info', message);
                        break;
                    default:
                        vidyoView.showProgressIndicator('info', message);
                        break;
                }
            }
            function handleDestroyLoginTemplate(data) {
                if (data && data.successMessage) {
                    //handle and print message to login page according to its type
                    loginSuccessMessageIdentifier(data.successMessage);
                }
                window.localStorage.removeItem("data");
            }

            return Controller.create({
                init: function(username, password, portalUri, data) {
                    self = this;
                    portalUriData = portalUri;
                    if (username && password) {
                        $("#home_page").addClass("room_load_and_hide_backround");
                    }
                    dialogController.init(vidyoPluginController.getPluginVersion()).done(function() {
                        vidyoView.init().done(function() {
                            var data = JSON.parse(window.localStorage.getItem("data"));
                            if (data && data.moderator) {
                                vidyoView.moderatorTabClick();
                            }
                            vent.off(VIDYO_EVENT.VIDYO_API).on(VIDYO_EVENT.VIDYO_API, handleVidyoApiEvent);
                            vidyoPluginController.init(vidyoView.getPluginContainerSelector()).done(function() {
                                if (username && password) {
                                    var isURLLogin = true;
                                    vidyoView.showLoadingItem(window.lang.VidyoClient.LOADING, true);
                                    vidyoView.moderatorButtonsHandleVisibility(false);
                                    handleModeratorJoinRoom(username, password, portalUriData, isURLLogin);
                                    window.localStorage.removeItem("data");
                                } else {
                                    handleDestroyLoginTemplate(data);
                                }
                            });
                            vent.off('onFullScreenClicked').on('onFullScreenClicked', handleFullScreen);
                            vent.off('onModeratorJoinRoom').on('onModeratorJoinRoom', handleModeratorJoinRoom);
                            vent.off('onGuestJoinRoom').on('onGuestJoinRoom', handleGuestJoinRoom);
                            vent.off('onLeaveConferenceClicked').on('onLeaveConferenceClicked', handleLeaveConference);
                            vent.off('onModeratorMenuClicked').on('onModeratorMenuClicked', refreshModeratorControlsView);
                            vent.off('onMuteMicrophoneClicked').on('onMuteMicrophoneClicked', handleMuteMicrophone);
                            vent.off('onMuteSpeakersClicked').on('onMuteSpeakersClicked', handleMuteSpeakers);
                            vent.off('onMuteVideoClicked').on('onMuteVideoClicked', handleMuteVideo);
                            vent.off('onUnmuteMicrophoneClicked').on('onUnmuteMicrophoneClicked', handleUnmuteMicrophone);
                            vent.off('onUnmuteSpeakersClicked').on('onUnmuteSpeakersClicked', handleUnmuteSpeakers);
                            vent.off('onUnmuteVideoClicked').on('onUnmuteVideoClicked', handleUnmuteVideo);
                            vent.off('onParticipantsAreaClicked').on('onParticipantsAreaClicked', refreshParticipantsOnClick);
                            vent.off('onLogout').on('onLogout', handleLogout);
                            vent.off('onPreviewModeChange').on('onPreviewModeChange', handlePreviewModeChange);
                            vent.off('onLayoutModeChange').on('onLayoutModeChange', handleLayoutModeChange);
                            vent.off('onServerVideoClicked').on('onServerVideoClicked', handleServerVideoClicked);
                            vent.off('onServerAudioClicked').on('onServerAudioClicked', handleServerAudioClicked);
                            vent.off('onSilenceParticipantsVideoClicked').on('onSilenceParticipantsVideoClicked', handleSilenceParticipantsVideoClicked);
                            vent.off('onSilenceParticipantsAudioClicked').on('onSilenceParticipantsAudioClicked', handleSilenceParticipantsAudioClicked);
                            vent.off('onSendGroupChatMessage').on('onSendGroupChatMessage', handleSendGroupChatMessage);
                            vent.off('onParticipantKickClicked').on('onParticipantKickClicked', handleKickParticipant);
                            vent.off('onParticipantStopVideoClicked').on('onParticipantStopVideoClicked', handleStopParticipantVideo);
                            vent.off('onParticipantMuteAudioClicked').on('onParticipantMuteAudioClicked', handleMuteParticipantAudio);
                            vent.off('onParticipantStartVideoClicked').on('onParticipantStartVideoClicked', handleStartParticipantVideo);
                            vent.off('onParticipantUnMuteAudioClicked').on('onParticipantUnMuteAudioClicked', handleUnMuteParticipantAudio);
                            vent.off('onSetCurrentDevice').on('onSetCurrentDevice', handleSetCurrentDevice);
                            vent.off('onShareScreenClicked').on('onShareScreenClicked', handleShareScreen);
                            vent.off('onScreenSelected').on('onScreenSelected', handleScreenSelected);
                            vent.off('onRemoteScreenSelected').on('onRemoteScreenSelected', handleRemoteScreenSelected);
                            vent.off('getAllDevice').on('getAllDevice', handleGetDeviceSettings);
                            vent.off('handleGetMyAccount').on('handleGetMyAccount', handleGetMyAccount);
                            vent.off('onLockRoomChange').on('onLockRoomChange', handleLockRoomChange);
                            vent.off('handleVidyoPluginIsInstalled').on('handleVidyoPluginIsInstalled', handleVidyoPluginIsInstalled);
                            vent.off('onClickEndConf').on('onClickEndConf', handleEndConf);
                            vent.off('onShowDialog').on('onShowDialog', handleShowDialog);
                            vent.off('onAboutPopup').on('onAboutPopup', handleAboutPopup);
                            vent.off('handleAudioAndCameraOnAtLogin').on('handleAudioAndCameraOnAtLogin', handleAudioAndCameraOnAtLogin);
                            vent.off('handleAudioOnAndCameraOffAtLogin').on('handleAudioOnAndCameraOffAtLogin', handleAudioOnAndCameraOffAtLogin);
                            vent.off('handleAudioOffAndCameraOffAtLogin').on('handleAudioOffAndCameraOffAtLogin', handleAudioOffAndCameraOffAtLogin);
                            vent.off('onEchoCancellationConfigChange').on('onEchoCancellationConfigChange', handleEchoCancellationConfigChange);
                            vent.off('onAudioAGCConfigChange').on('onAudioAGCConfigChange', handleAudioAGCConfigChange);
                        });
                    });
                },
                load: function() {
                    return $.Deferred().resolve();
                }
            });
        });
