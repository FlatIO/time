(function () {

  var AM = 'am'
    , PM = 'pm'
    , periodRegex = new RegExp('([ap](\\.?)(m\\.?)?)', 'i')
    , timeRegex = new RegExp('^(10|11|12|0?[1-9])(?::|\\.)?([0-5][0-9])?'
                             + periodRegex.source + '?$', 'i')
    , militaryTimeRegex = new RegExp('^([01]?[0-9]|2[0-3])(?::|\\.)?([0-5][0-9])?$', 'i')
    , formatRegex = new RegExp('^(h|hh|H|HH)([:|\.])?(mm)?( ?)'
                               + periodRegex.source + '?$', 'i');

  // play nice with both node.js and browser
  if (typeof module !== 'undefined' && module.exports) module.exports = Time;
  else window.Time = Time;

  /*
   * Time constructor works with(out) 'new'
   *
   * @time (optional) string or number representing a 12-hour or 24-hour military time.
   *   e.g. 7, 1234, '7', '7:00', '12.14', '13', '15:30'
   *
   *   If not provided, current time is used.
   */
  function Time(time) {
    if (!(this instanceof Time)) return new Time(time);

    var hours, minutes, period = null;

    if (time) {
      var sanitizedTime = sanitize(time);
      // parse 12-hour time
      var result = timeRegex.exec(sanitizedTime);
      if (result) {
        hours = parseInt(result[1], 10);
        minutes = result[2] ? parseInt(result[2], 10) : 0;
        period = parsePeriod(result[3]);
      } else {
        // parse 24-hour military time
        result = militaryTimeRegex.exec(sanitizedTime);
        if (result) {
          hours = parseInt(result[1]);
          period = hours > 11 ? PM : AM;
          if (hours > 12) hours -= 12;
          if (hours === 0) hours = 12;
          minutes = result[2] ? parseInt(result[2]) : 0;
        }
      }
    } else {
      // set to current time
      var d = new Date();
      hours = d.getHours();
      period = hours > 11 ? PM : AM;
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      minutes = d.getMinutes();
    }

    // gets or sets hours
    this.hours = function(newHours) {
      if (!newHours) return hours;
      hours = parseInt(newHours, 10);
    };

    this.militaryHours = function(newHours) {
      if (!newHours) {
        if (period === AM || !period) {
          if (hours === 12 && period)
            return 0;
          else
            return hours;
        } else {
          if (hours === 12)
            return 12;
          else {
            return parseInt(hours) + 12;
          }
        }
      }
      hours = parseInt(newHours);
      period = hours > 11 ? PM : AM;
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
    };

    // gets or sets minutes
    this.minutes = function(newMinutes) {
      if (!newMinutes) return minutes;
      minutes = parseInt(newMinutes, 10);
    };

    // gets or sets period
    this.period = function(newPeriod) {
      if (!newPeriod) return period;
      period = parsePeriod(newPeriod);
    };
  }

  /*
   * Find the next immediate corresponding Date.
   *
   * Assume it's 3:15 pm Aug 10:
   * Time('3:15').nextDate() // 3:15 pm Aug 10
   * Time('415').nextDate()  // 4:15 pm Aug 10
   * Time('2').nextDate()    // 2:00 am Aug 11
   */
  Time.prototype.nextDate = function () {
    if (!this.isValid()) return null;

    var hours = this.hours() === 12 ? 0 : this.hours(); // uniformly handle am/pm adjustments
    if (this.period() === PM) hours += 12;
    var d = new Date();
    d.setHours(hours);
    d.setMinutes(this.minutes());
    d.setSeconds(0);
    d.setMilliseconds(0);

    // if it has already passed, add 12 hours at a time until it's in the future
    while (new Date() > d) d.setHours(d.getHours() + 12);

    // make sure we're in the correct period
    if (d.getHours() > 11 && this.period() === AM) d.setHours(d.getHours() + 12)
    else if (d.getHours() < 12 && this.period() === PM) d.setHours(d.getHours() + 12)

    return d;
  };

  Time.isValid = function(time) {
    var sanitizedTime = sanitize(time);
    return timeRegex.test(sanitizedTime) || militaryTimeRegex.test(sanitizedTime);
  };

  Time.prototype.isValid = function() {
    return Time.isValid(toString(this));
  };

  /*
   * This can be safely changed if so desired.
   */
  Time.DEFAULT_TIME_FORMAT = 'h:mm am';

  /*
   * Formats the time to the given format, or h:mm if one is not provided.
   *
   * If periods are specified in the format, they are only printed if known.
   *
   * If the time isn't valid, return 'invalid time'.
   * If the format isn't valid, return 'invalid format'.
   *
   * This isn't every combination, but hopefully you get the gist of things.
   * h:mm       12:00       (default)
   * hh:mm      01:00
   * h          1
   * h          1:55        (input specified minutes, so we show them)
   * h.         1.55        (if minutes are shown, use . for separator)
   * hpm        1am
   * h:mm a     1:55 p
   * h:mm a     1:55        (input didn't specify period)
   * h.mm am    1.55 pm
   * h.mm A     1.55 P
   * hh:mm a.m. 01:55 a.m.
   * h:mma      1:55a
   * h.mm       1.55
   * H:mm       13:55
   * HH:mm      01:00
   */
  Time.prototype.format = function(format) {
    format = format || Time.DEFAULT_TIME_FORMAT;
    if (!this.isValid()) {
      return 'invalid time';
    } else if (!formatRegex.test(format)) {
      return 'invalid format';
    }
    return toString(this, format);
  };

  /*
   * Alias for `format`.
   */
  Time.prototype.toString = Time.prototype.format;

  /*
   * Alias for `format('HH:mm')` returns ISO8601 time component (without seconds)
   */
  Time.prototype.toISOString = function() {
    return this.format('HH:mm');
  };

  /*
   * (private) Format Time in the given format.
   *
   * @time Time instance
   * @retun hh:mm e.g. 3:00, 12:23, undefined:undefined
   */
  function toString(time, format) {
    format = format || Time.DEFAULT_TIME_FORMAT;
    var bits = formatRegex.exec(format);
    var fHour = bits[1];
    var fMiddlebit = bits[2];
    var fMinutes = bits[3];
    var fPeriodSpace = bits[4];
    var fPeriod = bits[5];
    var fFirstPeriod = bits[6];
    var fPeriodM = bits[7];

    // always show hour
    var hours;
    // check for military format H and HH
    var militaryFormat = fHour.toLowerCase() !== fHour;

    if (!militaryFormat)
      hours = fHour.length == 2 ? padTime(time.hours()) : time.hours();
    else
      hours = fHour.length == 2 ? padTime(time.militaryHours()) : time.militaryHours();

    // show if in the format or if non-zero and middlebit is provided
    var minutes = (fMinutes || (fMiddlebit && time.minutes() !== 0)) ?
                    padTime(time.minutes()) : '';

    // show middlebit if we have minutes
    var middlebit = (minutes && fMiddlebit) ? fMiddlebit : '';

    // show period if available and requested
    var period = '';
    if (!militaryFormat && fPeriod && time.period()) {
      var firstPeriod = time.period().charAt(0);
      if (fPeriod.charAt(0) === fPeriod.charAt(0).toUpperCase()) {
        firstPeriod = firstPeriod.toUpperCase();
      }
      period = firstPeriod + fPeriod.slice(1);
    }

    // only show space if it was requested by format and there's a period
    var space = (period && fPeriodSpace) ? fPeriodSpace : '';

    return '' + hours + middlebit + minutes + space + period;
  }

  function padTime(time) {
    return time < 10 ? '0' + time : time;
  }

  /*
   * (private) Force @time to a string and remove all whitespace.
   *
   * @time input
   * @retun input as a string, with all white space removed
   */
  function sanitize(time) {
    return time.toString().replace(/\s/g, '');
  }

  /*
   * (private)
   */
  function parsePeriod(period) {
    if (!period || !period.match(periodRegex)) return null;
    else if (period.match(/^p/i) != null) return PM;
    return (period.match(/^a/i) != null) ? AM : null;
  }
})();
