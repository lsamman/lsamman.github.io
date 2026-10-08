/*
 * sun.js: where the sun really is for the person viewing the site.
 *
 * Browsers don't reveal your location without asking, but they do know your
 * timezone (e.g. "America/New_York"). We look that up in a small table of
 * representative coordinates (falling back to a longitude estimated from
 * the UTC offset), then compute the sun's elevation for the current date and
 * time with a standard astronomical approximation (accurate to well under a
 * degree, which is plenty for lighting a sky).
 *
 * So sunrise, sunset, twilight length and the seasons all match the
 * visitor's part of the world. js/scene.js uses this for the sky colours, and
 * js/launches.js for whether rocket exhaust is sunlit.
 *
 *   Sun.position(date?)  -> { elev, ha, dec }  degrees: elevation above the
 *                           horizon, hour angle (negative = morning), declination
 *   Sun.hourAngleAt(elev, date?) -> hour angle (deg) when the sun is at that
 *                           elevation today, or null if it never gets there
 *   Sun.place            -> { tz, lat, lon, guessed }
 */
(function () {
  'use strict';

  var DEG = Math.PI / 180;

  // Representative [latitude, longitude] for common timezones.
  var TZ = {
    'America/New_York': [40.7, -74.0], 'America/Detroit': [42.3, -83.0], 'America/Toronto': [43.7, -79.4],
    'America/Chicago': [41.9, -87.6], 'America/Denver': [39.7, -105.0], 'America/Phoenix': [33.4, -112.1],
    'America/Los_Angeles': [34.1, -118.2], 'America/Vancouver': [49.3, -123.1], 'America/Anchorage': [61.2, -149.9],
    'Pacific/Honolulu': [21.3, -157.9], 'America/Halifax': [44.6, -63.6], 'America/St_Johns': [47.6, -52.7],
    'America/Winnipeg': [49.9, -97.1], 'America/Edmonton': [53.5, -113.5], 'America/Regina': [50.4, -104.6],
    'America/Indiana/Indianapolis': [39.8, -86.2], 'America/Kentucky/Louisville': [38.3, -85.8], 'America/Boise': [43.6, -116.2],
    'America/Puerto_Rico': [18.5, -66.1], 'America/Mexico_City': [19.4, -99.1], 'America/Tijuana': [32.5, -117.0],
    'America/Monterrey': [25.7, -100.3], 'America/Guatemala': [14.6, -90.5], 'America/Panama': [9.0, -79.5],
    'America/Havana': [23.1, -82.4], 'America/Bogota': [4.7, -74.1], 'America/Lima': [-12.0, -77.0],
    'America/Caracas': [10.5, -66.9], 'America/Santiago': [-33.4, -70.7], 'America/Argentina/Buenos_Aires': [-34.6, -58.4],
    'America/Sao_Paulo': [-23.5, -46.6], 'America/Montevideo': [-34.9, -56.2], 'America/La_Paz': [-16.5, -68.1],
    'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Lisbon': [38.7, -9.1],
    'Europe/Madrid': [40.4, -3.7], 'Europe/Paris': [48.9, 2.4], 'Europe/Brussels': [50.8, 4.4],
    'Europe/Amsterdam': [52.4, 4.9], 'Europe/Berlin': [52.5, 13.4], 'Europe/Zurich': [47.4, 8.5],
    'Europe/Rome': [41.9, 12.5], 'Europe/Vienna': [48.2, 16.4], 'Europe/Prague': [50.1, 14.4],
    'Europe/Warsaw': [52.2, 21.0], 'Europe/Stockholm': [59.3, 18.1], 'Europe/Oslo': [59.9, 10.8],
    'Europe/Copenhagen': [55.7, 12.6], 'Europe/Helsinki': [60.2, 24.9], 'Europe/Athens': [38.0, 23.7],
    'Europe/Bucharest': [44.4, 26.1], 'Europe/Kiev': [50.5, 30.5], 'Europe/Kyiv': [50.5, 30.5],
    'Europe/Istanbul': [41.0, 29.0], 'Europe/Moscow': [55.8, 37.6], 'Atlantic/Reykjavik': [64.1, -21.9],
    'Africa/Casablanca': [33.6, -7.6], 'Africa/Lagos': [6.5, 3.4], 'Africa/Cairo': [30.0, 31.2],
    'Africa/Nairobi': [-1.3, 36.8], 'Africa/Johannesburg': [-26.2, 28.0], 'Africa/Accra': [5.6, -0.2],
    'Asia/Dubai': [25.2, 55.3], 'Asia/Riyadh': [24.7, 46.7], 'Asia/Tehran': [35.7, 51.4],
    'Asia/Jerusalem': [31.8, 35.2], 'Asia/Karachi': [24.9, 67.0], 'Asia/Kolkata': [22.6, 88.4],
    'Asia/Calcutta': [22.6, 88.4], 'Asia/Dhaka': [23.8, 90.4], 'Asia/Bangkok': [13.8, 100.5],
    'Asia/Jakarta': [-6.2, 106.8], 'Asia/Singapore': [1.35, 103.8], 'Asia/Kuala_Lumpur': [3.1, 101.7],
    'Asia/Manila': [14.6, 121.0], 'Asia/Ho_Chi_Minh': [10.8, 106.7], 'Asia/Hong_Kong': [22.3, 114.2],
    'Asia/Shanghai': [31.2, 121.5], 'Asia/Taipei': [25.0, 121.6], 'Asia/Seoul': [37.6, 127.0],
    'Asia/Tokyo': [35.7, 139.7], 'Asia/Kathmandu': [27.7, 85.3], 'Asia/Almaty': [43.2, 76.9],
    'Australia/Perth': [-31.95, 115.9], 'Australia/Adelaide': [-34.9, 138.6], 'Australia/Darwin': [-12.5, 130.8],
    'Australia/Brisbane': [-27.5, 153.0], 'Australia/Sydney': [-33.9, 151.2], 'Australia/Melbourne': [-37.8, 145.0],
    'Australia/Hobart': [-42.9, 147.3], 'Pacific/Auckland': [-36.8, 174.8], 'Pacific/Guam': [13.4, 144.8]
  };

  function findPlace() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    if (TZ[tz]) return { tz: tz, lat: TZ[tz][0], lon: TZ[tz][1], guessed: false };

    // Unknown zone: longitude from the UTC offset (15° per hour). For latitude,
    // the zone's region gives the hemisphere; otherwise assume mid-northern.
    var offsetHours = -new Date().getTimezoneOffset() / 60;
    var south = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia)|^America\/(Argentina|Santiago|Sao_Paulo|Montevideo|Asuncion|Lima|La_Paz)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone|Maseru|Mbabane)/.test(tz);
    return { tz: tz, lat: south ? -30 : 40, lon: Math.max(-180, Math.min(180, offsetHours * 15)), guessed: true };
  }

  var place = findPlace();

  // Solar declination, right ascension and sidereal time (low-precision formulae).
  function solar(date) {
    var d = date.getTime() / 86400000 + 2440587.5 - 2451545.0;   // days since J2000
    var g = (357.529 + 0.98560028 * d) * DEG;                    // mean anomaly
    var q = 280.459 + 0.98564736 * d;                            // mean longitude
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG;   // ecliptic longitude
    var e = (23.439 - 0.00000036 * d) * DEG;                     // obliquity
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)) / DEG;
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var gmst = (18.697374558 + 24.06570982441908 * d) % 24;      // hours
    var lst = gmst * 15 + place.lon;                             // local sidereal time, degrees
    var ha = ((lst - ra) % 360 + 540) % 360 - 180;               // -180..180, negative = morning
    return { dec: dec, ha: ha };
  }

  function position(date) {
    var s = solar(date || new Date());
    var lat = place.lat * DEG;
    var sinEl = Math.sin(lat) * Math.sin(s.dec) + Math.cos(lat) * Math.cos(s.dec) * Math.cos(s.ha * DEG);
    return { elev: Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG, ha: s.ha, dec: s.dec / DEG };
  }

  // Hour angle (degrees, positive) at which the sun sits at `elev` degrees today.
  // null if the sun never gets that high (or is always above it: returns 180).
  function hourAngleAt(elev, date) {
    var s = solar(date || new Date());
    var lat = place.lat * DEG;
    var c = (Math.sin(elev * DEG) - Math.sin(lat) * Math.sin(s.dec)) / (Math.cos(lat) * Math.cos(s.dec));
    if (c > 1) return null;
    if (c < -1) return 180;
    return Math.acos(c) / DEG;
  }

  window.Sun = { position: position, hourAngleAt: hourAngleAt, place: place };
})();
