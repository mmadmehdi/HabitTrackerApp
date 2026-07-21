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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

/* ============================================================
   CONSTANTS
   ============================================================ */

const STORAGE_KEY = '@habit_tracker_data_v2';
const NOTIF_SETTINGS_KEY = '@habit_tracker_notif_settings_v1';
const NOTIF_CHANNEL_ID = 'habit_urgent_channel';
const NOTIF_BATCH_SIZE = 200;

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

/* ---------- Premium midnight design system ---------- */
const COLORS = {
  bg: '#000000',
  card: '#1C1C1E',
  cardBorder: 'rgba(255,255,255,0.09)',
  input: '#2C2C2E',

  primary: '#0A84FF',
  primarySoft: 'rgba(10,132,255,0.16)',

  success: '#63E6D8',
  successSoft: 'rgba(99,230,216,0.14)',
  successDeep: '#0F3D38',

  error: '#FF453A',
  errorSoft: 'rgba(255,69,58,0.14)',

  today: '#FF9F0A',
  todaySoft: 'rgba(255,159,10,0.16)',

  text: '#FFFFFF',
  subtext: 'rgba(235,235,245,0.60)',
  dim: 'rgba(235,235,245,0.30)',

  overlay: 'rgba(0,0,0,0.78)',
};

const WEEKDAYS_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']; // 0=شنبه … 6=جمعه
const WEEKDAYS_FA_DISPLAY = [...WEEKDAYS_FA].reverse();
const WEEKDAYS_FULL_FA = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
const MONTHS_FA = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/* ============================================================
   HELPERS
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

/* ---------- تبدیل شمسی <-> میلادی ---------- */

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
  return (jsDay + 1) % 7; // 0 = شنبه
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
}

function getIncompleteHabitTitles(habits, categories, todayKey) {
  const parts = todayKey.split('-');
  const jy = parseInt(parts[0], 10);
  const jm = parseInt(parts[1], 10);
  const jd = parseInt(parts[2], 10);
  return habits
    .filter((h) => (h.history || {})[todayKey] !== 'success')
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

/* ============================================================
   REUSABLE UI PIECES
   ============================================================ */

const AnimatedPressable = memo(function AnimatedPressable({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
  disabled,
  scaleTo = 0.97,
  hitSlop,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scale, {
      toValue: scaleTo,
      useNativeDriver: true,
      stiffness: 420,
      damping: 30,
      mass: 1,
    }).start();
  }, [scale, scaleTo]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      stiffness: 420,
      damping: 30,
      mass: 1,
    }).start();
  }, [scale]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
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
   DETAIL SCREEN
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
          <Text style={[styles.dayMark, { color: COLORS.success }]}>✓</Text>
        )}
        {status === 'fail' && dayIsScheduled && (
          <Text style={[styles.dayMark, { color: COLORS.error }]}>✕</Text>
        )}
      </View>
    </TouchableOpacity>
  );
});

const HabitDetailScreen = memo(function HabitDetailScreen({ habit, categories, onBack, onDelete, onSetStatus, onClearStatus, onBumpProgress, onEdit }) {
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

  const successLabel = hasDayRestriction ? 'موفقیت از روزهای برنامه‌ریزی' : 'موفقیت از روزهای ایجاد';
  const failLabel = hasDayRestriction ? 'شکست از روزهای برنامه‌ریزی' : 'شکست از روزهای ایجاد';
  const createdLabel = hasDayRestriction ? 'روزهای برنامه‌ریزی‌شده' : 'روزهای ایجاد شده';

  return (
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backBtn}>
          <Text style={styles.backBtnText}>➔</Text>
        </TouchableOpacity>
        <View style={styles.detailHeaderTextWrap}>
          <Text style={styles.detailTitle} numberOfLines={1}>
            {habit.title}
          </Text>
          <Text style={styles.detailSubtitle}>
            {toPersianDigits(todayJalali[2])} {MONTHS_FA[todayJalali[1] - 1]} {toPersianDigits(todayJalali[0])}
          </Text>
        </View>
        <TouchableOpacity onPress={onEdit} activeOpacity={0.7} style={styles.editBtn}>
          <Text style={styles.editBtnText}>✎</Text>
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
              <Text style={styles.calendarNavBtnText}>›</Text>
            </TouchableOpacity>
            <Text style={styles.calendarMonthLabel}>
              {MONTHS_FA[view.jm - 1]} {toPersianDigits(view.jy)}
            </Text>
            <TouchableOpacity onPress={goPrevMonth} activeOpacity={0.7} style={styles.calendarNavBtn}>
              <Text style={styles.calendarNavBtnText}>‹</Text>
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
                <Text style={styles.goalStepBtnText}>+</Text>
              </TouchableOpacity>

              <View style={styles.goalCenter}>
                <Text style={styles.goalCount}>
                  {toPersianDigits(todayProgress)}
                  <Text style={styles.goalCountDivider}> / </Text>
                  {toPersianDigits(habit.goal)}
                </Text>
                <Text style={styles.goalRemaining}>
                  {remaining > 0
                    ? `${toPersianDigits(remaining)} بار تا تکمیل هدف مانده`
                    : 'هدف امروز کامل شد 🎉'}
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
              این عادت امروز برنامه‌ریزی نشده است؛ فقط می‌توانید موفقیت را ثبت کنید و ثبت شکست در این روز انجام نمی‌شود.
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
          <Text style={styles.deleteBtnText}>حذف کامل این عادت</Text>
        </TouchableOpacity>
      </ScrollView>

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
            <Text style={styles.dayMenuTitle}>ویرایش وضعیت این روز</Text>

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
   HOME SCREEN
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
      style={[styles.habitCard, isCompletedToday && styles.habitCardCompleted]}
      scaleTo={0.98}
      onPress={reorderMode ? undefined : handlePress}
      onLongPress={onLongPress}
      delayLongPress={450}
    >
      <View style={styles.habitCardTop}>
        <View style={styles.habitTitleWrap}>
          <Text style={styles.habitTitle} numberOfLines={1}>
            {habit.title}
          </Text>
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
              <Text style={styles.completedBadgeText}>✓ امروز انجام شد</Text>
            </View>
          )}
        </View>
        {!reorderMode && (
          <TouchableOpacity
            onPress={handleEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.cardEditBtn}
          >
            <Text style={styles.cardEditBtnText}>✎</Text>
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
            <Text style={styles.reorderBtnText}>▾</Text>
          </TouchableOpacity>
          <Text style={styles.reorderHint}>برای جابه‌جایی از دکمه‌ها استفاده کنید</Text>
          <TouchableOpacity
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            onPress={handleMoveUp}
          >
            <Text style={styles.reorderBtnText}>▴</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.habitCounterRow}>
          <AnimatedPressable
            style={[
              styles.habitCounterChip,
              { backgroundColor: COLORS.successSoft },
              todayStatus === 'success' && styles.habitCounterChipActive,
            ]}
            onPress={handleSetSuccess}
          >
            <Text style={[styles.habitCounterValue, { color: COLORS.success }]}>
              {toPersianDigits(successCount)}
            </Text>
            <Text style={styles.habitCounterLabel}>موفقیت</Text>
          </AnimatedPressable>
          <AnimatedPressable
            disabled={!todayIsScheduled}
            style={[
              styles.habitCounterChip,
              { backgroundColor: COLORS.errorSoft },
              todayStatus === 'fail' && styles.habitCounterChipActive,
              !todayIsScheduled && styles.habitCounterChipDisabled,
            ]}
            onPress={handleSetFail}
          >
            <Text style={[styles.habitCounterValue, { color: COLORS.error }]}>
              {toPersianDigits(failCount)}
            </Text>
            <Text style={styles.habitCounterLabel}>شکست</Text>
          </AnimatedPressable>
        </View>
      )}
    </AnimatedPressable>
  );
});

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
            <Text style={styles.catReorderBtnText}>›</Text>
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
            <Text style={styles.catReorderBtnText}>‹</Text>
          </TouchableOpacity>

          {category.id !== DEFAULT_CATEGORY_ID && (
            <TouchableOpacity
              style={styles.catDeleteBtn}
              onPress={handleDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.catDeleteBtnText}>✕</Text>
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
    <View style={{ marginBottom: 14 }}>
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
            <Text style={styles.categoryAddTabText}>+</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {categoryReorderMode && (
        <View style={styles.categoryReorderBanner}>
          <Text style={styles.categoryReorderBannerText}>تغییر ترتیب بخش‌ها</Text>
          <TouchableOpacity
            style={styles.categoryReorderDoneBtn}
            activeOpacity={0.8}
            onPress={onFinishCategoryReorder}
          >
            <Text style={styles.categoryReorderDoneBtnText}>تایید ترتیب بخش‌ها</Text>
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
}) {
  const insets = useSafeAreaInsets();
  const [todayJy, todayJm, todayJd] = getTodayJalali();
  const todayKey = dateKey(todayJy, todayJm, todayJd);

  const categoryHabits = useMemo(
    () => habits.filter((h) => (h.categoryId || DEFAULT_CATEGORY_ID) === activeCategoryId),
    [habits, activeCategoryId]
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
          <Text style={styles.homeTitle}>🌱 ایجاد و مدیریت عادت‌ها</Text>
          <Text style={styles.homeSubtitle}>عادت‌های خود را بسازید و روزانه پیگیری کنید</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsBtn}
          activeOpacity={0.7}
          onPress={onOpenSettings}
        >
          <Text style={styles.settingsBtnText}>⚙️</Text>
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
                <Text style={styles.todaySummaryDateText}>
                  امروز · {toPersianDigits(todayJd)} {MONTHS_FA[todayJm - 1]}
                </Text>
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
                  { width: `${Math.min(100, (successToday / denominatorForToday) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.todaySummaryLabel}>عادت موفق امروز</Text>
          </View>
        </View>
      )}

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
              <Text style={styles.emptyStateIcon}>🌱</Text>
            </View>
            <Text style={styles.emptyStateText}>هنوز عادتی در این بخش ایجاد نکرده‌اید</Text>
            <Text style={styles.emptyStateSubtext}>
              با دکمه + پایین صفحه، اولین عادت این بخش را بسازید
            </Text>
          </View>
        ) : (
          categoryHabits.map((h, idx) => (
            <HabitCard
              key={h.id}
              habit={h}
              categories={categories}
              onOpenHabit={onOpenHabit}
              onEditHabit={onEditHabit}
              onLongPress={onEnterReorder}
              reorderMode={reorderMode}
              onMoveHabit={onMoveHabit}
              isFirst={idx === 0}
              isLast={idx === categoryHabits.length - 1}
              isCompletedToday={(h.history || {})[todayKey] === 'success'}
              todayKey={todayKey}
              onIncrementGoal={onIncrementGoal}
              onSetStatus={onSetStatus}
            />
          ))
        )}
      </ScrollView>

      {reorderMode ? (
        <TouchableOpacity
          style={[styles.finishReorderBtn, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.8}
          onPress={onFinishReorder}
        >
          <Text style={styles.finishReorderBtnText}>پایان ترتیب عادت‌ها</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.8}
          onPress={onOpenModal}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

/* ============================================================
   ROOT APP
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
  const [reorderMode, setReorderMode] = useState(false);
  const [categoryReorderMode, setCategoryReorderMode] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeCategoryId, setActiveCategoryId] = useState(DEFAULT_CATEGORY_ID);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryDaySelections, setCategoryDaySelections] = useState([]);
  const [notifSettings, setNotifSettings] = useState(DEFAULT_NOTIF_SETTINGS);
  const [notifLoaded, setNotifLoaded] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [notifDraft, setNotifDraft] = useState(DEFAULT_NOTIF_SETTINGS);

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
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;
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
    if (!loaded || !notifLoaded) return;
    scheduleHabitReminder(habits, categories, notifSettings);
  }, [habits, categories, notifSettings, loaded, notifLoaded]);

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

  const openCreateModal = useCallback(() => {
    setEditingHabitId(null);
    setTitleInput('');
    setDescInput('');
    setGoalInput('');
    setModalVisible(true);
  }, []);

  const openEditModal = useCallback((habit) => {
    setEditingHabitId(habit.id);
    setTitleInput(habit.title);
    setDescInput(habit.description || '');
    setGoalInput(habit.goal ? String(habit.goal) : '');
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

    if (editingHabitId) {
      const next = habits.map((h) =>
        h.id === editingHabitId
          ? { ...h, title: trimmedTitle, description: descInput.trim(), goal }
          : h
      );
      persist(next);
    } else {
      const newHabit = {
        id: uid(),
        title: trimmedTitle,
        description: descInput.trim(),
        goal,
        categoryId: activeCategoryId,
        createdAt: new Date().toISOString(),
        history: {},
        progress: {},
      };
      persist([newHabit, ...habits]);
    }
    setModalVisible(false);
  }, [titleInput, descInput, goalInput, editingHabitId, habits, activeCategoryId, persist]);

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
      const idx = habits.findIndex((h) => h.id === habitId);
      if (idx < 0) return;
      const newIdx = idx + direction;
      if (newIdx < 0 || newIdx >= habits.length) return;
      const next = [...habits];
      const [item] = next.splice(idx, 1);
      next.splice(newIdx, 0, item);
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
    <View style={{ flex: 1 }}>
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
          />
        </View>
      )}

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
                placeholder="مثلاً: مطالعه روزانه"
                placeholderTextColor={COLORS.dim}
                value={titleInput}
                onChangeText={setTitleInput}
                textAlign="right"
              />

              <Text style={styles.inputLabel}>توضیحات (اختیاری)</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                placeholder="توضیح کوتاهی درباره این عادت..."
                placeholderTextColor={COLORS.dim}
                value={descInput}
                onChangeText={setDescInput}
                textAlign="right"
                multiline
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>هدف روزانه - تعداد دفعات (اختیاری)</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: 3"
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
                trackColor={{ false: COLORS.cardBorder, true: COLORS.primary }}
                thumbColor="#FFFFFF"
              />
              <Text style={styles.notifSwitchLabel}>یادآور روزانه فعال باشد</Text>
            </View>

            {notifDraft.enabled && (
              <View style={styles.notifTimeCard}>
                <Text style={styles.notifTimeLabel}>یادآوری هر چند دقیقه یک‌بار ارسال شود</Text>
                <TextInput
                  style={styles.input}
                  placeholder="مثلاً: 30"
                  placeholderTextColor={COLORS.dim}
                  value={String(notifDraft.intervalMinutes)}
                  onChangeText={setDraftInterval}
                  textAlign="center"
                  keyboardType="number-pad"
                />
                <Text style={styles.notifTimeHint}>
                  به‌جای زمان مشخص، هر {toPersianDigits(notifDraft.intervalMinutes || '')} دقیقه یک‌بار
                  (تا وقتی عادتی ناتمام مانده) یادآوری ارسال می‌شود.
                </Text>
                <TouchableOpacity
                  style={styles.notifTestBtn}
                  activeOpacity={0.7}
                  onPress={handleTestNotification}
                >
                  <Text style={styles.notifTestBtnText}>ارسال نوتیفیکیشن تست (همین الان)</Text>
                </TouchableOpacity>
              </View>
            )}

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
              <Text style={styles.modalTitle}>بخش جدید</Text>

              <Text style={styles.inputLabel}>نام بخش</Text>
              <TextInput
                style={styles.input}
                placeholder="مثلاً: برنامه جمعه"
                placeholderTextColor={COLORS.subtext}
                value={categoryNameInput}
                onChangeText={setCategoryNameInput}
                textAlign="right"
              />

              <Text style={styles.inputLabel}>روزهای هفته (اختیاری - در صورت عدم انتخاب، همه روزها فعال است)</Text>
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

export default function App() {
  return (
    <SafeAreaProvider>
      <RootApp />
    </SafeAreaProvider>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  dayMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    borderRadius: 18,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  dayMenuTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  dayMenuOption: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: COLORS.bg,
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
    borderColor: 'rgba(99,230,216,0.35)',
  },
  dayMenuOptionSuccessText: {
    color: COLORS.success,
    fontSize: 15,
    fontWeight: '700',
  },
  dayMenuOptionFail: {
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderColor: 'rgba(255,69,58,0.35)',
  },
  dayMenuOptionFailText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },
  dayMenuOptionCancel: {
    backgroundColor: 'transparent',
    marginBottom: 0,
  },
  dayMenuOptionCancelText: {
    color: COLORS.subtext,
    fontSize: 14,
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

  /* ---- Home header ---- */
  homeHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
  },
  homeHeader: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginLeft: 20,
  },
  settingsBtnText: {
    fontSize: 18,
  },
  homeTitle: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: -0.4,
    lineHeight: 34,
  },
  homeSubtitle: {
    color: COLORS.subtext,
    fontSize: 15,
    lineHeight: 21,
    marginTop: 6,
    textAlign: 'right',
    letterSpacing: 0.1,
  },
  homeScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  emptyScrollContent: {
    flexGrow: 1,
    paddingBottom: 120,
  },

  /* ---- Category tabs ---- */
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
    paddingHorizontal: 16,
    paddingVertical: 9,
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
    fontWeight: '700',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
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
    width: 38,
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 0,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryAddTabText: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  categoryTabReorderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  catReorderBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catReorderBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginTop: -2,
  },
  catDeleteBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.errorSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  catDeleteBtnText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '800',
  },
  categoryReorderBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  categoryReorderBannerText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  categoryReorderDoneBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  categoryReorderDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  /* ---- Today summary hero ---- */
  todaySummaryRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  todaySummaryBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
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
    paddingVertical: 6,
  },
  todaySummaryDateText: {
    color: COLORS.today,
    fontSize: 13,
    fontWeight: '700',
  },
  todaySummaryFraction: {
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  summaryProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.input,
    marginTop: 14,
    overflow: 'hidden',
  },
  summaryProgressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  todaySummaryLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    marginTop: 10,
    fontWeight: '600',
    textAlign: 'right',
  },

  /* ---- Empty state ---- */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyStateIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyStateIcon: {
    fontSize: 40,
  },
  emptyStateText: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    color: COLORS.subtext,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
    textAlign: 'center',
  },

  /* ---- Habit card ---- */
  habitCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 3,
  },
  habitCardCompleted: {
    backgroundColor: COLORS.successDeep,
    borderColor: 'rgba(99,230,216,0.45)',
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
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    flexShrink: 1,
  },
  completedBadge: {
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(99,230,216,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
  },
  completedBadgeText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '700',
  },
  goalProgressBadge: {
    backgroundColor: COLORS.todaySoft,
    borderColor: 'rgba(255,159,10,0.45)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginRight: 10,
  },
  goalProgressBadgeText: {
    color: COLORS.today,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  goalProgressBadgeDivider: {
    color: COLORS.today,
    fontWeight: '600',
    opacity: 0.6,
  },
  cardEditBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardEditBtnText: {
    color: COLORS.subtext,
    fontSize: 16,
  },
  habitDescription: {
    color: COLORS.subtext,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
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
    paddingVertical: 8,
    marginLeft: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  habitCounterChipActive: {
    borderColor: COLORS.text,
  },
  habitCounterChipDisabled: {
    opacity: 0.4,
  },
  habitCounterValue: {
    fontSize: 19,
    fontWeight: '800',
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  habitCounterLabel: {
    color: COLORS.subtext,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ---- FAB ---- */
  fab: {
    position: 'absolute',
    left: 20,
    bottom: 28,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '400',
    marginTop: Platform.OS === 'ios' ? -2 : -3,
  },

  /* ---- Modal ---- */
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 28,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.cardBorder,
    marginBottom: 18,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  inputLabel: {
    color: COLORS.subtext,
    fontSize: 14,
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
    marginBottom: 18,
  },
  inputMultiline: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  modalButtonsRow: {
    flexDirection: 'row-reverse',
    marginTop: 6,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'transparent',
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    marginLeft: 12,
  },
  modalButtonCancelText: {
    color: COLORS.subtext,
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonCreate: {
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  modalButtonCreateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ---- Detail header ---- */
  detailHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  backBtnText: {
    color: COLORS.text,
    fontSize: 20,
  },
  detailHeaderTextWrap: {
    flex: 1,
  },
  detailTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'right',
    letterSpacing: 0.2,
  },
  detailSubtitle: {
    color: COLORS.subtext,
    fontSize: 14,
    marginTop: 4,
    textAlign: 'right',
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  editBtnText: {
    color: COLORS.primary,
    fontSize: 18,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 60,
  },

  /* ---- Schedule chip row (detail screen) ---- */
  scheduleChipRow: {
    flexDirection: 'row-reverse',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  scheduleChip: {
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  scheduleChipText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },

  /* ---- Stats ---- */
  statsRow: {
    flexDirection: 'row-reverse',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    marginLeft: 8,
  },
  statIconDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statIconDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  statLabel: {
    color: COLORS.subtext,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
    textAlign: 'center',
  },

  /* ---- Calendar ---- */
  calendarCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  calendarNavRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  calendarNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarNavBtnText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: -2,
  },
  calendarMonthLabel: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
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
    paddingVertical: 4,
  },
  weekdayText: {
    color: COLORS.dim,
    fontSize: 13,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'column',
    marginTop: 4,
  },
  calendarWeekRow: {
    flexDirection: 'row',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dayCircle: {
    width: '84%',
    height: '84%',
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
    fontSize: 14,
    fontWeight: '500',
  },
  dayNumberToday: {
    color: COLORS.today,
    fontWeight: '800',
  },
  dayNumberMarked: {
    fontSize: 11,
  },
  dayMark: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: -2,
  },

  /* ---- Action card ---- */
  actionCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  actionQuestion: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 26,
  },
  actionHintText: {
    color: COLORS.today,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'right',
    marginBottom: 12,
    lineHeight: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row-reverse',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    borderWidth: 1,
  },
  actionButtonYes: {
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(99,230,216,0.35)',
  },
  actionButtonYesActive: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButtonNo: {
    backgroundColor: COLORS.errorSoft,
    borderColor: 'rgba(255,69,58,0.35)',
  },
  actionButtonNoActive: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '800',
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

  /* ---- Delete ---- */
  deleteBtn: {
    backgroundColor: COLORS.errorSoft,
    borderColor: 'rgba(255,69,58,0.35)',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  deleteBtnText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: '700',
  },

  /* ---- Description card ---- */
  descriptionCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  descriptionLabel: {
    color: COLORS.dim,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  descriptionText: {
    color: COLORS.text,
    fontSize: 15,
    textAlign: 'right',
    lineHeight: 24,
  },

  /* ---- Goal / progress card ---- */
  goalCard: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  goalHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  goalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'right',
  },
  goalChip: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  goalChipText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  goalProgressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.input,
    overflow: 'hidden',
    marginBottom: 18,
  },
  goalProgressFill: {
    height: 8,
    borderRadius: 4,
  },
  goalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalStepBtn: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalStepBtnPlus: {
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
  },
  goalStepBtnText: {
    color: COLORS.primary,
    fontSize: 26,
    fontWeight: '700',
    marginTop: -2,
  },
  goalCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  goalCount: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  goalCountDivider: {
    color: COLORS.dim,
    fontWeight: '600',
  },
  goalRemaining: {
    color: COLORS.subtext,
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },

  /* ---- Reorder mode ---- */
  reorderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  reorderBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBtnDisabled: {
    opacity: 0.3,
  },
  reorderBtnText: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  reorderHint: {
    color: COLORS.subtext,
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },

  /* ---- Finish reorder button ---- */
  finishReorderBtn: {
    position: 'absolute',
    left: 20,
    right: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  finishReorderBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },

  /* ---- Notification settings modal ---- */
  notifSwitchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  notifSwitchLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'right',
  },
  notifTimeCard: {
    backgroundColor: COLORS.input,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
  },
  notifTimeLabel: {
    color: COLORS.subtext,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 10,
  },
  notifTimeHint: {
    color: COLORS.subtext,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
  },
  notifTestBtn: {
    marginTop: 14,
    backgroundColor: COLORS.primarySoft,
    borderColor: 'rgba(10,132,255,0.35)',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTestBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  /* ---- Day selector for category creation ---- */
  daySelectorRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    marginBottom: 18,
    gap: 8,
  },
  daySelectorCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.input,
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
    fontSize: 14,
    fontWeight: '700',
  },
  daySelectorTextSelected: {
    color: '#FFFFFF',
  },
});
