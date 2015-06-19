
/*global define, $, window */

/*
 * For managing dialog view
 */

define('dialogView', ['view'], function(View) {

    return View.create({
        updateView: function(title, type, buttons, downloadLink) {
            //We will fill the dialog using lang file so we do not need to pass title and message as parameters 

            if (!type) {
                type = "alert";
            }

            if (buttons) {
                if (buttons.ok) {
                    $("#dialog_ok").show();
                } else {
                    $("#dialog_ok").hide();
                }
                if (buttons.cancel) {
                    $("#dialog_cancel").show();
                } else {
                    $("#dialog_cancel").hide();
                }
                if (buttons.download) {
                    $("#dialog_download").show();
                    $('#dialog_download').attr('href', downloadLink + "?v=");
                } else {
                    $("#dialog_download").hide();
                }
            } else {
                $("#dialog_ok").show();

                $("#dialog_download").hide();

                $("#dialog_cancel").hide();
            }
            // Lang file will handle the message body of the dialog title by this way we will not keep long messages inside js files.
            if (window.lang.VidyoClient.Title[title]) {
                $('#dialog_title').html(window.lang.VidyoClient.Title[title]);
            }
            else {
                $('#dialog_title').html(title);
            }
            if (window.lang.VidyoClient.Message[title]) {
                $('#dialog_div').show();
                $('#dialog_message').html(window.lang.VidyoClient.Message[title]);
            }
            else {
                $('#dialog_div').hide();
            }
            if (type === "invitation") {
                $('#popup').addClass("invbrdr");
                $('#dialog .table').addClass("invDialogTable");
                $('#dialog_ok').addClass("inv");
                $('#dialog_cancel').addClass("invcancelbrdr");
                $('#popup').addClass("invbrdr");
                $('.dialog_div').addClass("invDiv");
                $('#dialog_title').addClass("invContent");
                $("#dialog_ok .ui-btn-text").html("Join");
                // $("#dialog_div").attr("padding-top","0px");
            }
            else {
                $("#dialog_ok .ui-btn-text").html("OK");
                //$("#dialog_div").attr("padding","10px");
                if ($('#popup').hasClass("invbrdr")) {
                    $("#popup").removeClass("invbrdr");
                }
                if ($('#dialog_ok').hasClass("inv")) {
                    $('#dialog_ok').removeClass("inv");
                }
                if ($('#dialog_cancel').hasClass("invcancelbrdr")) {
                    $('#dialog_cancel').removeClass("invcancelbrdr");
                }
                if ($('.dialog_div').hasClass("invDiv")) {
                    $('.dialog_div').removeClass("invDiv");
                }
                if ($('#dialog .table').hasClass("invDialogTable")) {
                    $('#dialog .table').removeClass("invDialogTable");
                }
                if ($('#dialog_title').hasClass("invContent")) {
                    $('#dialog_title').removeClass("invContent");
                }
            }
            $('#dialog_icon').attr("class", type);
        },
        showDialog: function() {

            var $dialog = $('#dialog');
            $dialog.css({
                display: 'block',
                opacity: 0
            });

            $dialog.animate({
                opacity: 1
            }, 250, function() {
            });
        },
        showAbout: function() {
            $('#about_popup').show();
        },
        hideAbout: function() {
            $('#about_popup').hide();
        },
        hideDialog: function() {

            var $dialog = $('#dialog');

            $dialog.animate({
                opacity: 0
            }, 350, function() {
                $('#dialog').css('display', 'none');
            });
        }
    });
});