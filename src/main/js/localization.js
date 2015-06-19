/*global define,$, window, mustache */

define('localization', ['configController', 'lib/jquery.mobile-1.4.5'], function(configController) {
    var lang;
    function setCookieLang(lang) {
        var cookie = "lang=" + encodeURIComponent(lang),
                today = new Date(),
                expiry = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
        // Add cookie attributes to that string
        cookie += "; max-age=" + expiry;
        cookie += "; path=/";

        // Set the cookie through the document.cookie property
        document.cookie = cookie;
    }

    function getCookieLang() {
        var name = "lang=",
                cookies = document.cookie.split(';'),
                i = 0,
                cookie = "";
        for (; i < cookies.length; i += 1) {
            cookie = cookies[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1, cookie.length);
            }
            if (cookie.indexOf(name) === 0) {
                return cookie.substring(name.length, cookie.length);
            }
        }
        return null;
    }
    
    function getUseLang() {
        return lang;
    }
    
    return {
        // prefferedLang argument is optional
        setLanguage: function(preferredLang) {
            // if the language is specified, set the cookie
            if (preferredLang !== null && preferredLang !== undefined) {
                setCookieLang(preferredLang);
            }
            // 'userLanguage' for IE and 'language' for other browsers
            var deferred = $.Deferred(), localeDeferred = $.Deferred(), supportedLanguages, supLang;

            // Getting user prefered language  from server side via HTTP header
            if (configController.getLanguageData()) {
                lang = configController.getLanguageData();
                localeDeferred.resolve(lang);
            }
            else {
                // An error occured. Trying to get the locale via javascript 
                lang = getCookieLang() || window.navigator.language || window.navigator.userLanguage || 'en';
                localeDeferred.resolve(lang);
            }
            $.when(localeDeferred).then(function(lang) {
                //TODO: move to server config
                supportedLanguages = configController.getConf("supportedLanguages", {
                    "en": "en",
                    "en-us": "en",
                    "en-ca": "en",
                    "en-gb": "en",
                    "fr": "fr",
                    "fr-fr": "fr",
                    "fr-ca": "fr",
                    "french": "fr"
                });

                supLang = supportedLanguages[lang.toLowerCase()];

                lang = supLang ? supLang : configController.getConf("defaultLanguage", "en");

                //load language file
                $.ajax({
                    url: 'lang/' + lang + '.json',
                    dataType: "json",
                    success: function(data) {
                        var customLangPath = null;
                        window.lang = data;

                        //Load customized languages file if exists
                        customLangPath = configController.getConf("languagesPath", null);
                        if (customLangPath) {
                            $.getJSON(customLangPath + '/' + lang + '.json', function(data) {
                                //ovewrite window.lang with the customization
                                var part, subpart;
                                for (part in data) {
                                    if (data.hasOwnProperty(part)) {

                                        for (subpart in data[part]) {
                                            if (data[part].hasOwnProperty(subpart)) {
                                                window.lang[part][subpart] = data[part][subpart];
                                            }
                                        }
                                    }
                                }
                                deferred.resolve();
                            });
                        } else {
                            deferred.resolve();
                        }
                    },
                    error: function(x, e) {
                        window.console.log("Could not load language files:" + e);
                    }
                });
            });
            return deferred;
        },
        getCookieLang: getCookieLang,
        setCookieLang: setCookieLang,
        getUseLang:getUseLang
    };
});
