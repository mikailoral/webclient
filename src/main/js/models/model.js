/*global define, $, window */

define( 'Model', [], function() {
    return {
        loadDeferred: null,

        // Create new model with Model object as prototype
        create: function( o ) {
            var object = Object.create( this );
            object.__parent = this;
            object.records  = [];

            $.extend( object, o );

            return object;
        },

        // Add new record
        add: function( obj ) {
            this.records.push( obj );

            this.trigger( 'change' );

            return this;
        },

        // Bind event handler to the model
        bind: function( events, callback ) {
            var self = this;
            self._callbacks = self._callbacks || {};

            $.each( events.split( ' ' ), function( index, eventName ) {
                if ( typeof( self._callbacks[ eventName ] === 'undefined' ) ) {
                    self._callbacks[ eventName ] = [];
                }

                self._callbacks[ eventName ].push( callback );
            });
        },

        // Reset all data
        setAllRecords: function( data, doChange ) {
            // Ensure that array is provided
            // TODO: fix this
            //if ( Object.prototype.toString.call( data ) !== '[object Array]' ) {
            //    throw new Error( 'The argument must be an array' );
            //}
            this.records = data;
            if(doChange) {
                this.trigger( 'change' );
            }            

            return this;
        },

        /*
         * Return model's cached data
         * @sortParamater - string identifying if we want to sort data before returning it
         */
        getData: function(sortParameter) {
            if(sortParameter){
                return this.records.sort(function(a,b){
                    return b[sortParameter]-a[sortParameter];
                });
            }else{
                return this.records;
            }    
        },

        /*
         * Load the data through the REST call
         * @loadItemsClosure - the method making the REST call
         * @forceReload - boolean identifying if we want to reload the model
         */
        __load: function( loadItemsClosure, forceReload ) {
            if ( typeof( forceReload ) === 'undefined' ) {
                // By default, use cached data
                forceReload = false;
            }

            var self = this,
                deferred = null;
                
            //this.loadDeferred = null;  
            if ( !this.loadDeferred || ( $.isNotActive( this.loadDeferred ) && forceReload ) ) {
                //window.console.log( 'model::__load', 'loading model data' );

                // The list has never been loaded, or data *was* loaded and the caller is forcing a reload
                this.loadDeferred = deferred = $.Deferred();
                                
                loadItemsClosure( function( data ) {
                  self.setAllRecords( data, true );
                  self.loadDeferred.resolve( data ); // resolve deferred and pass data to the callback defined inside .done() method
                }, function(e) {
                  self.loadDeferred.reject( e );
                });

            } else if ( $.isPending( this.loadDeferred ) ) {
                // Model data is already loading - return the deferred task currently in progress
                deferred = this.loadDeferred;

            } else {
                deferred = this.loadDeferred;
            }

            return deferred;
        },
        
        // Trigger the handler of the specified event
        trigger: function( ev ) {
            var list;

            if ( !this._callbacks ) {
                return this;
            }

            if (!( list  = this._callbacks[ ev ] ) ) {
                return this;
            }

            $.each( list, function(){
                this();
            });
        }
    };
});