/**
 * @fileoverview timezone
 * @author NHN FE Development Lab <dl_javascript@nhn.com>
 */
'use strict';

var util = require('tui-code-snippet');
var intlUtil = require('./intlUtil');

var MIN_TO_MS = 60 * 1000;
var nativeOffsetMs = getTimezoneOffset();
var customOffsetMs = nativeOffsetMs;
var timezoneOffsetCallback = null;
var setByTimezoneOption = false;
var primaryOffset, offsetCalculator;
var primaryTimezoneCode;

var getterMethods = [
    'getDate',
    'getDay',
    'getFullYear',
    'getHours',
    'getMilliseconds',
    'getMinutes',
    'getMonth',
    'getSeconds',
];

var setterMethods = [
    'setDate',
    'setFullYear',
    'setHours',
    'setMilliseconds',
    'setMinutes',
    'setMonth',
    'setSeconds',
];

var differentOffset = {
    STANDARD_TO_DST: 1,
    DST_TO_STANDARD: -1,
    SAME: 0,
};

/**
 * Get the timezone offset by timestampe
 * @param {number} timestamp - timestamp
 * @returns {number} timezone offset
 * @private
 */
function getTimezoneOffset(timestamp) {
    timestamp = timestamp || Date.now();

    return new Date(timestamp).getTimezoneOffset() * MIN_TO_MS;
}

/**
 * Get the custome timezone offset by timestampe
 * @param {number} timestamp - timestamp
 * @returns {number} timezone offset
 * @private
 */
function getCustomTimezoneOffset(timestamp) {
    if (!setByTimezoneOption && timezoneOffsetCallback) {
        return timezoneOffsetCallback(timestamp) * MIN_TO_MS;
    }

    return customOffsetMs;
}

/**
 * Convert to local time
 * @param {number} time - time
 * @returns {number} local time
 */
function getLocalTime(time) {
    var customTimezoneOffset, localTime;

    if (!setByTimezoneOption) {
        return time;
    }

    customTimezoneOffset = getCustomTimezoneOffset(time);
    localTime = time - customTimezoneOffset + nativeOffsetMs;

    return localTime;
}

/**
 * Create a Date instance with multiple arguments
 * @param {Array} args - arguments
 * @returns {Date}
 * @private
 */
function createDateWithMultipleArgs(args) {
    var utc = Date.UTC.apply(null, args);

    return new Date(utc + getTimezoneOffset(utc));
}

/**
 * To convert a Date to TZDate as it is.
 * @param {TZDate|number|null} arg - date
 * @returns {Date}
 */
function createDateWithUTCTime(arg) {
    var time;

    if (arg instanceof TZDate) {
        time = arg.getUTCTime();
    } else if (typeof arg === 'number') {
        time = arg;
    } else if (arg === null) {
        time = 0;
    } else {
        throw new Error('Invalid Type');
    }

    return new Date(time);
}

/**
 * Convert time to local time. Those times are only from API and not from inner source code.
 * @param {Date|string} arg - date
 * @returns {Date}
 */
function createDateAsLocalTime(arg) {
    var time;

    if (arg instanceof Date) {
        time = arg.getTime();
    } else if (typeof arg === 'string') {
        time = Date.parse(arg);
    } else {
        throw new Error('Invalid Type');
    }

    time = getLocalTime(time);

    return new Date(time);
}

/**
 * is it for local time? These type can be used from Calendar API.
 * @param {Date|string} arg - date
 * @returns {boolean}
 */
function useLocalTimeConverter(arg) {
    return arg instanceof Date || typeof arg === 'string';
}

/**
 * Timezone Date Class
 * @param {number|TZDate|Date|string} date - date to be converted
 * @constructor
 */
function TZDate(date) {
    var nativeDate;

    if (util.isUndefined(date)) {
        date = Date.now();
    }

    if (arguments.length > 1) {
        nativeDate = createDateWithMultipleArgs(arguments);
    } else if (useLocalTimeConverter(date)) {
        nativeDate = createDateAsLocalTime(date);
    } else {
        nativeDate = createDateWithUTCTime(date);
    }

    this._date = nativeDate;
}

/**
 * Get milliseconds which is converted by timezone
 * @returns {number} milliseconds
 */
TZDate.prototype.getTime = function () {
    var time = this._date.getTime();

    return time + getCustomTimezoneOffset(time) - getTimezoneOffset(time);
};

/**
 * Get UTC milliseconds
 * @returns {number} milliseconds
 */
TZDate.prototype.getUTCTime = function () {
    return this._date.getTime();
};

/**
 * toUTCString
 * @returns {string}
 */
TZDate.prototype.toUTCString = function () {
    return this._date.toUTCString();
};

/**
 * to Date
 * @returns {Date}
 */
TZDate.prototype.toDate = function () {
    return this._date;
};

TZDate.prototype.valueOf = function () {
    return this.getTime();
};

TZDate.prototype.addDate = function (day) {
    this.setDate(this.getDate() + day);

    return this;
};

TZDate.prototype.addMinutes = function (minutes) {
    this.setMinutes(this.getMinutes() + minutes);

    return this;
};

TZDate.prototype.addMilliseconds = function (milliseconds) {
    this.setMilliseconds(this.getMilliseconds() + milliseconds);

    return this;
};

/* eslint-disable max-params*/
TZDate.prototype.setWithRaw = function (y, M, d, h, m, s, ms) {
    this.setFullYear(y, M, d);
    this.setHours(h, m, s, ms);

    return this;
};

/**
 * @returns {TZDate} local time
 */
TZDate.prototype.toLocalTime = function () {
    var time = this.getTime();
    var utcTime = this.getUTCTime();
    var diff = time - utcTime;

    return new TZDate(utcTime - diff);
};

getterMethods.forEach(function (methodName) {
    TZDate.prototype[methodName] = function () {
        return this._date[methodName].apply(this._date, arguments);
    };
});

setterMethods.forEach(function (methodName) {
    TZDate.prototype[methodName] = function () {
        this._date[methodName].apply(this._date, arguments);

        return this.getTime();
    };
});

/**
 * Set offset
 * @param {number} offset - timezone offset based on minutes
 */
function setOffset(offset) {
    customOffsetMs = offset * MIN_TO_MS;
}

/**
 * Set primary offset
 * @param {number} offset - offset
 */
function setPrimaryOffset(offset) {
    primaryOffset = offset;
    setOffset(offset);
}

/**
 * Return primary offset
 * @returns {number} offset
 */
function getPrimaryOffset() {
    return util.isNumber(primaryOffset) ? primaryOffset : new Date().getTimezoneOffset();
}

/**
 * Set primary timezone code
 * @param {string} timezoneCode - timezone code (such as 'Asia/Seoul', 'America/New_York')
 */
function setPrimaryTimezoneCode(timezoneCode) {
    primaryTimezoneCode = timezoneCode;
}

/**
 * Get offset by timezoneCode
 * @param {string} timezoneCode - timezone code (such as 'Asia/Seoul', 'America/New_York')
 * @param {number} timestamp - timestamp
 * @returns {number} timezone offset
 */
function getOffsetByTimezoneCode(timezoneCode, timestamp) {
    var offset = getPrimaryOffset();
    var calculator;

    if (!timezoneCode) {
        return offset;
    }

    calculator = getOffsetCalculator(timezoneCode);

    return calculator ? calculator(timezoneCode, timestamp) : offset;
}

/**
 * Set a calculator function to get timezone offset by timestamp
 * @param {function} calculator - offset calculator
 */
function setOffsetCalculator(calculator) {
    offsetCalculator = calculator;
}

/**
 * Return a function to calculate timezone offset by timestamp
 * @param {string} timezoneCode - timezone code
 * @returns {function | null} offset calculator
 */
function getOffsetCalculator(timezoneCode) {
    if (util.isFunction(offsetCalculator)) {
        return offsetCalculator;
    }

    if (intlUtil.supportIntl(timezoneCode)) {
        return intlUtil.offsetCalculator;
    }

    return null;
}

/**
 * Set timezone and offset by timezone option
 * @param {Timezone} timezoneObj - {@link Timezone}
 */
function setPrimaryTimezoneByOption(timezoneObj) {
    var timezoneCode = timezoneObj.timezone;
    var timestamp, offset;

    if (!timezoneObj) {
        return;
    }

    timestamp = Date.now();

    if (timezoneCode) {
        setByTimezoneOption = true;
        setPrimaryTimezoneCode(timezoneCode);

        offset = getOffsetByTimezoneCode(timezoneCode, timestamp);

        if (offset === nativeOffsetMs / MIN_TO_MS) {
            setByTimezoneOption = false;
        }

        setPrimaryOffset(offset);
    }
}

/**
 * Get primary timezone code
 * @returns {string} primary timezone code (such as 'Asia/Seoul', 'America/New_York')
 */
function getPrimaryTimezoneCode() {
    return primaryTimezoneCode;
}

/**
 *
 * @param {number} startTime - start timestamp
 * @param {number} endTime - end timestamp
 * @returns {number}
 */
function isDifferentOffsetStartAndEndTime(startTime, endTime) {
    var offset1 = getOffsetByTimezoneCode(primaryTimezoneCode, startTime);
    var offset2 = getOffsetByTimezoneCode(primaryTimezoneCode, endTime);
    var result = differentOffset.SAME;

    if (offset1 > offset2) {
        result = differentOffset.STANDARD_TO_DST; // Standard to DST
    } else if (offset1 < offset2) {
        result = differentOffset.DST_TO_STANDARD; // DST to Standard
    }

    return result;
}

module.exports = {
    Date: TZDate,
    differentOffset: differentOffset,

    setOffset: setOffset,

    /**
     * Set offset
     * @param {number} offset - timezone offset based on minutes
     */
    setOffsetByTimezoneOption: function (offset) {
        this.setOffset(-offset);
        setByTimezoneOption = true;
    },

    /**
     * Get offset in case of `setByTimezoneOption`. Or return 0.
     * @returns {number} timezone offset offset minutes
     */
    getOffset: function () {
        if (setByTimezoneOption) {
            return customOffsetMs / MIN_TO_MS;
        }

        return 0;
    },

    /**
     * Set a callback function to get timezone offset by timestamp
     * @param {function} callback - callback function
     */
    setOffsetCallback: function (callback) {
        timezoneOffsetCallback = callback;
    },

    /**
     * (Use this method only for testing)
     * Reset system timezone and custom timezone
     */
    restoreOffset: function () {
        customOffsetMs = getTimezoneOffset();
    },

    getNativeOffsetMs: function () {
        return nativeOffsetMs;
    },

    /**
     * Check to use custom timezone option
     * @returns {boolean} use custom timezone option
     */
    hasPrimaryTimezoneCustomSetting: function () {
        return setByTimezoneOption;
    },

    setOffsetCalculator: setOffsetCalculator,

    setPrimaryTimezoneByOption: setPrimaryTimezoneByOption,

    getPrimaryOffset: getPrimaryOffset,

    getOffsetByTimezoneCode: getOffsetByTimezoneCode,

    getPrimaryTimezoneCode: getPrimaryTimezoneCode,

    isNativeOsUsingDSTTimezone: function () {
        var year = new Date().getFullYear();
        var jan = new Date(year, 0, 1).getTimezoneOffset();
        var jul = new Date(year, 6, 1).getTimezoneOffset();

        return jan !== jul;
    },

    isPrimaryUsingDSTTimezone: function () {
        var year = new Date().getFullYear();
        var jan = new Date(year, 0, 1);
        var jul = new Date(year, 6, 1);

        return (
            getOffsetByTimezoneCode(primaryTimezoneCode, jan) !==
            getOffsetByTimezoneCode(primaryTimezoneCode, jul)
        );
    },

    isDifferentOffsetStartAndEndTime: isDifferentOffsetStartAndEndTime,
};
