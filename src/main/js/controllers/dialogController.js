/*global define, $, window ,GCFWVersion,BUILDVERSION */

define('DialogController', ['Controller', 'dialogView'],
        function(Controller, dialogView) {

            var okAction, cancelAction, initialized = false;

            return Controller.create({
                init: function(pluginVersion) {
                    var deferred = $.Deferred(), self;
                    if (initialized) {
                        deferred.reject();
                    }
                    initialized = true;
                    self = this.initializeListeners;
                    $.when(dialogView.appendContent("#home_page", 'dialog_tmpl', {
                        clientVersion: GCFWVersion,
                        buildVersion: BUILDVERSION,
                        pluginVersion: pluginVersion
                    }, "pagecreate")).done(function() {
                        self();
                        $('#dialog_download').attr('href', $('#dialog_download').attr('href') + Math.random());
                        if (window.navigator.appVersion.indexOf("Mac") !== -1) {
                            $("#plugindownload_browser_version").click();
                            $("#macosx-browser-version").show();
                        } else {
                            $("#macosx-browser-version").hide();
                        }
                        if ($.browser.msie) {
                            // if the browser is IE, add ".exe" manually after the random number for versioning
                            $('#dialog_download').attr('href', $('#dialog_download').attr('href') + ".exe");
                            deferred.resolve();
                        }
                        deferred.resolve();
                    });
                    return deferred;
                },
                initializeListeners: function() {
                    //If elements are placed into the DOM via ajax click events should be handled using "on"
                    $(document.body).on('click', "#dialog_ok", function() {
                        dialogView.hideDialog();
                        if (typeof okAction === 'function') {
                            okAction();
                        }
                    });
                    $(document.body).on('click', "#dialog_cancel", function() {
                        dialogView.hideDialog();
                        if (typeof cancelAction === 'function') {
                            cancelAction();
                        }

                    });
                    $(document.body).on('click', "#dialog_download", function() {
                        dialogView.hideDialog();
                    });
                },
                showDialog: function(title, type, buttons, data) {
                    var link;
                    if (data && data.downloadLink) {
                        link = data.downloadLink;
                    }
                    if (buttons) {
                        if (buttons.ok) {
                            okAction = buttons.ok;
                        }
                        if (buttons.cancel) {
                            cancelAction = buttons.cancel;
                        }
                    }
                    dialogView.updateView(title, type, buttons, link);
                    dialogView.showDialog();
                },
                showAbout: function() {
                    dialogView.showAbout();
                },
                hideAbout: function() {
                    dialogView.hideAbout();
                }
            });
        }
);
