import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BiteLog,
  EnrichedDish,
  PHOTO_FILTERS,
  PhotoFilter,
  TastingVerdict,
  VERDICT_OPTIONS,
} from '../types/models';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';

export interface TimelineEntry {
  log: BiteLog;
  dish: EnrichedDish;
  visitIndex: number;
  prevPrice?: number;
}

interface TimelineCalendarProps {
  entries: TimelineEntry[];
  colors: ThemeColors;
  onOpenLightbox: (dish: EnrichedDish, log: BiteLog) => void;
  onNavigateToPlace: (placeId: string) => void;
  onOpenComposerForDate: (dateStr: string) => void;
  isWideScreen?: boolean;
}

export const TimelineCalendar: React.FC<TimelineCalendarProps> = ({
  entries,
  colors,
  onOpenLightbox,
  onNavigateToPlace,
  onOpenComposerForDate,
  isWideScreen,
}) => {
  // 當前日曆檢視的年份與月份（預設為今天所在的年月）
  const [viewDate, setViewDate] = useState<Date>(() => new Date());
  // 使用者點選的特定日期（格式：YYYY-MM-DD，若為 null 則顯示該月份全部）
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth() + 1; // 1-12

  // 今天日期字串 (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  // 切換月份
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDateStr(null);
  };

  const handleGoToday = () => {
    setViewDate(new Date());
    setSelectedDateStr(todayStr);
  };

  // 整理所有紀錄以日期 (YYYY-MM-DD) 為 key 的 Map
  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>();
    for (const item of entries) {
      const dateKey = item.log.visitedAt ? item.log.visitedAt.slice(0, 10) : '';
      if (!dateKey) continue;
      const arr = map.get(dateKey) || [];
      arr.push(item);
      map.set(dateKey, arr);
    }
    return map;
  }, [entries]);

  // 當月所有日期計算
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0(日)~6(六)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
      entries: TimelineEntry[];
    }[] = [];

    // 前置空白格
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push({
        dayNum: 0,
        dateStr: `prev-${i}`,
        isCurrentMonth: false,
        entries: [],
      });
    }

    // 當月日期
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dayNum: d,
        dateStr,
        isCurrentMonth: true,
        entries: entriesByDate.get(dateStr) || [],
      });
    }

    return days;
  }, [currentYear, currentMonth, entriesByDate]);

  // 當前月份所有紀錄總數
  const monthEntries = useMemo(() => {
    const prefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    return entries.filter((e) => e.log.visitedAt && e.log.visitedAt.startsWith(prefix));
  }, [entries, currentYear, currentMonth]);

  // 目前下方展示的拍立得清單（選取某天則為當天，否則為當月全部）
  const displayEntries = useMemo(() => {
    if (selectedDateStr) {
      return entriesByDate.get(selectedDateStr) || [];
    }
    return monthEntries;
  }, [selectedDateStr, entriesByDate, monthEntries]);

  const WEEK_DAYS = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <View style={styles.container}>
      {/* 1. 日曆主卡片 (Calendar Card) */}
      <View
        style={[
          styles.calendarCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        {/* 月份切換標頭 */}
        <View style={styles.monthHeaderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一月份"
            onPress={handlePrevMonth}
            style={({ pressed }) => [
              styles.navMonthBtn,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.navMonthBtnText, { color: colors.ink }]}>‹</Text>
          </Pressable>

          <View style={styles.monthTitleCenter}>
            <View style={styles.monthTitleRow}>
              <Text style={[styles.monthTitleText, { color: colors.ink }]}>
                {currentYear} 年 {currentMonth} 月
              </Text>
              <View style={[styles.monthBadge, { backgroundColor: colors.accentSoft }]}>
                <Text style={[styles.monthBadgeText, { color: colors.accent }]}>
                  {monthEntries.length} 筆美食
                </Text>
              </View>
            </View>
            <Text style={[styles.monthSubText, { color: colors.inkMuted }]}>
              點擊日期查看手帳，或點空檔直接補記
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="回到本月今天"
              onPress={handleGoToday}
              style={({ pressed }) => [
                styles.todayShortcutBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.todayShortcutBtnText, { color: colors.inkSecondary }]}>
                今天
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="下一月份"
              onPress={handleNextMonth}
              style={({ pressed }) => [
                styles.navMonthBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.navMonthBtnText, { color: colors.ink }]}>›</Text>
            </Pressable>
          </View>
        </View>

        {/* 星期標頭 (週日 ~ 週六) */}
        <View style={styles.weekDaysRow}>
          {WEEK_DAYS.map((w, idx) => {
            const isWeekend = idx === 0 || idx === 6;
            return (
              <View key={w} style={styles.weekDayCol}>
                <Text
                  style={[
                    styles.weekDayText,
                    { color: isWeekend ? colors.accent : colors.inkMuted },
                  ]}
                >
                  {w}
                </Text>
              </View>
            );
          })}
        </View>

        {/* 日期格子網格 */}
        <View style={styles.daysGrid}>
          {calendarDays.map((item, index) => {
            if (!item.isCurrentMonth) {
              return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
            }

            const isSelected = selectedDateStr === item.dateStr;
            const isToday = item.dateStr === todayStr;
            const hasLogs = item.entries.length > 0;
            const firstLog = hasLogs ? item.entries[0].log : null;

            return (
              <Pressable
                key={item.dateStr}
                accessibilityRole="button"
                accessibilityLabel={`${item.dateStr}，共 ${item.entries.length} 筆美食紀錄`}
                onPress={() => {
                  if (isSelected) {
                    setSelectedDateStr(null);
                  } else {
                    setSelectedDateStr(item.dateStr);
                  }
                }}
                style={({ pressed }) => [
                  styles.dayCell,
                  {
                    borderColor: isSelected
                      ? colors.accent
                      : isToday
                      ? colors.borderStrong
                      : colors.border,
                    backgroundColor: isSelected
                      ? colors.accentSoft
                      : hasLogs
                      ? colors.surfaceElevated
                      : colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {/* 日期數字與今天小標記 */}
                <View style={styles.dayTopRow}>
                  <Text
                    style={[
                      styles.dayNumText,
                      {
                        color: isSelected
                          ? colors.accent
                          : isToday
                          ? colors.accent
                          : colors.ink,
                        fontWeight: isSelected || isToday || hasLogs ? '800' : '500',
                      },
                    ]}
                  >
                    {item.dayNum}
                  </Text>
                  {isToday && (
                    <View style={[styles.todayDot, { backgroundColor: colors.accent }]} />
                  )}
                </View>

                {/* 當日紀錄印記 / 照片縮圖 */}
                {hasLogs ? (
                  <View style={styles.dayLogIndicatorWrap}>
                    {firstLog?.photoUri ? (
                      <View style={[styles.dayThumbContainer, { borderColor: colors.border }]}>
                        <Image
                          source={{ uri: firstLog.photoUri }}
                          style={styles.dayThumb}
                          resizeMode="cover"
                        />
                      </View>
                    ) : (
                      <View style={[styles.dayHankoDot, { backgroundColor: colors.accent }]}>
                        <Text style={styles.dayHankoEmoji}>
                          {VERDICT_OPTIONS[firstLog?.verdict || 'solid'].emoji}
                        </Text>
                      </View>
                    )}

                    {/* 多筆時的小計數標籤 */}
                    {item.entries.length > 1 && (
                      <View
                        style={[
                          styles.dayCountBadge,
                          { backgroundColor: colors.ink, borderColor: colors.surface },
                        ]}
                      >
                        <Text style={[styles.dayCountText, { color: colors.canvas }]}>
                          {item.entries.length}
                        </Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.dayEmptyPlaceholder} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 2. 下方手帳詳情清單 (Entries for Selected Date or Current Month) */}
      <View style={styles.detailsSection}>
        <View style={styles.detailsHeaderRow}>
          <View style={styles.detailsTitleLeft}>
            <Text style={[styles.detailsSectionTitle, { color: colors.ink }]}>
              {selectedDateStr ? `📅 ${selectedDateStr} 品嚐手帳` : `📖 ${currentYear} 年 ${currentMonth} 月手帳全集`}
            </Text>
            <Text style={[styles.detailsCountTag, { color: colors.inkSecondary }]}>
              （共 {displayEntries.length} 筆）
            </Text>
          </View>

          {selectedDateStr && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="取消特定日期選取，查看當月全部"
              onPress={() => setSelectedDateStr(null)}
              style={({ pressed }) => [
                styles.clearFilterBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.clearFilterBtnText, { color: colors.inkSecondary }]}>
                查看當月全部 ✕
              </Text>
            </Pressable>
          )}
        </View>

        {/* 清單內容 */}
        {displayEntries.length === 0 ? (
          <View
            style={[
              styles.emptyStateBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={styles.emptyStateEmoji}>
              {selectedDateStr ? '🍽️' : '📖'}
            </Text>
            <Text style={[styles.emptyStateTitle, { color: colors.ink }]}>
              {selectedDateStr
                ? `${selectedDateStr} 沒有記錄任何用餐`
                : `${currentYear} 年 ${currentMonth} 月尚未有任何品嚐紀錄`}
            </Text>
            <Text style={[styles.emptyStateDesc, { color: colors.inkSecondary }]}>
              {selectedDateStr
                ? '點擊下方按鈕，直接為這一天補上美食照片與評分筆記！'
                : '點擊下方按鈕或右上角「＋ 記一口」，開始寫下專屬於你的第一筆手帳！'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={selectedDateStr ? `為 ${selectedDateStr} 補記一口` : '記一口新味道'}
              onPress={() => onOpenComposerForDate(selectedDateStr || todayStr)}
              style={({ pressed }) => [
                styles.emptyActionBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.emptyActionBtnText}>
                {selectedDateStr ? `📷 補記 ${selectedDateStr} 的味道` : '📷 ＋ 記一口新味道'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.polaroidGrid, isWideScreen && styles.polaroidGridWide]}>
            {displayEntries.map(({ log, dish, visitIndex, prevPrice }) => {
              const vMeta = VERDICT_OPTIONS[log.verdict];
              const fMeta =
                PHOTO_FILTERS.find((f) => f.id === log.photoFilter) ||
                PHOTO_FILTERS[0];
              const priceDiff =
                typeof prevPrice === 'number' ? log.price - prevPrice : 0;

              return (
                <View
                  key={log.id}
                  style={[
                    styles.polaroidCard,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`點擊放大回味 ${dish.name} 照片`}
                    onPress={() => onOpenLightbox(dish, log)}
                    style={styles.polaroidImageWrapper}
                  >
                    {log.photoUri ? (
                      <>
                        <Image
                          source={{ uri: log.photoUri }}
                          style={styles.polaroidImage}
                          resizeMode="cover"
                        />
                        {fMeta.overlayOpacity > 0 && (
                          <View
                            pointerEvents="none"
                            style={[
                              StyleSheet.absoluteFillObject,
                              {
                                backgroundColor: fMeta.overlayColor,
                                opacity: fMeta.overlayOpacity,
                              },
                            ]}
                          />
                        )}
                        <View style={styles.polaroidZoomOverlay}>
                          <Text style={styles.polaroidZoomOverlayText}>
                            🔍 點擊放大回味
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View
                        style={[
                          styles.polaroidImage,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 36 }}>{vMeta.emoji}</Text>
                      </View>
                    )}

                    <View style={styles.polaroidTopBadges}>
                      <View style={styles.polaroidDarkPill}>
                        <Text style={styles.polaroidDarkPillText}>
                          {log.visitedAt}・第 {visitIndex} 次吃
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.polaroidVerdictPill,
                          {
                            backgroundColor: colors.isDark
                              ? vMeta.bgDark
                              : vMeta.bgLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.polaroidVerdictText,
                            {
                              color: colors.isDark
                                ? vMeta.colorDark
                                : vMeta.colorLight,
                            },
                          ]}
                        >
                          {vMeta.emoji} {vMeta.label}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  <View style={styles.polaroidBody}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`查看店家 ${dish.placeName}`}
                      onPress={() => onNavigateToPlace(dish.placeId)}
                      style={styles.polaroidPlacePressable}
                    >
                      <Text style={[styles.polaroidPlaceText, { color: colors.accent }]}>
                        📍 {dish.placeName} →
                      </Text>
                    </Pressable>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`點擊放大檢視 ${dish.name}`}
                      onPress={() => onOpenLightbox(dish, log)}
                    >
                      <Text style={[styles.polaroidDishName, { color: colors.ink }]}>
                        {dish.name}
                      </Text>
                    </Pressable>

                    <View style={styles.polaroidPriceRatingRow}>
                      <Text style={[styles.polaroidRating, { color: colors.accent }]}>
                        ★ {log.rating.toFixed(1)} 分
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.polaroidPrice, { color: colors.ink }]}>
                          NT${log.price}
                        </Text>
                        {priceDiff > 0 && (
                          <Text style={[styles.polaroidPriceUp, { color: colors.priceUp }]}>
                            (▲漲 ${priceDiff})
                          </Text>
                        )}
                      </View>
                    </View>

                    <Text
                      numberOfLines={3}
                      style={[styles.polaroidNote, { color: colors.inkSecondary }]}
                    >
                      {log.note}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: SPACING.lg,
  },
  calendarCard: {
    width: '100%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  monthHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    gap: 8,
  },
  navMonthBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navMonthBtnText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
  monthTitleCenter: {
    alignItems: 'center',
    gap: 2,
  },
  monthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitleText: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONTS.serif,
  },
  monthBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  monthBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  monthSubText: {
    fontSize: 11,
  },
  todayShortcutBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  todayShortcutBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  weekDaysRow: {
    flexDirection: 'row',
    width: '100%',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.2)',
  },
  weekDayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    gap: 4,
    paddingVertical: 4,
  },
  dayCellEmpty: {
    width: '13.4%', // ~ 100% / 7
    aspectRatio: 1,
  },
  dayCell: {
    width: '13.4%',
    aspectRatio: 1,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 3,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  dayNumText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayLogIndicatorWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  dayThumbContainer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    borderWidth: 1,
  },
  dayThumb: {
    width: '100%',
    height: '100%',
  },
  dayHankoDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayHankoEmoji: {
    fontSize: 10,
  },
  dayCountBadge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 13,
    height: 13,
    borderRadius: 6.5,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  dayCountText: {
    fontSize: 8.5,
    fontWeight: '900',
  },
  dayEmptyPlaceholder: {
    height: 14,
  },
  detailsSection: {
    width: '100%',
    gap: SPACING.md,
  },
  detailsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 2,
  },
  detailsTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailsSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  detailsCountTag: {
    fontSize: 13,
    fontWeight: '600',
  },
  clearFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  clearFilterBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  emptyStateBox: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateEmoji: {
    fontSize: 36,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.serif,
    textAlign: 'center',
  },
  emptyStateDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    maxWidth: 360,
  },
  emptyActionBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  polaroidGrid: {
    width: '100%',
    gap: SPACING.md,
  },
  polaroidGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  polaroidCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 12,
  },
  polaroidImageWrapper: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidZoomOverlay: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(28, 25, 23, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  polaroidZoomOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  polaroidTopBadges: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  polaroidDarkPill: {
    backgroundColor: 'rgba(28, 25, 23, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  polaroidDarkPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  polaroidVerdictPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  polaroidVerdictText: {
    fontSize: 11,
    fontWeight: '800',
  },
  polaroidBody: {
    gap: 4,
  },
  polaroidPlacePressable: {
    alignSelf: 'flex-start',
  },
  polaroidPlaceText: {
    fontSize: 12,
    fontWeight: '700',
  },
  polaroidDishName: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  polaroidPriceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  polaroidRating: {
    fontSize: 13.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  polaroidPrice: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  polaroidPriceUp: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  polaroidNote: {
    fontSize: 13,
    lineHeight: 19,
  },
});
