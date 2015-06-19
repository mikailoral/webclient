/*global define, $, window */
define( 'router', ['logController','vidyoController' ],
    function( logController,vidyoController) {

        var Router, getUrlHashParameters, logger = logController.getLogger('Router');

        Router = function() {
            var self = this;
            this.originalMargin = 0;
            this.currentPage    = null;

            window.onhashchange = function( hash ) {
                return self.onHashChange( hash );
            };

            $( document ).bind( 'pagebeforechange', function( e, data ) {
                return self.pageBeforeChange( e, data );
            });
        };


        Router.prototype.routes = [
            {'matcher': new RegExp( /^#vidyo/  ),pageClass: vidyoController}
        ];

        Router.currentPage = null;


        // Populates the user interface with new content, based on a routing match for
        // the "hash" parameter
        Router.prototype.changeTo = function( hash, parameters ) {
            var self = this,
            pageClass = this.getRouteForHash( hash ),
            page;
          
            //window.console.log( 'routing::changeTo', hash, parameters );

            // Search for a route that matches the current hash      
            if ( null === pageClass ) {
                //window.console.log( 'routing::changeTo', 'no page class found for hash - ignoring', hash );
                return;
            }

            // If a page is already on display, destroy it
            if ( this.currentPage !== null && typeof( this.currentPage.destroy ) === 'function' ) {
                //window.console.log( 'routing::changeTo', 'destroying current page', this.currentPage );
                this.currentPage.destroy();
            }

            //this.showPageLoading();

            //window.console.log( 'routing::changeTo', 'initializing new page', pageClass );

            // The URL's hash matches this route - render content using the route's Page class
            page = this.currentPage = pageClass.create();
            // check calllogModel load done to retrieve data
            if(hash.indexOf("history_details")>-1){
                page.init( parameters ).done(function() {
                    page.load();
                });
            }
            else{
                page.init( parameters );
                page.load();
            }        
        };


        Router.prototype.getRouteForHash = function( hash ) {
            // Search for a route that matches the current hash
            var pageClass = null,
            i = 0,
            routesLength = this.routes.length,
            route;
            for ( ; i < routesLength; i++ ) {
                route = this.routes[ i ];
                if ( hash.search( route.matcher ) >= 0 ) {
                    pageClass = route.pageClass;
                    break;
                }
            }

            return pageClass;
        };


        // Loads content for the new page hash
        Router.prototype.onHashChange = function( hash ) {
            hash = window.location.hash;
            if ( '' === hash ) {
                hash = '#home';
            }

            //window.console.log( 'routing::onHashChange', 'Navigating to hash',  hash );
            this.changeTo( hash, getUrlHashParameters( hash ) );

            return false;
        };


        // Intercepts jQuery Mobile navigation requests.
        // If there is a route defined for the navigation event's URL hash, the
        // navigation is cancelled and the fcs web framework loads content instead.
        Router.prototype.pageBeforeChange = function( e, data ) {
            //window.console.log( 'routing::pagebeforechange', e, data );

            if ( typeof data.toPage !== 'string' ) {
                //                window.console.log(
                //                    'routing::pagebeforechange',
                //                    'skipping routing of non-string toPage',
                //                    typeof( data.toPage ), data.toPage
                //                    );
                return true;
            }

            var url = $.mobile.path.parseUrl( data.toPage ),
            pageClass = this.getRouteForHash( url.hash );

            if ( pageClass ) {
                //window.console.log( 'routing::pagebeforechange', 'page class found for hash', url.hash, pageClass );

                // Point the browser's URL bar to the new location - this will kick off "onHashChange" logic
                window.location.hash = url.hash;

                // Prevent the browser from navigating
                // (new content will be inserted into the DOM during page.load())
                e.preventDefault();
                return false;

            } else {

                //window.console.log( 'routing::pagebeforechange', 'no page class found for hash', url.hash );
                return true;
            }
        };

        // Loads content for the current page hash
        Router.prototype.update = function() {
            var hash = window.location.hash;

            this.changeTo( hash, getUrlHashParameters( hash ) );
        };


        Router.prototype.hidePageLoading = function() {
            $.mobile.loading( 'hide' );

            // Slide the new details in from left-to-right
            $( '#detail' )
            // Move the div offscreen to the left - it will slide in from here
            .css    ( {
                marginLeft: -100
            } )
            // Slide the div on screen
            .animate( {
                opacity: 1, 
                marginLeft: this.originalMargin
            }, 300 );
        };


        Router.prototype.showPageLoading = function() {
            $.mobile.loading( 'show' );

            // Slide old details to the right (offscreen)
            var $detail = $( '#detail' );

            // TODO: find a better way to get the original margin
            // The problem with doing it here is that the margin-left value is altered during
            // transitions.  If the user clicks two contact items in quick succession, the second
            // click will use the current transition's margin-left value (positioning the contact's
            // details slighty off to the left)
            this.originalMargin = $detail.css( 'margin-left' );

            $detail.animate( {
                opacity: 0.25, 
                marginLeft: '+=1000'
            }, 300 );
        };


        getUrlHashParameters = function( hash ) {

            // Hash begins with the #page, then ?, then name=value parameters separated by &
            // e.g. #contact_details?contact_id=1&show_all=true

            // Slice off the page and ?, then split into key/value strings
            var pairStrings = hash.slice( hash.indexOf( '?' ) + 1 ).split( '&' ),
            pairs = {},
            i = 0,
            pairString, pair={},equalSignValidator;

            for ( ; i < pairStrings.length; i++ ) {
                pairString = pairStrings[ i ];
                /*jslint regexp: false*/ equalSignValidator = pairString.replace(/[^=)]/g, "").length;
                if(equalSignValidator > 1){
                    pair[0] = pairString.slice(0,pairString.indexOf("="));
                    pair[1] = pairString.slice(pairString.indexOf("=")+1);
                }else{
                    pair = pairString.split( '=' ); // Split into name/value array
                }
                pairs[ pair[ 0 ] ] = pair[ 1 ];
            }

            return pairs;
        };

        return new Router();
    }
    );
