/*global define, $,window , CONSTANTS*/


define('vidyoView', ['view', 'eventAggregator', 'configController', 'logController', 'utils', 'errorView', 'localization'], function(View, vent, configController, logController, utils, errorView, localization) {
    var PLUGIN_CONTAINER_SELECTOR = "#vidyo_plugin_container",
            PLUGIN_CHAT_CONTAINER_SELECTOR = "#vidyo_plugin_chat_container",
            self,
            fullScreenElement,
            isFullScreen,
            roomData,
            myAccount = {"data": "", "incomingMsgCount": 0, "userName": ""},
    lastPersonTyped = {"GROUP_CHAT": ""},
    vidyoConfig,
            logger = logController.getLogger('vidyoView'),
            myTimer,
            shareTimer,
            popupVisibility = [],
            popupArrAction = [],
            popupArrInformative = [],
            popupArrQuestion = [],
            popupArrNotification = [],
            popupArrKeys = [],
            POPUP_CODES = CONSTANTS.POPUP_CODES,
            DEVICE_NAMES = CONSTANTS.DEVICE_NAMES,
            PROXY_TYPE = CONSTANTS.PROXY_SETIINGS.PROXY_TYPE;

    function getRoomData() {
        if (!roomData) {
            roomData = configController.getRoomData();
        }
        return {
            firstName: roomData.collaborationResponse.first_name,
            lastName: roomData.collaborationResponse.last_name,
            domain: roomData.roomOwner,
            isShareOnly: roomData.collaborationResponse.service_name === "screensharing",
            roomUrl: roomData.collaborationResponse.roomUrl
        };
    }

    function isRoomShareOnly() {
        return getRoomData().isShareOnly;
    }

    function endConferenceClickWorker() {
        vent.trigger("onClickEndConf");
        logger.info('Event click endConf conference ended');
    }

    function removePopupFromArrayAccordingToIdAndType(typeOfPopup, popupId) {
        var i;
        switch (typeOfPopup) {
            case "informative":
                for (i = 0; i < popupArrInformative.length; i++) {
                    if (popupArrInformative[i] === popupId) {
                        delete popupArrInformative[i];
                    }
                }
                break;
            case "action":
                for (i = 0; i < popupArrAction.length; i++) {
                    if (popupArrAction[i] === popupId) {
                        delete popupArrAction[i];
                    }
                }
                break;
            case "question":
                for (i = 0; i < popupArrQuestion.length; i++) {
                    if (popupArrQuestion[i] === popupId) {
                        delete popupArrQuestion[i];
                    }
                }
                break;
            case "notification":
                for (i = 0; i < popupArrNotification.length; i++) {
                    if (popupArrNotification[i] === popupId) {
                        delete popupArrNotification[i];
                    }
                }
                break;
        }

    }

    function removePopupByElementId(popup_element_name, typeOfPopup) {
        var popupId = $(popup_element_name).parents().find("div.noty_bar").attr("id"), notification, id;
        notification = $.noty.get(popupId);//or notificationQuestion.options.id
        notification.close(popupId);
        //remove from the array also accordıng to type
        removePopupFromArrayAccordingToIdAndType(typeOfPopup, popupId);
        id = notification.options.id;
        delete $.noty.store.id;
    }
    function removePopup(popupId, typeOfPopup) {
        var notification, id;
        notification = $.noty.get(popupId);//or notificationQuestion.options.id
        notification.close(popupId);
        id = notification.options.id;
        removePopupFromArrayAccordingToIdAndType(typeOfPopup, popupId);
        delete $.noty.store.id;
    }

    function clearAllPopupArrays() {
        popupArrInformative = [];
        popupArrNotification = [];
        popupArrQuestion = [];
        popupArrAction = [];
        popupVisibility = [];
        popupArrKeys = [];
    }

    function killAllPopups() {
        //ABE 3026
        //clearAllPopupArrays();
        $.noty.closeAll();
        $.noty.store = {}; //stores every popup element
    }

    function killPopup(popupId) {
        var allPopups = $.noty.store, id;
        $.each(allPopups, function(key, val) {
            if (allPopups[key].options.id === popupId) {
                id = allPopups[key].options.id;
                $.noty.close(id);
                delete $.noty.store.id;
            }
        });
    }

    function checkIfPopupExistsByText(text) {
        var allPopups = $.noty.store, id, flag = false;
        $.each(allPopups, function(key, val) {
            if (allPopups[key].options.text === text) {
                flag = true;
                return false; //breaks from $.each
            }
        });
        return flag;
    }

    function killAllPopupsTypeOf(typeofKey) {
        var allPopuptypes, i;
        switch (typeofKey) {
            case "informative":
                allPopuptypes = popupArrInformative;
                break;
            case "action":
                allPopuptypes = popupArrAction;
                break;
            case "question":
                allPopuptypes = popupArrQuestion;
                break;
            case "notification":
                allPopuptypes = popupArrNotification;
                break;
        }
        for (i = 0; i < allPopuptypes.length; i++) {
            killPopup(allPopuptypes[i]);
            removePopupFromArrayAccordingToIdAndType(typeofKey, allPopuptypes[i]);

        }

    }

    //returns if popup is informative or user action.
    //categories can be extended.
    function popupType(key) {
        var type = "informative";
        switch (key) {
            case 'SHARING_WARNING':
                type = "action";
                break;
            case 'END_CONFERENCE_QUESTION':
                type = "question";
                break;
            case 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE':
                type = "question";
                break;
            case "PARTICIPANTS_CHANGED":
                type = "notification";
                break;
            default:
                type = "informative";
                break;
        }
        return type;
    }

    function playPopupSound(popupKey) {
        //using http://ionden.com/a/plugins/ion.sound/en.html     
        //according to popupKey you can play different sounds. Do not delete the argument.
        //play sound only if user wanted to see those kind of popups.
        if (popupVisibility.notification) {
            utils.playSound("notification");
        }
    }

    function isPopupAlreadyShown(popupKey) {
        var i = 0, flag = false;
        //do not show sharing warning popup multiple times. other ones should be show multiple times
        if (popupKey !== 'SHARING_WARNING') {
            return flag;
        }
        for (i = 0; i < popupArrKeys.length; i++) {
            if (popupArrKeys[i] === popupKey) {
                flag = true;
                break;
            }
        }
        if (flag === false) {
            popupArrKeys.push(popupKey);
        }
        return flag;
    }

    function clearFromPopupKeyArr(popupKey) {
        var i;
        for (i = 0; i < popupArrKeys.length; i++) {
            if (popupArrKeys[i] === popupKey) {
                delete popupArrKeys[i];
                break;
            }
        }
    }

    function showPopupOrNot(typeOfPopup) {
        var flag = false, keyExists = false;

        if (popupVisibility[typeOfPopup] === true) {
            flag = true;
            keyExists = true;

        } else if (popupVisibility[typeOfPopup] === false) {
            flag = false;
            keyExists = true;
        }
        if (keyExists === false) {
            popupVisibility[typeOfPopup] = true;
            flag = true;
        }
        return flag;
    }
    function addPopupAccordingToType(typeOfPopup, popupId) {
        switch (typeOfPopup) {
            case "action":
                popupArrAction.push(popupId);
                break;
            case "question":
                popupArrQuestion.push(popupId);
                break;
            case "informative":
                popupArrInformative.push(popupId);
                break;
            case "notification":
                popupArrNotification.push(popupId);
                break;
        }
    }

    //modify all the popup templates within this function
    //includes the general template, templates with buttons and checkbox
    function popupTemplates(templateNumber, checkboxId) {
        var returnTemplate;
        switch (templateNumber) {
            case 1: //'BTNS_MICCAM_LOGIN'
                //buttons for MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE popupKeyword template
                //currently 3 buttons every button includes 2 icons within buttons
                returnTemplate = '<br><table id="table_popup_btn_audiovideo"><tr><td><div id="popupBtnAudioVideoOn" title="' + window.lang.VidyoClient.POPUP_BTN_AUDIOVIDEOON + '"><div id="popupBtnAudioVideoOn1"></div><div id="popupBtnAudioVideoOn2"></div></div></td><td><div id="popupBtnAudioOnVideoOff" title="' + window.lang.VidyoClient.POPUP_BTN_AUDIOONVIDEOOFF + '"><div id="popupBtnAudioOnVideoOff1"></div><div id="popupBtnAudioOnVideoOff2"></div></div></td><td><div id="popupBtnAudioOffVideoOff" title="' + window.lang.VidyoClient.POPUP_BTN_AUDIOOFFVIDEOOFF + '"><div id="popupBtnAudioOffVideoOff1"></div><div id="popupBtnAudioOffVideoOff2"></div></div></td></tr></table>';
                break;
            case 2: //'BTNS_YESNO_LEFT'
                //buttons YES/NO if popup is shown from left side of the page
                returnTemplate = '<br><table id="table_popup_btn_from_left"><tr><td><span id="popupBtnYes_from_left">' + window.lang.VidyoClient.POPUP_BTN_YES + '</span></td><td><span id="popupBtnNo_from_left">' + window.lang.VidyoClient.POPUP_BTN_NO + '</span></td></tr></table>';
                break;
            case 3: //'BTNS_YESNO_TOP'
                //buttons YES/NO if popup is shown from top of the page
                returnTemplate = '<br><table id="table_popup_btn"><tr><td><span id="popupBtnYes">' + window.lang.VidyoClient.POPUP_BTN_YES + '</span></td><td><span id="popupBtnNo">' + window.lang.VidyoClient.POPUP_BTN_NO + '</span></td></tr></table>';
                break;
            case 4: //'CBOX_SINGLE_CLOSE_TOP'
                //no button but simply a single checkbox
                returnTemplate = "<br><input type='checkbox' id='" + checkboxId + "' value='popupFlag'> ";
                break;
            case 5: //'TEMPL_MICCAM_LOGIN'
                //general popup template for MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE
                returnTemplate = '<div><table id="table_popup_audio_video"><tr colspan="3"><td class="alert"><div class="alertDiv"><span class="noty_text"></span></td></tr></table><div class="noty_close"></div></div>';
                break;
            case 6: //'TEMPL_YESNO_TOP'
                //general popup template if popup shown from top and includes YES/NO buttons
                returnTemplate = '<div><table id="table_popup"><tr colspan="2"><td class="alert"><div class="alertDiv"><span class="noty_text"></span></td></tr></table><div class="noty_close"></div></div>';
                break;
            case 7: //'TEMPL_YESNO_LEFT'
                //general popup template if popup shown from left and includes YES/NO buttons
                returnTemplate = '<div><table id="table_popup_from_left"><tr colspan="2"><td class="alert"><div class="alertDiv_from_left"><span class="noty_text"></span></td></tr></table><div class="noty_close"></div></div>';
                break;
            case 8: //'TEMPL_CBOX_TOP'
                //general popup template if popup shown from top and includes only single checkbox
                returnTemplate = '<div><table id="table_popup"><tr colspan="2"><td class="alert"><div class="alertDiv"><span class="noty_text"></span></td><td align="right" class="close_x"><span>X</span></td></tr></table><div class="noty_close"></div></div>';
                break;
            case 9: //'TEMPL_CBOX_LEFT'
                //general popup template if popup shown from left and includes only single checkbox
                returnTemplate = '<div><table id="table_popup_from_left"><tr colspan="2"><td class="alert"><div class="alertDiv_from_left"><span class="noty_text"></span></td><td align="right" class="close_x"><span>X</span></td></tr></table><div class="noty_close"></div></div>';
                break;
            case 10: //'TEMPL_CBOX_BTM_RIGHT'
                //general popup template if popup shown from bottomRight and includes only single checkbox
                returnTemplate = '<div><table id="table_popup_from_bottom_right"><tr colspan="2"><td class="alert"><div class="alertDiv_from_bottom_right"><span class="noty_text"></span></td><td align="right" class="close_x"><span>X</span></td></tr></table><div class="noty_close"></div></div>';
                break;
        }
        return returnTemplate;
    }
    function popupBtnListenersOnShow(mainMessage, typeOfPopup, popupKeyword) {
        //mic cam
        $('#popupBtnAudioVideoOn').off('vclick').on('vclick', function(e) {
            removePopupByElementId("#popupBtnAudioVideoOn", typeOfPopup);
            vent.trigger("handleAudioAndCameraOnAtLogin");
            clearFromPopupKeyArr(popupKeyword);
        });
        $('#popupBtnAudioOnVideoOff').off('vclick').on('vclick', function(e) {
            removePopupByElementId("#popupBtnAudioOnVideoOff", typeOfPopup);
            vent.trigger("handleAudioOnAndCameraOffAtLogin");
            clearFromPopupKeyArr(popupKeyword);
        });
        $('#popupBtnAudioOffVideoOff').off('vclick').on('vclick', function(e) {
            removePopupByElementId("#popupBtnAudioOffVideoOff", typeOfPopup);
            vent.trigger("handleAudioOffAndCameraOffAtLogin");
            clearFromPopupKeyArr(popupKeyword);
        });
        //question
        $('#popupBtnNo').off('vclick').on('vclick', function(e) {
            removePopupByElementId("#popupBtnNo", typeOfPopup);
            clearFromPopupKeyArr(popupKeyword);
        });
        $('#popupBtnYes').off('vclick').on('vclick', function(e) {
            if (mainMessage === window.lang.VidyoClient.END_CONFERENCE_QUESTION) {
                killAllPopups();
                endConferenceClickWorker();
            } else if (mainMessage === window.lang.VidyoClient.MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE) {
                removePopupByElementId("#popupBtnYes", typeOfPopup);
                vent.trigger("handleVideoAndCameraOnAtLogin");
                clearFromPopupKeyArr(popupKeyword);
            }
        });
        $('#popupBtnNo_from_left').off('vclick').on('vclick', function(e) {
        });
        $('#popupBtnYes_from_left').off('vclick').on('vclick', function(e) {
        });
    }
    function popupBtnListenersOnClose(typeOfPopup, popupKeyword, popup) {

        if ($('#popupFlag').is(':checked')
                || $('#popupFlag_action').is(':checked')
                || $('#popupFlag_notification').is(':checked')) {
            popupVisibility[typeOfPopup] = false;
            killAllPopupsTypeOf(typeOfPopup);
        } else {
            removePopup(popup.options.id, typeOfPopup);
        }
        clearFromPopupKeyArr(popupKeyword);
    }

    function createPopup(message, template, layout, timeout, force, typeOfPopup, popupKeyword, mainMessage, clickClose) {
        var popupObj = window.noty({
            text: message,
            template: template,
            layout: layout, //'topCenter',
            maxVisible: 1,
            type: 'alert',
            timeout: timeout,
            force: force,
            modal: false,
            killer: false,
            closeWith: [clickClose ? 'click' : ''],
            animation: {
                open: {height: 'toggle'}, // jQuery animate function property object
                close: {height: 'toggle'}, // jQuery animate function property object
                easing: 'swing', // easing
                speed: 500 // opening & closing animation speed
            },
            callback: {
                onShow: function() {
                    popupBtnListenersOnShow(mainMessage, typeOfPopup, popupKeyword);
                },
                afterShow: function() {
                },
                onClose: function() {
                    popupBtnListenersOnClose(typeOfPopup, popupKeyword, this);
                },
                afterClose: function() {
                },
                onCloseClick: function() {
                }
            }
        });
        return popupObj;
    }

    function showPopup(mainMessage, checkboxMessage, question, layout, popupKeyword) {

        var message = mainMessage, popupQuestion = false, typeOfPopup,
                checkboxId, showPop, popupObj, template, position, timeout, force;

        if (isPopupAlreadyShown(popupKeyword)) {
            return;
        }

        typeOfPopup = popupType(popupKeyword);

        showPop = showPopupOrNot(typeOfPopup);
        if (!showPop) {
            return;
        }

        switch (typeOfPopup) {
            case "action":
                checkboxId = "popupFlag_action";
                break;
            case "informative":
                checkboxId = "popupFlag";
                break;
            case "notification":
                checkboxId = "popupFlag_notification";
                break;
            default:
                checkboxId = "popupFlag";
                break;
        }
        if (popupKeyword === 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE') {
            message += popupTemplates(POPUP_CODES.BTNS_MICCAM_LOGIN);
        } else if (question) {
            if (layout === "centerLeft") {
                message += popupTemplates(POPUP_CODES.BTNS_YESNO_LEFT);
            } else {
                message += popupTemplates(POPUP_CODES.BTNS_YESNO_TOP);
            }
            popupQuestion = true;
        } else if (checkboxMessage) {
            message += popupTemplates(POPUP_CODES.CBOX_SINGLE_CLOSE_TOP, checkboxId);
            message += checkboxMessage;
        } else {
            message += popupTemplates(POPUP_CODES.CBOX_SINGLE_CLOSE_TOP, checkboxId);
            message += window.lang.VidyoClient.DEFAULT_POP_UP_CHECKBOX_MESSAGE;
        }

        if (popupKeyword === 'MICROPHONE_AND_CAMERA_IS_OFF_POP_UP_MESSAGE') {

            template = popupTemplates(POPUP_CODES.TEMPL_MICCAM_LOGIN);
            if (layout === undefined) {
                position = 'topCenter';
            } else {
                position = layout;
            }
            popupObj = createPopup(message, template, position, false, false, typeOfPopup, popupKeyword, mainMessage, false);
            addPopupAccordingToType(typeOfPopup, popupObj.options.id);

        } else if (popupQuestion) {

            if (layout === undefined) {
                template = popupTemplates(POPUP_CODES.TEMPL_YESNO_TOP);
                position = 'topCenter';

            } else {
                template = popupTemplates(POPUP_CODES.TEMPL_YESNO_LEFT);
                position = layout;

            }

            popupObj = createPopup(message, template, position, false, false, typeOfPopup, popupKeyword, mainMessage, false);
            addPopupAccordingToType(typeOfPopup, popupObj.options.id);

        } else {

            if (layout === undefined) {
                template = popupTemplates(POPUP_CODES.TEMPL_CBOX_TOP);
                position = 'topCenter';
                force = false;
            } else if (layout === 'bottomRight') {
                template = popupTemplates(POPUP_CODES.TEMPL_CBOX_BTM_RIGHT);
                position = layout;
                force = true;
            } else {
                template = popupTemplates(POPUP_CODES.TEMPL_CBOX_LEFT);
                position = layout;
                force = true;
            }

            if (popupKeyword === 'PARTICIPANTS_CHANGED') {
                timeout = 3000;
            } else {
                timeout = false;
            }

            popupObj = createPopup(message, template, position, timeout, force, typeOfPopup, popupKeyword, mainMessage, true);
            addPopupAccordingToType(typeOfPopup, popupObj.options.id);
        }
    }

    function shareListUpdateTimer() {
        clearInterval(shareTimer);
        shareTimer = setInterval(function() {
            if ($("#share_menu").hasClass('cur_menu')) {
                vent.trigger("onShareScreenClicked");
            }
        }, 3000);
    }

    function showModeratorName() {
        var moderatorData = getRoomData();
        $('#inConference').text(moderatorData.firstName + " " + moderatorData.lastName + " " + window.lang.VidyoClient.COLLABROOM);
    }

    function isCurrentTabInViewParticipants() {
        return $('#menu_items').find('#participants_menu').hasClass('cur_menu');
    }

    function isCurrentTabInShare() {
        return $('#menu_items').find('#share_menu').hasClass('cur_menu');
    }
    function isCurrentTabInViewModeratorControls() {
        return $('#menu_items').find('#moderator_menu').hasClass('cur_menu');
    }

    function isCurrentTabInViewSettings() {
        return $('#menu_items').find('#settings_menu').hasClass('cur_menu');
    }

    function updateSidebarContentSize(menu_name) {
        var listHeight, pHeight, panelHeight, padding, contentHeight;
        switch (menu_name) {
            case "share_menu":
                listHeight = $('#share_list').height() + $('#share_window').height();
                //rather than multiplying by a factor we can focus on margins of header element.
                pHeight = 2 * $('#share_list li').height();
                panelHeight = $('#sidebar_menu').height();
                padding = $('#sidebarContent').innerHeight() - $('#sidebarContent').height();
                $('#sidebarContent').css({'min-height': panelHeight - padding + "px"});
                $('#sidebarContent').css({'height': listHeight + pHeight + "px"});
                break;
            case "participants_menu":
                listHeight = $('#inCallParticipantsList').height();
                //uncomment the line below if participant count header is in participant sidebartab.
                //pHeight = $('.participants_area').height() + $('#span_participant_count').height();
                pHeight = $('.participants_area').height();
                panelHeight = $('#sidebar_menu').height();
                padding = $('#sidebarContent').innerHeight() - $('#sidebarContent').height();
                $('#sidebarContent').css({'min-height': panelHeight - padding + "px"});
                $('#sidebarContent').css({'height': listHeight + pHeight + "px"});
                break;
            default:
                if (!isCurrentTabInViewParticipants() &&
                        !isCurrentTabInShare()) {
                    contentHeight = $('#pluginAndChatContainer').height();
                    panelHeight = $('#sidebar_menu').height();
                    padding = $('#sidebarContent').innerHeight() - $('#sidebarContent').height();
                    $('#sidebarContent').css({'min-height': panelHeight - padding + "px"});
                    $('#sidebarContent').css({'height': contentHeight + "px"});
                }
                break;
        }
    }

    /*  func: writeParticipantsCounter
     *  desc: write participants counter in the badge area in the left nav (not the drawer) 
     */
    function writeParticipantsCounter(participants) {
        $("#participant_counter").html(participants.length);
    }
    function handleSidebarmenuChange(curElement) {
        //cur elem undefined

        $('#share_menu').removeClass("cur_menu");
        $('#setview_menu').removeClass("cur_menu");
        $('#layout_menu').removeClass("cur_menu");
        $('#settings_menu').removeClass("cur_menu");
        $('#participants_menu').removeClass("cur_menu");
        $('#moderator_menu').removeClass("cur_menu");
        if (curElement !== undefined)
        {
            curElement.addClass("cur_menu");
        }
        //otherwise height of the sidebarContent will remain same as the height when page is fullscreen
        updateSidebarContentSize();
//        if (!isCurrentTabInViewParticipants() &&
//                !isCurrentTabInShare()) {
//            var contentHeight = $('#pluginAndChatContainer').height();
//            $('#sidebarContent').css({'min-height': contentHeight + "px"});
//            $('#sidebarContent').css({'height': contentHeight + "px"});
//        }
    }

    function hideSidebarTemplate(curElement) {
        if (curElement) {
            curElement.removeClass("cur_menu");
        }
        else {
            handleSidebarmenuChange();
        }
        $("#sidebarContent").hide();
        $("#inCallParticipantsPanel").addClass("sidebar_hide");
        $("#pluginAndChatContainer").addClass("sidebar_hide");
    }

    function showSidebarTemplate() {
        if ($("#pluginAndChatContainer").hasClass("sidebar_hide")) {
            $("#pluginAndChatContainer").removeClass("sidebar_hide");
            $("#inCallParticipantsPanel").removeClass("sidebar_hide");
            $("#sidebarContent").show();
        }
    }
    function reloadParticipantsList(participants, isGuest, isParticipantsTabClicked) {
        /*  Let's display the participants counter in the left nav badge area */
        writeParticipantsCounter(participants);
        return $.when(self.replaceContent('#sidebarContent', 'vidyo_participants_list_template', {
            "participants": participants,
            "shareOnly": getRoomData().isShareOnly,
            "isGuest": isGuest,
            "participantCount": {"count": participants.length}
        })).done(function() { //changed then to done

            if (isParticipantsTabClicked) {
                showSidebarTemplate();
                handleSidebarmenuChange($('#participants_menu'));
            }

            if (participants.length === 0) {
                //if span_participant_count element on participant tab is necessary uncomment.
                //$('#sidebarContent #span_participant_count').hide();  
                $('#sidebarContent #inCallParticipantsList').hide();
            } else {
                //if span_participant_count element on participant tab is necessary uncomment.
                //$('#sidebarContent #span_participant_count').show();
                $('#sidebarContent #inCallParticipantsList').show();

            }

            //if participant list is too long, we have to increase the height of the parent element.
            //Otherwise background color will not grow.
            //get the height of single participant 
            updateSidebarContentSize("participants_menu");

            $("#sidebarContent #mod_participant_controls #mod_participant_audio_btn").off('vclick').on('vclick', function(e) {
                var $element = $(this), participantID = $element.attr('participantID');
                if ($element.hasClass("audio_status_true")) {
                    vent.trigger("onParticipantMuteAudioClicked", participantID);
                }
                else {
                    vent.trigger("onParticipantUnMuteAudioClicked", participantID);
                }
            });
            $("#sidebarContent #mod_participant_controls #mod_participant_video_btn").off('vclick').on('vclick', function(e) {
                var $element = $(this), participantID = $element.attr('participantID');
                if ($element.hasClass("video_status_true")) {
                    vent.trigger("onParticipantStopVideoClicked", participantID);
                }
                else {
                    vent.trigger("onParticipantStartVideoClicked", participantID);
                }
            });
            //If kick button needs to stand on the right side of the participant list use the commented
            //line below, and change the css. Otherwise this function will not trigger.
            //$("#sidebarContent #mod_participant_controls #mod_participant_kick_btn").off('vclick').on('vclick',function (e) {
            $("#sidebarContent #mod_participant_kick_btn").off('vclick').on('vclick', function(e) {
                var $element = $(this), participantID = $element.attr('participantID');
                vent.trigger("onParticipantKickClicked", participantID);
            });

        });
    }

    //TODO: remove after test
    function fillParticipantListWithFakeUsersForTest() {

        var dummyArr = [], i = 0;
        for (i = 0; i < 100; i++) {
            dummyArr[i] = {'audio': true, 'video': true, 'displayName': "hakan"};
        }
        reloadParticipantsList(dummyArr, false);
    }

    //toogle chat button    
    function toggleChatButton() {
        if ($("#chat_container").is(":visible")) {
            $("#chat_toggle_btn").addClass("disabled");
            $("#chat_toggle_btn").attr('title', window.lang.VidyoClient.HIDE_CHAT);
            logger.info("Chat panel should be visible.");
        } else {
            $("#chat_toggle_btn").removeClass("disabled");
            $("#chat_toggle_btn").attr('title', window.lang.VidyoClient.SHOW_CHAT);
            logger.info("Chat panel should be invisible.");
        }
    }
    
    function hidePopupsFromLeft() {
        var obj = $.noty.store;
        $.each(obj, function(key, val) {
            if (obj[key].options.layout.name === "centerLeft") {
                $.noty.close(key);
            }
        });
    }

    //Chat Container UI Hide Method
    function hideChatContainer() {
        $("#chat_container").hide();
        $("#vidyo_plugin_container").removeClass("chat");
        $("#chat_container.cd-panel").removeClass("is-visible");
        toggleChatButton();
    }
    //Chat Container UI Show Method
    function showChatContainer() {
        $("#chat_container").show();
        $("#vidyo_plugin_container").addClass("chat");
        $("#chat_container.cd-panel").addClass("is-visible");
        $("#create-new-tabs").tabs();
        $("#chat_warning_icon").hide();
        $("#vidyo-message-input").focus();
        toggleChatButton();
    }

    function addFullScreenTemplateUpdate() {
        logger.info("page is fullscreen, toolbar should be invisible.");
        $("#fullscreen_btn").addClass("disabled");
        hideSidebarTemplate();
        hideChatContainer();
    }

    function removeFullScreenTemplateUpdate() {
        logger.info("page is NOT fullscreen, toolbar should be visible.");
        $("#fullscreen_btn").removeClass("disabled");
    }

    function maxWindowOnlyForIE() {

        $("#fullscreen_btn").addClass("disabled");
        $('#share_menu').removeClass("cur_menu");
        $('#setview_menu').removeClass("cur_menu");
        $('#layout_menu').removeClass("cur_menu");
        $('#settings_menu').removeClass("cur_menu");
        $('#participants_menu').removeClass("cur_menu");
        $('#moderator_menu').removeClass("cur_menu");

        $('#inCallParticipantsPanel').hide();
        $('#modcontroller_header').hide();
        $('#inCallContainer').removeClass("fullscreen");
        $('#inCallContainer').removeClass("well");
        $('#inCallContainer').removeClass("well-large");

        $('#pluginAndChatContainer').css({width: "", height: ""}); //needs to be auto
        $('#pluginAndChatContainer').removeClass("pull-right");
        $('#pluginAndChatContainer').removeClass("fullscreen");
        $('#pluginAndChatContainer').removeClass("sidebar_hide");
        $('#pluginAndChatContainer').addClass("fullscreen_only_ie");

        $("#chat_container").hide(); //slideToggle moves from up to down
        $("#vidyo_plugin_container").removeClass("chat");
        $("#chat_container.cd-panel").removeClass("is-visible");
        toggleChatButton();

    }

    function minWindowOnlyForIE() {

        $('#inCallParticipantsPanel').show();
        $('#modcontroller_header').show();
        $('#inCallContainer').addClass("fullscreen");
        $('#inCallContainer').addClass("well");
        $('#inCallContainer').addClass("well-large");

        $('#pluginAndChatContainer').css({width: "auto", height: "auto"}); //needs to be auto
        $('#pluginAndChatContainer').addClass("pull-right");
        $('#pluginAndChatContainer').addClass("fullscreen");
        $('#pluginAndChatContainer').addClass("sidebar_hide");
        $('#pluginAndChatContainer').removeClass("fullscreen_only_ie");

        $("#fullscreen_btn").removeClass("disabled");
    }

    function addFullScreen(element, notF11Key) {
        var requestMethod = element.requestFullScreen || element.webkitRequestFullscreen || element.mozRequestFullScreen || element.msRequestFullscreen,
                wscript, isFullScreenApplied = false;
        if (requestMethod) {
            requestMethod.call(element);
            isFullScreenApplied = true;
            addFullScreenTemplateUpdate();
        } else if (window.ActiveXObject !== undefined) {

            try {//IE full screen with security low
                wscript = new window.ActiveXObject("WScript.Shell");
                if (wscript !== null && !notF11Key) {
                    wscript.SendKeys("{F11}");
                    isFullScreenApplied = true;
                    addFullScreenTemplateUpdate();
                }
            } catch (e) {//IE full screen with security high
                //IE security level prevented going to full screen
                logger.info("maximize: running on IE, fullscreen functionality only works if ActiveXObj security is disabled!");
                maxWindowOnlyForIE();
//                addFullScreenTemplateUpdate();
                isFullScreenApplied = true;
            }
        }
        return isFullScreenApplied;
    }

    function removeFullScreen(notF11Key) {
        var requestMethod = document.cancelFullScreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen,
                wscript, isFullScreenRemoved = false;
        if (requestMethod) { // Native full screen.
            requestMethod.call(document);
            isFullScreenRemoved = true;
            removeFullScreenTemplateUpdate();
        } else if (window.ActiveXObject !== undefined) {
            try {// Older IE.
                wscript = new window.ActiveXObject("WScript.Shell");
                if (wscript !== null && !notF11Key) {
                    wscript.SendKeys("{F11}");
                    isFullScreenRemoved = true;
                    removeFullScreenTemplateUpdate();
                }
            } catch (e) {
                //IE security level prevented going to full screen
                logger.info("minimize: running on IE, fullscreen functionality only works if ActiveXObj security is disabled!");
                minWindowOnlyForIE();
//                removeFullScreenTemplateUpdate();
                isFullScreenRemoved = true;
            }
        }

        return isFullScreenRemoved;
    }

    function handleFullScreen() {
        if (!isFullScreen) {
            if (addFullScreen(fullScreenElement)) {
                isFullScreen = true;
                $("#fullscreen_btn").attr('title', window.lang.VidyoClient.MINIMIZE_FULL_SCREEN);
            }
        }
        else {
            if (removeFullScreen()) {
                isFullScreen = false;
                $("#fullscreen_btn").attr('title', window.lang.VidyoClient.FULL_SCREEN);
                //expected behavior. once minimizing hide panels.
                hideSidebarTemplate();
                hideChatContainer();
                hidePopupsFromLeft();
            }
        }
    }
    //Full Screen Events End//

    function linkModeratorClickEvents() {
        $('#unlock_room').off('vclick').on('vclick', function(e) {
            vent.trigger("onLockRoomChange", false);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#lock_room').off('vclick').on('vclick', function(e) {
            vent.trigger("onLockRoomChange", true);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#end_conference').off('vclick').on('vclick', function(e) {
            killAllPopups();
            showPopup(window.lang.VidyoClient.END_CONFERENCE_QUESTION, "", true, undefined, 'END_CONFERENCE_QUESTION');
            //since we are not able to show popups in fullscreen, exit from fullscreen to show the popup.
            if (isFullScreen) {
                handleFullScreen();
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#unmute_conference_audio').off('vclick').on('vclick', function(e) {
            vent.trigger("onServerAudioClicked", false);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#mute_conference_audio').off('vclick').on('vclick', function(e) {
            vent.trigger("onServerAudioClicked", true);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#unmute_conference_video').off('vclick').on('vclick', function(e) {
            vent.trigger("onServerVideoClicked", false);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#mute_conference_video').off('vclick').on('vclick', function(e) {
            vent.trigger("onServerVideoClicked", true);
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#silence_conference_audio').off('vclick').on('vclick', function(e) {
            vent.trigger("onSilenceParticipantsAudioClicked");
        }).dblclick(function(event) {
            event.preventDefault();
        });
        $('#silence_conference_video').off('vclick').on('vclick', function(e) {
            vent.trigger("onSilenceParticipantsVideoClicked");
        }).dblclick(function(event) {
            event.preventDefault();
        });
    }

    function reloadModeratorControlsTab(mediaInfo, isLocked, onclick) {
        $.when(self.replaceContent('#sidebarContent', 'moderator_controls_template',
                {"mediaInfo": mediaInfo, "isLocked": isLocked, "shareOnly": getRoomData().isShareOnly})).done(
                function() {
                    linkModeratorClickEvents();
                    if (onclick) {
                        showSidebarTemplate();
                        handleSidebarmenuChange($('#moderator_menu'));
                    }
                }
        );
    }

    function stringifyTime(hours, minutes, seconds) {
        hours = (hours < 10) ? "0" + hours : hours;
        minutes = (minutes < 10) ? "0" + minutes : minutes;
        seconds = (seconds < 10) ? "0" + seconds : seconds;

        return hours + ":" + minutes + ":" + seconds;
    }

    function formatDuration(duration) {
        var seconds = parseInt((duration / 1000) % 60, 10)
                , minutes = parseInt((duration / 60000) % 60, 10)
                , hours = parseInt(duration / 3600000, 10);

        return stringifyTime(hours, minutes, seconds);
    }

    function conferenceTimerStart() {
        var first = new Date();
        clearInterval(myTimer);
        function start(first) {
            var now = new Date(),
                    durationText,
                    timeText;

            timeText = stringifyTime(now.getHours(), now.getMinutes(), now.getSeconds());
            durationText = formatDuration(now.getTime() - first.getTime());

            if ($('#timer_btn').hasClass('none')) {
                $("#timer_btn").children("label").text(timeText);
                //show duration as tooltip i.e: show opposite
                $("#timer_btn").attr('title', window.lang.VidyoClient.SHOW_DURATION);
            } else {
                $("#timer_btn").children("label").text(durationText);
                //show time as tooltip
                $("#timer_btn").attr('title', window.lang.VidyoClient.SHOW_TIME);
            }
        } // timer function end
        myTimer = setInterval(function() {
            start(first);
        }, 1000);
        start(first);
    }

    function toggleLocalMediaButton(isMuted, button, muteTitle, unmuteTitle) {
        if (isMuted) {
            $(button).addClass("muted");
            $(button).attr("title", unmuteTitle);
        } else {
            $(button).removeClass("muted");
            $(button).attr("title", muteTitle);
        }
    }
    
    function disableEnableLocalMediaButton(isDisabled, button, muteTitle, unmuteTitle, disabledTitle) {
        if (isDisabled === true) {
            $(button).addClass("ui-disabled");
            $(button).attr("title", disabledTitle);
        } else {
            $(button).removeClass("ui-disabled");
            if ($(button).hasClass("muted")) {
                $(button).attr("title", unmuteTitle);
            } else {
                $(button).attr("title", muteTitle);
            }
        }
    }

    function setFullScreenElement() {
        fullScreenElement = document.getElementById("inCallContainer");
    }

    function showLoadingItem(text, hideBackground) {
        $.mobile.loading("show", {
            text: text,
            textVisible: true,
            theme: "c",
            html: ""
        });
        if (hideBackground) {
            $("#home_page").addClass("room_load_and_hide_backround");
        }
        else {
            $("#home_page").addClass("room_load");
            $("#home_page").addClass("ui-disabled");
        }
    }

    function hideLoadingItem() {
        $.mobile.loading("hide");
        $("#home_page").removeClass("room_load");
        $("#home_page").removeClass("room_load_and_hide_backround");
        $("#home_page").removeClass("ui-disabled");
    }

    function activeSessionTemplate(isGuest) {
        hideLoadingItem();
        conferenceTimerStart();
        shareListUpdateTimer();
        if (isGuest) {
            $('#moderator_menu').hide();
        } else {
            $('#moderator_menu').show();
        }

        $('#detail').hide();
        $('#inCallContainer').addClass("fullscreen");
        $('#inCallContainer').addClass("well");
        $('#inCallContainer').addClass("well-large");
        $('#inCallParticipantsPanel').addClass("fullscreen");
        $('#inCallParticipantsPanel').removeClass("hide");
        $('#inCallButtonPanel').addClass("fullscreen");
        $('#inCallButtonPanel').removeClass("hide");
        $('#inCallPluginAndControlsWrap').addClass("fullscreen");
        $('#pluginAndChatContainer').addClass("fullscreen");
        $('#inCallParticipantsPanel').show();
        $('#inCallButtonPanel').show();
        $('#modcontroller_header').show();
        $('#participants_menu').addClass("cur_menu");
        $("#conference_settings").removeClass("hide");
        setFullScreenElement();
        showModeratorName();
        //update the location of footer
    }

    function deActiveSessionTemplate() {
        hideLoadingItem();
        removeFullScreen(true);//Disable fullScreen remove with F11 key.
//        $('#detail').show();
//        $('#inCallContainer').removeClass("fullscreen");
//        $('#inCallContainer').removeClass("well");
//        $('#inCallContainer').removeClass("well-large");
//        $('#inCallParticipantsPanel').removeClass("fullscreen");
//        $('#inCallParticipantsPanel').addClass("hide");
//        $('#inCallButtonPanel').removeClass("fullscreen");
//        $('#inCallButtonPanel').addClass("hide");
//        $('#inCallPluginAndControlsWrap').removeClass("fullscreen");
//        $('#pluginAndChatContainer').removeClass("fullscreen");
//        $('#pluginAndChatContainer').removeClass("fullscreen_only_ie");
//        $('#inCallParticipantsPanel').hide();
//        $('#inCallButtonPanel').hide();
//        $('#modcontroller_header').hide();
//        $("#conference_settings").addClass("hide");
//        handleSidebarmenuChange();
        clearAllPopupArrays();
        window.location.reload();
    }

    function hideVidyoControlDetailsDiv() {
        $('#vidyo_control_details').hide();
    }

    function showVidyoControlDetailsDiv() {
        $('#vidyo_control_details').show();
    }
    function enableVidyoControlDetailsInputElements() {
        $("#invite_message_text").attr("disabled", false);
        $("#email_group_text").attr("disabled", false);
        //$("#enter_room").removeClass("disabled");
    }

    function disableVidyoControlDetailsInputElements() {
        $("#invite_message_text").attr("disabled", true);
        $("#email_group_text").attr("disabled", true);
        //$("#enter_room").addClass("disabled");
    }

    function showProgressIndicator(type, text) {
        if (type === "loading") {
            $("#information_area #warning_icon").css({"display": "none"});
            $("#vidyo_status_icon").removeClass("error").addClass("loading").show();
            $("#vidyo_status_label").removeClass("warning_label");
            $("#vidyo_status_label").addClass("information_label");
            $("#information_area").addClass("information");
            $("#information_area").removeClass("warning");

        }
        else if (type === "error") {
            $("#information_area #warning_icon").css({"display": "table-cell"});
            $("#vidyo_status_icon").removeClass("loading").addClass("error").show();
            $("#vidyo_status_label").addClass("warning_label");
            $("#vidyo_status_label").removeClass("information_label");
            $("#information_area").removeClass("information");
            $("#information_area").addClass("warning");

        } else {
            $("#information_area #warning_icon").css({"display": "none"});
            $("#vidyo_status_icon").removeClass("loading").removeClass("error").show();
            $("#vidyo_status_label").removeClass("warning_label");
            $("#vidyo_status_label").addClass("information_label");
            $("#information_area").addClass("information");
            $("#information_area").removeClass("warning");


        }
        $("#vidyo_status_label").text(text);
        //$("#vidyo_status_control").show();
    }

    function createSendMessageTemplate(name, message, direction) {
        var sendMessageDiv, directionColor = (direction === "send" ? "Blue" : "Gray"),
                directionPosition = (direction === "send" ? "right" : "left"), text = message, errorIM, time = (new Date()).toLocaleTimeString();

        sendMessageDiv = $('<div class="instant_message ' + directionPosition + '">' +
                '<span class="message_time"><i>' + time + '</i></span>' +
                '<div class="instant_message bubble' + directionColor + 'TopLeft"></div>' +
                '<div class="instant_message bubble' + directionColor + 'TopCenter"></div>' +
                '<div class="instant_message bubble' + directionColor + 'TopRight"></div>' +
                '<div class="instant_message bubble' + directionColor + 'MiddleLeft"></div>' +
                '<div class="instant_message bubble' + directionColor + 'MiddleRight"></div>' +
                '<div class="instant_message bubble' + directionColor + 'BottomLeft"></div>' +
                '<div class="instant_message bubble' + directionColor + 'BottomCenter"></div>' +
                '<div class="instant_message bubble' + directionColor + 'BottomRight"></div>' +
                '<div class="instant_message bubble' + directionColor + 'MiddleCenter"></div>' +
                '<div class="instant_message bubble' + directionColor + ' ' + errorIM + '">' + text +
                '</div></div>');
        return sendMessageDiv;

    }

    function chatHistoryUpdate(name, message, direction) {
        var sendMessageDiv = createSendMessageTemplate(name, message, direction), oScrollbar = $('#messages_scroll');
        $("#instant_messages_vidyo").append(sendMessageDiv);
        oScrollbar.tinyscrollbar();
        oScrollbar.tinyscrollbar_update('bottom');
    }

    function maximizePluginContainer(isAboutPopup) {
        $(PLUGIN_CONTAINER_SELECTOR).addClass("show_plugin");

        //necessary for footer. simple css solutions does not work with this architecture.
        //there is a general problem with application template in IE11. This solution works
        //as expected with Chrome, IE9

        if (!isAboutPopup) {
            //since this will be the active menu at first, hide it so the plugin is at max.
            hideSidebarTemplate($('#participants_menu'));
        }
    }

    function clearChatArea() {
        $(".cd-panel-content").empty();
        $("#vidyo-message-input").val("");

        lastPersonTyped.GROUP_CHAT = "";
        if (myAccount.incomingMsgCount) {
            myAccount.incomingMsgCount = 0;
        }
        myAccount.data = "";
        myAccount.userName = "";
        if ($("#chat_warning_icon").is(":visible")) {
            $("#chat_warning_icon").remove();
        }
    }
    function minimizePluginContainer(hideOpenWindows) {
        //necessary for jira id ABE-2677
        if (hideOpenWindows === undefined || hideOpenWindows) {
            $(PLUGIN_CONTAINER_SELECTOR).removeClass("show_plugin");
            $(PLUGIN_CHAT_CONTAINER_SELECTOR).removeClass("show_chat");
            $(PLUGIN_CHAT_CONTAINER_SELECTOR).hide();
            //clear chat area
            clearChatArea();
        }
        //necessary for footer. there is another similar line in maximizePluginContainer fn.
    }

    function activateVidyoPluginContainer(isAboutPopup) {
        maximizePluginContainer(isAboutPopup);
        $("#vidyo_plugin_container").children(":first").css({width: "100%", height: "100%"});
        $("#vidyo_plugin_container").removeClass("off");
        $("#vidyo_plugin_container").addClass("on");
    }

    function deactivateVidyoPluginContainer(hideOpenWindows) {
        minimizePluginContainer(hideOpenWindows);
        $("#vidyo_plugin_container").children(":first").css({width: "1px", height: "1px"});
        $("#vidyo_plugin_container").removeClass("on");
        $("#vidyo_plugin_container").addClass("off");
    }

    function isRoomLoadingScreenOnView() {
        return $("#home_page").hasClass("room_load_and_hide_backround") || $("#home_page").hasClass("room_load");
    }

    function isVidyoPluginContainerActive() {
        return $("#vidyo_plugin_container").hasClass("on");
    }

    function isLoginScreenOnView() {
        return !(isVidyoPluginContainerActive() || isRoomLoadingScreenOnView());
    }

    function setEchoCancellationConfig(isSet) {
        $("#echo_cancellation").attr("checked", isSet);
    }

    function getEchoCancellationConfig() {
        return $("#echo_cancellation").is(':checked');
    }


    function setAudioAGCConfig(isSet) {
        $("#audio_AGC").attr("checked", isSet);
    }

    function getAudioAGCConfig() {
        return $("#audio_AGC").is(':checked');
    }

    function showDeviceConfigurationList(data, forceOpen) {
        if ($(PLUGIN_CONTAINER_SELECTOR).hasClass("show_plugin")
                && (forceOpen || ($("#sidebarContent_control").length !== 0 && $("#sidebarContent").is(":visible") === true))) {
            $.when(self.replaceContent('#sidebarContent', 'login_devicelist_template', {
                "deviceCamera": data.camera,
                "deviceMicrophone": data.microphone,
                "deviceSpeaker": data.speaker,
                "shareOnly": getRoomData().isShareOnly,
                "enableEchoCancellation": data.enableEchoCancellation,
                "enableAudioAGC": data.enableAudioAGC
            }, 'create')).done(function() {
                showSidebarTemplate();
                window.console.log("login_devicelist_template click");
                handleSidebarmenuChange($('#settings_menu'));
                $("#camera ,#speaker ,#microphone").change(function(event) {
                    // Check device setting change event
                    var selection = $(event.target).val(),
                            deviceName = $(event.target).attr("name");
                    if (deviceName === DEVICE_NAMES.CAMERA || deviceName === DEVICE_NAMES.SPEAKER || deviceName === DEVICE_NAMES.MICROPHONE) {
                        if (selection !== "#") {
                            vent.trigger("onSetCurrentDevice", deviceName, selection);
                        }
                    }
                });


                $("#echo_cancellation").change(function(event) {
                    vent.trigger("onEchoCancellationConfigChange", getEchoCancellationConfig());
                }).dblclick(function(event) {
                    event.preventDefault();
                });

                $("#audio_AGC").change(function(event) {
                    vent.trigger("onAudioAGCConfigChange", getAudioAGCConfig());
                }).dblclick(function(event) {
                    event.preventDefault();
                });


            });
        }
    }

    function isShare(data) {
        var key, isshare = false;
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                if (data[key].highlight) {
                    isshare = true;
                }
            }
        }
        return isshare;
    }

    function isView(data) {
        var key, isview = false;
        for (key in data) {
            if (data.hasOwnProperty(key)) {
                if (data[key].highlight) {
                    isview = true;
                }
            }
        }
        return isview;
    }

    function toggleScreenShareIcon(sharingSelf, watching, notWatchingNorSharing) {
        if (sharingSelf) {
            $("#share_menu").addClass("sharing");
            $("#share_menu").removeClass("active");
            $("#share_menu").removeClass("deactive");
        } else if (watching) {
            $("#share_menu").addClass("active");
            $("#share_menu").removeClass("deactive");
            $("#share_menu").removeClass("sharing");
        } else if (notWatchingNorSharing) {
            $("#share_menu").removeClass("active");
            $("#share_menu").removeClass("sharing");
            $("#share_menu").addClass("deactive");
        }
    }

    function isActivelyWatchingSomeonesShare() {
        return !$('#share_list li').hasClass("stop-viewing ui-disabled")
                || !$('#share_list li').hasClass("stop-sharing ui-disabled");
    }

    function isUserWatchingOrSharing(arr) {
        var i = 0, flag = false;

        for (i = 0; i < arr.length; i++) {
            if (arr[i].highlight) {
                flag = true;
                break;
            }
        }
        return flag;
    }

    function showScreenShareList(data) {
        var i = 0, sharingSelf = false, watching = false, notWatchingNorSharing = false,
                appArray = {
            arrayppt: [],
            arrayxls: [],
            arraytxt: [],
            arrayjpg: [],
            arraychrome: [],
            arrayfirefox: [],
            arrayexplorer: [],
            arraysafari: [],
            arrayoutlook: [],
            arrayfolder: [],
            arraygenband: [],
            arraypdf: [],
            arraydoc: [],
            arrayother: []
        };
//        if (!isCurrentTabInShare()) {
//            if (isActivelyWatchingSomeonesShare()) {
//                toggleScreenShareIcon(true);
//            } else {
//                toggleScreenShareIcon(false);
//            }
//        } else {

        for (i = 0; i < data.windows.length; i++) {
            if (data.windows[i].type === "ppt") {
                appArray.arrayppt.push(data.windows[i]);
            } else if (data.windows[i].type === "xls") {
                appArray.arrayxls.push(data.windows[i]);
            } else if (data.windows[i].type === "txt") {
                appArray.arraytxt.push(data.windows[i]);
            } else if (data.windows[i].type === "jpg") {
                appArray.arrayjpg.push(data.windows[i]);
            } else if (data.windows[i].type === "chrome") {
                appArray.arraychrome.push(data.windows[i]);
            } else if (data.windows[i].type === "firefox") {
                appArray.arrayfirefox.push(data.windows[i]);
            } else if (data.windows[i].type === "explorer") {
                appArray.arrayexplorer.push(data.windows[i]);
            } else if (data.windows[i].type === "safari") {
                appArray.arraysafari.push(data.windows[i]);
            } else if (data.windows[i].type === "outlook") {
                appArray.arrayoutlook.push(data.windows[i]);
            } else if (data.windows[i].type === "pdf") {
                appArray.arraypdf.push(data.windows[i]);
            } else if (data.windows[i].type === "genband") {
                appArray.arraygenband.push(data.windows[i]);
            } else if (data.windows[i].type === "doc") {
                appArray.arraydoc.push(data.windows[i]);
            } else if (data.windows[i].type === "folder") {
                appArray.arrayfolder.push(data.windows[i]);
            } else {
                appArray.arrayother.push(data.windows[i]);
            }
        }
        $.when(View.replaceContent('#sidebarContent', 'vidyo_screen_share_list', {
            "sharing": data.sharing,
            "desktops": data.desktops,
//            "windows": data.windows,
            "arrayppt": appArray.arrayppt,
            "arrayxls": appArray.arrayxls,
            "arraytxt": appArray.arraytxt,
            "arrayjpg": appArray.arrayjpg,
            "arraychrome": appArray.arraychrome,
            "arrayfirefox": appArray.arrayfirefox,
            "arrayexplorer": appArray.arrayexplorer,
            "arraysafari": appArray.arraysafari,
            "arrayoutlook": appArray.arrayoutlook,
            "arrayfolder": appArray.arrayfolder,
            "arraygenband": appArray.arraygenband,
            "arraypdf": appArray.arraypdf,
            "arraydoc": appArray.arraydoc,
            "arrayother": appArray.arrayother,
            "failed": data.failed,
            "viewCount": {"count": data.sharing.length},
            "shareCount": {"count": data.failed ? 0 : data.desktops.length + data.windows.length},
            "isShare": isShare(data.desktops) || isShare(data.windows),
            "isView": isView(data.sharing)
        })).done(function() {
            //in case automatic tab open is required call
            //showSidebarTemplate and handleSidebarmenuChange($('#share_menu'))
            showSidebarTemplate();
            handleSidebarmenuChange($('#share_menu'));
            //if share list is too long, we have to increase the height of the parent element.
            //Otherwise background color will not grow.                     
            updateSidebarContentSize("share_menu");


            for (i = 0; i < 3; i++) {
                if (i === 0) {
                    sharingSelf = isUserWatchingOrSharing(data.windows);
                } else if (i === 1) {
                    sharingSelf = isUserWatchingOrSharing(data.desktops);
                } else if (i === 2) {
                    watching = isUserWatchingOrSharing(data.sharing);
                    sharingSelf = false;
                }
                if (sharingSelf) {
                    break;
                }
            }


            if (!watching && !sharingSelf) {
                notWatchingNorSharing = true;
            }

            toggleScreenShareIcon(sharingSelf, watching, notWatchingNorSharing);

            $("#share_list li .clickable_item").off('vclick').on('vclick', function(event) {
                var target = $(event.target), id = target.attr('data-id');
                if (target.hasClass("highlight")) {
                    return;
                }
                $("#share_list li .clickable_item.highlight").removeClass("highlight");
                $("#share_list li").find('.clickable_item[data-id="' + id + '"]"').addClass("highlight");
                if (target.hasClass("remote")) {
                    vent.trigger("onRemoteScreenSelected", id);
                } else {
                    vent.trigger("onScreenSelected", id);
                    //unable to show popups in fullscreen mode
                    if (!target.hasClass("stop-sharing") && !isFullScreen) {
                        if (!checkIfPopupExistsByText(window.lang.VidyoClient.SHARING_WARNING)) {
                            showPopup(window.lang.VidyoClient.SHARING_WARNING, window.lang.VidyoClient.DEFAULT_POP_UP_CHECKBOX_MESSAGE, false, "centerLeft", 'SHARING_WARNING');

                        }
                    }
                }
                //in case we need to show popup with dialog once user clicks a shareable element uncomment
                //the lines below                             showPopup(window.lang.VidyoClient.SHARING_WARNING, window.lang.VidyoClient.DEFAULT_POP_UP_CHECKBOX_MESSAGE, false, "centerLeft", "", data);

//                if (target.hasClass("remote")) {
//                    $("#share_list li .clickable_item.highlight").removeClass("highlight");
//                    $("#share_list li").find('.clickable_item[data-id="' + id + '"]"').addClass("highlight");
//                    vent.trigger("onRemoteScreenSelected", id);
//                } else {
//                    //if popup answer is yes change screen
//                    if (!target.hasClass("stop-sharing")) {
//                        showPopup(window.lang.VidyoClient.SHARE_WINDOW_REALLY, "", true, "centerLeft", "share", id);
//                    } else {
//                        $("#share_list li .clickable_item.highlight").removeClass("highlight");
//                        $("#share_list li").find('.clickable_item[data-id="' + data + '"]"').addClass("highlight");
//                        vent.trigger("onScreenSelected", id);
//                    }
//                }
                updateSidebarContentSize("share_menu");
            });
        });
//        }

    }

    /*create new message temple 
     * for incoming and outgoing
     * messages
     * format: <div> date(hh:mm:ss)+ username+ msg </div> 
     */
    function newMessageTemplate(msg, username, activeTab, direction, fail) {
        // format date time show two digits
        // e.g: 12:9:10 -> 12:09:10
        function getDate() {
            var hour = "", min = "", sec = "", d = new Date();
            hour = d.getHours();
            min = d.getMinutes();
            sec = d.getSeconds();

            if (d.getHours() < 10) {
                hour = "0" + d.getHours();
            }
            if (d.getMinutes() < 10) {
                min = "0" + d.getMinutes();
            }
            if (d.getSeconds() < 10) {
                sec = "0" + d.getSeconds();
            }
            return  hour + ":" + min + ":" + sec;
        }
        //refactored inline style commands given in previous version. 
        //This part is completely redesigned and basis on chat.less for css
        var date = getDate(), brr = "";
        $(activeTab + " .cd-panel-content").append('<div id="msg_item"> </div>');
        if (lastPersonTyped.GROUP_CHAT === "" || lastPersonTyped.GROUP_CHAT !== username) {
            lastPersonTyped.GROUP_CHAT = username;
            $('#msg_item').addClass('msg_border_top_left');
            $('#msg_item').addClass('msg_border_bottom_right');
            brr = '<span id="msg_sender">' + username + ':</span> ' + '<span class="message_clock_color">(' + date + ')</span>';
            $(activeTab + " .cd-panel-content #msg_item").last().append(brr);
        } else {
            brr = "";
            $("#group-chat .cd-panel-content div").last().removeClass("msg_border_bottom_right");
            $(activeTab + " .cd-panel-content #msg_item").last().removeClass('msg_border_top_left');
            $(activeTab + " .cd-panel-content #msg_item").last().addClass('msg_border_bottom_right');
        }
        //direction 0 receive 1 send
        if (direction === 0) {
            $(activeTab + " .cd-panel-content #msg_item #msg_sender").last().addClass('receiver_username_color');
            $(activeTab + " .cd-panel-content #msg_item").last().addClass('receive_message_background_color');
            $(activeTab + " .cd-panel-content #msg_item #msg_sender").last().removeClass('sender_username_color');
            $(activeTab + " .cd-panel-content #msg_item").last().removeClass('send_message_background_color');
        } else {
            $(activeTab + " .cd-panel-content #msg_item #msg_sender").last().addClass('sender_username_color');
            $(activeTab + " .cd-panel-content #msg_item").last().addClass('send_message_background_color');
            $(activeTab + " .cd-panel-content #msg_item #msg_sender").last().removeClass('receiver_username_color');
            $(activeTab + " .cd-panel-content #msg_item").last().removeClass('receive_message_background_color');
        }
        if (!fail) {
            $(activeTab + " .cd-panel-content #msg_item").last().append('<span class="message_color"> ' + msg + '</span>');
        }
        else {
            $(activeTab + " .cd-panel-content #msg_item").last().append('<span class="message_color"> ' + msg + '</span><span class="fail_message fail_message_color">(' + window.lang.VidyoClient.RETRY_MESSAGE + ')</span>');
            $(".fail_message").off('vclick').on('vclick', function(e) {
                $(e.currentTarget).hide();
                $("#chat_container").addClass("cursor_progress");
                vent.trigger("onSendGroupChatMessage", $(e.currentTarget.parentNode).find('.message_color').text().trim(), function() {
                    $(e.currentTarget).remove();
                    $("#chat_container").removeClass("cursor_progress");
                }, function() {
                    $(e.currentTarget).show();
                    $("#chat_container").removeClass("cursor_progress");
                });
            }).dblclick(function(event) {
                event.preventDefault();
            });
        }
    }

    function chatScrollToBottom() {
        //should scroll to bottom
        var activeTab = "#group-chat", $tab;
        $tab = $(activeTab + " .cd-panel-content");
        $tab.animate({"scrollTop": $(activeTab + " .cd-panel-content")[0].scrollHeight}, "fast");
    }

    function onReceiveMessage(IM) {
        var activeTab = "#group-chat", msg = "", direction = 1, from = "", val = "";

        from = IM.displayName;
        msg = IM.message;

        //find and tag URLs, emails in message 
        // msg = window.urlize(msg); //using library
        msg = utils.linkify(msg);
        direction = 0;
        newMessageTemplate(msg, from, activeTab, direction);

        if (!$("#vidyo_plugin_container").hasClass("chat")) {
            $("#chat_warning_icon .warning").css({"left": "4px"});
            if (!myAccount.incomingMsgCount) {
                myAccount.incomingMsgCount = 1;
            } else {
                myAccount.incomingMsgCount += 1;
            }
            val = myAccount.incomingMsgCount;
            if (myAccount.incomingMsgCount > 9) {
                val = "9+";
                $("#chat_warning_icon .warning").css({"left": "1px"});
            }
            $("#chat_warning_icon").show();
            $("#chat_warning_icon .warning").html(val);
        }
        chatScrollToBottom();
    }


    function setUserAccount(data) {
        if (data) {
            myAccount.data = data;
            myAccount.userName = data.displayName;
        }
    }

    function setSelfViewMode() {
        if ($('#selfview_menu').hasClass('none')) {
            vent.trigger("onPreviewModeChange", true);
            logger.info('Selview is activated');
        }
    }

    function lockRoomUpdate(isRoomLocked) {
        if (isRoomLocked) {
            $('#lockRoom').removeClass("none");
            $("#lockRoom").attr('title', window.lang.VidyoClient.UNLOCK_ROOM_TOOLTIP);
            logger.info('lockRoomUpdate(', isRoomLocked, ') room is locked');
        } else {
            $('#lockRoom').addClass("none");
            $("#lockRoom").attr('title', window.lang.VidyoClient.LOCK_ROOM_TOOLTIP);
            logger.info('lockRoomUpdate(', isRoomLocked, ') room is unlocked');
        }
    }

    function loadConfiguration() {
        var vidyoPluginLink;
        vidyoConfig = configController.getConf("vidyoPluginConfiguration", null);
        if (!vidyoConfig) {
            showProgressIndicator("error", window.lang.VidyoClient.NO_CONFIGURATION);
            return undefined;
        }

        if (window.navigator.appVersion.indexOf("Mac") !== -1) {
            if ($("#plugindownload_browser_version").attr("checked") === "checked") {
                vidyoPluginLink = vidyoConfig.macOsVideoPluginLink64;
            } else {
                vidyoPluginLink = vidyoConfig.macOsVideoPluginLink;
            }
        }
        else {
            $("#macosx-browser-version").removeClass("macosx");
            vidyoPluginLink = vidyoConfig.windowsVidyoPluginLink;
        }

        vidyoConfig.vidyoPluginDownloadLink = vidyoPluginLink;

        return vidyoConfig;
    }

    function vidyoPluginIsInstalled() {
        vidyoConfig = loadConfiguration();
        var isFound = false, browserName, depNpapi = utils.getKeyVal("depracation_folloups");
        browserName = utils.getBrowser().toLowerCase();
        if (browserName.indexOf("chrome 42") >= 0 && !depNpapi && depNpapi !== "yes") {
            errorView.init({
                step_warning_message: [
                    {step: window.lang.VidyoClient.CHROME_42_FOLLOWUPS_FIRST_LABEL},
                    {step: window.lang.VidyoClient.CHROME_42_FOLLOWUPS_LABEL_STEP_1},
                    {step: window.lang.VidyoClient.CHROME_42_FOLLOWUPS_LABEL_STEP_2},
                    {step: window.lang.VidyoClient.CHROME_42_FOLLOWUPS_LABEL_STEP_3},
                    {step: window.lang.VidyoClient.CHROME_42_FOLLOWUPS_END_LABEL}
                ],
                roomOwner: window.lang.VidyoClient.CHROME_42,
                createBackButton: {
                    text: window.lang.VidyoClient.ALLREADY_ENABLED,
                    buttonFunction: function() {
                        utils.saveKeyVal("depracation_folloups", "yes");
                        location.reload();
                    }
                },
                createOKButton: {
                    text: window.lang.VidyoClient.JUST_DONE,
                    buttonFunction: function() {
                        utils.saveKeyVal("depracation_folloups", "yes");
                    }
                }
            }).done(function() {
                $("#error_information_area").addClass("warning_message");
            });
        }
        isFound = utils.vidyoPluginIsInstalled(vidyoConfig.pluginMimeType, vidyoConfig.pluginVersion, vidyoConfig.activexType);
        if (!isFound) {
            /* Notify deferred object to show plugin download */
            if (vidyoConfig.vidyoPluginDownloadLink) {
                vent.trigger("onShowDialog", window.lang.VidyoClient.PLUGIN_NOT_FOUND, "alert", {
                    download: true,
                    cancel: true
                }, {
                    downloadLink: vidyoConfig.vidyoPluginDownloadLink
                });
            }
            else {
                showProgressIndicator("error", window.lang.VidyoClient.PLUGIN_NOT_FOUND);
            }
        }
    }

    /**
     * Reads localStorage and fills user credentials
     * @returns {undefined}
     */
    function fillUserCredentials() {
        var rememberGuest, rememberHost, username, password, nickname, savekey;
        savekey = utils.getKeyFromUrl();
        if ($("#moderator").is(":visible")) {
            rememberHost = utils.getKeyVal(savekey + "_collab-l-rmn-x_host");
            if (rememberHost && rememberHost === 'yes')
            {
                username = window.Base64.decode(utils.getKeyVal(savekey + '_collab-l-usrnm-x'));
                password = window.Base64.decode(utils.getKeyVal(savekey + '_collab-l-pwd-x'));

                if (username && username !== "") {
                    $('#login_username').val(username);
                    $("#clear_username").show();
                }
                if (username && username !== "" && password && password !== "") {
                    $('#password').val(password);
                    $('#password').focus();
                    $('#password').blur();
                    $("#clear_password").show();
                }
                $("#rememberMe").attr("checked", true);
            }
            else {
                $("#rememberMe").attr("checked", false);
            }
        }

        if ($("#guest").is(":visible")) {
            rememberGuest = utils.getKeyVal("collab-l-rmn-x_guest");
            if (rememberGuest && rememberGuest === "yes") {
                nickname = window.Base64.decode(utils.getKeyVal('collab-l-nck-x'));
                if (nickname && nickname !== "") {
                    $('#login_nickname').val(nickname);
                    $("#clear_nickname").show();
                    $("#rememberMe").attr("checked", true);
                }
            }
            else {
                $("#rememberMe").attr("checked", false);
            }
        }
    }

    function cleanUpWindow() {
        if ($("#vidyo_plugin_container").hasClass("chat")) {
            $("#chat_toggle_btn").click();
        }
    }

    function retryLogin() {
        $("#enter_room").click();
    }

    function moderatorTabClick() {
        $("#ui-id-2").click(); //default open moderator login page.
    }    

    function setProxyConfig(isUseProxy) {
        $("#proxy_setting").attr("checked", isUseProxy);
    }

    function getProxyConfig() {
        return $("#proxy_setting").is(':checked');
    }

    function setWebProxyConfig(webProxyConfig) {
        logger.info("Initialize Web Proxy Config for UI : " + JSON.stringify(webProxyConfig));
        /*$("#web_proxy_setting").attr("checked", isUseWebProxy);*/ // isUseWebProxy === true for all web scenarios
    }

    function getWebProxyConfig() {
        return {
            isCheckWebProxy: /*$("#web_proxy_setting").is(':checked')---web Proxy UI check disable*/true,
            proxyType: /*$("#web_proxy_setting").is(':checked') ? PROXY_TYPE.AUTO : PROXY_TYPE.NONE---web proxy hardcoded AUTO(OS setting)*/PROXY_TYPE.AUTO,
            webProxyUsername: "", //if there is web proxy authentication(Selected Manual or AUTO)
            webProxyPassword: "", //if there is web proxy authentication (Selected Manual or AUTO)
            webProxyAddress: "", //if selected manual web proxy
            webProxyPort: ""       //if selected manual web proxy
        };
    }

    function moderatorButtonsHandleVisibility(isGuest) {
        if (isGuest) {
            $('#lockRoom').remove();
            $('#endConf').remove();
        } else {
            if ($("#endConf").length <= 0 && $("#lockRoom").length <= 0) {
                var lock, end;
                end = '<div id="endConf" data-form="ui-btn-up-c" data-role="button" title="' + window.lang.VidyoClient.END_CONFERENCE_TOOLTIP + '" ></div>';
                lock = '<div id="lockRoom" data-form="ui-btn-up-c" data-role="button" title="' + window.lang.VidyoClient.LOCK_ROOM_TOOLTIP + '" class="none"></div>';
                $("#modcontroller").append(end);
                $("#modcontroller").append(lock);
            }
            // initialize endConf & lockRoom onclicks
            $('#lockRoom').off('vclick').on('vclick', function(e) {
                if ($('#lockRoom').hasClass('none')) {
                    vent.trigger("onLockRoomChange", true);
                }
                else {
                    vent.trigger("onLockRoomChange", false);
                }
            }).dblclick(function(event) {
                event.preventDefault();
            });

            $('#endConf').off('vclick').on('vclick', function() {
                killAllPopups();
                showPopup(window.lang.VidyoClient.END_CONFERENCE_QUESTION, "", true, undefined, 'END_CONFERENCE_QUESTION');
            }).dblclick(function(event) {
                event.preventDefault();
            });
        }
    }

    function initializeListeners() {
        $(window).ready(function() {
            utils.loadSound("notification", 1, "tones/");
        });
        var browserName = utils.getBrowser().toLowerCase();
        if (browserName.indexOf("opera") >= 0) {
            $("#browser_warning").show();
        }
        //update sidebarContent size dynamically on resize.
        $(window).resize(function() {

            if (isCurrentTabInViewParticipants()) {
                updateSidebarContentSize("participants_menu");
            } else if (isCurrentTabInShare()) {
                updateSidebarContentSize("share_menu");
            } else {
                updateSidebarContentSize();
            }
            //triggered help_submenu hide with browser resize.
            $("body").trigger("click");
            //if chat is open,scroll to bottom
            if ($("#chat_container").is(":visible")) {
                chatScrollToBottom();
            }
        });

        $('#help_login').off('vclick').on('vclick', function(e) {
            if (e.target.type !== "list") {
                $('#help_login_submenu').show();
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#help_main').off('vclick').on('vclick', function(e) {
            if (e.target.type !== "list") {
                $('#help_main_submenu').show();
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#help_main_submenu,#help_login_submenu').find(".clickable_item").off('vclick').on('vclick', function(e) {
            if (e.target.textContent === window.lang.VidyoClient.HELP) {
                if (localization.getUseLang() === "fr") {
                    window.open(configController.getConf("vidyoPluginConfiguration").frenchHelp);
                }
                else if (localization.getUseLang() === "en") {
                    window.open(configController.getConf("vidyoPluginConfiguration").englishHelp);
                }
                else {
                    window.open(configController.getConf("vidyoPluginConfiguration").englishHelp);
                }
            }
            else if (e.target.textContent === window.lang.VidyoClient.ABOUT) {
                vent.trigger("onAboutPopup", true);
            }
            $('#help_main_submenu').hide();
            $('#help_login_submenu').hide();
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#dialog_close').off('vclick').on('vclick', function(e) {
            vent.trigger("onAboutPopup", false);
        }).dblclick(function(event) {
            event.preventDefault();
        });

        window.addEventListener("click", function(e) {
            if (e.target.getAttribute("id") !== "help_login" && e.target.getAttribute("id") !== "help_main") {
                $('#help_main_submenu').hide();
                $('#help_login_submenu').hide();
            }
        });

        $("#plugindownload_browser_version").off('vclick').on('vclick', function(e) {
            if ($("#plugindownload_browser_version").attr("checked") === "checked") {
                $("#dialog_download").attr('href', vidyoConfig.macOsVideoPluginLink64);
            } else {
                $("#dialog_download").attr('href', vidyoConfig.macOsVideoPluginLink);
            }
        });
        $("#ui-id-1").off('vclick').on('vclick', function(e) {
            var rememberGuest = utils.getKeyVal("collab-l-rmn-x_guest");
            $("#ui-id-1").attr("checked", true);
            $("#ui-id-2").attr("checked", false);
            if (rememberGuest && rememberGuest === "yes") {
                $('#login_nickname').val(window.Base64.decode(utils.getKeyVal('collab-l-nck-x')));
                $("#rememberMe").attr("checked", true);
            } else {
                $("#rememberMe").attr("checked", false);
            }
            $("#password, #login_nickname, #login_username, #login_guesturl").keyup();
        });

        $("#ui-id-2").off('vclick').on('vclick', function(e) {
            var rememberHost, savekey, username, password;
            savekey = utils.getKeyFromUrl();
            rememberHost = utils.getKeyVal(savekey + "_collab-l-rmn-x_host");
            $("#ui-id-2").attr("checked", true);
            $("#ui-id-1").attr("checked", false);
            if (rememberHost && rememberHost === "yes") {
                username = window.Base64.decode(utils.getKeyVal(savekey + '_collab-l-usrnm-x'));
                password = window.Base64.decode(utils.getKeyVal(savekey + '_collab-l-pwd-x'));
                // autofill the fields
                if (username && username !== "" && password && password !== "") {
                    $('#login_username').val(username);
                    $('#password').val(password);
                    $('#password').focus();
                    $('#password').blur();
                }
                $("#rememberMe").attr("checked", true);
            } else {
                $("#rememberMe").attr("checked", false);
            }
            $("#password, #login_nickname, #login_username, #login_guesturl").keyup();
        });

        function enterRoom() {
            //check if vidyo plugin is installed or not.
            vidyoPluginIsInstalled();
            var username, password, nickname, roomdata, roomUri, savekey;
            roomdata = getRoomData();
            roomUri = roomdata.roomUrl.split("?")[0];
            if ($("#moderator").is(":visible")) {
                username = $('#login_username').val().trim();
                password = $('#password').val().trim();
                savekey = username;
                if (username === "") {
                    self.showProgressIndicator("info", window.lang.VidyoClient.USERNAME_EMPTY);
                    return;
                }

                if (password === "") {
                    self.showProgressIndicator("info", window.lang.VidyoClient.PASSWORD_EMPTY);
                    return;
                }
                if (!utils.isValidEmailAddress(username)) {
                    self.showProgressIndicator("info", window.lang.VidyoClient.EMAIL_ADRESS_FORMAT_ERR);
                    return;
                }

                if (username !== roomdata.domain) {
                    errorView.init({
                        errorMessage: window.lang.VidyoClient.NOT_ENTER_MODERATOR,
                        roomOwner: roomdata.domain,
                        createBackButton: {
                            text: window.lang.VidyoClient.GO_TO_LOGIN_PAGE,
                            buttonFunction: function() {
                                window.location.reload();
                            }
                        }
                    });
                }
                else {
                    if ($('#rememberMe').is(':checked')) {
                        utils.saveKeyVal(savekey + '_collab-l-usrnm-x', window.Base64.encode(username));
                        utils.saveKeyVal(savekey + '_collab-l-pwd-x', window.Base64.encode(password));
                        utils.saveKeyVal(savekey + '_collab-l-rmn-x_host', "yes");
                    }
                    else {
                        utils.removeKeyVal(savekey + '_collab-l-usrnm-x');
                        utils.removeKeyVal(savekey + '_collab-l-pwd-x');
                        utils.removeKeyVal(savekey + '_collab-l-rmn-x_host');
                    }
                    moderatorButtonsHandleVisibility(false);
                    self.showLoadingItem(window.lang.VidyoClient.LOADING);
                    vent.trigger("onModeratorJoinRoom", username, password, roomUri.substring(0, roomUri.lastIndexOf("/flex")));
                }
            } else if ($("#guest").is(":visible")) {
                nickname = $("#login_nickname").val().trim();
                nickname = $.grep(nickname.split(" "), function(n) {
                    return(n);
                });
                nickname = nickname.join(" ");
                if (nickname.length > 63) {
                    self.showProgressIndicator("info", window.lang.VidyoClient.GUEST_CHARACTER_LIMIT_ERROR);
                    return;
                }

                if (nickname === "") {
                    self.showProgressIndicator("info", window.lang.VidyoClient.GUEST_USER_CREDENTIALS_ERR);
                    return;
                }

                if (utils.validChars(nickname) === false) {
                    self.showProgressIndicator("info", window.lang.VidyoClient.INVALID_DISPLAYNAME);
                    return;
                }

                if ($('#rememberMe').is(':checked')) {
                    utils.saveKeyVal('collab-l-rmn-x_guest', "yes");
                    utils.saveKeyVal('collab-l-nck-x', window.Base64.encode(nickname));
                } else {
                    utils.removeKeyVal('collab-l-nck-x');
                    utils.removeKeyVal('collab-l-rmn-x_guest');
                }

                self.showLoadingItem(window.lang.VidyoClient.LOADING);
                moderatorButtonsHandleVisibility(true);
                myAccount.userName = nickname;
                vent.trigger("onGuestJoinRoom", roomdata.roomUrl, nickname, roomUri.substring(0, roomUri.lastIndexOf("/flex")));
                // TODO: this part will be change when guest login api is ready
                window.console.log("guest login");
            }
        }

        $("#password, #login_nickname, #login_username, #login_guesturl").bind("keyup", function(event) {
            var keycode = (event.keyCode ? event.keyCode : event.which);
            if (keycode === 13) {
                enterRoom();
            }
            if (keycode >= 14 && keycode <= 46 && keycode !== 32) {
                return;
            }

            $("#password").val($("#password").val().trim());
            if ($("#password").val().trim() !== "") {
                $("#clear_password").show();
            } else {
                $("#clear_password").hide();
            }
            if ($("#login_username").val().trim() !== "") {
                $("#clear_username").show();
            } else {
                $("#clear_username").hide();
            }
            if ($("#login_nickname").val().trim() !== "") {
                $("#clear_nickname").show();
            } else {
                $("#clear_nickname").hide();
            }
        });

        $("#password").change(function() {
            if ($("#password").val().trim() !== "") {
                $("#clear_password").show();
            } else {
                $("#clear_password").hide();
            }
        });

        $("#clear_nickname").off('vclick').on('vclick', function(e) {
            $("#login_nickname").val("");
            $("#clear_nickname").hide();
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $("#clear_username").off('vclick').on('vclick', function(e) {
            $("#login_username").val("");
            $("#clear_username").hide();
            $("#password").val("");
            $("#clear_password").hide();
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $("#clear_password").off('vclick').on('vclick', function(e) {
            $("#password").val("");
            $("#clear_password").hide();
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#enter_room').off('vclick').on('vclick', function(e) {
            enterRoom();
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#participants_menu').off('vclick').on('vclick', function() {
            hidePopupsFromLeft();
            if ($('#participants_menu').hasClass("cur_menu")) {
                hideSidebarTemplate($('#participants_menu'));
            }
            else {
                logger.info("Participants menu is clicked.");
                vent.trigger("onParticipantsAreaClicked");
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#share_menu').off('vclick').on('vclick', function(e) {
            hidePopupsFromLeft();
            if ($('#share_menu').hasClass("cur_menu")) {
                hideSidebarTemplate($('#share_menu'));
            }
            else {
                vent.trigger("onShareScreenClicked");
                //showSidebartmeplate and handleSidebarmenu change should be here since they
                //are not triggered inside showScreenShareList and getScreenShareList if automatic
                //tab show is inactive
                showSidebarTemplate();
                handleSidebarmenuChange($('#share_menu'));
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#layout_menu').off('vclick').on('vclick', function(e) {
            hidePopupsFromLeft();
            if ($('#layout_menu').hasClass("active")) {
                vent.trigger("onLayoutModeChange", 1);
                $('#layout_menu').removeClass("active");
                $("#layout_menu").attr('title', window.lang.VidyoClient.ACTIVATE_LAYOUT_GRID);
                logger.info('Layout is changed to preffered mode');
            } else {
                vent.trigger("onLayoutModeChange", 0);
                $('#layout_menu').addClass("active");
                $("#layout_menu").attr('title', window.lang.VidyoClient.ACTIVATE_LAYOUT_PREFERRED);
                logger.info('Layout is changed to grid mode');
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#selfview_menu').off('vclick').on('vclick', function(e) {
            hidePopupsFromLeft();
            if ($('#selfview_menu').hasClass('none')) {
                vent.trigger("onPreviewModeChange", false);
                $('#selfview_menu').removeClass("none");
                $("#selfview_menu").attr('title', window.lang.VidyoClient.ACTIVATE_SELF_VIEW);
                logger.info('Selview is deactivated');
            } else {
                vent.trigger("onPreviewModeChange", true);
                $('#selfview_menu').addClass("none");
                $("#selfview_menu").attr('title', window.lang.VidyoClient.DEACTIVATE_SELF_VIEW);
                logger.info('Selfview is activated');
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#settings_menu').off('vclick').on('vclick', function(e) {
            hidePopupsFromLeft();
            if ($('#settings_menu').hasClass("cur_menu")) {
                hideSidebarTemplate($('#settings_menu'));
            }
            else {
                vent.trigger("getAllDevice", true);
//                if (!isCurrentTabInViewParticipants() &&
//                !isCurrentTabInShare()) {
//                    var contentHeight = $('#pluginAndChatContainer').height();
//                    $('#sidebarContent').css({'min-height': contentHeight + "px"});
//                    $('#sidebarContent').css({'height': contentHeight + "px"});
//                }
                updateSidebarContentSize();
            }

        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#moderator_menu').off('vclick').on('vclick', function(e) {
            hidePopupsFromLeft();
            if ($('#moderator_menu').hasClass("cur_menu")) {
                hideSidebarTemplate($('#moderator_menu'));
            }
            else {
                logger.info("Moderator menu is clicked.");
                vent.trigger("onModeratorMenuClicked", true);
//                if (!isCurrentTabInViewParticipants() &&
//                !isCurrentTabInShare()) {
//                    var contentHeight = $('#pluginAndChatContainer').height();
//                    $('#sidebarContent').css({'min-height': contentHeight + "px"});
//                    $('#sidebarContent').css({'height': contentHeight + "px"});
//                }
                updateSidebarContentSize();

            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        //Session Navigation Tab Clieck Event End//

        $("#close_warning_section").off('vclick').on('vclick', function() {
            $("#browser_warning").hide();
        });

        //Local Media Controller Click Event Start//
        
        function localMediaButonClickBinder(button, muteEvent, unmuteEvent) {
            $(button).off('vclick').on('vclick', function (e) {
                if ($(button).hasClass("ui-disabled")) {
                    return;
                } else if ($(button).hasClass("muted")) {
                    vent.trigger(unmuteEvent);
                } else {
                    vent.trigger(muteEvent);
                }
            }).dblclick(function (event) {
                event.preventDefault();
            });
        }
        
        localMediaButonClickBinder("#camera_mute_btn", "onMuteVideoClicked",
                "onUnmuteVideoClicked");
        localMediaButonClickBinder("#microphone_mute_btn", "onMuteMicrophoneClicked",
                "onUnmuteMicrophoneClicked");
        localMediaButonClickBinder("#speaker_mute_btn", "onMuteSpeakersClicked",
                "onUnmuteSpeakersClicked");

        $('#fullscreen_btn').off('vclick').on('vclick', function(e) {
            vent.trigger("onFullScreenClicked");
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#timer_btn').off('vclick').on('vclick', function(e) {
            if ($('#timer_btn').hasClass('none')) {
                $('#timer_btn').removeClass("none");
            } else {
                $('#timer_btn').addClass("none");
            }
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $('#disconnected_btn').off('vclick').on('vclick', function(e) {
            if ($("#disconnected_btn").hasClass("disabled")) {
                return;
            }
            //if we need to show a popup to user in case exiting conference uncomment lines below.
//            killAllPopups();
//            if(myAccount.userName===""){ //username is null in case user is mod
//                showPopup(window.lang.VidyoClient.EXIT_COLLAB_LABEL_MOD,"",true,undefined,window.lang.VidyoClient.EXIT_COLLAB_LABEL_MOD,undefined);
//            } else {
//                showPopup(window.lang.VidyoClient.EXIT_COLLAB_LABEL_GUEST,"",true,undefined,window.lang.VidyoClient.EXIT_COLLAB_LABEL_GUEST,undefined);
//            }
            vent.trigger("onLeaveConferenceClicked");
        }).dblclick(function(event) {
            event.preventDefault();
        });

        $("#chat_toggle_btn").on("click", function() {
            $("#chat_container").toggle(); //slideToggle moves from up to down
            $("#vidyo_plugin_container").toggleClass("chat");
            $("#chat_container.cd-panel").toggleClass("is-visible");
            $("#create-new-tabs").tabs();
            $("#chat_warning_icon").hide();
            $("#vidyo-message-input").focus();
            //check chat panel visibility and change chat button icon accordingly
            toggleChatButton();
            if (myAccount.incomingMsgCount) {
                myAccount.incomingMsgCount = 0;
            }
            //jira ABE-2819
            chatScrollToBottom();
        });


        function sendMessage(automsg) {
            var activeTab = "#group-chat", msg = "", direction = 1, key = "", username = "";
            msg = $("#vidyo-message-input").val();
            $("#vidyo-message-input").val("");
            $("#vidyo-message-input").focus();
            if (msg.trim() === "") {
                return;
            }

            //myAccount.userName is not null if user is guest
            if (myAccount.data === "" || myAccount.data === undefined) {
                if (myAccount.userName === "") {
                    vent.trigger("handleGetMyAccount");
                }
            }
            //Once handleGetMyAccount triggers userName is not null 
            if (myAccount.userName === "" || myAccount.userName === undefined) {
                username = window.lang.VidyoClient.ME;
            } else {
                username = myAccount.userName;
            }

            vent.trigger("onSendGroupChatMessage", msg, function() {
                msg = utils.linkify(msg);
                chatHistoryUpdate(key, msg, "send");
                newMessageTemplate(msg, username, activeTab, direction);
                chatScrollToBottom();
            }, function() {
                //Failure CallBack
                msg = utils.linkify(msg);
                chatHistoryUpdate(key, msg, "send");
                newMessageTemplate(msg, username, activeTab, direction, true);
                chatScrollToBottom();
            });
        }

        /**
         * send msg
         */
        //chat input text character limit is set to 1024. also user must not paste characters bigger than
        //1024. test with http://www.unit-conversion.info/texttools/random-string-generator/
        //This triggers in IE
        $("#vidyo-message-input").bind("input propertychange", function(e) {
            var maxLength = $("#vidyo-message-input").attr('maxlength'), data, isIE, text;
            data = "";
            isIE = 0;
            try {
                data = e.originalEvent.clipboardData.getData('Text');
                isIE = 0;
            }
            catch (err) {
                if (data === "") {
                    if (isIE === 0) {
                        //once user starts to type in IE this function triggers.
                        //however this fn is just to detect paste in IE. Not needed to work
                        //if browser is Chrome
                        return;
                    }
                    data = window.clipboardData.getData("Text"); //IE9
                    isIE = 1;
                }
            }
            //Chrome goes to  $("#vidyo-message-input").bind('paste', ...  
            if (isIE === 0) {
                return;
            }

            text = $("#vidyo-message-input").val() + data;

            if (text.length > maxLength) {
                $("#vidyo-message-input").val(text.substring(0, maxLength));
            }
        });
        //This triggers in Chrome
        $("#vidyo-message-input").bind('paste', function(e) {
            var maxLength = $("#vidyo-message-input").attr('maxlength'), data, text;
            data = "";
            try {
                data = e.originalEvent.clipboardData.getData('Text');
            }
            catch (err) {
                //Browser is IE
                return;
            }

            text = $("#vidyo-message-input").val() + data;

            if (text.length > maxLength) {
                $("#vidyo-message-input").val(text.substring(0, maxLength));
            }
        });

        /**
         * enter button will send message
         */
        //this is necessary if we dont want cursor to add a new line once pressing enter key
        //JIRA ABE-2812
        $("#vidyo-message-input").keypress(function(e) {
            if (e.keyCode === 13) {
                e.preventDefault();
            }
        });
        $("#vidyo-message-input").keyup(function(e) {
            if (e.keyCode === 13) {
                sendMessage();

            }
        });
        //Local Media Controller Click Event End//


        //Monitor ESC key in IE
        $(document).keyup(function(e) {
            // esc key or f11 key 
            if (e.keyCode === 27) {
                if (isFullScreen) {
                    handleFullScreen();
                }
                //about popup close event trigger
                vent.trigger("onAboutPopup", false);
            }
        });
        //Full Screen Events Start//  
        $(document).on("mozfullscreenchange", function(event) {
            if (document.mozFullScreen === isFullScreen) {
                return;
            }
            if (!isFullScreen) {
                addFullScreen(fullScreenElement);
                isFullScreen = true;
            } else if (isFullScreen) {
//                removeFullScreen();
//                isFullScreen = false;
                handleFullScreen();
            }
        }).on("webkitfullscreenchange", function() {
            if (document.webkitIsFullScreen === isFullScreen) {
                return;
            }
            if (!isFullScreen) {
                addFullScreen(fullScreenElement);
                isFullScreen = true;
            } else if (isFullScreen) {
                handleFullScreen();
            }
        }).on("MSFullscreenChange", function() {
            //changed msFullscreenEnabled to document.msFullscreenElement for IE11
            if (document.msFullscreenElement !== undefined) {
                return;
            }
            if (!isFullScreen) {
                addFullScreen(fullScreenElement);
                isFullScreen = true;
            } else if (isFullScreen) {
                handleFullScreen();
            }
        });

        window.onbeforeunload = function() {
            if (!$("#vidyo_plugin_container").hasClass("off")) {
                return window.lang.VidyoClient.REFRESH_CONTROL;
            }
        };
    }

    return View.create({
        init: function() {
            var deferred = $.Deferred();
            self = this;
            View.appendContent('#home_page', 'application-template', {
                "shareOnly": getRoomData().isShareOnly
            }).done(function() {
                $.when(self.replaceContent('#detail', 'login_template', {
                    "shareOnly": getRoomData().isShareOnly
                }, 'create')).then(function() {
                    initializeListeners();
                    deferred.resolve();
                    vidyoPluginIsInstalled();
                    fillUserCredentials();
                });
            });
            return deferred;
        },
        getPluginContainerSelector: function() {
            return PLUGIN_CONTAINER_SELECTOR;
        },
        activeSessionTemplate: activeSessionTemplate,
        deActiveSessionTemplate: deActiveSessionTemplate,
        reloadParticipantsList: reloadParticipantsList,
        isCurrentTabInViewParticipants: isCurrentTabInViewParticipants,
        activateVidyoPluginContainer: activateVidyoPluginContainer,
        deactivateVidyoPluginContainer: deactivateVidyoPluginContainer,
        maximizePluginContainer: maximizePluginContainer,
        toggleMuteMicrophoneButton: function (isMuted) {
            toggleLocalMediaButton(isMuted, "#microphone_mute_btn",
                    window.lang.VidyoClient.MUTE_MICROPHONE, window.lang.VidyoClient.UNMUTE_MICROPHONE);
        },
        toggleMuteSpeakersButton: function (isMuted) {
            toggleLocalMediaButton(isMuted, "#speaker_mute_btn",
                    window.lang.VidyoClient.MUTE_SPEAKERS, window.lang.VidyoClient.UNMUTE_SPEAKERS);
        },
        toggleMuteVideoButton: function (isMuted) {
            toggleLocalMediaButton(isMuted, "#camera_mute_btn",
                    window.lang.VidyoClient.MUTE_VIDEO, window.lang.VidyoClient.UNMUTE_VIDEO);
        },
        disableEnableMuteMicrophoneButton: function (isDisabled) {
            disableEnableLocalMediaButton(isDisabled, "#microphone_mute_btn",
                    window.lang.VidyoClient.MUTE_MICROPHONE, window.lang.VidyoClient.UNMUTE_MICROPHONE,
                    window.lang.VidyoClient.MICROPHONE_BTN);
        },
        disableEnableMuteSpeakersButton: function (isDisabled) {
            disableEnableLocalMediaButton(isDisabled, "#speaker_mute_btn",
                    window.lang.VidyoClient.MUTE_SPEAKERS, window.lang.VidyoClient.UNMUTE_SPEAKERS,
                    window.lang.VidyoClient.SPEAKER_BTN);
        },
        disableEnableMuteVideoButton: function (isDisabled) {
            disableEnableLocalMediaButton(isDisabled, "#camera_mute_btn",
                    window.lang.VidyoClient.MUTE_VIDEO, window.lang.VidyoClient.UNMUTE_VIDEO,
                    window.lang.VidyoClient.VIDEO_BTN);
        },
        showDeviceConfigurationList: showDeviceConfigurationList,
        showProgressIndicator: showProgressIndicator,
        showScreenShareList: showScreenShareList,
        showPopup: showPopup,
        toggleScreenShareIcon: toggleScreenShareIcon,
        isActivelyWatchingSomeonesShare: isActivelyWatchingSomeonesShare,
        setUserAccount: setUserAccount,
        onReceiveMessage: onReceiveMessage,
        handleFullScreen: handleFullScreen,
        lockRoomUpdate: lockRoomUpdate,
        showLoadingItem: showLoadingItem,
        hideLoadingItem: hideLoadingItem,
        cleanUpWindow: cleanUpWindow,
        setSelfViewMode: setSelfViewMode,
        retryLogin: retryLogin,
        toggleChatButton: toggleChatButton,
        reloadModeratorControlsTab: reloadModeratorControlsTab,
        isCurrentTabInViewModeratorControls: isCurrentTabInViewModeratorControls,
        isCurrentTabInViewSettings: isCurrentTabInViewSettings,
        isRoomShareOnly: isRoomShareOnly,
        //TODO: remove it, for test purposes only. there is another fn in vidyoController.js
        fillParticipantListWithFakeUsersForTest: fillParticipantListWithFakeUsersForTest,
        getRoomData: getRoomData,
        moderatorButtonsHandleVisibility: moderatorButtonsHandleVisibility,
        moderatorTabClick: moderatorTabClick,
        setProxyConfig: setProxyConfig,
        getProxyConfig: getProxyConfig,
        getWebProxyConfig: getWebProxyConfig,
        setWebProxyConfig: setWebProxyConfig,
        isLoginScreenOnView: isLoginScreenOnView,
        setEchoCancellationConfig: setEchoCancellationConfig,
        setAudioAGCConfig: setAudioAGCConfig,
        playPopupSound: playPopupSound,
        writeParticipantsCounter: writeParticipantsCounter
    });
});
