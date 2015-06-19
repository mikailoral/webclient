
/*global define, $, window */

/*
 * For managing dialog view
 */

define('mobileView', ['view'], function(View) {
    var self, guest_link , play_store;
    
//    guest_link = 'vidyomobile://so-portal-ha.netas.com.tr?key=45qxnBTZI0PyVDKdxPnWknKcPSE';
//    play_store = 'https://play.google.com/store/apps/details?id=com.vidyo.VidyoClient';


    function initializeListeners() {
        
        function download() {
            window.location = play_store;
        }
        
        function defaultBrowser() {
            var clickedAt = +new Date();
            window.location = guest_link;
            setTimeout(function () {
                

                if (+new Date() - clickedAt < 2000) {
                    window.location = play_store;
                }

            }, 500);

        }

        function chromeAndFirefoxBrowsers() {
            var w;
            try {
                w = window.open( guest_link, '_blank');
            } catch(e) {}
            setTimeout(function(){
                if (w) {
                    w.location = play_store;
                } else {
                    window.location = play_store;
                }
            }, 500);
        }

        function operaBrowser() {
            window.location = guest_link;
            var clickedAt = +new Date();
            // During tests on 3g/3gs this timeout fires immediately if less than 500ms.
            setTimeout(function() {
                // To avoid failing on return to browser, ensure freshness!
                if (+new Date() - clickedAt < 2000){
                    window.location = play_store;
                }
            }, 500);
        }

        function join() {
            if (navigator.userAgent.match(/Chrome/i)) {
                chromeAndFirefoxBrowsers();
            } else if (navigator.userAgent.match(/opera/i)) {
                operaBrowser();
            } else if (navigator.userAgent.match(/firefox/i)) {
                chromeAndFirefoxBrowsers();
            } else{
                defaultBrowser();
            }
        }
        
        $('#download-btn').off('vclick').on('vclick', function(e) {
            download();
        });
        
        $('#join-btn').off('vclick').on('vclick', function(e) {
            join();
        });
            
    }
    
    function modifyUrl( deviceParameters ){            
        play_store = deviceParameters.downloadUrl;
        guest_link = 'vidyomobile://' + deviceParameters.vidyoServer + '?' + deviceParameters.key;            
    }

    return View.create({
        init: function(deviceParameters ) {
            var deferred = $.Deferred();
            self = this;            
            modifyUrl(deviceParameters);
            View.replaceContent('#home_page',  'mobile_template',{
                isAndroid   : deviceParameters.isAndroid ,
                isIos       : deviceParameters.isIos ,
                isTablet    : deviceParameters.isTablet}).done(function() {                
                deferred.resolve();                
                initializeListeners();
            });
            return deferred;
        }
    });
});


