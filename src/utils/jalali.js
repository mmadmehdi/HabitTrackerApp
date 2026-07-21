// src/utils/jalali.js
export function div(a, b) { return Math.floor(a / b); }
export function mod(a, b) { return a - div(a, b) * b; }
export function pad2(n) { return n < 10 ? '0' + n : '' + n; }
export function uid() {
  return 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

export function toPersianDigits(input) {
  const str = String(input);
  const map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  return str.replace(/[0-9]/g, (d) => map[d]);
}

export function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  gy -= gy <= 1600 ? 621 : 1600;
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    365 * gy +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) -
    80 +
    gd +
    g_d_m[gm - 1];
  jy += 33 * div(days, 12053);
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + div(days, 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + div(days - 186, 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function jalaliToGregorian(jy, jm, jd) {
  let gy = jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days =
    365 * jy +
    div(jy, 33) * 8 +
    div(mod(jy, 33) + 3, 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    days -= 1;
    gy += 100 * div(days, 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeapG = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const sal_a = [0, 31, isLeapG ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm;
  for (gm = 0; gm < 13; gm += 1) {
    const v = sal_a[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return [gy, gm, gd];
}

export function jalaliMonthLength(jy, jm) {
  const nextJy = jm === 12 ? jy + 1 : jy;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const [gy1, gm1, gd1] = jalaliToGregorian(jy, jm, 1);
  const [gy2, gm2, gd2] = jalaliToGregorian(nextJy, nextJm, 1);
  const d1 = Date.UTC(gy1, gm1 - 1, gd1);
  const d2 = Date.UTC(gy2, gm2 - 1, gd2);
  return Math.round((d2 - d1) / 86400000);
}

export function firstWeekdayOfJalaliMonth(jy, jm) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  return (jsDay + 1) % 7;
}

export function getTodayJalali() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function dateKey(jy, jm, jd) {
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

export function jalaliWeekdayIndex(jy, jm, jd) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  return (jsDay + 1) % 7;
}

export function isCategoryActiveOn(category, jy, jm, jd) {
  if (!category) return true;
  if (!Array.isArray(category.days) || category.days.length === 0) return true;
  return category.days.includes(jalaliWeekdayIndex(jy, jm, jd));
}

export function scheduledDaysSince(category, startDate) {
  if (!startDate || Number.isNaN(startDate.getTime())) return 1;
  if (!category || !Array.isArray(category.days) || category.days.length === 0) {
    const now = new Date();
    return Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())) /
        86400000
    ) + 1;
  }
  const now = new Date();
  let count = 0;
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  while (cursor.getTime() <= todayUtc) {
    const [jy, jm, jd] = gregorianToJalali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
    if (category.days.includes(jalaliWeekdayIndex(jy, jm, jd))) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export function countFailuresOnScheduledDays(history, category) {
  if (!history) return 0;
  let n = 0;
  Object.keys(history).forEach((key) => {
    if (history[key] !== 'fail') return;
    const parts = key.split('-');
    if (parts.length !== 3) return;
    const jy = parseInt(parts[0], 10);
    const jm = parseInt(parts[1], 10);
    const jd = parseInt(parts[2], 10);
    if (!Number.isFinite(jy) || !Number.isFinite(jm) || !Number.isFinite(jd)) return;
    if (isCategoryActiveOn(category, jy, jm, jd)) n += 1;
  });
  return n;
}

export function backfillMissedDays(list, categories) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let changed = false;

  const next = list.map((h) => {
    const created = new Date(h.createdAt);
    if (Number.isNaN(created.getTime())) return h;
    const history = { ...(h.history || {}) };
    const progress = h.progress || {};
    const goal = h.goal || 0;
    const categoryId = h.categoryId || 'daily';
    const category = categories.find((c) => c.id === categoryId);

    let cursor = new Date(created.getFullYear(), created.getMonth(), created.getDate());
    let guard = 0;
    while (cursor.getTime() < todayStart.getTime() && guard < 20000) {
      const [jy, jm, jd] = gregorianToJalali(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate());
      const key = dateKey(jy, jm, jd);

      if (isCategoryActiveOn(category, jy, jm, jd)) {
        const goalMet = goal > 0 && (progress[key] || 0) >= goal;
        if (!history[key] && !goalMet) {
          history[key] = 'fail';
          changed = true;
        }
      }

      cursor.setDate(cursor.getDate() + 1);
      guard += 1;
    }
    return changed ? { ...h, history } : h;
  });

  return { next, changed };
}
