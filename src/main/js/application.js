/*global define,$, window, GCFWVersion */

define('Application', [  'localization',  'errorView'],
        function (  localization,  errorView) {
            return function Application() {

                function setLanguageSuccess() {
                    var Months = window.lang.Months;
                    window.dateFormat.i18n.monthNames =
                            [Months.JAN, Months.FEB, Months.MAR, Months.APR, Months.MA, Months.JUN, Months.JUL, Months.AUG, Months.SEP, Months.OCT, Months.NOV, Months.DEC,
                                Months.JANUARY, Months.FEBRUARY, Months.MARCH, Months.APRIL, Months.MAY, Months.JUNE, Months.JULY, Months.AUGUST, Months.SEPTEMBER, Months.OCTOBER, Months.NOVEMBER, Months.DECEMBER];
                    document.title = window.lang.VidyoClient.TITLE;
                }

                return {
                    init: function init() {

                        $.when(localization.setLanguage()).done(function () {
                            setLanguageSuccess();
                            errorView.init({
                                roomOwner: 'roomOwner',
                                errorMessage: window.lang.VidyoClient.ROOM_NOT_FOUND,
                                createBackButton: {
                                    text: window.lang.VidyoClient.GO_TO_BACK_PAGE,
                                    buttonFunction: function () {
                                        if (history.length > 1) {
                                            window.history.back();
                                        }
                                        else {
                                            window.location.href = "https://www.genband.com/";
                                        }
                                    }
                                }
                            });
                        });
                    }
                };
            };
        });