/*global define, window, $ */

define('configController', ['Controller'], function(Controller) {
    var config = {}, roomData = {}, errorTemplate;

    function languageParse(al) {
        var regex = /((([a-zA-Z]+(-[a-zA-Z]+)?)|\*)(;q=[0-1](\.[0-9]+)?)?)*/g, strings, bits, ietf;
        strings = (al || "").match(regex);
        return strings.map(function(m) {
            if (!m) {
                return;
            }
            bits = m.split(';');
            ietf = bits[0].split('-');
            return {
                code: ietf[0],
                region: ietf[1],
                quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
            };
        }).filter(function(r) {
            return r;
        }).sort(function(a, b) {
            return b.quality - a.quality;
        });
    }

    function isEmpty(obj) {
        var prop;
        for (prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                return false;
            }
        }
        return true;
    }

    return Controller.create({
        init: function() {
            return $.ajax({
                url: 'custom/config.json',
                type: 'GET',
                dataType: 'json',
                success: function(jsonObj) {
                    config = jsonObj;
                    $.ajax({
                        url: 'templates/error-template.html',
                        type: 'GET',
                        dataType: "html",
                        cache: false,
                        success: function(data) {
                            errorTemplate = data;
                        }
                    });
                }
            });
        },
        getConf: function(parameter, defaultValue) {
            return (config[parameter] === undefined) ? defaultValue : config[parameter];
        },
        getRoomData: function() {
            return roomData;
        },
        getRoom: function(roomOwner) {
            return $.ajax({
                url: window.location.protocol + '//' + config.serverIP + '/pa/collaboration/webCollabServlet',
                type: 'GET',
                dataType: "json",
                data: {"host": roomOwner},
                cache: true,
                success: function(data) {
                    if (data) {
                        var url;
                        data.roomOwner = roomOwner;
                        url=data.collaborationResponse.roomUrl.split('//')[0];
                        data.collaborationResponse.roomUrl=data.collaborationResponse.roomUrl.replace(url,window.location.protocol);
                        roomData = data;
                        return true;
                    }
                    else {
                        return false;
                    }
                },
                error: function(data) {
                    roomData = data;
                    //400 Bad Request 
                }
            });

        },
        getLanguageData: function() {
            var lang;
            if (roomData && roomData.collaborationResponse && roomData.collaborationResponse.accept_language) {
                lang = languageParse(roomData.collaborationResponse.accept_language);
                if (isEmpty(lang)) {
                    return;
                }
                else {
                    return lang[0].code;
                }
            }
        },
        getErrorTemplate: function() {
            return errorTemplate;
        }

    });
});