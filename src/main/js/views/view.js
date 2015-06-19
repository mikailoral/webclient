/*global define, $, window */

define('view', ['mustache','configController', 'lib/jquery.mobile-1.4.5'], function(Mustache, configController) {
    
    function handleTinyScrollIE9(element) {
        function handleMouseUp() {
            $("body").find(":not(input)").attr("unselectable", "off");
            $(document).off("mouseup", handleMouseUp);
        }

        if ($.browser.msie && $.browser.version('msie') <= 9) {
            element.on("mousedown", ".thumb", function() {
                $("body").find(":not(input)").attr("unselectable", "on");
                $(document).on("mouseup", handleMouseUp);

            });

            element.on("mouseup", ".thumb", handleMouseUp);
        }

    }
    
    return {
        // Create new view with View object as prototype
        create: function(o) {
            var object = Object.create(this);
            object.parent = this;

            $.extend(object, o);

            return object;
        },

        to_html: function(template, data, partials) {
            return Mustache.to_html( template, {
                data: data,
                lang: window.lang
            }, partials );
        },

        appendContent: function( selector, template, context, jQueryMobileTrigger ) {
            var self     = this,
            deferred = $.Deferred(),
            $element = $( selector );

            $.when( self.loadTemplate( template ) )
            .done( function( templateHTML ) {

                 $element.append( self.to_html( templateHTML, context ) );
                self.doJQueryTrigger( $element, jQueryMobileTrigger );

                deferred.resolve( $element );
                handleTinyScrollIE9($element);
                // place holder fix for IE9
                if ($element.find('[placeholder]').length > 0) {
                    if ($element.find('[placeholder]').not('.placeholderPluginTriggered').length > 0) {
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').placeholder();
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').addClass("placeholderPluginTriggered");
                    }
                }
                return $element;
            });

            return deferred;
        },


        doJQueryTrigger: function( $element, jQueryMobileTrigger ) {
            if ( typeof( jQueryMobileTrigger ) !== 'undefined' ) {
                $element.trigger( jQueryMobileTrigger );
            }
        },


        loadTemplate: function( templateId ) {
            var deferred   = $.Deferred();

            // Load and extract the template
            $.ajax({
                url: configController.getConf("templatesPath","templates") + '/' + templateId + '.html' ,
                success: function( template ) {
                    deferred.resolve( $( template ).filter( '#' + templateId ).html() );
                },
                error : function(){
                    deferred.reject();
                }, 
                dataType: "html",
                cache: false
            });

            return deferred;
        },


        replaceContent: function( selector, template, context, jQueryMobileTrigger ) {
            var self     = this,
                    deferred = $.Deferred(),
            $element = $( selector );

            $.when( self.loadTemplate( template ) )
            .done( function replace( templateHTML ) {
                $element.html( self.to_html( templateHTML, context ) );
                self.doJQueryTrigger( $element, jQueryMobileTrigger );

                deferred.resolve( $element );
                handleTinyScrollIE9($element);
                // place holder fix for IE9
                if ($element.find('[placeholder]').length > 0) {
                    if ($element.find('[placeholder]').not('.placeholderPluginTriggered').length > 0) {
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').placeholder();
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').addClass("placeholderPluginTriggered");
                    }
                }
                return $element;
            }).fail(function(){
                $element.html( self.to_html( $( template ).filter( '#error-template').html(), context ) );
                self.doJQueryTrigger( $element, jQueryMobileTrigger );

                deferred.resolve( $element );
                handleTinyScrollIE9($element);
                // place holder fix for IE9
                if ($element.find('[placeholder]').length > 0) {
                    if ($element.find('[placeholder]').not('.placeholderPluginTriggered').length > 0) {
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').placeholder();
                        $element.find('[placeholder]').not('.placeholderPluginTriggered').addClass("placeholderPluginTriggered");
                    }
                }
                return $element; 
            });

           return deferred;
        },

        Events: $({}),

        bind: function(event, callback) {
            this.Events.bind(event, callback);
        },

        trigger: function(event) {
            this.Events.trigger(event);
        }
    };
});
