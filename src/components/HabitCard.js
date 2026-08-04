// src/components/HabitCard.js
import React, { useMemo, useCallback, memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Check, Edit2, ChevronUp, ChevronDown } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';
import { toPersianDigits, getTodayJalali, isCategoryActiveOn, countFailuresOnScheduledDays } from '../utils/jalali';

export const HabitCard = memo(function HabitCard({
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
    () => categories.find((c) => c.id === (habit.categoryId || 'daily')),
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
          {hasGoal && !reorderMode && (
            <TouchableOpacity
              style={styles.goalProgressBadge}
              activeOpacity={0.6}
              onPress={handleIncrementGoal}
            >
              <Text style={styles.goalProgressBadgeText}>
                {toPersianDigits(todayProgress)} / {toPersianDigits(habit.goal)}
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
          <TouchableOpacity onPress={handleEdit} style={styles.cardEditBtn}>
            <Edit2 size={16} color={COLORS.subtext} />
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
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ChevronDown size={20} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.reorderHint}>جابه‌جایی موقعیت کارت</Text>
          <TouchableOpacity
            style={[styles.reorderBtn, isFirst && styles.reorderBtnDisabled]}
            disabled={isFirst}
            onPress={handleMoveUp}
            activeOpacity={0.75}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

const styles = StyleSheet.create({
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
    backgroundColor: COLORS.successSoft,
    borderColor: 'rgba(48,209,88,0.3)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    gap: 4,
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
    fontSize: 14,
    fontWeight: '800',
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
});
