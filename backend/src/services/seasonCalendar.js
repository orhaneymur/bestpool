/**
 * Season calendar — the single source of truth for how many hours a contract
 * actually covers.
 *
 * The old model multiplied a hand-typed "hours per week" by a week count that
 * was rounded to the nearest whole week. May 28 – Sep 5 is 14 weeks and 3 days;
 * rounding it to 14 silently dropped three operating days from every invoice.
 *
 * This walks the season one day at a time instead, so the answer is exact, and
 * it applies the Holiday row on US public holidays — a pool whose Mondays are
 * closed still opens on Memorial Day and Labor Day.
 *
 * Everything here is pure and deterministic: the wizard, the invoice and the PDF
 * all call it, so the three can never disagree.
 */

/** Dates are handled in UTC so a server timezone can never shift a day. */
function toUTC(dateish) {
  if (!dateish) return null;
  const s = String(dateish).slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const iso = (dt) => dt.toISOString().slice(0, 10);
const addDays = (dt, n) => new Date(dt.getTime() + n * 86400000);

/** nth (1-based) weekday of a month; n = -1 means the last one. */
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(Date.UTC(year, month, 1));
    const shift = (weekday - first.getUTCDay() + 7) % 7;
    return new Date(Date.UTC(year, month, 1 + shift + (n - 1) * 7));
  }
  const last = new Date(Date.UTC(year, month + 1, 0));
  const shift = (last.getUTCDay() - weekday + 7) % 7;
  return new Date(Date.UTC(year, month + 1, 0 - shift));
}

/**
 * US public holidays for a calendar year.
 *
 * Fixed-date holidays use the real date rather than the federal "observed"
 * weekday shift: a pool is busy on the Fourth of July itself, not on the Friday
 * the offices take off.
 */
export function usHolidays(year) {
  const y = Number(year);
  return [
    { key: 'new_year', name: "New Year's Day", date: iso(new Date(Date.UTC(y, 0, 1))) },
    { key: 'mlk', name: 'Martin Luther King Jr. Day', date: iso(nthWeekday(y, 0, 1, 3)) },
    { key: 'presidents', name: "Presidents' Day", date: iso(nthWeekday(y, 1, 1, 3)) },
    { key: 'memorial', name: 'Memorial Day', date: iso(nthWeekday(y, 4, 1, -1)) },
    { key: 'juneteenth', name: 'Juneteenth', date: iso(new Date(Date.UTC(y, 5, 19))) },
    { key: 'independence', name: 'Independence Day', date: iso(new Date(Date.UTC(y, 6, 4))) },
    { key: 'labor', name: 'Labor Day', date: iso(nthWeekday(y, 8, 1, 1)) },
    { key: 'columbus', name: 'Columbus Day', date: iso(nthWeekday(y, 9, 1, 2)) },
    { key: 'veterans', name: 'Veterans Day', date: iso(new Date(Date.UTC(y, 10, 11))) },
    { key: 'thanksgiving', name: 'Thanksgiving Day', date: iso(nthWeekday(y, 10, 4, 4)) },
    { key: 'christmas', name: 'Christmas Day', date: iso(new Date(Date.UTC(y, 11, 25))) },
  ];
}

/** Every US holiday landing inside the contract dates, in order. */
export function holidaysInSeason(seasonStart, seasonEnd) {
  const start = toUTC(seasonStart);
  const end = toUTC(seasonEnd);
  if (!start || !end || end < start) return [];

  // Same reasoning as computeSeason: a mistyped year must not turn into
  // thousands of holiday tables.
  if (end.getUTCFullYear() - start.getUTCFullYear() > 3) return [];

  const years = new Set([start.getUTCFullYear(), end.getUTCFullYear()]);
  const all = [...years].flatMap((y) => usHolidays(y));
  return all
    .filter((h) => {
      const d = toUTC(h.date);
      return d >= start && d <= end;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

const DAY_KEYS = ['pazar', 'pazartesi', 'sali', 'carsamba', 'persembe', 'cuma', 'cumartesi'];
export const HOLIDAY_KEY = 'tatil';

/** Open hours for one schedule row; a closed or malformed row counts as zero. */
function rowHours(row) {
  if (!row || row.is_closed) return 0;
  const parse = (t) => {
    const [hh, mm] = String(t || '').split(':').map(Number);
    if (!Number.isFinite(hh)) return null;
    return hh * 60 + (Number.isFinite(mm) ? mm : 0);
  };
  const open = parse(row.open_time);
  const close = parse(row.close_time);
  if (open == null || close == null || close <= open) return 0;
  return (close - open) / 60;
}

function findRow(schedules, seasonType, dayKey) {
  return (schedules || []).find((s) => s.season_type === seasonType && s.day_label === dayKey) || null;
}

/**
 * Walks the season day by day.
 *
 * @param {object} input
 * @param {string} input.season_start          YYYY-MM-DD
 * @param {string} input.season_end            YYYY-MM-DD (inclusive)
 * @param {Array}  input.schedules             quote_schedules rows
 * @param {number} input.lifeguard_count
 * @param {string} [input.school_closes]       last day schools are in session
 * @param {string} [input.school_reopens]      first day schools are back
 * @param {object} [input.holiday_policy]      { [holidayKey]: boolean } — true = open on Holiday hours
 */
export function computeSeason(input = {}) {
  const start = toUTC(input.season_start);
  const end = toUTC(input.season_end);
  const guards = Math.max(0, Number(input.lifeguard_count || 0));
  const schedules = input.schedules || [];

  const empty = {
    valid: false,
    days: 0,
    weeks: 0,
    weeksLabel: '—',
    openDays: 0,
    closedDays: 0,
    openHours: 0,
    staffHours: 0,
    avgWeeklyStaffHours: 0,
    avgDailyHoursPerGuard: 0,
    normalDays: 0,
    schoolDays: 0,
    holidays: [],
    holidayOpenDays: 0,
    holidayStaffHours: 0,
    holidayExtraStaffHours: 0,
    warnings: [],
  };

  if (!start || !end || end < start) {
    return { ...empty, warnings: ['Enter a contract start and end date.'] };
  }

  // Hard bound before the day loop.
  //
  // The wizard re-runs this while the dates are being typed, and a half-typed
  // year like 9999 asks for ~2.9 million iterations — about three seconds of
  // blocked event loop per keystroke. Enough of those in a row and the liveness
  // probe times out and the pod is restarted, which shows up as a 502 on every
  // other request. No pool contract runs for two years, so refuse instead.
  const MAX_DAYS = 800;
  const spanDays = Math.round((end - start) / 86400000) + 1;
  if (spanDays > MAX_DAYS) {
    return {
      ...empty,
      warnings: [
        `Those dates span ${spanDays.toLocaleString('en-US')} days. Check the year — a contract cannot run longer than ${MAX_DAYS} days.`,
      ],
    };
  }

  const schoolCloses = toUTC(input.school_closes);
  const schoolReopens = toUTC(input.school_reopens);
  const policy = input.holiday_policy && typeof input.holiday_policy === 'object' ? input.holiday_policy : {};

  const seasonHolidays = holidaysInSeason(input.season_start, input.season_end).map((h) => ({
    ...h,
    // Default: the pool opens on public holidays using the Holiday row. That is
    // the whole point of having a Holiday row, and it is what a closed Monday
    // falling on Memorial Day needs.
    observed: policy[h.key] !== false,
  }));
  const holidayByDate = new Map(seasonHolidays.map((h) => [h.date, h]));

  let days = 0;
  let openDays = 0;
  let openHours = 0;
  let normalDays = 0;
  let schoolDays = 0;
  let holidayOpenDays = 0;
  let holidayHours = 0;
  let holidayBaselineHours = 0;

  for (let d = start; d <= end; d = addDays(d, 1)) {
    days += 1;
    const date = iso(d);

    // School hours apply while schools are in session: before they close for the
    // summer, and again once they reopen. Blank dates mean normal hours all season.
    const inSchoolSession =
      (schoolCloses && d <= schoolCloses) || (schoolReopens && d >= schoolReopens);
    const seasonType = inSchoolSession ? 'okul' : 'normal';
    if (seasonType === 'okul') schoolDays += 1;
    else normalDays += 1;

    const weekdayRow = findRow(schedules, seasonType, DAY_KEYS[d.getUTCDay()]);
    const weekdayHours = rowHours(weekdayRow);

    const holiday = holidayByDate.get(date);
    let hours = weekdayHours;

    if (holiday && holiday.observed) {
      const holidayRow = findRow(schedules, seasonType, HOLIDAY_KEY);
      hours = rowHours(holidayRow);
      holiday.hours = hours;
      holiday.weekday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
        .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      holiday.replacesHours = weekdayHours;
      if (hours > 0) holidayOpenDays += 1;
      holidayHours += hours;
      holidayBaselineHours += weekdayHours;
    } else if (holiday) {
      holiday.hours = weekdayHours;
      holiday.weekday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
        .toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
      holiday.replacesHours = weekdayHours;
    }

    if (hours > 0) openDays += 1;
    openHours += hours;
  }

  const round1 = (n) => Math.round(n * 10) / 10;
  const round2 = (n) => Math.round(n * 100) / 100;

  const staffHours = round2(openHours * guards);
  const wholeWeeks = Math.floor(days / 7);
  const spareDays = days % 7;

  const warnings = [];
  if (!guards) warnings.push('No lifeguards entered, so staffed hours are zero.');
  if (!openDays) warnings.push('Every day of the season is closed in the operating schedule.');

  return {
    valid: true,
    days,
    weeks: round2(days / 7),
    weeksLabel: spareDays ? `${wholeWeeks} weeks ${spareDays} day${spareDays === 1 ? '' : 's'}` : `${wholeWeeks} weeks`,
    openDays,
    closedDays: days - openDays,
    openHours: round2(openHours),
    staffHours,
    avgWeeklyStaffHours: days ? round1((staffHours / days) * 7) : 0,
    avgDailyHoursPerGuard: openDays ? round1(openHours / openDays) : 0,
    normalDays,
    schoolDays,
    holidays: seasonHolidays,
    holidayOpenDays,
    holidayStaffHours: round2(holidayHours * guards),
    // What the holidays add on top of what the weekday schedule alone would give.
    // Negative means the pool runs shorter hours on holidays than on a normal day.
    holidayExtraStaffHours: round2((holidayHours - holidayBaselineHours) * guards),
    warnings,
  };
}
