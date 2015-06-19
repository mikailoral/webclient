/*global define, $, window */
/*jslint regexp: false,sloppy: true */


define('urlDecode', ['view', 'utils'], function(View, utils) {
    function getQueryString() {
        var match, urlParams,
                pl = /\+/g,
                search = /([^&=]+)=?([^&]*)/g,
                decode = function(s) {
            return decodeURIComponent(s.replace(pl, " "));
        },
                query = window.location.search.substring(1);

        urlParams = {};
        while ((match = search.exec(query)) !== null) {
            urlParams[decode(match[1])] = decode(match[2]);
        }
        return urlParams;
    }


    function getRoomOwnerUrl() {
        var roomOwner, debugMod = false;
        roomOwner = window.location.href.split("/").slice(-1)[0];
        window.console.log("Old Room URL : " + roomOwner);
        //Get roomOwner in url and A2 Ajax call for roomInfo.
        if (roomOwner.indexOf(".debug.html") !== -1) {
            roomOwner = roomOwner.split(".debug.html")[0];
            debugMod = true;
        }
        if (roomOwner.indexOf("?")) {
            roomOwner = roomOwner.split("?")[0];
        }
        return {
            roomOwner: roomOwner,
            debugMod: debugMod
        };
    }

    function removeQueryStringParameterInUrl(roomOwnerUrl) {
        var replaceUrl;
        if (roomOwnerUrl.debugMod) {
            replaceUrl = roomOwnerUrl.roomOwner + '.debug.html';
        }
        else {
            replaceUrl = roomOwnerUrl.roomOwner;
        }
        window.console.log("New URL : " + replaceUrl);
        window.location.replace(replaceUrl);
    }

    function isQueryStringValid(data) {
        if (data && utils.isValidEmailAddress(data.username) && data.token) {
            return true;
        }
        else {
            return false;
        }
    }

    function setQueryStringStorageData(username, token) {
        window.localStorage.setItem("username", username);
        window.localStorage.setItem("token", token);
    }

    function getQueryStringStorageData() {
        return {
            username: window.localStorage.getItem("username"),
            token: window.localStorage.getItem("token")
        };
    }

    function removeQueryStringStorageData() {
        window.localStorage.removeItem("userName");
        window.localStorage.removeItem("token");
    }


    function handleCollabLink() {
        var deferred = $.Deferred(), queryString = getQueryString(), cacheData, roomOwnerUrl = getRoomOwnerUrl(), roomOwner = roomOwnerUrl.roomOwner;
        if (isQueryStringValid(queryString)) {
            setQueryStringStorageData(queryString.username, queryString.token);
            removeQueryStringParameterInUrl(roomOwnerUrl);
        }
        else {
            if (!utils.isEmpty(queryString)) {
                removeQueryStringParameterInUrl(roomOwnerUrl);
            }
            else {
                cacheData = getQueryStringStorageData();
                removeQueryStringStorageData();
                window.console.log("Username : " + cacheData.username + " Token : " + cacheData.token + " Domain : " + roomOwner);
                deferred.resolve(cacheData.username, cacheData.token, roomOwner);
            }
        }
        return deferred;
    }

    return View.create({
        handleCollabLink: handleCollabLink
    });

});



