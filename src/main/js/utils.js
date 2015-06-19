/*global define, $, window */


define('utils', ['view'], function(View) {

    /** <Attention>
     * STACKOVERFLOW accepted answer as REGEX for email validation,
     * Can be optimized to smaller one
     * @param {type} emailAddress
     * @returns {@exp;pattern@call;test} // true or false
     */
    function isValidEmailAddress(emailAddress) {
        var pattern = new RegExp(/^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))/i);
        return pattern.test(emailAddress);
    }

    function myTrim(str) {
        if (str) {
            return str.replace(/\s/g, '');
        }
        return;
    }
    
    function loadSound(name,volume,path){
        //using http://ionden.com/a/plugins/ion.sound/en.html    
        window.ion.sound({
            sounds: [
                {
                    name: name
                }
            ],
            volume: volume,
            path: path,
            preload: true
        }); 
    }  
    
    function playSound(name){
        window.ion.sound.play(name);
    }

    /**
     * Returns browser name
     * @returns {String|@exp;M@call;join}
     */
    function getBrowser() {
        var ua = navigator.userAgent, tem, M = ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || [];
        if (/trident/i.test(M[1])) {
            tem = /\brv[ :]+(\d+)/g.exec(ua) || [];
            return 'IE ' + (tem[1] || '');
        }
        if (M[1] === 'Chrome') {
            tem = ua.match(/\bOPR\/(\d+)/);
            if (tem !== null) {
                return 'Opera ' + tem[1];
            }
        }
        M = M[2] ? [M[1], M[2]] : [navigator.appName, navigator.appVersion, '-?'];
        if ((tem = ua.match(/version\/(\d+)/i)) !== null) {
            M.splice(1, 1, tem[1]);
        }
        return M.join(' ');
    }


    //save value of a key to storage
    function saveKeyVal(key, val) {
        window.localStorage.setItem(key, val);
    }

    //get val of a key from storage
    function getKeyVal(key) {
        var value = "";
        value = window.localStorage.getItem(key);
        if (value === undefined) {
            return "";
        }
        return value;
    }

    //remove an element from storage
    function removeKeyVal(key) {
        window.localStorage.removeItem(key);
    }

    function urlify(text) {
        // Regex matching url
        var replacedText,
                urlRegexHTTP = /(\b(https?|ftp|file):\/\/[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig,
                urlRegexWWW = /(\b(www?)\.[\-A-Z0-9+&@#\/%?=~_|!:,.;]*[\-A-Z0-9+&@#\/%=~_|])/ig;
        text = text.replace('<', '&lt');
        text = text.replace('>', '&gt');
        replacedText = text.replace(urlRegexHTTP, "<a href='$1' target='_blank'>$1</a>");
        if (text === replacedText) {
            replacedText = text.replace(urlRegexWWW, "<a href='http://$1' target='_blank'>$1</a>");
        }
        return replacedText;
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

    function validChars(arg) {
        var reg = /^[a-z0-9@._-\s\d]+$/i;
        try {
            if (reg.test(arg)) {
                return true;
            }
        } catch (e) {
            window.console.log("Display name validation is failed due to error: " + e);
        }
        return false;
    }

    function getKeyFromUrl() {
        var savekey = "";
        if (window.location.href.toString().indexOf("/") > 0) {
            savekey = window.location.href.toString().split("/");
            savekey = savekey[savekey.length - 1];
            if (savekey.indexOf("debug.html") > 0) {
                savekey = savekey.split(".debug.html")[0];
            }
        }
        return savekey;
    }

    /**
     * Handle incoming messages
     * @param {type} IM
     * @returns {unresolved}
     */

    //URL detection conforms to RFC1738 https://www.ietf.org/rfc/rfc1738.txt 
    //http://stackoverflow.com/questions/1500260/detect-urls-in-text-with-javascript
    //Email detection conforms to RFC5322 http://tools.ietf.org/html/rfc5322#section-3.4
    function linkify(text) {

        var arrText, word, httpRegex, emailRegex, temp1, temp2, removeHttpTrailingCharsRegex
                , index, replaceWithWhat, newLineRegex, addHeaderTag;
        //replace any kind of newLines by space
        newLineRegex = /\r\n|\r|\n/g;
        text = text.replace(newLineRegex, " ").replace(/<br\>/g, " ").replace(/<br \/\>/g, " ");
        arrText = text.split(" ");
        httpRegex = /((?:(http|https|Http|Https|rtsp|Rtsp):\/\/(?:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,64}(?:\:(?:[a-zA-Z0-9\$\-\_\.\+\!\*\'\(\)\,\;\?\&\=]|(?:\%[a-fA-F0-9]{2})){1,25})?\@)?)?((?:(?:[a-zA-Z0-9][a-zA-Z0-9\-]{0,64}\.)+(?:(?:aero|arpa|asia|a[cdefgilmnoqrstuwxz])|(?:biz|b[abdefghijmnorstvwyz])|(?:cat|com|coop|c[acdfghiklmnoruvxyz])|d[ejkmoz]|(?:edu|e[cegrstu])|f[ijkmor]|(?:gov|g[abdefghilmnpqrstuwy])|h[kmnrtu]|(?:info|int|i[delmnoqrst])|(?:jobs|j[emop])|k[eghimnrwyz]|l[abcikrstuvy]|(?:mil|mobi|museum|m[acdghklmnopqrstuvwxyz])|(?:name|net|n[acefgilopruz])|(?:org|om)|(?:pro|p[aefghklmnrstwy])|qa|r[eouw]|s[abcdeghijklmnortuvyz]|(?:tel|travel|t[cdfghjklmnoprtvwz])|u[agkmsyz]|v[aceginu]|w[fs]|y[etu]|z[amw]))|(?:(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9])\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[1-9]|0)\.(?:25[0-5]|2[0-4][0-9]|[0-1][0-9]{2}|[1-9][0-9]|[0-9])))(?:\:\d{1,5})?)(\/(?:(?:[a-zA-Z0-9\;\/\?\:\@\&\=\#\~\-\.\+\!\*\'\(\)\,\_])|(?:\%[a-fA-F0-9]{2}))*)?(?:\b|$)/gi;
        //http://stackoverflow.com/questions/46155/validate-email-address-in-javascript
        emailRegex = /^(?:[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+\.)*[\w\!\#\$\%\&\'\*\+\-\/\=\?\^\`\{\|\}\~]+@(?:(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!\.)){0,61}[a-zA-Z0-9]?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9\-](?!$)){0,61}[a-zA-Z0-9]?)|(?:\[(?:(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\.){3}(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\]))$/gi;
        //emailRegex = /([a-zA-Z0-9._\-]+@[a-zA-Z0-9._\-]+\.[a-zA-Z0-9._\-]+)/gi;
        removeHttpTrailingCharsRegex = /\)$/gi;
        //remove g from the regex http://stackoverflow.com/questions/2630418/javascript-regex-returning-true-then-false-then-true-etc
        addHeaderTag = /\b(http|https|Http|Https|rtsp|Rtsp)/i;
        function replaceHttpFn(url) {
            if (addHeaderTag.test(url)) {
                return '<a href="' + url + '" target="_blank">' + url + '</a>';
            } else {
                return '<a href="http://' + url + '" target="_blank">' + url + '</a>';
            }
        }
        function replaceEmailFn(url) {
            return '<a href="mailto:' + url + '" target="_blank">' + url + '</a>';
        }
        replaceWithWhat = -1; //0=url 1=email
        for (index in arrText) {
            word = arrText[index];
            temp1 = word.match(httpRegex);
            temp2 = word.match(emailRegex);
            if (temp1 && temp2 === null) {
                temp1[0] = temp1[0].replace(removeHttpTrailingCharsRegex, "");
                replaceWithWhat = 0;
            } else if (temp2 && temp1 === null) {
                replaceWithWhat = 1;
            } else if (temp1 && temp2) {
                temp1[0] = temp1[0].replace(removeHttpTrailingCharsRegex, "");
                if (temp1[0].length > temp2[0].length) {
                    replaceWithWhat = 0;
                } else if (temp2[0].length > temp1[0].length) {
                    replaceWithWhat = 1;
                }
            }
            if (replaceWithWhat === 0) {
                word = word.replace(temp1, replaceHttpFn);
            } else if (replaceWithWhat === 1) {
                word = word.replace(temp2, replaceEmailFn);
            }
            arrText[index] = word;
            replaceWithWhat = -1;
        } 
        return text===arrText.join(" ") ? arrText.join(" ").replace(/&/g, "&amp;").replace(/>/g, "&gt;").replace(/</g, "&lt;").replace(/"/g, "&quot;") :  arrText.join(" ");
    }
    
    
    function vidyoPluginIsInstalled(mimeType, pluginVers, actType) {
        var isFound = false, control, browserName = getBrowser().toLowerCase(), values;
        window.navigator.plugins.refresh(false);

        /* Try NPAPI approach */
        /*jslint unparam: true*/
        $.each(window.navigator.mimeTypes, function(i, val) {
            if (val.type === mimeType + pluginVers) {
                /* Reload page when plugin is detected */
                isFound = true;
                return true;
            }
        });
        /*jslint unparam: false*/

        if (window.ActiveXObject || window.ActiveXObject !== undefined) {
            /* Try IE approach */
            try {
                control = new window.ActiveXObject(actType + pluginVers);
                if (control) {
                    isFound = true;
                }
            } catch (ignore) {

            }
        }


        /*Try Mac plugins for safari*/
        if (browserName.indexOf("safari") >= 0) {
            values = pluginVers.split(".");
            values = "npVidyoWeb-" + (values[values.length - 1]) + ".plugin";
            $.each(window.navigator.plugins, function(i, val) {
                if (val.name === "VidyoWeb" && val.filename === values) {
                    isFound = true;
                }
            });
        }

        if (isFound) {
            return true;
        } else {
            return false;
        }
    }

    return View.create({
        isValidEmailAddress: isValidEmailAddress,
        myTrim: myTrim,
        getBrowser: getBrowser,
//        getCookie: getCookie,
//        setCookie: setCookie,
        urlify: urlify,
        isEmpty: isEmpty,
        saveKeyVal: saveKeyVal,
        getKeyVal: getKeyVal,
        removeKeyVal: removeKeyVal,
        validChars: validChars,
        getKeyFromUrl: getKeyFromUrl,
        linkify: linkify,
        vidyoPluginIsInstalled:vidyoPluginIsInstalled,
        loadSound:loadSound,
        playSound:playSound
    });

});






