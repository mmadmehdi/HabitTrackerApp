import React, { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  StatusBar,
  ActivityIndicator,
  Platform,
  BackHandler,
  KeyboardAvoidingView,
  AppState,
  Switch,
  Animated,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Application from 'expo-application';
import {
  Check,
  Plus,
  Settings,
  ArrowRight,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  X,
  Clock,
  Bell,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  Menu,
  Download,
  Upload,
  Package,
} from 'lucide-react-native';

/* ============================================================
   CONSTANTS & APPLE HIG DESIGN SYSTEM
   ============================================================ */

// DEVICE_LOCK_PLACEHOLDER — این خط را دستی ویرایش نکن؛ هر بار apply_*.sh
// اجرا می‌شود، محتوای allowed_devices.txt در همین‌جا جایگزین می‌شود.
const ALLOWED_DEVICE_IDS = ["8184d2c29f160340","5d93328f3e22b371","55ad5b6eb41c188b"];

const LICENSE_CONTACT_TELEGRAM = '@ImDivane';

const STORAGE_KEY = '@habit_tracker_data_v2';
const NOTIF_SETTINGS_KEY = '@habit_tracker_notif_settings_v1';
const NOTIF_CHANNEL_ID = 'habit_urgent_channel';
const TIMER_CHANNEL_ID = 'habit_timer_channel';
const PERSISTENT_CHANNEL_ID = 'habit_persistent_channel';
const NOTIF_BATCH_SIZE = 200;

const PERSISTENT_NOTIF_ID = 'habit_persistent_reminder';
const RANDOM_TIMER_CATEGORY_ID = 'habit_persistent_actions';
const RANDOM_TIMER_ACTION_ID = 'START_RANDOM_TIMER';
const RANDOM_TIMER_SECONDS = 30;
const RANDOM_TIMER_LIVE_CHANNEL_ID = 'habit_random_timer_live_channel';
const RANDOM_TIMER_LIVE_ID = 'habit_random_timer_live';

const DEFAULT_NOTIF_SETTINGS = { enabled: false, intervalMinutes: 30 };

const CATEGORIES_KEY = '@habit_tracker_categories_v1';
const DEFAULT_CATEGORY_ID = 'daily';
const DEFAULT_CATEGORIES = [{ id: DEFAULT_CATEGORY_ID, name: 'روزانه', days: null }];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    priority: Notifications.AndroidNotificationPriority.MAX,
  }),
});

/* ---------- Apple HIG Midnight Color Palette ---------- */
const COLORS = {
  bg: '#000000',                           // Pure iOS Pitch Black
  card: '#1C1C1E',                         // iOS Secondary System Background
  cardBorder: 'rgba(255, 255, 255, 0.08)',   // Ultra-fine stroke
  cardSurface: '#2C2C2E',                  // iOS Tertiary Background
  input: '#2C2C2E',                        // iOS Form Surface

  primary: '#0A84FF',                      // iOS System Electric Blue
  primarySoft: 'rgba(10, 132, 255, 0.15)',

  success: '#30D158',                      // iOS System Mint Green
  successSoft: 'rgba(48, 209, 88, 0.15)',
  successDeep: '#0D2D1B',
  errorDeep: '#3A0E0B',

  error: '#FF453A',                        // iOS System Coral Red
  errorSoft: 'rgba(255, 69, 58, 0.15)',

  today: '#FF9F0A',                        // iOS System Amber / Orange
  todaySoft: 'rgba(255, 159, 10, 0.15)',

  text: '#FFFFFF',                         // Primary Label
  subtext: 'rgba(235, 235, 245, 0.60)',    // Secondary Label
  dim: 'rgba(235, 235, 245, 0.30)',        // Tertiary Label

  overlay: 'rgba(0, 0, 0, 0.78)',          // Backdrop
};

const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const WEEKDAYS_FA_DISPLAY = [...WEEKDAYS_FA].reverse();
const WEEKDAYS_FULL_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

const BACKUP_FIELD_META = [
  { key: 'description', label: 'توضیحات' },
  { key: 'goal', label: 'هدف روزانه' },
  { key: 'timerSeconds', label: 'تایمر معکوس' },
  { key: 'category', label: 'بخش' },
  { key: 'history', label: 'تاریخچه انجام‌شدن/نشدن' },
  { key: 'progress', label: 'پیشرفت روزانه' },
  { key: 'createdAt', label: 'تاریخ ایجاد' },
];
const MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/* ============================================================
   JALALI & MATH HELPERS
   ============================================================ */

function div(a, b) { return Math.floor(a / b); }
function mod(a, b) { return a - div(a, b) * b; }
function pad2(n) { return n < 10 ? '0' + n : '' + n; }
function uid() {
  return 'h_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}
function toPersianDigits(input) {
  const str = String(input);
  const map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  return str.replace(/[0-9]/g, (d) => map[d]);
}

function formatTimerEnglish(totalSecs) {
  if (totalSecs == null || isNaN(totalSecs)) return '0s';
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  if (m > 0) {
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${totalSecs}s`;
}

function gregorianToJalali(gy, gm, gd) {
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

function jalaliToGregorian(jy, jm, jd) {
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

function jalaliMonthLength(jy, jm) {
  const nextJy = jm === 12 ? jy + 1 : jy;
  const nextJm = jm === 12 ? 1 : jm + 1;
  const [gy1, gm1, gd1] = jalaliToGregorian(jy, jm, 1);
  const [gy2, gm2, gd2] = jalaliToGregorian(nextJy, nextJm, 1);
  const d1 = Date.UTC(gy1, gm1 - 1, gd1);
  const d2 = Date.UTC(gy2, gm2 - 1, gd2);
  return Math.round((d2 - d1) / 86400000);
}

function firstWeekdayOfJalaliMonth(jy, jm) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  return (jsDay + 1) % 7;
}

function getTodayJalali() {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

function dateKey(jy, jm, jd) {
  return `${jy}-${pad2(jm)}-${pad2(jd)}`;
}

function jalaliWeekdayIndex(jy, jm, jd) {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const jsDay = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay();
  return (jsDay + 1) % 7;
}

function isCategoryActiveOn(category, jy, jm, jd) {
  if (!category) return true;
  if (!Array.isArray(category.days) || category.days.length === 0) return true;
  return category.days.includes(jalaliWeekdayIndex(jy, jm, jd));
}

function scheduledDaysSince(category, startDate) {
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

function formatScheduledDays(category) {
  if (!category || !Array.isArray(category.days) || category.days.length === 0) return 'همه روزها';
  if (category.days.length === 7) return 'همه روزها';
  return category.days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS_FULL_FA[d])
    .join('، ');
}

function countFailuresOnScheduledDays(history, category) {
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

function backfillMissedDays(list, categories) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let changed = false;

  const next = list.map((h) => {
    const created = new Date(h.createdAt);
    if (Number.isNaN(created.getTime())) return h;
    const history = { ...(h.history || {}) };
    const progress = h.progress || {};
    const goal = h.goal || 0;
    const categoryId = h.categoryId || DEFAULT_CATEGORY_ID;
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

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

async function configureNotificationChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NOTIF_CHANNEL_ID, {
    name: 'یادآور عادت‌ها',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: COLORS.today,
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  await Notifications.setNotificationChannelAsync(TIMER_CHANNEL_ID, {
    name: 'تایمر معکوس عادت‌ها',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF2D55',
    enableVibrate: true,
    enableLights: true,
    showBadge: true,
    sound: 'default',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
  });

  // کانال جدا برای نوتیفیکیشن دائمی (ongoing) — بدون صدا/لرزش تکراری،
  // چون هر بار محتوایش آپدیت می‌شود نه این‌که یک هشدار تازه باشد.
  await Notifications.setNotificationChannelAsync(PERSISTENT_CHANNEL_ID, {
    name: 'یادآور دائمی عادت‌ها',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
    showBadge: true,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // کانال جدا با اهمیت پایین برای نوتیف «تایمر رندوم شروع شد» — یک نوتیف
  // بی‌صدا و بدون هشدار (heads-up) که فقط یک بار همان لحظه‌ی زدن دکمه نمایش
  // داده می‌شود تا کاربر بفهمد دکمه کار کرده؛ در لحظه‌ی پایان از کانال
  // TIMER_CHANNEL_ID (فوری/پرصدا) استفاده می‌کنیم.
  await Notifications.setNotificationChannelAsync(RANDOM_TIMER_LIVE_CHANNEL_ID, {
    name: 'شروع تایمر عادت رندوم',
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    showBadge: false,
    sound: null,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  try {
    await Notifications.setNotificationCategoryAsync(RANDOM_TIMER_CATEGORY_ID, [
      {
        identifier: RANDOM_TIMER_ACTION_ID,
        buttonTitle: 'تایمر عادت رندوم',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn('Failed to register notification category', e);
  }
}

function getIncompleteHabitTitles(habits, categories, todayKey) {
  const parts = todayKey.split('-');
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  return habits
    // "ناتمام" یعنی هنوز هیچ تصمیمی (نه موفقیت، نه شکست) براش ثبت نشده —
    // اگه قبلاً شکست خورده، دیگه لازم نیست دوباره یادآوری بشه.
    .filter((h) => {
      const status = (h.history || {})[todayKey];
      return status !== 'success' && status !== 'fail';
    })
    .filter((h) => {
      const catId = h.categoryId || DEFAULT_CATEGORY_ID;
      const cat = categories.find((c) => c.id === catId);
      return isCategoryActiveOn(cat, jy, jm, jd);
    })
    .map((h) => h.title);
}

function buildReminderBody(incomplete) {
  return incomplete.length === 1
    ? `هنوز عادت «${incomplete[0]}» را امروز انجام نداده‌اید.`
    : `هنوز این عادت‌ها را امروز انجام نداده‌اید: ${incomplete.join('، ')}`;
}

async function scheduleHabitReminder(habits, categories, settings) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {}

  if (!settings || !settings.enabled) return;

  const [jy, jm, jd] = getTodayJalali();
  const todayKey = dateKey(jy, jm, jd);
  const incomplete = getIncompleteHabitTitles(habits, categories, todayKey);
  if (incomplete.length === 0) return;

  const body = buildReminderBody(incomplete);
  const seconds = Math.max(60, Math.round((settings.intervalMinutes || 30) * 60));

  try {
    for (let i = 1; i <= NOTIF_BATCH_SIZE; i += 1) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ یادآور عادت‌ها',
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          android: { channelId: NOTIF_CHANNEL_ID },
        },
        trigger: { type: 'timeInterval', seconds: seconds * i, repeats: false },
      });
    }
  } catch (e) {
    console.warn('Failed to schedule habit reminders', e);
  }
}

async function sendTestHabitNotification(habits, categories) {
  const [jy, jm, jd] = getTodayJalali();
  const todayKey = dateKey(jy, jm, jd);
  const incomplete = getIncompleteHabitTitles(habits, categories, todayKey);
  const body =
    incomplete.length > 0 ? buildReminderBody(incomplete) : 'همه‌ی عادت‌های امروز انجام شده‌اند 🎉';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 تست یادآور',
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      android: { channelId: NOTIF_CHANNEL_ID },
    },
    trigger: null,
  });
}

// نوتیفیکیشن دائمی (ongoing): با sticky + autoDismiss:false، هم با لمس و هم
// با کشیدن (swipe) پاک نمی‌شود — فقط با غیرفعال کردن نوتیفیکیشن‌های برنامه
// از تنظیمات گوشی از بین می‌رود. هر بار که لیست عادت‌ها/دسته‌بندی‌ها تغییر
// کند، همین نوتیفیکیشن (با همان identifier) با محتوای تازه جایگزین می‌شود.
async function presentPersistentReminder(habits, categories) {
  try {
    const [jy, jm, jd] = getTodayJalali();
    const todayKey = dateKey(jy, jm, jd);
    const incomplete = getIncompleteHabitTitles(habits, categories, todayKey);
    const body =
      incomplete.length > 0
        ? buildReminderBody(incomplete)
        : 'همه‌ی عادت‌های امروز انجام شده‌اند 🎉';

    await Notifications.scheduleNotificationAsync({
      identifier: PERSISTENT_NOTIF_ID,
      content: {
        title: '📌 یادآور دائمی عادت‌ها',
        body,
        sticky: true,
        autoDismiss: false,
        sound: false,
        categoryIdentifier: RANDOM_TIMER_CATEGORY_ID,
        android: { channelId: PERSISTENT_CHANNEL_ID },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to present persistent reminder', e);
  }
}

// وقتی دکمه‌ی «تایمر عادت رندوم» روی نوتیفیکیشن دائمی زده می‌شود: یکی از
// عادت‌های هنوز انجام‌نشده‌ی امروز به‌صورت رندوم انتخاب می‌شود، بلافاصله یک
// نوتیف بی‌صدای «تایمر شروع شد» نمایش داده می‌شود (نشانه‌ای که کاربر بفهمد
// دکمه کار کرده) و ۳۰ ثانیه بعد نوتیف فوری (urgent) «پایان تایمر» می‌رسد.
//
// نکته‌ی مهم طراحی: دیگر هیچ شمارش معکوس زنده‌ای در جاوااسکریپت وجود ندارد.
// نسخه‌ی قبلی نوتیف را هر ۵ ثانیه آپدیت می‌کرد، ولی وقتی برنامه در پس‌زمینه
// بود اندروید جاوااسکریپت را فریز می‌کرد؛ بعداً با باز شدن برنامه همان
// شمارنده‌ی فریزشده بیدار می‌شد، از همان‌جا ادامه می‌داد و یک «پایان تایمر»
// تکراری هم می‌فرستاد. در طراحی جدید:
//   - نوتیف شروع فقط یک بار، همان لحظه، نمایش داده می‌شود و دیگر آپدیت نمی‌شود.
//   - نوتیف پایان را خودِ سیستم‌عامل (نه جاوااسکریپت) سر ۳۰ ثانیه ارسال
//     می‌کند؛ پس حتی اگر برنامه بسته/کشته شده باشد هم دقیقاً یک بار می‌رسد و
//     هیچ نسخه‌ی تکراری‌ای وجود ندارد.
//   - هر دو نوتیف از یک identifier مشترک استفاده می‌کنند، بنابراین نوتیف
//     پایان به‌طور خودکار (توسط خود اندروید، بدون نیاز به اجرای جاوااسکریپت)
//     جایگزین نوتیف شروع می‌شود.
async function scheduleRandomHabitTimer(habits, categories) {
  const [jy, jm, jd] = getTodayJalali();
  const todayKey = dateKey(jy, jm, jd);
  const incompleteHabits = habits.filter((h) => {
    const status = (h.history || {})[todayKey];
    if (status === 'success' || status === 'fail') return false;
    const catId = h.categoryId || DEFAULT_CATEGORY_ID;
    const cat = categories.find((c) => c.id === catId);
    return isCategoryActiveOn(cat, jy, jm, jd);
  });

  if (incompleteHabits.length === 0) return;

  const randomHabit = incompleteHabits[Math.floor(Math.random() * incompleteHabits.length)];

  try {
    await Notifications.requestPermissionsAsync();
  } catch (e) {}

  // اگر تایمر رندوم قبلی هنوز به پایان نرسیده، نوتیف پایانِ زمان‌بندی‌شده‌اش
  // را لغو می‌کنیم و از نو (با عادت تازه‌ی انتخاب‌شده) شروع می‌کنیم — تا دو
  // نوتیف پایان پشت سر هم نیاید.
  try {
    await Notifications.cancelScheduledNotificationAsync(RANDOM_TIMER_LIVE_ID);
  } catch (e) {}

  // نوتیف پایان — با trigger واقعی سیستم‌عامل (نه تایمر جاوااسکریپت) زمان‌بندی
  // می‌شود، پس دقیقاً ۳۰ ثانیه بعد می‌رسد؛ حتی اگر برنامه در همین حین به
  // پس‌زمینه برود یا کامل کشته شود.
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: RANDOM_TIMER_LIVE_ID,
      content: {
        title: '⏱️ پایان تایمر عادت',
        body: `تایمر ${randomHabit.title} تموم شد، برو انجامش بده`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        android: { channelId: TIMER_CHANNEL_ID },
      },
      trigger: { type: 'timeInterval', seconds: RANDOM_TIMER_SECONDS, repeats: false },
    });
  } catch (e) {
    console.warn('Failed to schedule timer-finished notification', e);
  }

  // نوتیف بی‌صدای «تایمر شروع شد» — همان نشانه‌ای که لازم است تا کاربر مطمئن
  // شود دکمه کار کرده. فقط یک بار نمایش داده می‌شود و هرگز آپدیت نمی‌شود؛
  // ۳۰ ثانیه بعد نوتیف پایان (با همان identifier) خودبه‌خود جایگزینش می‌شود.
  // کاربر هم هر وقت بخواهد می‌تواند با لمس/کشیدن پاکش کند.
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: RANDOM_TIMER_LIVE_ID,
      content: {
        title: '⏱️ تایمر عادت رندوم شروع شد',
        body: `${randomHabit.title} — تا ${toPersianDigits(RANDOM_TIMER_SECONDS)} ثانیه دیگه نوتیف پایان میاد`,
        sound: false,
        android: { channelId: RANDOM_TIMER_LIVE_CHANNEL_ID },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('Failed to present timer-started notification', e);
  }
}

/* ============================================================
   APPLE TACTILE MICRO-INTERACTION COMPONENTS
   ============================================================ */

const AnimatedPressable = memo(function AnimatedPressable({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  scaleTo = 0.96,
  hitSlop,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      stiffness: 450,
      damping: 28,
      mass: 0.8,
    }).start();
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 450,
      damping: 28,
      mass: 0.8,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </TouchableOpacity>
  );
});

const StatBox = memo(function StatBox({ value, numerator, denominator, label, color, softColor }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statIconDot, { backgroundColor: softColor || COLORS.primarySoft }]}>
        <View style={[styles.statIconDotInner, { backgroundColor: color || COLORS.primary }]} />
      </View>
      {numerator != null ? (
        <Text style={styles.statValue}>
          <Text style={{ color: color || COLORS.text }}>{toPersianDigits(numerator)}</Text>
          <Text style={{ color: COLORS.dim }}> / </Text>
          <Text style={{ color: COLORS.text }}>{toPersianDigits(denominator)}</Text>
        </Text>
      ) : (
        <Text style={[styles.statValue, { color: color || COLORS.text }]}>
          {toPersianDigits(value)}
        </Text>
      )}
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

const ScheduleChip = memo(function ScheduleChip({ category }) {
  if (!category) return null;
  return (
    <View style={styles.scheduleChip}>
      <Text style={styles.scheduleChipText}>
        روزهای فعال: {formatScheduledDays(category)}
      </Text>
    </View>
  );
});

/* ============================================================
   DETAIL SCREEN (APPLE NATIVE DESIGN WITH LUCIDE)
   ============================================================ */

const DayCell = memo(function DayCell({ day, dayKey, isToday, status, dayIsScheduled, onLongPressDay }) {
  if (day === null) {
    return <View style={styles.dayCell} />;
  }
  return (
    <TouchableOpacity
      style={styles.dayCell}
      activeOpacity={0.6}
      delayLongPress={450}
      onLongPress={() => onLongPressDay(dayKey, dayIsScheduled)}
    >
      <View
        style={[
          styles.dayCircle,
          isToday && styles.dayCircleToday,
          status === 'success' && styles.dayCircleSuccess,
          status === 'fail' && dayIsScheduled && styles.dayCircleFail,
        ]}
      >
        <Text
          style={[
            styles.dayNumber,
            isToday && styles.dayNumberToday,
            (status === 'success' || (status === 'fail' && dayIsScheduled)) && styles.dayNumberMarked,
          ]}
        >
          {toPersianDigits(day)}
        </Text>
        {status === 'success' && (
          <Check size={11} color={COLORS.success} strokeWidth={3} style={{ marginTop: -2 }} />
        )}
        {status === 'fail' && dayIsScheduled && (
          <X size={11} color={COLORS.error} strokeWidth={3} style={{ marginTop: -2 }} />
        )}
      </View>
    </TouchableOpacity>
  );
});

const HabitDetailScreen = memo(function HabitDetailScreen({
  habit,
  categories,
  onBack,
  onDelete,
  onSetStatus,
  onClearStatus,
  onBumpProgress,
  onEdit,
  activeTimers,
  onToggleTimer,
  nowTick,
}) {
  const insets = useSafeAreaInsets();
  const [view, setView] = useState(() => {
    const [jy, jm] = getTodayJalali();
    return { jy, jm };
  });
  const [dayMenu, setDayMenu] = useState({ visible: false, key: null, dayIsScheduled: true });

  useEffect(() => {
    const onHardwareBack = () => {
      onBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onBack]);

  const todayJalali = getTodayJalali();
  const todayKey = dateKey(todayJalali[0], todayJalali[1], todayJalali[2]);
  const history = habit.history || {};

  const category = useMemo(
    () => categories.find((c) => c.id === (habit.categoryId || DEFAULT_CATEGORY_ID)),
    [categories, habit.categoryId]
  );
  const hasDayRestriction = !!(category && Array.isArray(category.days) && category.days.length > 0 && category.days.length < 7);
  const todayIsScheduled = isCategoryActiveOn(category, todayJalali[0], todayJalali[1], todayJalali[2]);

  const totalSuccess = useMemo(
    () => Object.values(history).filter((v) => v === 'success').length,
    [history]
  );
  const totalFail = useMemo(
    () => countFailuresOnScheduledDays(history, category),
    [history, category]
  );

  const daysElapsed = useMemo(() => {
    const created = new Date(habit.createdAt);
    return Math.max(1, scheduledDaysSince(category, created));
  }, [habit.createdAt, category]);

  const weekRows = useMemo(() => {
    const monthLength = jalaliMonthLength(view.jy, view.jm);
    const startWeekday = firstWeekdayOfJalaliMonth(view.jy, view.jm);

    const cells = [];
    for (let i = 0; i < startWeekday; i += 1) cells.push(null);
    for (let d = 1; d <= monthLength; d += 1) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7).reverse());
    }
    return rows;
  }, [view.jy, view.jm]);

  const goPrevMonth = useCallback(() => {
    setView((v) => {
      if (v.jm === 1) return { jy: v.jy - 1, jm: 12 };
      return { jy: v.jy, jm: v.jm - 1 };
    });
  }, []);
  const goNextMonth = useCallback(() => {
    setView((v) => {
      if (v.jm === 12) return { jy: v.jy + 1, jm: 1 };
      return { jy: v.jy, jm: v.jm + 1 };
    });
  }, []);

  const handleMark = useCallback(
    (status) => {
      onSetStatus(habit.id, todayKey, status);
    },
    [onSetStatus, habit.id, todayKey]
  );

  const handleDayLongPress = useCallback(
    (key, dayIsScheduled) => {
      if (key > todayKey) return;
      setDayMenu({ visible: true, key, dayIsScheduled });
    },
    [todayKey]
  );

  const closeDayMenu = useCallback(() => {
    setDayMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  const confirmDelete = useCallback(() => {
    Alert.alert(
      'حذف عادت',
      `آیا از حذف کامل عادت «${habit.title}» مطمئن هستید؟ این کار قابل بازگشت نیست.`,
      [
        { text: 'انصراف', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => onDelete(habit.id),
        },
      ]
    );
  }, [habit.id, habit.title, onDelete]);

  const handleDayMenuSuccess = useCallback(() => {
    onSetStatus(habit.id, dayMenu.key, 'success');
    closeDayMenu();
  }, [onSetStatus, habit.id, dayMenu.key, closeDayMenu]);

  const handleDayMenuFail = useCallback(() => {
    onSetStatus(habit.id, dayMenu.key, 'fail');
    closeDayMenu();
  }, [onSetStatus, habit.id, dayMenu.key, closeDayMenu]);

  const handleDayMenuClear = useCallback(() => {
    onClearStatus(habit.id, dayMenu.key);
    closeDayMenu();
  }, [onClearStatus, habit.id, dayMenu.key, closeDayMenu]);

  const handleMarkSuccess = useCallback(() => handleMark('success'), [handleMark]);
  const handleMarkFail = useCallback(() => handleMark('fail'), [handleMark]);

  const todayStatus = history[todayKey];
  const todayProgress = (habit.progress && habit.progress[todayKey]) || 0;
  const remaining = habit.goal > 0 ? Math.max(0, habit.goal - todayProgress) : 0;

  const timerInfo = activeTimers ? activeTimers[habit.id] : null;
  const remainingSecs = timerInfo
    ? Math.max(0, Math.ceil((timerInfo.endTime - nowTick) / 1000))
    : null;

  const successLabel = hasDayRestriction ? 'موفقیت در روزهای فعال' : 'کل موفقیت‌ها';
  const failLabel = hasDayRestriction ? 'شکست در روزهای فعال' : 'کل شکست‌ها';
  const createdLabel = hasDayRestriction ? 'روزهای برنامه‌ریزی' : 'روزهای سپری شده';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <ArrowRight size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.detailHeaderTextWrap}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center' }}>
            <Text style={styles.detailTitle} numberOfLines={1}>
              {habit.title}
            </Text>
            {!!habit.timerSeconds && habit.timerSeconds > 0 && (
              <TouchableOpacity
                style={[styles.timerBadge, timerInfo && styles.timerBadgeActive]}
                activeOpacity={0.7}
                onPress={() => onToggleTimer(habit)}
              >
                <Clock size={13} color={timerInfo ? '#FFFFFF' : COLORS.primary} style={{ marginLeft: 4 }} />
                <Text style={[styles.timerBadgeText, timerInfo && styles.timerBadgeTextActive]}>
                  {timerInfo ? formatTimerEnglish(remainingSecs) : formatTimerEnglish(habit.timerSeconds)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.detailSubtitle}>
            {toPersianDigits(todayJalali[2])} {MONTHS_FA[todayJalali[1] - 1]} {toPersianDigits(todayJalali[0])}
          </Text>
        </View>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={styles.editBtn}>
          <Edit3 size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {hasDayRestriction && (
          <View style={styles.scheduleChipRow}>
            <ScheduleChip category={category} />
          </View>
        )}

        <View style={styles.statsRow}>
          <StatBox
            numerator={totalSuccess}
            denominator={daysElapsed}
            label={successLabel}
            color={COLORS.success}
            softColor={COLORS.successSoft}
          />
          <StatBox
            numerator={totalFail}
            denominator={daysElapsed}
            label={failLabel}
            color={COLORS.error}
            softColor={COLORS.errorSoft}
          />
          <StatBox
            value={daysElapsed}
            label={createdLabel}
            color={COLORS.primary}
            softColor={COLORS.primarySoft}
          />
        </View>

        <View style={styles.calendarCard}>
          <View style={styles.calendarNavRow}>
            <TouchableOpacity onPress={goNextMonth} activeOpacity={0.7} style={styles.calendarNavBtn}>
              <ChevronRight size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthLabel}>
              {MONTHS_FA[view.jm - 1]} {toPersianDigits(view.jy)}
            </Text>
            <TouchableOpacity onPress={goPrevMonth} activeOpacity={0.7} style={styles.calendarNavBtn}>
              <ChevronLeft size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS_FA_DISPLAY.map((w, idx) => (
              <View key={idx} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{w}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {weekRows.map((row, rIdx) => (
              <View key={rIdx} style={styles.calendarWeekRow}>
                {row.map((day, cIdx) => {
                  if (day === null) {
                    return <DayCell key={cIdx} day={null} />;
                  }
                  const key = dateKey(view.jy, view.jm, day);
                  const isToday =
                    view.jy === todayJalali[0] &&
                    view.jm === todayJalali[1] &&
                    day === todayJalali[2];
                  const status = history[key];
                  const dayIsScheduled = isCategoryActiveOn(category, view.jy, view.jm, day);
                  return (
                    <DayCell
                      key={cIdx}
                      day={day}
                      dayKey={key}
                      isToday={isToday}
                      status={status}
                      dayIsScheduled={dayIsScheduled}
                      onLongPressDay={handleDayLongPress}
                    />
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {!!habit.description && (
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionLabel}>توضیحات</Text>
            <Text style={styles.descriptionText}>{habit.description}</Text>
          </View>
        )}

        {!!habit.goal && habit.goal > 0 && (
          <View style={styles.goalCard}>
            <View style={styles.goalHeaderRow}>
              <Text style={styles.goalTitle}>هدف روزانه</Text>
              <View style={styles.goalChip}>
                <Text style={styles.goalChipText}>
                  {remaining > 0
                    ? `${toPersianDigits(remaining)} بار مانده`
                    : 'کامل شد 🎉'}
                </Text>
              </View>
            </View>

            <View style={styles.goalProgressTrack}>
              <View
                style={[
                  styles.goalProgressFill,
                  {
                    width: `${Math.min(100, (todayProgress / habit.goal) * 100)}%`,
                    backgroundColor: remaining > 0 ? COLORS.primary : COLORS.success,
                  },
                ]}
              />
            </View>

            <View style={styles.goalRow}>
              <TouchableOpacity
                style={[styles.goalStepBtn, styles.goalStepBtnPlus]}
                activeOpacity={0.7}
                onPress={() => onBumpProgress(habit.id, todayKey, 1, habit.goal)}
              >
                <Plus size={20} color={COLORS.primary} strokeWidth={2.5} />
              </TouchableOpacity>

              <View style={styles.goalCenter}>
                <Text style={styles.goalCount}>
                  {toPersianDigits(todayProgress)}
                  <Text style={styles.goalCountDivider}> / </Text>
                  {toPersianDigits(habit.goal)}
                </Text>
                <Text style={styles.goalRemaining}>
                  {remaining > 0
                    ? `${toPersianDigits(remaining)} بار تا تکمیل هدف`
                    : 'هدف امروز تکمیل شد 🎉'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.goalStepBtn}
                activeOpacity={0.7}
                onPress={() => onBumpProgress(habit.id, todayKey, -1, habit.goal)}
              >
                <Text style={styles.goalStepBtnText}>−</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.actionCard}>
          <Text style={styles.actionQuestion}>
            آیا امروز عادت «{habit.title}» را انجام دادید؟
          </Text>
          {hasDayRestriction && !todayIsScheduled && (
            <Text style={styles.actionHintText}>
              این عادت برای امروز برنامه‌ریزی نشده است.
            </Text>
          )}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              activeOpacity={0.7}
              style={[
                styles.actionButton,
                styles.actionButtonYes,
                todayStatus === 'success' && styles.actionButtonYesActive,
              ]}
              onPress={handleMarkSuccess}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  styles.actionButtonYesText,
                  todayStatus === 'success' && styles.actionButtonTextActive,
                ]}
              >
                ✓ بله
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={hasDayRestriction && !todayIsScheduled ? 0.4 : 0.7}
              style={[
                styles.actionButton,
                styles.actionButtonNo,
                todayStatus === 'fail' && styles.actionButtonNoActive,
                hasDayRestriction && !todayIsScheduled && styles.actionButtonDisabled,
              ]}
              onPress={handleMarkFail}
              disabled={hasDayRestriction && !todayIsScheduled}
            >
              <Text
                style={[
                  styles.actionButtonText,
                  styles.actionButtonNoText,
                  todayStatus === 'fail' && styles.actionButtonTextActive,
                ]}
              >
                ✕ خیر
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.7} onPress={confirmDelete}>
          <Trash2 size={18} color={COLORS.error} style={{ marginLeft: 8 }} />
          <Text style={styles.deleteBtnText}>حذف کامل این عادت</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* iOS Action Sheet Style Day Menu */}
      <Modal
        visible={dayMenu.visible}
        animationType="fade"
        transparent
        onRequestClose={closeDayMenu}
      >
        <TouchableOpacity
          style={styles.dayMenuOverlay}
          activeOpacity={1}
          onPress={closeDayMenu}
        >
          <View style={styles.dayMenuCard}>
            <Text style={styles.dayMenuTitle}>ویرایش وضعیت روز</Text>

            <TouchableOpacity
              style={[styles.dayMenuOption, styles.dayMenuOptionSuccess]}
              activeOpacity={0.7}
              onPress={handleDayMenuSuccess}
            >
              <Text style={styles.dayMenuOptionSuccessText}>✓ ثبت موفقیت</Text>
            </TouchableOpacity>

            {dayMenu.dayIsScheduled && (
              <TouchableOpacity
                style={[styles.dayMenuOption, styles.dayMenuOptionFail]}
                activeOpacity={0.7}
                onPress={handleDayMenuFail}
              >
                <Text style={styles.dayMenuOptionFailText}>✕ ثبت شکست</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.dayMenuOption}
              activeOpacity={0.7}
              onPress={handleDayMenuClear}
            >
              <Text style={styles.dayMenuOptionText}>پاک کردن وضعیت</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dayMenuOption, styles.dayMenuOptionCancel]}
              activeOpacity={0.7}
              onPress={closeDayMenu}
            >
              <Text style={styles.dayMenuOptionCancelText}>انصراف</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

/* ============================================================
   HOME SCREEN (APPLE INSET GROUPED STYLE WITH LUCIDE ICONS)
   ============================================================ */

const HabitCard = memo(function HabitCard({
  habit,
  categories,
  onOpenHabit,
  onEditHabit,
  onLongPress,
  reorderMode,
  onMoveHabit,
  isFirst,
  isLast,
  isCompletedToday,
  todayKey,
  onIncrementGoal,
  onSetStatus,
  activeTimers,
  onToggleTimer,
  nowTick,
}) {
  const history = habit.history || {};
  const category = useMemo(
    () => categories.find((c) => c.id === (habit.categoryId || DEFAULT_CATEGORY_ID)),
    [categories, habit.categoryId]
  );
  const successCount = useMemo(
    () => Object.values(history).filter((v) => v === 'success').length,
    [history]
  );
  const failCount = useMemo(
    () => countFailuresOnScheduledDays(history, category),
    [history, category]
  );
  const hasGoal = !!habit.goal && habit.goal > 0;
  const todayProgress = hasGoal ? (habit.progress && habit.progress[todayKey]) || 0 : 0;
  const todayIsScheduled = useMemo(() => {
    const [todayJy, todayJm, todayJd] = getTodayJalali();
    return isCategoryActiveOn(category, todayJy, todayJm, todayJd);
  }, [category]);
  const todayStatus = history[todayKey];

  const timerInfo = activeTimers ? activeTimers[habit.id] : null;
  const remainingSecs = timerInfo
    ? Math.max(0, Math.ceil((timerInfo.endTime - nowTick) / 1000))
    : null;

  const handlePress = useCallback(() => onOpenHabit(habit.id), [onOpenHabit, habit.id]);
  const handleEdit = useCallback(() => onEditHabit(habit), [onEditHabit, habit]);
  const handleMoveDown = useCallback(() => onMoveHabit(habit.id, 1), [onMoveHabit, habit.id]);
  const handleMoveUp = useCallback(() => onMoveHabit(habit.id, -1), [onMoveHabit, habit.id]);
  const handleIncrementGoal = useCallback(
    () => onIncrementGoal(habit.id, todayKey, habit.goal),
    [onIncrementGoal, habit.id, todayKey, habit.goal]
  );
  const handleSetSuccess = useCallback(
    () => onSetStatus(habit.id, todayKey, 'success'),
    [onSetStatus, habit.id, todayKey]
  );
  const handleSetFail = useCallback(
    () => onSetStatus(habit.id, todayKey, 'fail'),
    [onSetStatus, habit.id, todayKey]
  );

  return (
    <AnimatedPressable
      style={[
        styles.habitCard,
        isCompletedToday && styles.habitCardCompleted,
        !isCompletedToday && todayStatus === 'fail' && styles.habitCardFailed,
      ]}
      scaleTo={0.97}
      onPress={reorderMode ? undefined : handlePress}
      onLongPress={onLongPress}
      delayLongPress={450}
    >
      <View style={styles.habitCardTop}>
        <View style={styles.habitTitleWrap}>
          <Text style={styles.habitTitle} numberOfLines={1}>
            {habit.title}
          </Text>

          {!!habit.timerSeconds && habit.timerSeconds > 0 && !reorderMode && (
            <TouchableOpacity
              style={[styles.timerBadge, timerInfo && styles.timerBadgeActive]}
              activeOpacity={0.7}
              onPress={() => onToggleTimer(habit)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Clock size={13} color={timerInfo ? '#FFFFFF' : COLORS.primary} style={{ marginLeft: 4 }} />
              <Text style={[styles.timerBadgeText, timerInfo && styles.timerBadgeTextActive]}>
                {timerInfo ? formatTimerEnglish(remainingSecs) : formatTimerEnglish(habit.timerSeconds)}
              </Text>
            </TouchableOpacity>
          )}

          {hasGoal && !reorderMode && (
            <TouchableOpacity
              style={styles.goalProgressBadge}
              activeOpacity={0.6}
              onPress={handleIncrementGoal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.goalProgressBadgeText}>
                {toPersianDigits(todayProgress)}
                <Text style={styles.goalProgressBadgeDivider}> / </Text>
                {toPersianDigits(habit.goal)}
              </Text>
            </TouchableOpacity>
          )}
          {isCompletedToday && !reorderMode && (
            <View style={styles.completedBadge}>
              <Check size={12} color={COLORS.success} strokeWidth={3} />
              <Text style={styles.completedBadgeText}>تکمیل شد</Text>
            </View>
          )}
        </View>
        {!reorderMode && (
          <TouchableOpacity
            onPress={handleEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cardEditBtn}
          >
            <Edit3 size={15} color={COLORS.subtext} />
          </TouchableOpacity>
        )}
      </View>

      {!!habit.description && !reorderMode && (
        <Text style={styles.habitDescription} numberOfLines={2}>
          {habit.description}
        </Text>
      )}

      {reorderMode ? (
        <View style={styles.reorderRow}>
          <TouchableOpacity
            style={[styles.reorderBtn, isLast && styles.reorderBtnDisabled]}
            disabled={isLast}
            onPress={handleMoveDown}
          >
            <ChevronDown size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.reorderHint}>جابه‌جایی موقعیت</Text>
          <TouchableOpacity
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            onPress={handleMoveUp}
          >
            <ChevronUp size={20} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.habitCounterRow}>
          <AnimatedPressable
            style={[
              styles.habitCounterChip,
              { backgroundColor: COLORS.successSoft },
              todayStatus === 'success' && styles.habitCounterChipActiveSuccess,
            ]}
            onPress={handleSetSuccess}
          >
            <Text
              style={[
                styles.habitCounterValue,
                { color: COLORS.success },
                todayStatus === 'success' && styles.habitCounterValueActive,
              ]}
            >
              {toPersianDigits(successCount)}
            </Text>
            <Text
              style={[
                styles.habitCounterLabel,
                todayStatus === 'success' && styles.habitCounterLabelActive,
              ]}
            >
              موفقیت
            </Text>
          </AnimatedPressable>
          <AnimatedPressable
            disabled={!todayIsScheduled}
            style={[
              styles.habitCounterChip,
              { backgroundColor: COLORS.errorSoft },
              todayStatus === 'fail' && styles.habitCounterChipActiveFail,
              !todayIsScheduled && styles.habitCounterChipDisabled,
            ]}
            onPress={handleSetFail}
          >
            <Text
              style={[
                styles.habitCounterValue,
                { color: COLORS.error },
                todayStatus === 'fail' && styles.habitCounterValueActive,
              ]}
            >
              {toPersianDigits(failCount)}
            </Text>
            <Text
              style={[
                styles.habitCounterLabel,
                todayStatus === 'fail' && styles.habitCounterLabelActive,
              ]}
            >
              شکست
            </Text>
          </AnimatedPressable>
        </View>
      )}
    </AnimatedPressable>
  );
});

/* ============================================================
   DRAG-AND-DROP REORDER LIST (habit cards)
   بدون هیچ کتابخانه‌ی خارجی — فقط PanResponder + Animated بومی خود
   react-native. برای این‌که ریاضیِ جابه‌جایی ساده و قابل‌اعتماد بمونه، حین
   کشیدن، هر ردیف با یه ارتفاع ثابت (REORDER_ROW_HEIGHT) نمایش داده می‌شه
   (نه کارت کامل با توضیحات/نشان‌های متغیرالارتفاع).
   ============================================================ */

const REORDER_ROW_HEIGHT = 60;

const DraggableReorderRow = memo(function DraggableReorderRow({
  habit,
  shift,
  isDragged,
  dragY,
  panHandlers,
}) {
  const offset = useRef(new Animated.Value(shift * REORDER_ROW_HEIGHT)).current;

  useEffect(() => {
    if (isDragged) return; // ردیفِ در حال کشیدن با dragY کنترل می‌شه، نه offset
    Animated.spring(offset, {
      toValue: shift * REORDER_ROW_HEIGHT,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  }, [shift, isDragged, offset]);

  const translateY = isDragged ? dragY : offset;

  return (
    <Animated.View
      style={[
        styles.reorderDragRow,
        isDragged && styles.reorderDragRowActive,
        { transform: [{ translateY }], zIndex: isDragged ? 10 : 1, elevation: isDragged ? 10 : 1 },
      ]}
    >
      <Text style={styles.reorderDragRowTitle} numberOfLines={1}>
        {habit.title}
      </Text>
      <View style={styles.reorderDragHandle} {...panHandlers}>
        <Menu size={20} color={COLORS.subtext} />
      </View>
    </Animated.View>
  );
});

function ReorderableHabitList({ habitIds, habitsById, onReorderEnd, onDragActiveChange }) {
  const [order, setOrder] = useState(habitIds);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const startIndexRef = useRef(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  const dropIndexRef = useRef(null);
  dropIndexRef.current = dropIndex;

  // اگر لیست عادت‌های واقعی از بیرون تغییر کرد (مثلاً حذف/اضافه شدن عادت)
  // و در همون لحظه در حال کشیدن نیستیم، ترتیب محلی رو با واقعیت هماهنگ کن.
  useEffect(() => {
    if (draggedIndex === null) setOrder(habitIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitIds]);

  const finalizeDrop = useCallback(() => {
    const from = startIndexRef.current;
    const to = dropIndexRef.current;
    if (from !== null && to !== null && from !== to) {
      setOrder((prevOrder) => {
        const next = [...prevOrder];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        onReorderEnd(next);
        return next;
      });
    }
    dragY.setValue(0);
    setDraggedIndex(null);
    setDropIndex(null);
    startIndexRef.current = null;
    if (onDragActiveChange) onDragActiveChange(false);
  }, [onReorderEnd, dragY, onDragActiveChange]);

  // finalizeDrop از طریق ref صدا زده می‌شه تا خودِ PanResponder هیچ‌وقت لازم
  // نباشه دوباره ساخته بشه (وگرنه وسط کشیدن، هر بار dropIndex عوض می‌شد،
  // finalizeDrop رفرنس جدید می‌گرفت و PanResponder وسط ژست از نو ساخته
  // می‌شد — که دقیقاً همون چیزی بود که باعث می‌شد کشیدن گاهی اصلاً جواب
  // نده یا نصفه‌ونیمه کار کنه).
  const finalizeDropRef = useRef(finalizeDrop);
  finalizeDropRef.current = finalizeDrop;

  // یک PanResponder واحد و پایدار به‌ازای هر ایندکس — فقط یک‌بار ساخته
  // می‌شه و تا وسط یک کشیدن هرگز عوض نمی‌شه.
  const respondersRef = useRef(new Map());

  const getPanResponderForIndex = useCallback(
    (idx) => {
      if (!respondersRef.current.has(idx)) {
        respondersRef.current.set(
          idx,
          PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onStartShouldSetPanResponderCapture: () => true,
            onMoveShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponderCapture: () => true,
            onPanResponderGrant: () => {
              startIndexRef.current = idx;
              setDraggedIndex(idx);
              setDropIndex(idx);
              dragY.setValue(0);
              if (onDragActiveChange) onDragActiveChange(true);
            },
            onPanResponderMove: Animated.event([null, { dy: dragY }], {
              useNativeDriver: false,
              listener: (evt, gesture) => {
                if (startIndexRef.current === null) return;
                const rawIndex = startIndexRef.current + gesture.dy / REORDER_ROW_HEIGHT;
                const clamped = Math.max(0, Math.min(orderRef.current.length - 1, Math.round(rawIndex)));
                setDropIndex((prev) => (prev === clamped ? prev : clamped));
              },
            }),
            // این دو تا کلیدی‌ترین بخش رفع باگ هستن: بدون این‌ها، ScrollView
            // والد به‌محض این‌که انگشت تکون می‌خوره، responder رو از دست
            // خود drag handle قاپ می‌زد (رفتار شناخته‌شده‌ی اندروید) — و
            // برای همین کارت فقط حالت "گرفته‌شده" رو نشون می‌داد ولی هیچ‌وقت
            // واقعاً تکون نمی‌خورد.
            onPanResponderTerminationRequest: () => false,
            onShouldBlockNativeResponder: () => true,
            onPanResponderRelease: () => finalizeDropRef.current(),
            onPanResponderTerminate: () => finalizeDropRef.current(),
          })
        );
      }
      return respondersRef.current.get(idx);
    },
    [dragY, onDragActiveChange]
  );

  useEffect(() => {
    respondersRef.current.forEach((_, key) => {
      if (key >= order.length) respondersRef.current.delete(key);
    });
  }, [order.length]);

  return (
    <View style={{ height: order.length * REORDER_ROW_HEIGHT }}>
      {order.map((id, idx) => {
        const habit = habitsById.get(id);
        if (!habit) return null;
        const isDragged = draggedIndex === idx;
        let shift = 0;
        if (draggedIndex !== null && dropIndex !== null && !isDragged) {
          if (draggedIndex < dropIndex && idx > draggedIndex && idx <= dropIndex) shift = -1;
          else if (draggedIndex > dropIndex && idx < draggedIndex && idx >= dropIndex) shift = 1;
        }
        return (
          <View key={id} style={[styles.reorderDragSlot, { top: idx * REORDER_ROW_HEIGHT }]}>
            <DraggableReorderRow
              habit={habit}
              shift={shift}
              isDragged={isDragged}
              dragY={dragY}
              panHandlers={getPanResponderForIndex(idx).panHandlers}
            />
          </View>
        );
      })}
    </View>
  );
}


const DaySelectorButton = memo(function DaySelectorButton({ dayIndex, label, isSelected, onToggle }) {
  const handlePress = useCallback(() => onToggle(dayIndex), [onToggle, dayIndex]);
  return (
    <TouchableOpacity
      style={[styles.daySelectorCircle, isSelected && styles.daySelectorCircleSelected]}
      activeOpacity={0.7}
      onPress={handlePress}
    >
      <Text style={[styles.daySelectorText, isSelected && styles.daySelectorTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

const CategoryTab = memo(function CategoryTab({
  category,
  isActive,
  onSelectCategory,
  onDeleteCategory,
  shouldBlink,
  categoryReorderMode,
  onLongPressCategory,
  onMoveCategory,
  isFirst,
  isLast,
}) {
  const handlePress = useCallback(() => onSelectCategory(category.id), [onSelectCategory, category.id]);
  const handleLongPress = useCallback(() => onLongPressCategory(), [onLongPressCategory]);
  const handleMoveRight = useCallback(() => onMoveCategory(category.id, -1), [onMoveCategory, category.id]);
  const handleMoveLeft = useCallback(() => onMoveCategory(category.id, 1), [onMoveCategory, category.id]);
  const handleDelete = useCallback(() => onDeleteCategory(category.id), [onDeleteCategory, category.id]);

  const blinkAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!shouldBlink) {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(0);
      return undefined;
    }
    const loopAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 650,
          useNativeDriver: true,
        }),
      ])
    );
    loopAnimation.start();
    return () => {
      loopAnimation.stop();
    };
  }, [shouldBlink, blinkAnim]);

  const blinkOverlayOpacity = blinkAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.75],
  });

  return (
    <AnimatedPressable
      style={[styles.categoryTab, isActive && styles.categoryTabActive]}
      onPress={categoryReorderMode ? undefined : handlePress}
      onLongPress={categoryReorderMode ? undefined : handleLongPress}
      delayLongPress={450}
    >
      {shouldBlink && (
        <Animated.View
          pointerEvents="none"
          style={[styles.categoryTabBlinkOverlay, { opacity: blinkOverlayOpacity }]}
        />
      )}
      {categoryReorderMode ? (
        <View style={styles.categoryTabReorderRow}>
          <TouchableOpacity
            style={[styles.catReorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            onPress={handleMoveRight}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight size={14} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.categoryTabContent}>
            <Text
              style={[
                styles.categoryTabText,
                isActive && styles.categoryTabTextActive,
                shouldBlink && styles.categoryTabTextBlink,
              ]}
            >
              {category.name}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.catReorderBtn, isLast && styles.reorderBtnDisabled]}
            disabled={isLast}
            onPress={handleMoveLeft}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={14} color="#FFFFFF" />
          </TouchableOpacity>

          {category.id !== DEFAULT_CATEGORY_ID && (
            <TouchableOpacity
              style={styles.catDeleteBtn}
              onPress={handleDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={12} color={COLORS.error} strokeWidth={3} />
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.categoryTabContent}>
          <Text
            style={[
              styles.categoryTabText,
              isActive && styles.categoryTabTextActive,
              shouldBlink && styles.categoryTabTextBlink,
            ]}
          >
            {category.name}
          </Text>
          {category.days && category.days.length > 0 && category.days.length < 7 && (
            <Text
              style={[
                styles.categoryTabDayHint,
                isActive && styles.categoryTabDayHintActive,
                shouldBlink && styles.categoryTabTextBlink,
              ]}
            >
              {category.days.map((d) => WEEKDAYS_FA[d]).join(' ')}
            </Text>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
});

const CategoryTabs = memo(function CategoryTabs({
  categories,
  activeCategoryId,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  habits,
  todayKey,
  categoryReorderMode,
  onLongPressCategory,
  onMoveCategory,
  onFinishCategoryReorder,
}) {
  const [todayJy, todayJm, todayJd] = getTodayJalali();

  const blinkingCategoryIds = useMemo(() => {
    const ids = new Set();
    categories.forEach((cat) => {
      const isScheduledToday = isCategoryActiveOn(cat, todayJy, todayJm, todayJd);
      if (!isScheduledToday) return;
      const habitsInCategory = habits.filter(
        (h) => (h.categoryId || DEFAULT_CATEGORY_ID) === cat.id
      );
      if (habitsInCategory.length === 0) return;
      const allCompletedToday = habitsInCategory.every(
        (h) => (h.history || {})[todayKey] === 'success'
      );
      if (!allCompletedToday) ids.add(cat.id);
    });
    return ids;
  }, [categories, habits, todayKey, todayJy, todayJm, todayJd]);

  return (
    <View style={{ marginBottom: 16 }}>
      <ScrollView
        horizontal
        style={styles.categoryTabsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabsRow}
      >
        {categories.map((cat, idx) => (
          <CategoryTab
            key={cat.id}
            category={cat}
            isActive={cat.id === activeCategoryId}
            onSelectCategory={onSelectCategory}
            onDeleteCategory={onDeleteCategory}
            shouldBlink={blinkingCategoryIds.has(cat.id)}
            categoryReorderMode={categoryReorderMode}
            onLongPressCategory={onLongPressCategory}
            onMoveCategory={onMoveCategory}
            isFirst={idx === 0}
            isLast={idx === categories.length - 1}
          />
        ))}
        {!categoryReorderMode && (
          <TouchableOpacity
            style={[styles.categoryTab, styles.categoryAddTab]}
            activeOpacity={0.7}
            onPress={onAddCategory}
          >
            <Plus size={18} color={COLORS.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {categoryReorderMode && (
        <View style={styles.categoryReorderBanner}>
          <Text style={styles.categoryReorderBannerText}>تغییر چیدمان بخش‌ها</Text>
          <TouchableOpacity
            style={styles.categoryReorderDoneBtn}
            activeOpacity={0.8}
            onPress={onFinishCategoryReorder}
          >
            <Text style={styles.categoryReorderDoneBtnText}>تایید چیدمان</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
});

const HomeScreen = memo(function HomeScreen({
  habits,
  categories,
  onOpenHabit,
  onOpenModal,
  onEditHabit,
  reorderMode,
  onEnterReorder,
  onFinishReorder,
  onMoveHabit,
  categoryReorderMode,
  onEnterCategoryReorder,
  onFinishCategoryReorder,
  onMoveCategory,
  onOpenSettings,
  activeCategoryId,
  onSelectCategory,
  onAddCategory,
  onDeleteCategory,
  onIncrementGoal,
  onSetStatus,
  activeTimers,
  onToggleTimer,
  nowTick,
  onReorderCategoryHabits,
}) {
  const insets = useSafeAreaInsets();
  const [todayJy, todayJm, todayJd] = getTodayJalali();
  const todayKey = dateKey(todayJy, todayJm, todayJd);

  const categoryHabits = useMemo(
    () => habits.filter((h) => (h.categoryId || DEFAULT_CATEGORY_ID) === activeCategoryId),
    [habits, activeCategoryId]
  );

  const categoryHabitIds = useMemo(() => categoryHabits.map((h) => h.id), [categoryHabits]);
  const habitsById = useMemo(() => new Map(categoryHabits.map((h) => [h.id, h])), [categoryHabits]);
  const [isReorderDragActive, setIsReorderDragActive] = useState(false);

  const handleReorderEnd = useCallback(
    (orderedIds) => {
      onReorderCategoryHabits(activeCategoryId, orderedIds);
    },
    [onReorderCategoryHabits, activeCategoryId]
  );

  const { successToday, denominatorForToday } = useMemo(() => {
    const success = categoryHabits.filter((h) => {
      const history = h.history || {};
      if (history[todayKey] !== 'success') return false;
      const catId = h.categoryId || DEFAULT_CATEGORY_ID;
      const cat = categories.find((c) => c.id === catId);
      return isCategoryActiveOn(cat, todayJy, todayJm, todayJd);
    }).length;

    const scheduledToday = categoryHabits.filter((h) => {
      const catId = h.categoryId || DEFAULT_CATEGORY_ID;
      const cat = categories.find((c) => c.id === catId);
      return isCategoryActiveOn(cat, todayJy, todayJm, todayJd);
    }).length;

    return {
      successToday: success,
      denominatorForToday: scheduledToday > 0 ? scheduledToday : categoryHabits.length,
    };
  }, [categoryHabits, categories, todayKey, todayJy, todayJm, todayJd]);

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.homeHeaderRow}>
        <View style={styles.homeHeader}>
          <Text style={styles.homeTitle}>عادت‌ها</Text>
          <Text style={styles.homeSubtitle}>امروز، {toPersianDigits(todayJd)} {MONTHS_FA[todayJm - 1]}</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          activeOpacity={0.7}
          onPress={onOpenSettings}
        >
          <Settings size={20} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {!reorderMode && (
        <CategoryTabs
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelectCategory={onSelectCategory}
          onAddCategory={onAddCategory}
          onDeleteCategory={onDeleteCategory}
          habits={habits}
          todayKey={todayKey}
          categoryReorderMode={categoryReorderMode}
          onLongPressCategory={onEnterCategoryReorder}
          onMoveCategory={onMoveCategory}
          onFinishCategoryReorder={onFinishCategoryReorder}
        />
      )}

      {categoryHabits.length > 0 && (
        <View style={styles.todaySummaryRow}>
          <View style={styles.todaySummaryBox}>
            <View style={styles.todaySummaryTopRow}>
              <View style={styles.todaySummaryDateChip}>
                <Text style={styles.todaySummaryDateText}>وضعیت روزانه</Text>
              </View>
              <Text style={styles.todaySummaryFraction}>
                <Text style={{ color: COLORS.success }}>{toPersianDigits(successToday)}</Text>
                <Text style={{ color: COLORS.dim }}> / </Text>
                <Text style={{ color: COLORS.text }}>{toPersianDigits(denominatorForToday)}</Text>
              </Text>
            </View>
            <View style={styles.summaryProgressTrack}>
              <View
                style={[
                  styles.summaryProgressFill,
                  { width: `${Math.min(100, (successToday / (denominatorForToday || 1)) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.todaySummaryLabel}>عادت‌های موفق امروز</Text>
          </View>
        </View>
      )}

      {reorderMode ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.homeScrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isReorderDragActive}
        >
          <Text style={styles.reorderDragHint}>
            دستهٔ کنار هر عادت را بگیر و بکش تا ترتیبش عوض بشه
          </Text>
          <ReorderableHabitList
            habitIds={categoryHabitIds}
            habitsById={habitsById}
            onReorderEnd={handleReorderEnd}
            onDragActiveChange={setIsReorderDragActive}
          />
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={
            categoryHabits.length === 0 ? styles.emptyScrollContent : styles.homeScrollContent
          }
          showsVerticalScrollIndicator={false}
        >
          {categoryHabits.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconWrap}>
                <CalendarIcon size={36} color={COLORS.subtext} />
              </View>
              <Text style={styles.emptyStateText}>بدون عادت در این بخش</Text>
              <Text style={styles.emptyStateSubtext}>
                با دکمه + در پایین صفحه، اولین عادت خود را بسازید
              </Text>
            </View>
          ) : (
            categoryHabits.map((h) => (
              <HabitCard
                key={h.id}
                habit={h}
                categories={categories}
                onOpenHabit={onOpenHabit}
                onEditHabit={onEditHabit}
                onLongPress={onEnterReorder}
                reorderMode={false}
                isCompletedToday={(h.history || {})[todayKey] === 'success'}
                todayKey={todayKey}
                onIncrementGoal={onIncrementGoal}
                onSetStatus={onSetStatus}
                activeTimers={activeTimers}
                onToggleTimer={onToggleTimer}
                nowTick={nowTick}
              />
            ))
          )}
        </ScrollView>
      )}

      {reorderMode ? (
        <TouchableOpacity
          style={[styles.finishReorderBtn, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.8}
          onPress={onFinishReorder}
        >
          <Text style={styles.finishReorderBtnText}>تایید جابه‌جایی</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.8}
          onPress={onOpenModal}
        >
          <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ============================================================
   ROOT APP (STATE & CONTROLLERS)
   ============================================================ */

function RootApp() {
  const insets = useSafeAreaInsets();
  const [habits, setHabits] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState('home');
  const [selectedId, setSelectedId] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [titleInput, setTitleInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [goalInput, setGoalInput] = useState('');
  const [timerInput, setTimerInput] = useState('');
  const [reorderMode, setReorderMode] = useState(false);
  const [categoryReorderMode, setCategoryReorderMode] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  // آیا دسته‌بندی‌ها از حافظه‌ی گوشی لود شده‌اند؟ تا قبل از این لحظه، state
  // فقط دسته‌بندی پیش‌فرض («روزانه») را دارد و هر محاسبه‌ای که به دسته‌بندی
  // واقعی عادت‌ها نیاز داشته باشد (مثل فیلتر «فقط عادت‌های امروز» در
  // نوتیفیکیشن‌ها) نباید اجرا شود.
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryDaySelections, setCategoryDaySelections] = useState([]);
  const [notifSettings, setNotifSettings] = useState(DEFAULT_NOTIF_SETTINGS);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifDraft, setNotifDraft] = useState(DEFAULT_NOTIF_SETTINGS);

  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [backupMode, setBackupMode] = useState('export'); // 'export' | 'import'
  const [exportScope, setExportScope] = useState('all'); // 'all' | 'categories'
  const [exportSelectedCategoryIds, setExportSelectedCategoryIds] = useState([]);
  const [exportFields, setExportFields] = useState({
    description: true,
    goal: true,
    timerSeconds: true,
    category: true,
    history: true,
    progress: true,
    createdAt: true,
  });
  const [importFileInfo, setImportFileInfo] = useState(null); // { name, data }
  const [importFields, setImportFields] = useState({
    description: true,
    goal: true,
    timerSeconds: true,
    category: true,
    history: true,
    progress: true,
    createdAt: true,
  });

  const [activeTimers, setActiveTimers] = useState({});
  const [nowTick, setNowTick] = useState(Date.now());
  // هر بار برنامه به فورگراند می‌آید یکی زیاد می‌شود تا نوتیفیکیشن دائمی با
  // تاریخِ «امروزِ» جدید از نو محاسبه شود (مثلاً وقتی روز عوض شده باشد).
  const [appActiveTick, setAppActiveTick] = useState(0);

  // برای دسترسی هم‌گام (بدون stale closure) از داخل listener سراسری نوتیفیکیشن —
  // همون الگویی که برای activeTimersRef استفاده شد.
  const habitsRef = useRef(habits);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  const categoriesRef = useRef(categories);
  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  // شنونده‌ی سراسری برای دکمه‌ی «تایمر عادت رندوم» روی نوتیفیکیشن دائمی.
  // توجه: این listener فقط تا وقتی برنامه (فوری یا در پس‌زمینه) زنده است کار
  // می‌کند — اگر برنامه کامل بسته/force-stop شده باشد، اندروید JS را اجرا
  // نمی‌کند و این دکمه در آن حالت پاسخ نمی‌دهد؛ این محدودیت پلتفرم است.
  //
  // برای این‌که دکمه «تایمر عادت رندوم» همیشه (نه گاهی) کار کند، اکشن با
  // opensAppToForeground:true ثبت شده تا هر بار زده شود، جاوااسکریپت حتماً
  // اجرا/بیدار شود و بتواند تایمر را زمان‌بندی کند — برخلاف حالت قبلی که
  // برنامه باز نمی‌شد ولی چون گاهی جاوااسکریپت در پس‌زمینه کشته شده بود،
  // اصلاً هیچ واکنشی نشان نمی‌داد.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (response.actionIdentifier !== RANDOM_TIMER_ACTION_ID) return;
      try {
        await scheduleRandomHabitTimer(habitsRef.current, categoriesRef.current);
      } catch (e) {
        console.warn('Failed to start random habit timer', e);
      }
    });
    return () => sub.remove();
  }, []);

  // اگر برنامه دقیقاً با زدن دکمه «تایمر عادت رندوم» از حالت کاملاً بسته باز
  // شده باشد (cold start)، لیسنر بالا دیر ثبت می‌شود و آن تپ اولیه را از
  // دست می‌دهد؛ این افکت همان تپ گم‌شده را با getLastNotificationResponseAsync
  // می‌گیرد.
  useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        if (response.actionIdentifier !== RANDOM_TIMER_ACTION_ID) return;
        scheduleRandomHabitTimer(habitsRef.current, categoriesRef.current).catch((e) =>
          console.warn('Failed to start random habit timer (cold start)', e)
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // نمایش/آپدیت نوتیفیکیشن دائمی هرگاه لیست عادت‌ها یا دسته‌بندی‌ها تغییر کند
  // (مستقل از روشن/خاموش بودن یادآور زمان‌بندی‌شده در تنظیمات).
  // مهم (رفع باگ): باید تا لود کامل دسته‌بندی‌ها از حافظه صبر کنیم؛ وگرنه این
  // نوتیف یک بار با لیست پیش‌فرض دسته‌بندی‌ها ساخته می‌شود و چون دسته‌بندیِ
  // عادت‌ها هنوز «ناشناخته» است، فیلترِ «فقط عادت‌های امروز» رد می‌شود و
  // همه‌ی عادت‌های برنامه (حتی بخش‌های مخصوص روزهای دیگر) داخل نوتیف می‌آیند.
  // appActiveTick هم تضمین می‌کند هر بار برنامه باز شود، محتوای نوتیف با
  // تاریخ امروز از نو حساب شود — دقیقاً مثل یادآور زمان‌بندی‌شده.
  useEffect(() => {
    if (!loaded || !categoriesLoaded) return;
    presentPersistentReminder(habits, categories);
  }, [habits, categories, loaded, categoriesLoaded, appActiveTick]);

  useEffect(() => {
    const timerKeys = Object.keys(activeTimers);
    if (timerKeys.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setNowTick(now);

      setActiveTimers((prev) => {
        const next = { ...prev };
        let hasExpired = false;
        Object.keys(next).forEach((id) => {
          if (now >= next[id].endTime) {
            delete next[id];
            hasExpired = true;
          }
        });
        return hasExpired ? next : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTimers]);

  const activeTimersRef = useRef(activeTimers);
  useEffect(() => {
    activeTimersRef.current = activeTimers;
  }, [activeTimers]);

  const toggleTimer = useCallback(async (habit) => {
    if (!habit.timerSeconds || habit.timerSeconds <= 0) return;

    // تصمیم فعال/غیرفعال بودن را هم‌گام (synchronous) و مستقیماً از روی
    // activeTimersRef می‌گیریم، نه از داخل callback ناهمگام setState —
    // چون آن callback همیشه بلافاصله اجرا نمی‌شود و باعث می‌شد گاهی
    // این تصمیم اشتباه (همیشه "غیرفعال") خوانده شود.
    const current = activeTimersRef.current[habit.id];

    if (current) {
      // در حال اجراست → لغو کن
      const next = { ...activeTimersRef.current };
      delete next[habit.id];
      activeTimersRef.current = next;
      setActiveTimers(next);

      if (current.notifId) {
        await Notifications.cancelScheduledNotificationAsync(current.notifId).catch(() => {});
      }
      return;
    }

    const seconds = parseInt(habit.timerSeconds, 10);
    if (isNaN(seconds) || seconds <= 0) return;

    let notifId = null;
    try {
      await Notifications.requestPermissionsAsync();
      notifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏱️ پایان تایمر عادت',
          body: `تایمر ${habit.title} تموم شد، برو انجامش بده`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.MAX,
          android: { channelId: TIMER_CHANNEL_ID },
        },
        trigger: { type: 'timeInterval', seconds: seconds, repeats: false },
      });
    } catch (e) {
      console.warn('Failed to schedule timer notification', e);
    }

    // اگر بین این لحظه و بالا کاربر دوباره کلیک زده و تایمر را خاموش کرده،
    // آن انتخاب را محترم می‌شماریم (و نوتیف تازه‌زمان‌بندی‌شده را کنسل می‌کنیم).
    if (activeTimersRef.current[habit.id]) {
      if (notifId) {
        await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
      }
      return;
    }

    const endTime = Date.now() + seconds * 1000;
    const next = { ...activeTimersRef.current, [habit.id]: { endTime, notifId } };
    activeTimersRef.current = next;
    setActiveTimers(next);
    setNowTick(Date.now());
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        let list = [];
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) list = parsed;
        }
        const { next, changed } = backfillMissedDays(list, DEFAULT_CATEGORIES);
        setHabits(next);
        if (changed) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        }
      } catch (e) {
        console.warn('Failed to load habits', e);
      } finally {
        setLoaded(true);
      }
    })();

    (async () => {
      try {
        await configureNotificationChannel();
        try {
          await Notifications.requestPermissionsAsync();
        } catch (e) {}
        const raw = await AsyncStorage.getItem(NOTIF_SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setNotifSettings({ ...DEFAULT_NOTIF_SETTINGS, ...parsed });
        }
      } catch (e) {
        console.warn('Failed to load notification settings', e);
      } finally {
        setNotifLoaded(true);
      }
    })();

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(CATEGORIES_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
            setCategories(parsed.categories);
          }
          if (parsed.activeCategoryId) {
            setActiveCategoryId(parsed.activeCategoryId);
          }
        }
      } catch (e) {
        console.warn('Failed to load categories', e);
      } finally {
        setCategoriesLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
      setAppActiveTick((t) => t + 1);
      setHabits((current) => {
        const { next, changed } = backfillMissedDays(current, categories);
        if (changed) {
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch((e) =>
            console.warn('Failed to save habits', e)
          );
          return next;
        }
        return current;
      });
    });
    return () => sub.remove();
  }, [categories]);

  useEffect(() => {
    if (!loaded || !notifLoaded || !categoriesLoaded) return;
    scheduleHabitReminder(habits, categories, notifSettings);
  }, [habits, categories, notifSettings, loaded, notifLoaded, categoriesLoaded]);

  const persist = useCallback(async (next) => {
    setHabits(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('Failed to save habits', e);
    }
  }, []);

  const persistCategories = useCallback(async (nextCategories, nextActiveId) => {
    setCategories(nextCategories);
    setActiveCategoryId(nextActiveId);
    try {
      await AsyncStorage.setItem(
        CATEGORIES_KEY,
        JSON.stringify({ categories: nextCategories, activeCategoryId: nextActiveId })
      );
    } catch (e) {
      console.warn('Failed to save categories', e);
    }
  }, []);

  const openAddCategoryModal = useCallback(() => {
    setCategoryNameInput('');
    setCategoryDaySelections([]);
    setCategoryModalVisible(true);
  }, []);

  const closeAddCategoryModal = useCallback(() => {
    setCategoryModalVisible(false);
  }, []);

  const toggleCategoryDay = useCallback((dayIndex) => {
    setCategoryDaySelections((prev) => {
      if (prev.includes(dayIndex)) {
        return prev.filter((d) => d !== dayIndex);
      }
      return [...prev, dayIndex];
    });
  }, []);

  const submitNewCategory = useCallback(() => {
    const trimmed = categoryNameInput.trim();
    if (!trimmed) {
      Alert.alert('نام لازم است', 'لطفاً یک نام برای بخش وارد کنید.');
      return;
    }
    const days = categoryDaySelections.length > 0 ? [...categoryDaySelections].sort((a, b) => a - b) : null;
    const newCategory = { id: uid(), name: trimmed, days };
    persistCategories([...categories, newCategory], newCategory.id);
    setCategoryModalVisible(false);
  }, [categoryNameInput, categoryDaySelections, categories, persistCategories]);

  const selectCategory = useCallback(
    (id) => {
      persistCategories(categories, id);
    },
    [categories, persistCategories]
  );

  const deleteCategory = useCallback(
    (id) => {
      const target = categories.find((c) => c.id === id);
      if (!target) return;
      Alert.alert(
        'حذف بخش',
        `آیا از حذف بخش «${target.name}» مطمئن هستید؟ عادت‌های این بخش به «روزانه» منتقل می‌شوند.`,
        [
          { text: 'انصراف', style: 'cancel' },
          {
            text: 'حذف',
            style: 'destructive',
            onPress: () => {
              const nextCategories = categories.filter((c) => c.id !== id);
              const nextHabits = habits.map((h) =>
                (h.categoryId || DEFAULT_CATEGORY_ID) === id
                  ? { ...h, categoryId: DEFAULT_CATEGORY_ID }
                  : h
              );
              persist(nextHabits);
              persistCategories(
                nextCategories,
                activeCategoryId === id ? DEFAULT_CATEGORY_ID : activeCategoryId
              );
            },
          },
        ]
      );
    },
    [categories, habits, activeCategoryId, persist, persistCategories]
  );

  const moveCategory = useCallback(
    (catId, direction) => {
      const idx = categories.findIndex((c) => c.id === catId);
      if (idx < 0) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= categories.length) return;
      const next = [...categories];
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
      persistCategories(next, activeCategoryId);
    },
    [categories, activeCategoryId, persistCategories]
  );

  const enterCategoryReorderMode = useCallback(() => setCategoryReorderMode(true), []);
  const finishCategoryReorderMode = useCallback(() => setCategoryReorderMode(false), []);

  const openNotifSettings = useCallback(() => {
    setNotifDraft(notifSettings);
    setNotifModalVisible(true);
  }, [notifSettings]);

  const closeNotifSettings = useCallback(() => {
    setNotifModalVisible(false);
  }, []);

  const saveNotifSettings = useCallback(async () => {
    const parsedInterval = parseInt(notifDraft.intervalMinutes, 10);
    const intervalMinutes = Number.isFinite(parsedInterval) && parsedInterval > 0 ? parsedInterval : 30;
    const finalSettings = { ...notifDraft, intervalMinutes };

    if (finalSettings.enabled) {
      try {
        const perm = await Notifications.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            'اجازه لازم است',
            'برای ارسال یادآور، لطفاً اجازه‌ی نوتیفیکیشن را برای برنامه فعال کنید.'
          );
        }
      } catch (e) {
        console.warn('Failed to request notification permission', e);
      }
    }
    setNotifSettings(finalSettings);
    try {
      await AsyncStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(finalSettings));
    } catch (e) {
      console.warn('Failed to save notification settings', e);
    }
    setNotifModalVisible(false);
  }, [notifDraft]);

  const setDraftInterval = useCallback((text) => {
    const digitsOnly = text.replace(/[^0-9]/g, '');
    const n = parseInt(digitsOnly, 10);
    setNotifDraft((prev) => ({
      ...prev,
      intervalMinutes: digitsOnly === '' ? '' : Number.isFinite(n) ? n : prev.intervalMinutes,
    }));
  }, []);

  const handleTestNotification = useCallback(async () => {
    try {
      await Notifications.requestPermissionsAsync();
      await sendTestHabitNotification(habits, categories);
    } catch (e) {
      console.warn('Failed to send test notification', e);
      Alert.alert('خطا', 'ارسال نوتیفیکیشن تست ناموفق بود.');
    }
  }, [habits, categories]);

  // ---------- ایمپورت / اکسپورت داده‌ها ----------
  const openExportModal = useCallback(() => {
    setBackupMode('export');
    setExportScope('all');
    setExportSelectedCategoryIds(categories.map((c) => c.id));
    setExportFields({
      description: true,
      goal: true,
      timerSeconds: true,
      category: true,
      history: true,
      progress: true,
      createdAt: true,
    });
    setBackupModalVisible(true);
  }, [categories]);

  const openImportModal = useCallback(() => {
    setBackupMode('import');
    setImportFileInfo(null);
    setImportFields({
      description: true,
      goal: true,
      timerSeconds: true,
      category: true,
      history: true,
      progress: true,
      createdAt: true,
    });
    setBackupModalVisible(true);
  }, []);

  const closeBackupModal = useCallback(() => {
    setBackupModalVisible(false);
  }, []);

  const toggleExportField = useCallback((key) => {
    setExportFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleImportField = useCallback((key) => {
    setImportFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const toggleExportCategoryId = useCallback((id) => {
    setExportSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const selectedCategoryIds =
        exportScope === 'all' ? categories.map((c) => c.id) : exportSelectedCategoryIds;

      const habitsToExport = habits.filter((h) =>
        selectedCategoryIds.includes(h.categoryId || DEFAULT_CATEGORY_ID)
      );

      const exportedHabits = habitsToExport.map((h) => {
        const item = { id: h.id, title: h.title };
        if (exportFields.description) item.description = h.description || '';
        if (exportFields.goal) item.goal = h.goal || 0;
        if (exportFields.timerSeconds) item.timerSeconds = h.timerSeconds || 0;
        if (exportFields.category) item.categoryId = h.categoryId || DEFAULT_CATEGORY_ID;
        if (exportFields.history) item.history = h.history || {};
        if (exportFields.progress) item.progress = h.progress || {};
        if (exportFields.createdAt) item.createdAt = h.createdAt || null;
        return item;
      });

      const exportedCategories = exportFields.category
        ? categories.filter((c) => selectedCategoryIds.includes(c.id))
        : [];

      const payload = {
        app: 'HabitTrackerApp',
        exportedAt: new Date().toISOString(),
        categories: exportedCategories,
        habits: exportedHabits,
      };

      const [jy, jm, jd] = getTodayJalali();
      const fileName = `habittracker-backup-${jy}-${pad2(jm)}-${pad2(jd)}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'ذخیره یا اشتراک‌گذاری بکاپ',
        });
      } else {
        Alert.alert('اکسپورت انجام شد', `فایل در ${fileUri} ذخیره شد.`);
      }
      setBackupModalVisible(false);
    } catch (e) {
      console.warn('Export failed', e);
      Alert.alert('خطا', 'اکسپورت با مشکل مواجه شد.\n\n' + String((e && e.message) || e));
    }
  }, [habits, categories, exportScope, exportSelectedCategoryIds, exportFields]);

  const handlePickImportFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const parsed = JSON.parse(content);
      if (!parsed || !Array.isArray(parsed.habits)) {
        Alert.alert('فایل نامعتبر', 'ساختار فایل بکاپ شناسایی نشد.');
        return;
      }
      setImportFileInfo({ name: asset.name || 'backup.json', data: parsed });

      const sampleHabit = parsed.habits[0] || {};
      setImportFields({
        description: sampleHabit.description !== undefined,
        goal: sampleHabit.goal !== undefined,
        timerSeconds: sampleHabit.timerSeconds !== undefined,
        category: sampleHabit.categoryId !== undefined && Array.isArray(parsed.categories),
        history: sampleHabit.history !== undefined,
        progress: sampleHabit.progress !== undefined,
        createdAt: sampleHabit.createdAt !== undefined,
      });
    } catch (e) {
      console.warn('Import file pick failed', e);
      Alert.alert('خطا', 'خواندن فایل بکاپ ناموفق بود.\n\n' + String((e && e.message) || e));
    }
  }, []);

  const handleImportConfirm = useCallback(() => {
    if (!importFileInfo || !importFileInfo.data) return;
    const { data } = importFileInfo;
    const importedHabits = Array.isArray(data.habits) ? data.habits : [];
    const importedCategories = Array.isArray(data.categories) ? data.categories : [];

    let nextCategories = categories;
    if (importFields.category && importedCategories.length > 0) {
      const existingIds = new Set(categories.map((c) => c.id));
      const newCats = importedCategories.filter((c) => c && c.id && !existingIds.has(c.id));
      nextCategories = [...categories, ...newCats];
    }

    const existingHabitsById = new Map(habits.map((h) => [h.id, h]));
    const nextHabits = [...habits];

    importedHabits.forEach((ih) => {
      if (!ih || !ih.id || !ih.title) return;
      const existing = existingHabitsById.get(ih.id);

      if (existing) {
        const idx = nextHabits.findIndex((h) => h.id === ih.id);
        const updated = { ...existing, title: ih.title };
        if (importFields.description && ih.description !== undefined) updated.description = ih.description;
        if (importFields.goal && ih.goal !== undefined) updated.goal = ih.goal;
        if (importFields.timerSeconds && ih.timerSeconds !== undefined) updated.timerSeconds = ih.timerSeconds;
        if (importFields.category && ih.categoryId !== undefined) updated.categoryId = ih.categoryId;
        if (importFields.history && ih.history !== undefined) updated.history = ih.history;
        if (importFields.progress && ih.progress !== undefined) updated.progress = ih.progress;
        if (importFields.createdAt && ih.createdAt !== undefined) updated.createdAt = ih.createdAt;
        nextHabits[idx] = updated;
      } else {
        const created = {
          id: ih.id,
          title: ih.title,
          description: importFields.description ? ih.description || '' : '',
          goal: importFields.goal ? ih.goal || 0 : 0,
          timerSeconds: importFields.timerSeconds ? ih.timerSeconds || 0 : 0,
          categoryId:
            importFields.category && ih.categoryId ? ih.categoryId : DEFAULT_CATEGORY_ID,
          createdAt: importFields.createdAt && ih.createdAt ? ih.createdAt : new Date().toISOString(),
          history: importFields.history ? ih.history || {} : {},
          progress: importFields.progress ? ih.progress || {} : {},
        };
        nextHabits.push(created);
      }
    });

    persist(nextHabits);
    if (nextCategories !== categories) {
      persistCategories(nextCategories, activeCategoryId);
    }
    setBackupModalVisible(false);
    Alert.alert('ایمپورت انجام شد', `${importedHabits.length} عادت پردازش شد.`);
  }, [importFileInfo, importFields, habits, categories, activeCategoryId, persist, persistCategories]);

  const openCreateModal = useCallback(() => {
    setEditingHabitId(null);
    setTitleInput('');
    setDescInput('');
    setGoalInput('');
    setTimerInput('');
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((habit) => {
    setEditingHabitId(habit.id);
    setTitleInput(habit.title);
    setDescInput(habit.description || '');
    setGoalInput(habit.goal ? String(habit.goal) : '');
    setTimerInput(habit.timerSeconds ? String(habit.timerSeconds) : '');
    setModalVisible(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setModalVisible(false);
  }, []);

  const handleSubmitHabit = useCallback(() => {
    const trimmedTitle = titleInput.trim();
    if (!trimmedTitle) {
      Alert.alert('عنوان الزامی است', 'لطفاً برای عادت خود یک عنوان وارد کنید.');
      return;
    }
    const parsedGoal = parseInt(goalInput, 10);
    const goal = Number.isFinite(parsedGoal) && parsedGoal > 0 ? parsedGoal : 0;

    const parsedTimer = parseInt(timerInput, 10);
    const timerSeconds = Number.isFinite(parsedTimer) && parsedTimer > 0 ? parsedTimer : 0;

    if (editingHabitId) {
      const next = habits.map((h) =>
        h.id === editingHabitId
          ? { ...h, title: trimmedTitle, description: descInput.trim(), goal, timerSeconds }
          : h
      );
      persist(next);
    } else {
      const newHabit = {
        id: uid(),
        title: trimmedTitle,
        description: descInput.trim(),
        goal,
        timerSeconds,
        categoryId: activeCategoryId,
        createdAt: new Date().toISOString(),
        history: {},
        progress: {},
      };
      persist([newHabit, ...habits]);
    }
    setModalVisible(false);
  }, [titleInput, descInput, goalInput, timerInput, editingHabitId, habits, activeCategoryId, persist]);

  const openHabit = useCallback((id) => {
    setSelectedId(id);
    setScreen('detail');
  }, []);

  const goBackHome = useCallback(() => {
    setScreen('home');
    setSelectedId(null);
  }, []);

  const setStatus = useCallback(
    (habitId, key, status) => {
      const parts = key.split('-');
      const jy = parseInt(parts[0], 10);
      const jm = parseInt(parts[1], 10);
      const jd = parseInt(parts[2], 10);

      const next = habits.map((h) => {
        if (h.id !== habitId) return h;
        const categoryId = h.categoryId || DEFAULT_CATEGORY_ID;
        const category = categories.find((c) => c.id === categoryId);

        const nextHistory = { ...(h.history || {}) };
        if (nextHistory[key] === status) {
          delete nextHistory[key];
        } else {
          if (status === 'fail' && !isCategoryActiveOn(category, jy, jm, jd)) {
            return h;
          }
          nextHistory[key] = status;
        }
        return { ...h, history: nextHistory };
      });
      persist(next);
    },
    [habits, categories, persist]
  );

  const clearStatus = useCallback(
    (habitId, key) => {
      const next = habits.map((h) => {
        if (h.id !== habitId) return h;
        const nextHistory = { ...(h.history || {}) };
        delete nextHistory[key];
        return { ...h, history: nextHistory };
      });
      persist(next);
    },
    [habits, persist]
  );

  const bumpProgress = useCallback(
    (habitId, key, delta, goal) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const current = (habit.progress && habit.progress[key]) || 0;
      const nextCount = Math.max(0, current + delta);
      const nextProgress = { ...(habit.progress || {}), [key]: nextCount };
      const nextHistory = { ...(habit.history || {}) };
      if (goal > 0 && nextCount >= goal) {
        nextHistory[key] = 'success';
      }
      const next = habits.map((h) =>
        h.id === habitId ? { ...h, progress: nextProgress, history: nextHistory } : h
      );
      persist(next);
    },
    [habits, persist]
  );

  const moveHabit = useCallback(
    (habitId, direction) => {
      const habit = habits.find((h) => h.id === habitId);
      if (!habit) return;
      const categoryId = habit.categoryId || DEFAULT_CATEGORY_ID;

      // ترتیب واقعیِ نمایش‌داده‌شده فقط شامل عادت‌های همین بخش است — پس باید
      // با همسایه‌ی واقعیِ داخل همین بخش جابه‌جا شود، نه با هر چیزی که در
      // آرایه‌ی کامل (شامل همه‌ی بخش‌ها) کنارش افتاده.
      const sameCategoryIds = habits
        .filter((h) => (h.categoryId || DEFAULT_CATEGORY_ID) === categoryId)
        .map((h) => h.id);

      const posInCategory = sameCategoryIds.indexOf(habitId);
      if (posInCategory < 0) return;
      const targetPosInCategory = posInCategory + direction;
      if (targetPosInCategory < 0 || targetPosInCategory >= sameCategoryIds.length) return;

      const targetId = sameCategoryIds[targetPosInCategory];
      const idx = habits.findIndex((h) => h.id === habitId);
      const targetIdx = habits.findIndex((h) => h.id === targetId);
      if (idx < 0 || targetIdx < 0) return;

      const next = [...habits];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      persist(next);
    },
    [habits, persist]
  );

  // یک جابه‌جایی کامل (drag) روی یک بخش: ترتیب جدید فقط برای عادت‌های همون
  // بخش اعمال می‌شه؛ موقعیت عادت‌های بخش‌های دیگه در آرایه‌ی اصلی دست‌نخورده
  // می‌مونه (فقط اسلات‌هایی که به این بخش تعلق دارن، به‌ترتیب جدید پر می‌شن).
  const reorderCategoryHabits = useCallback(
    (categoryId, orderedIds) => {
      const byId = new Map(habits.map((h) => [h.id, h]));
      let i = 0;
      const next = habits.map((h) => {
        const catId = h.categoryId || DEFAULT_CATEGORY_ID;
        if (catId !== categoryId) return h;
        const id = orderedIds[i];
        i += 1;
        return byId.get(id) || h;
      });
      persist(next);
    },
    [habits, persist]
  );

  const deleteHabit = useCallback(
    (id) => {
      const next = habits.filter((h) => h.id !== id);
      persist(next);
      setScreen('home');
      setSelectedId(null);
    },
    [habits, persist]
  );

  const enterReorderMode = useCallback(() => setReorderMode(true), []);
  const finishReorderMode = useCallback(() => setReorderMode(false), []);
  const incrementGoal = useCallback(
    (habitId, key, goal) => bumpProgress(habitId, key, 1, goal),
    [bumpProgress]
  );

  const handleGoalInputChange = useCallback((t) => setGoalInput(t.replace(/[^0-9]/g, '')), []);
  const handleTimerInputChange = useCallback((t) => setTimerInput(t.replace(/[^0-9]/g, '')), []);

  const handleNotifEnabledChange = useCallback((v) => {
    setNotifDraft((prev) => ({ ...prev, enabled: v }));
  }, []);

  const selectedHabit = useMemo(
    () => habits.find((h) => h.id === selectedId),
    [habits, selectedId]
  );

  const handleEditSelected = useCallback(() => {
    if (selectedHabit) openEditModal(selectedHabit);
  }, [selectedHabit, openEditModal]);

  if (!loaded) {
    return (
      <View style={[styles.safe, styles.loadingWrap, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <HomeScreen
        habits={habits}
        categories={categories}
        onOpenHabit={openHabit}
        onOpenModal={openCreateModal}
        onEditHabit={openEditModal}
        reorderMode={reorderMode}
        onEnterReorder={enterReorderMode}
        onFinishReorder={finishReorderMode}
        onMoveHabit={moveHabit}
        onReorderCategoryHabits={reorderCategoryHabits}
        categoryReorderMode={categoryReorderMode}
        onEnterCategoryReorder={enterCategoryReorderMode}
        onFinishCategoryReorder={finishCategoryReorderMode}
        onMoveCategory={moveCategory}
        onOpenSettings={openNotifSettings}
        onIncrementGoal={incrementGoal}
        activeCategoryId={activeCategoryId}
        onSelectCategory={selectCategory}
        onAddCategory={openAddCategoryModal}
        onDeleteCategory={deleteCategory}
        onSetStatus={setStatus}
        activeTimers={activeTimers}
        onToggleTimer={toggleTimer}
        nowTick={nowTick}
      />

      {screen === 'detail' && selectedHabit && (
        <View style={styles.detailOverlay}>
          <HabitDetailScreen
            habit={selectedHabit}
            categories={categories}
            onBack={goBackHome}
            onDelete={deleteHabit}
            onSetStatus={setStatus}
            onClearStatus={clearStatus}
            onBumpProgress={bumpProgress}
            onEdit={handleEditSelected}
            activeTimers={activeTimers}
            onToggleTimer={toggleTimer}
            nowTick={nowTick}
          />
        </View>
      )}

      {/* iOS Style Bottom Sheet Modal for Habit Creation */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeCreateModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {editingHabitId ? 'ویرایش عادت' : 'عادت جدید'}
              </Text>

              <Text style={styles.inputLabel}>عنوان</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: مطالعه کتاب"
                placeholderTextColor={COLORS.dim}
                value={titleInput}
                onChangeText={setTitleInput}
                textAlign="right"
              />

              <Text style={styles.inputLabel}>توضیحات (اختیاری)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="توضیح کوتاه یا یادداشت..."
                placeholderTextColor={COLORS.dim}
                value={descInput}
                onChangeText={setDescInput}
                textAlign="right"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>تایمر معکوس (ثانیه - اختیاری)</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: ۱۲۰"
                placeholderTextColor={COLORS.dim}
                value={timerInput}
                onChangeText={handleTimerInputChange}
                textAlign="right"
                keyboardType="number-pad"
              />

              <Text style={styles.inputLabel}>هدف روزانه (تعداد دفعات)</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: ۳"
                placeholderTextColor={COLORS.dim}
                value={goalInput}
                onChangeText={handleGoalInputChange}
                textAlign="right"
                keyboardType="number-pad"
              />

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  activeOpacity={0.7}
                  onPress={closeCreateModal}
                >
                  <Text style={styles.modalButtonCancelText}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCreate]}
                  activeOpacity={0.7}
                  onPress={handleSubmitHabit}
                >
                  <Text style={styles.modalButtonCreateText}>
                    {editingHabitId ? 'ذخیره' : 'ایجاد'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* iOS Style Bottom Sheet Modal for Notification Settings */}
      <Modal
        visible={notifModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeNotifSettings}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>تنظیمات یادآور</Text>

            <View style={styles.notifSwitchRow}>
              <Switch
                value={notifDraft.enabled}
                onValueChange={handleNotifEnabledChange}
                trackColor={{ false: COLORS.cardSurface, true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.notifSwitchLabel}>یادآور روزانه فعال باشد</Text>
            </View>

            {notifDraft.enabled && (
              <View style={styles.notifTimeCard}>
                <Text style={styles.notifTimeLabel}>فاصله زمانی یادآوری (دقیقه)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="۳۰"
                  placeholderTextColor={COLORS.dim}
                  value={String(notifDraft.intervalMinutes)}
                  onChangeText={setDraftInterval}
                  textAlign="center"
                  keyboardType="number-pad"
                />
                <Text style={styles.notifTimeHint}>
                  ارسال یادآور هر {toPersianDigits(notifDraft.intervalMinutes || '')} دقیقه یک‌بار تا زمان تکمیل کامل عادت‌ها
                </Text>
                <TouchableOpacity
                  style={styles.notifTestBtn}
                  activeOpacity={0.7}
                  onPress={handleTestNotification}
                >
                  <Text style={styles.notifTestBtnText}>ارسال نوتیفیکیشن تست</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.backupEntryRow}>
              <TouchableOpacity
                style={styles.backupEntryBtn}
                activeOpacity={0.7}
                onPress={openExportModal}
              >
                <Download size={18} color={COLORS.primary} />
                <Text style={styles.backupEntryBtnText}>اکسپورت</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.backupEntryBtn}
                activeOpacity={0.7}
                onPress={openImportModal}
              >
                <Upload size={18} color={COLORS.primary} />
                <Text style={styles.backupEntryBtnText}>ایمپورت</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                activeOpacity={0.7}
                onPress={closeNotifSettings}
              >
                <Text style={styles.modalButtonCancelText}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCreate]}
                activeOpacity={0.7}
                onPress={saveNotifSettings}
              >
                <Text style={styles.modalButtonCreateText}>ذخیره</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Style Bottom Sheet Modal for Export/Import Backup */}
      <Modal
        visible={backupModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeBackupModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20, maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>
              {backupMode === 'export' ? 'اکسپورت داده‌ها' : 'ایمپورت داده‌ها'}
            </Text>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {backupMode === 'export' ? (
                <>
                  <Text style={styles.backupSectionLabel}>محدوده</Text>
                  <View style={styles.backupScopeRow}>
                    <TouchableOpacity
                      style={[
                        styles.backupScopeBtn,
                        exportScope === 'all' && styles.backupScopeBtnActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setExportScope('all')}
                    >
                      <Text
                        style={[
                          styles.backupScopeBtnText,
                          exportScope === 'all' && styles.backupScopeBtnTextActive,
                        ]}
                      >
                        همه بخش‌ها
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.backupScopeBtn,
                        exportScope === 'categories' && styles.backupScopeBtnActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setExportScope('categories')}
                    >
                      <Text
                        style={[
                          styles.backupScopeBtnText,
                          exportScope === 'categories' && styles.backupScopeBtnTextActive,
                        ]}
                      >
                        بخش‌های خاص
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {exportScope === 'categories' && (
                    <View style={styles.backupCategoryList}>
                      {categories.map((cat) => {
                        const checked = exportSelectedCategoryIds.includes(cat.id);
                        return (
                          <TouchableOpacity
                            key={cat.id}
                            style={styles.backupCheckboxRow}
                            activeOpacity={0.7}
                            onPress={() => toggleExportCategoryId(cat.id)}
                          >
                            <View style={[styles.backupCheckbox, checked && styles.backupCheckboxChecked]}>
                              {checked && <Check size={14} color="#FFFFFF" />}
                            </View>
                            <Text style={styles.backupCheckboxLabel}>{cat.name}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.backupSectionLabel}>فیلدهای همراه هر عادت</Text>
                  <View style={styles.backupCheckboxRow}>
                    <View style={[styles.backupCheckbox, styles.backupCheckboxChecked, styles.backupCheckboxLocked]}>
                      <Check size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.backupCheckboxLabel}>نام عادت (همیشه همراه است)</Text>
                  </View>
                  {BACKUP_FIELD_META.map((f) => (
                    <TouchableOpacity
                      key={f.key}
                      style={styles.backupCheckboxRow}
                      activeOpacity={0.7}
                      onPress={() => toggleExportField(f.key)}
                    >
                      <View
                        style={[
                          styles.backupCheckbox,
                          exportFields[f.key] && styles.backupCheckboxChecked,
                        ]}
                      >
                        {exportFields[f.key] && <Check size={14} color="#FFFFFF" />}
                      </View>
                      <Text style={styles.backupCheckboxLabel}>{f.label}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.backupFilePickBtn}
                    activeOpacity={0.7}
                    onPress={handlePickImportFile}
                  >
                    <Package size={18} color={COLORS.primary} />
                    <Text style={styles.backupFilePickBtnText}>
                      {importFileInfo ? importFileInfo.name : 'انتخاب فایل بکاپ'}
                    </Text>
                  </TouchableOpacity>

                  {importFileInfo && (
                    <>
                      <Text style={styles.backupSectionLabel}>
                        {importFileInfo.data.habits.length} عادت در این فایل پیدا شد — فیلدهایی که می‌خواهید ایمپورت شوند را انتخاب کنید
                      </Text>
                      <View style={styles.backupCheckboxRow}>
                        <View style={[styles.backupCheckbox, styles.backupCheckboxChecked, styles.backupCheckboxLocked]}>
                          <Check size={14} color="#FFFFFF" />
                        </View>
                        <Text style={styles.backupCheckboxLabel}>نام عادت (همیشه ایمپورت می‌شود)</Text>
                      </View>
                      {BACKUP_FIELD_META.map((f) => {
                        const sample = importFileInfo.data.habits[0] || {};
                        const availableKey = f.key === 'category' ? 'categoryId' : f.key;
                        const available =
                          f.key === 'category'
                            ? Array.isArray(importFileInfo.data.categories) && sample.categoryId !== undefined
                            : sample[availableKey] !== undefined;
                        if (!available) return null;
                        return (
                          <TouchableOpacity
                            key={f.key}
                            style={styles.backupCheckboxRow}
                            activeOpacity={0.7}
                            onPress={() => toggleImportField(f.key)}
                          >
                            <View
                              style={[
                                styles.backupCheckbox,
                                importFields[f.key] && styles.backupCheckboxChecked,
                              ]}
                            >
                              {importFields[f.key] && <Check size={14} color="#FFFFFF" />}
                            </View>
                            <Text style={styles.backupCheckboxLabel}>{f.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                activeOpacity={0.7}
                onPress={closeBackupModal}
              >
                <Text style={styles.modalButtonCancelText}>انصراف</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonCreate,
                  backupMode === 'import' && !importFileInfo && styles.modalButtonDisabled,
                ]}
                activeOpacity={0.7}
                disabled={backupMode === 'import' && !importFileInfo}
                onPress={backupMode === 'export' ? handleExport : handleImportConfirm}
              >
                <Text style={styles.modalButtonCreateText}>
                  {backupMode === 'export' ? 'اکسپورت' : 'ایمپورت'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Style Bottom Sheet Modal for Category Creation */}
      <Modal
        visible={categoryModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeAddCategoryModal}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>بخش جدید</Text>

              <Text style={styles.inputLabel}>نام بخش</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: آخر هفته"
                placeholderTextColor={COLORS.subtext}
                value={categoryNameInput}
                onChangeText={setCategoryNameInput}
                textAlign="right"
              />

              <Text style={styles.inputLabel}>روزهای فعال (عدم انتخاب = همه روزها)</Text>
              <View style={styles.daySelectorRow}>
                {WEEKDAYS_FA.map((shortName, idx) => (
                  <DaySelectorButton
                    key={idx}
                    dayIndex={idx}
                    label={shortName}
                    isSelected={categoryDaySelections.includes(idx)}
                    onToggle={toggleCategoryDay}
                  />
                ))}
              </View>

              <View style={styles.modalButtonsRow}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  activeOpacity={0.7}
                  onPress={closeAddCategoryModal}
                >
                  <Text style={styles.modalButtonCancelText}>انصراف</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCreate]}
                  activeOpacity={0.7}
                  onPress={submitNewCategory}
                >
                  <Text style={styles.modalButtonCreateText}>ایجاد</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function DeviceLockScreen({ deviceId }) {
  return (
    <View style={styles.lockScreenContainer}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <Text style={styles.lockScreenTitle}>دسترسی محدود شده است</Text>
      <Text style={styles.lockScreenMessage}>
        برای خرید اشتراک به آیدی تلگرام زیر پیام بدید{'\n'}
        {LICENSE_CONTACT_TELEGRAM}
      </Text>
      <View style={styles.lockScreenIdBox}>
        <Text style={styles.lockScreenIdLabel}>شناسه دستگاه شما</Text>
        <Text style={styles.lockScreenIdValue} selectable>
          {deviceId || 'نامشخص'}
        </Text>
        <Text style={styles.lockScreenIdHint}>
          این شناسه را نگه دارید و برای فعال‌سازی بفرستید (برای کپی، روی متن بالا نگه دارید)
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const deviceId = Platform.OS === 'android' ? Application.getAndroidId() : null;
  const isAllowed = Platform.OS === 'android' && ALLOWED_DEVICE_IDS.includes(deviceId);

  if (!isAllowed) {
    return <DeviceLockScreen deviceId={deviceId} />;
  }

  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
}

/* ============================================================
   STYLING SYSTEM (APPLE HIG STANDARD)
   ============================================================ */

const styles = StyleSheet.create({
  lockScreenContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  lockScreenTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  lockScreenMessage: {
    color: COLORS.subtext,
    fontSize: 15,
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 28,
  },
  lockScreenIdBox: {
    width: '100%',
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
  },
  lockScreenIdLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    marginBottom: 8,
  },
  lockScreenIdValue: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 10,
    textAlign: 'center',
  },
  lockScreenIdHint: {
    color: COLORS.subtext,
    fontSize: 11,
    textAlign: 'center',
  },
  timerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  timerBadgeActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  timerBadgeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timerBadgeTextActive: {
    color: '#FFFFFF',
  },

  dayMenuOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  dayMenuCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 10,
  },
  dayMenuTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.2,
  },
  dayMenuOption: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
  },
  dayMenuOptionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dayMenuOptionSuccess: {
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(48,209,88,0.3)',
  },
  dayMenuOptionSuccessText: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '700',
  },
  dayMenuOptionFail: {
    backgroundColor: COLORS.errorSoft,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  dayMenuOptionFailText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },
  dayMenuOptionCancel: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    marginBottom: 0,
    marginTop: 4,
  },
  dayMenuOptionCancelText: {
    color: COLORS.subtext,
    fontSize: 15,
    fontWeight: '600',
  },
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  detailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.bg,
  },
  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- iOS Native Large Title Header ---- */
  homeHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  homeHeader: {
    flex: 1,
  },
  settingsBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeTitle: {
    color: COLORS.text,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.8,
    lineHeight: 40,
  },
  homeSubtitle: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  homeScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emptyScrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },

  /* ---- Category Pills (iOS Segmented Style) ---- */
  categoryTabsScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryTabsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
    gap: 8,
  },
  categoryTab: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  categoryTabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryTabContent: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  categoryTabText: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  categoryTabDayHint: {
    color: COLORS.dim,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },
  categoryTabDayHintActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  categoryTabBlinkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.error,
    borderRadius: 999,
  },
  categoryTabTextBlink: {
    color: '#FFFFFF',
  },
  categoryAddTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTabReorderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  catReorderBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  categoryReorderBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
    borderWidth: 1,
    borderRadius: 18,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryReorderBannerText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryReorderDoneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  categoryReorderDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---- Apple Inset Today Summary Card ---- */
  todaySummaryRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  todaySummaryBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  todaySummaryTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todaySummaryDateChip: {
    backgroundColor: COLORS.todaySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  todaySummaryDateText: {
    color: COLORS.today,
    fontSize: 12,
    fontWeight: '700',
  },
  todaySummaryFraction: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryProgressTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.cardSurface,
    marginTop: 14,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.success,
  },
  todaySummaryLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 10,
    fontWeight: '500',
    textAlign: 'right',
  },

  /* ---- Empty State ---- */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: COLORS.subtext,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: 'center',
  },

  /* ---- Apple Grouped Habit Card ---- */
  habitCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 12,
  },
  habitCardCompleted: {
    backgroundColor: COLORS.successDeep,
    borderColor: 'rgba(48,209,88,0.35)',
  },
  habitCardFailed: {
    backgroundColor: COLORS.errorDeep,
    borderColor: 'rgba(255,69,58,0.35)',
  },
  habitCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  habitTitleWrap: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  habitTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
    letterSpacing: -0.3,
  },
  completedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(48,209,88,0.3)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  completedBadgeText: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: '700',
  },
  goalProgressBadge: {
    backgroundColor: COLORS.todaySoft,
    borderColor: 'rgba(255,159,10,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 8,
  },
  goalProgressBadgeText: {
    color: COLORS.today,
    fontSize: 15,
    fontWeight: '800',
  },
  goalProgressBadgeDivider: {
    color: COLORS.today,
    fontWeight: '600',
    opacity: 0.6,
  },
  cardEditBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  habitDescription: {
    color: COLORS.subtext,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    textAlign: 'right',
  },
  habitCounterRow: {
    flexDirection: 'row-reverse',
    marginTop: 14,
  },
  habitCounterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  habitCounterChipActive: {
    borderColor: COLORS.text,
  },
  habitCounterChipActiveSuccess: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  habitCounterChipActiveFail: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  habitCounterValueActive: {
    color: '#FFFFFF',
  },
  habitCounterLabelActive: {
    color: '#FFFFFF',
  },
  habitCounterChipDisabled: {
    opacity: 0.35,
  },
  habitCounterValue: {
    fontSize: 17,
    fontWeight: '800',
    marginLeft: 6,
  },
  habitCounterLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ---- Floating Action Button (iOS Glass Style) ---- */
  fab: {
    position: 'absolute',
    left: 20,
    bottom: 28,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },

  /* ---- Apple Bottom Sheet Modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 28,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 18,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 18,
    letterSpacing: -0.3,
  },
  inputLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    textAlign: 'right',
    marginBottom: 16,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row-reverse',
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    marginLeft: 10,
  },
  modalButtonCancelText: {
    color: COLORS.subtext,
    fontSize: 15,
    fontWeight: '600',
  },
  modalButtonCreate: {
    backgroundColor: COLORS.primary,
  },
  modalButtonCreateText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Detail Screen Components ---- */
  detailHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  detailHeaderTextWrap: {
    flex: 1,
  },
  detailTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.4,
  },
  detailSubtitle: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 2,
    textAlign: 'right',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },

  scheduleChipRow: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scheduleChip: {
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  scheduleChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },

  /* ---- Stats Inset Cards ---- */
  statsRow: {
    flexDirection: 'row-reverse',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginLeft: 8,
  },
  statIconDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  statLabel: {
    color: COLORS.subtext,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
    textAlign: 'center',
  },

  /* ---- Calendar Grid Card ---- */
  calendarCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  calendarNavRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  calendarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMonthLabel: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    paddingBottom: 8,
  },
  weekdayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 2,
  },
  weekdayText: {
    color: COLORS.dim,
    fontSize: 12,
    fontWeight: '600',
  },
  calendarGrid: {
    flexDirection: 'column',
    marginTop: 2,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayCircle: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCircleToday: {
    borderColor: COLORS.today,
    borderWidth: 1.5,
    backgroundColor: COLORS.todaySoft,
  },
  dayCircleSuccess: {
    backgroundColor: COLORS.successSoft,
  },
  dayCircleFail: {
    backgroundColor: COLORS.errorSoft,
  },
  dayNumber: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  dayNumberToday: {
    color: COLORS.today,
    fontWeight: '800',
  },
  dayNumberMarked: {
    fontSize: 10,
  },

  /* ---- Action Card ---- */
  actionCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  actionQuestion: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 14,
    lineHeight: 24,
  },
  actionHintText: {
    color: COLORS.today,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    marginBottom: 12,
    lineHeight: 18,
  },
  actionButtonsRow: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
  },
  actionButtonYes: {
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(48,209,88,0.3)',
  },
  actionButtonYesActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  actionButtonNo: {
    backgroundColor: COLORS.errorSoft,
    borderColor: 'rgba(255,69,58,0.3)',
  },
  actionButtonNoActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  actionButtonDisabled: {
    opacity: 0.35,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  actionButtonYesText: {
    color: COLORS.success,
  },
  actionButtonNoText: {
    color: COLORS.error,
  },
  actionButtonTextActive: {
    color: '#FFFFFF',
  },

  /* ---- Delete Button ---- */
  deleteBtn: {
    flexDirection: 'row-reverse',
    backgroundColor: COLORS.errorSoft,
    borderColor: 'rgba(255,69,58,0.3)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Description Card ---- */
  descriptionCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  descriptionLabel: {
    color: COLORS.dim,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 6,
  },
  descriptionText: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'right',
    lineHeight: 22,
  },

  /* ---- Goal Card ---- */
  goalCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  goalHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  goalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  goalChip: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  goalChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  goalProgressTrack: {
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.cardSurface,
    overflow: 'hidden',
    marginBottom: 16,
  },
  goalProgressFill: {
    height: 7,
    borderRadius: 3.5,
  },
  goalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalStepBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStepBtnPlus: {
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
  },
  goalStepBtnText: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: '600',
    marginTop: -2,
  },
  goalCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  goalCount: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  goalCountDivider: {
    color: COLORS.dim,
    fontWeight: '500',
  },
  goalRemaining: {
    color: COLORS.subtext,
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },

  /* ---- Reorder Row ---- */
  reorderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  reorderBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  reorderHint: {
    color: COLORS.subtext,
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },

  /* ---- Drag-and-drop Reorder List ---- */
  reorderDragHint: {
    color: COLORS.subtext,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  reorderDragSlot: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  reorderDragRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: REORDER_ROW_HEIGHT - 8,
    marginBottom: 8,
  },
  reorderDragRowActive: {
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  reorderDragRowTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  reorderDragHandle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ---- Finish Reorder Button ---- */
  finishReorderBtn: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  finishReorderBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ---- Notifications Modal ---- */
  notifSwitchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  notifSwitchLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  notifTimeCard: {
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  notifTimeLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  notifTimeHint: {
    color: COLORS.subtext,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 18,
  },
  notifTestBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTestBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---- Backup Export/Import ---- */
  backupEntryRow: {
    flexDirection: 'row-reverse',
    marginTop: 14,
    gap: 10,
  },
  backupEntryBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.3)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  backupEntryBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  backupSectionLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 14,
    marginBottom: 8,
  },
  backupScopeRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  backupScopeBtn: {
    flex: 1,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  backupScopeBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  backupScopeBtnText: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '700',
  },
  backupScopeBtnTextActive: {
    color: '#FFFFFF',
  },
  backupCategoryList: {
    marginTop: 8,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  backupCheckboxRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 10,
  },
  backupCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLORS.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardSurface,
  },
  backupCheckboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  backupCheckboxLocked: {
    opacity: 0.6,
  },
  backupCheckboxLabel: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'right',
    flex: 1,
  },
  backupFilePickBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 4,
  },
  backupFilePickBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  modalButtonDisabled: {
    opacity: 0.4,
  },

  /* ---- Day Selector Pills ---- */
  daySelectorRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 6,
  },
  daySelectorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cardSurface,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelectorCircleSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  daySelectorText: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '700',
  },
  daySelectorTextSelected: {
    color: '#FFFFFF',
  },
});
