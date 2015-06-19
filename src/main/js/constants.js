/*jslint bitwise: false */

var CONSTANTS = {
    "LOG": {
        WEB_ROOT_NAMESPACE: "web",
        LEVEL: {
            OFF: "OFF",
            FATAL: "FATAL",
            ERROR: "ERROR",
            WARN: "WARN",
            INFO: "INFO",
            DEBUG: "DEBUG",
            TRACE: "TRACE",
            ALL: "ALL"
        }
    },
    "PROXY_SETIINGS": {
        FORCE_PROXY: 0X0001,
        PROXY_WEB_ENABLE: 0X0008,
        PROXY_WEB_IE: 0x0010,
        PROXY_WEB_LOCAL: 0x0020,
        PROXY_WEB_LOCAL_MANUAL: 0x0800,
        PROXY_TYPE: {
            MANUAL: "manual",
            AUTO: "auto",
            NONE: "none"
        }
    },
    "EVENT": {
        VIDYO_API: "VIDYO_API",
        LOGIN_SUCCESS: 1,
        LOGIN_FAILURE: 2,
        CONF_ACTIVE: 3,
        CONF_ENDED: 4,
        JOIN_CONF_FAILURE: 5,
        LEAVE_CONF_FAILURE: 6,
        LOCAL_MEDIA_UPDATE_EVENT: 7,
        SERVER_MEDIA_UPDATE_EVENT: 8,
        SERVER_BASED_MEDIA_CONTROL_EVENT: 9,
        SCREEN_SHARE_ADDED: 10,
        SCREEN_SHARE_REMOVED: 11,
        SCREEN_SHARE_LIST_READY: 12,
        PARTICIPANTS_CHANGED_FOR_GUEST: 13,
        PARTICIPANTS_CHANGED_FOR_USER: 14,
        PARTICIPANTS_CHANGED_FAILURE_FOR_GUEST: 15,
        PARTICIPANTS_CHANGED_FAILURE_FOR_USER: 16,
        DEVICE_CHANGE_OUT_EVENT: 17,
        PLUGIN_FAILURE: 18,
        LEAVE_CONF_SUCCESS: 19,
        RECEIVED_GROUP_CHAT_MESSAGES: 20,
        PLUGIN_SUCCESS: 21,
        DEVICE_CONFIGURATION_ERROR: 22,
        SCREEN_SHARE_LIST_FAILED: 23,
        LOGIC_STARTED: 24
    },
    "LOGIN_TYPE": {
        NONE: 1,
        USER: 2,
        GUEST: 1
    },
    "ERROR_CODE": {
        GET_PARTICIPANTS_ERROR: 1,
        USER_ACCOUNT_ERROR: 2
    },
    "POPUP_CODES": {
        BTNS_MICCAM_LOGIN: 1,
        BTNS_YESNO_LEFT: 2,
        BTNS_YESNO_TOP: 3,
        CBOX_SINGLE_CLOSE_TOP: 4,
        TEMPL_MICCAM_LOGIN: 5,
        TEMPL_YESNO_TOP: 6,
        TEMPL_YESNO_LEFT: 7,
        TEMPL_CBOX_TOP: 8,
        TEMPL_CBOX_LEFT: 9,
        TEMPL_CBOX_BTM_RIGHT: 10
    },
    "USED_MEDIA_TYPES": {
        // Local media constants/variables
        DEVICE_TYPE_MICROPHONE: "microphone",
        DEVICE_TYPE_SPEAKER: "speaker",
        DEVICE_TYPE_VIDEO: "video",
        // Server media control constants/variables
        SERVER_MEDIA_TYPE_AUDIO: "audio",
        SERVER_MEDIA_TYPE_VIDEO: "video",
        ANIMATE_SILENCE_AUDIO: "animateSilenceAudio",
        ANIMATE_SILENCE_VIDEO: "animateSilenceVideo",
        // Media control event constants
        MEDIA_CONTROL_COMMAND_SILENCE: "Silence",
        MEDIA_CONTROL_MEDIA_TYPE_AUDIO: "Audio",
        MEDIA_CONTROL_MEDIA_TYPE_VIDEO: "Video"
    },
    "GENERAL": {
        MAX_NAME_STRING_LENGTH_FOR_PARTS_CHANGE_POP_UP: 82,
        SILENCE_ANIMATION_DURATION: 4000
    },
    "DEVICE_NAMES": {
        CAMERA: "Camera",
        SPEAKER: "Speaker",
        MICROPHONE: "Microphone"
    }
};