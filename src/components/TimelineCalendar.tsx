import React, { useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BiteLog,
  EnrichedDish,
  PHOTO_FILTERS,
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

function getWeekdayStr(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length < 3) return '';
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  return weekdays[d.getDay()] || '';
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

  // 彈窗輪播狀態：被點選的日期字串 (YYYY-MM-DD) 以及當前翻閱卡牌索引 (0..N-1)
  const [activeDeckDateStr, setActiveDeckDateStr] = useState<string | null>(null);
  const [deckIndex, setDeckIndex] = useState<number>(0);

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
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToday = () => {
    setViewDate(new Date());
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

  // 點擊日期觸發卡牌彈窗
  const handleOpenDayDeck = (dateStr: string) => {
    setActiveDeckDateStr(dateStr);
    setDeckIndex(0);
  };

  // 關閉彈窗
  const handleCloseDayDeck = () => {
    setActiveDeckDateStr(null);
    setDeckIndex(0);
  };

  // 彈窗內當天的所有紀錄
  const activeDeckEntries = useMemo(() => {
    if (!activeDeckDateStr) return [];
    return entriesByDate.get(activeDeckDateStr) || [];
  }, [activeDeckDateStr, entriesByDate]);

  const currentDeckEntry = activeDeckEntries[deckIndex] || null;

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
              點擊任一日期，彈出翻閱當日拍立得卡牌
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

            const isToday = item.dateStr === todayStr;
            const hasLogs = item.entries.length > 0;
            const firstLog = hasLogs ? item.entries[0].log : null;

            return (
              <Pressable
                key={item.dateStr}
                accessibilityRole="button"
                accessibilityLabel={`${item.dateStr}，共 ${item.entries.length} 筆美食紀錄，點擊彈出卡牌`}
                onPress={() => handleOpenDayDeck(item.dateStr)}
                style={({ pressed }) => [
                  styles.dayCell,
                  {
                    borderColor: isToday ? colors.accent : colors.border,
                    backgroundColor: hasLogs ? colors.surfaceElevated : colors.surface,
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
                        color: isToday ? colors.accent : colors.ink,
                        fontWeight: isToday || hasLogs ? '800' : '500',
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

      {/* 2. 下方當月手帳總覽清單 (Month Overview Stream) */}
      <View style={styles.monthOverviewSection}>
        <View style={styles.monthOverviewHeaderRow}>
          <Text style={[styles.monthOverviewTitle, { color: colors.ink }]}>
            📖 {currentYear} 年 {currentMonth} 月手帳總覽
          </Text>
          <Text style={[styles.monthOverviewCountText, { color: colors.inkSecondary }]}>
            （共 {monthEntries.length} 筆）
          </Text>
        </View>

        {monthEntries.length === 0 ? (
          <View
            style={[
              styles.emptyStateBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={styles.emptyStateEmoji}>🍽️</Text>
            <Text style={[styles.emptyStateTitle, { color: colors.ink }]}>
              {currentYear} 年 {currentMonth} 月尚未記錄任何品嚐
            </Text>
            <Text style={[styles.emptyStateDesc, { color: colors.inkSecondary }]}>
              點擊上方日曆中任一天，或點擊下方按鈕，開始寫下專屬的美食手帳！
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="記一口新味道"
              onPress={() => onOpenComposerForDate(todayStr)}
              style={({ pressed }) => [
                styles.emptyActionBtn,
                { backgroundColor: colors.accent, opacity: pressed ? 0.88 : 1 },
              ]}
            >
              <Text style={styles.emptyActionBtnText}>📷 ＋ 記一口新味道</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.polaroidGrid, isWideScreen && styles.polaroidGridWide]}>
            {monthEntries.map(({ log, dish, visitIndex, prevPrice }) => {
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
                    accessibilityLabel={`放大檢視 ${dish.name} 照片`}
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
                            🔍 點擊放大
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
                      accessibilityLabel={`放大檢視 ${dish.name}`}
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

      {/* =====================================================================
       * 3. 方案 1：左右滑動拍立得卡牌輪播彈窗 (Day Food Journal Card Deck Modal)
       * =================================================================== */}
      <Modal
        visible={!!activeDeckDateStr}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDayDeck}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="點擊背景關閉手帳彈窗"
            style={StyleSheet.absoluteFillObject}
            onPress={handleCloseDayDeck}
          />

          <View
            style={[
              styles.deckModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: '#000',
              },
            ]}
          >
            {/* 彈窗頂部刊頭列 */}
            <View style={[styles.deckModalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.deckModalHeaderLeft}>
                <View style={[styles.deckDateBadge, { backgroundColor: colors.accentSoft }]}>
                  <Text style={[styles.deckDateBadgeText, { color: colors.accent }]}>
                    📅 {activeDeckDateStr} {activeDeckDateStr ? getWeekdayStr(activeDeckDateStr) : ''}
                  </Text>
                </View>
                <Text style={[styles.deckCountText, { color: colors.inkSecondary }]}>
                  {activeDeckEntries.length > 0
                    ? `共 ${activeDeckEntries.length} 筆美食`
                    : '尚無紀錄'}
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉手帳卡牌視窗"
                onPress={handleCloseDayDeck}
                style={({ pressed }) => [
                  styles.deckCloseBtn,
                  { backgroundColor: colors.surfaceSubtle, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.deckCloseBtnText, { color: colors.ink }]}>✕</Text>
              </Pressable>
            </View>

            {/* 彈窗主內容：若當天有吃美食，展示卡牌輪播；若無，展示補記按鈕 */}
            {activeDeckEntries.length > 0 && currentDeckEntry ? (
              <ScrollView
                style={styles.deckCardScroll}
                contentContainerStyle={styles.deckCardScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {/* 多筆時的左右切換控制列 (Card Deck Switcher) */}
                {activeDeckEntries.length > 1 && (
                  <View
                    style={[
                      styles.deckPaginationBar,
                      { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="翻閱前一筆美食"
                      disabled={deckIndex <= 0}
                      onPress={() => setDeckIndex((prev) => Math.max(0, prev - 1))}
                      style={({ pressed }) => [
                        styles.deckNavArrowBtn,
                        deckIndex <= 0 && { opacity: 0.25 },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={[styles.deckNavArrowText, { color: colors.ink }]}>‹ 前一餐</Text>
                    </Pressable>

                    <View style={styles.deckDotsRow}>
                      {activeDeckEntries.map((_, i) => (
                        <Pressable
                          key={`dot-${i}`}
                          onPress={() => setDeckIndex(i)}
                          style={[
                            styles.deckDot,
                            {
                              backgroundColor: i === deckIndex ? colors.accent : colors.borderStrong,
                              width: i === deckIndex ? 18 : 6,
                            },
                          ]}
                        />
                      ))}
                      <Text style={[styles.deckPageIndicatorText, { color: colors.inkSecondary }]}>
                        {deckIndex + 1} / {activeDeckEntries.length}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="翻閱下一筆美食"
                      disabled={deckIndex >= activeDeckEntries.length - 1}
                      onPress={() =>
                        setDeckIndex((prev) =>
                          Math.min(activeDeckEntries.length - 1, prev + 1)
                        )
                      }
                      style={({ pressed }) => [
                        styles.deckNavArrowBtn,
                        deckIndex >= activeDeckEntries.length - 1 && { opacity: 0.25 },
                        pressed && { opacity: 0.6 },
                      ]}
                    >
                      <Text style={[styles.deckNavArrowText, { color: colors.ink }]}>後一餐 ›</Text>
                    </Pressable>
                  </View>
                )}

                {/* 當前卡牌 (Polaroid Card) */}
                <View
                  style={[
                    styles.deckPolaroidFrame,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`放大檢視 ${currentDeckEntry.dish.name} 照片`}
                    onPress={() => {
                      handleCloseDayDeck();
                      onOpenLightbox(currentDeckEntry.dish, currentDeckEntry.log);
                    }}
                    style={styles.deckImageWrapper}
                  >
                    {currentDeckEntry.log.photoUri ? (
                      <>
                        <Image
                          source={{ uri: currentDeckEntry.log.photoUri }}
                          style={styles.deckImage}
                          resizeMode="cover"
                        />
                        <View style={styles.deckZoomTag}>
                          <Text style={styles.deckZoomTagText}>🔍 點擊放大照片</Text>
                        </View>
                      </>
                    ) : (
                      <View
                        style={[
                          styles.deckImage,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            alignItems: 'center',
                            justifyContent: 'center',
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 44 }}>
                          {VERDICT_OPTIONS[currentDeckEntry.log.verdict].emoji}
                        </Text>
                      </View>
                    )}

                    {/* 評價徽章印記 */}
                    <View style={styles.deckImageBadgesRow}>
                      <View style={styles.deckDarkPill}>
                        <Text style={styles.deckDarkPillText}>
                          第 {currentDeckEntry.visitIndex} 次吃
                        </Text>
                      </View>

                      <View
                        style={[
                          styles.deckVerdictPill,
                          {
                            backgroundColor: colors.isDark
                              ? VERDICT_OPTIONS[currentDeckEntry.log.verdict].bgDark
                              : VERDICT_OPTIONS[currentDeckEntry.log.verdict].bgLight,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.deckVerdictText,
                            {
                              color: colors.isDark
                                ? VERDICT_OPTIONS[currentDeckEntry.log.verdict].colorDark
                                : VERDICT_OPTIONS[currentDeckEntry.log.verdict].colorLight,
                            },
                          ]}
                        >
                          {VERDICT_OPTIONS[currentDeckEntry.log.verdict].emoji}{' '}
                          {VERDICT_OPTIONS[currentDeckEntry.log.verdict].label}
                        </Text>
                      </View>
                    </View>
                  </Pressable>

                  {/* 內文詳情 */}
                  <View style={styles.deckBody}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`前往店家 ${currentDeckEntry.dish.placeName}`}
                      onPress={() => {
                        handleCloseDayDeck();
                        onNavigateToPlace(currentDeckEntry.dish.placeId);
                      }}
                      style={styles.deckPlaceBtn}
                    >
                      <Text style={[styles.deckPlaceText, { color: colors.accent }]}>
                        📍 {currentDeckEntry.dish.placeName} →
                      </Text>
                    </Pressable>

                    <Text style={[styles.deckDishTitle, { color: colors.ink }]}>
                      {currentDeckEntry.dish.name}
                    </Text>

                    <View style={styles.deckPriceRatingRow}>
                      <Text style={[styles.deckRatingText, { color: colors.accent }]}>
                        ★ {currentDeckEntry.log.rating.toFixed(1)} 分
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.deckPriceText, { color: colors.ink }]}>
                          NT${currentDeckEntry.log.price}
                        </Text>
                        {typeof currentDeckEntry.prevPrice === 'number' &&
                          currentDeckEntry.log.price - currentDeckEntry.prevPrice > 0 && (
                            <Text style={[styles.deckPriceUpText, { color: colors.priceUp }]}>
                              (▲漲 ${currentDeckEntry.log.price - currentDeckEntry.prevPrice})
                            </Text>
                          )}
                      </View>
                    </View>

                    {currentDeckEntry.log.note ? (
                      <View
                        style={[
                          styles.deckNoteBox,
                          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.deckNoteText, { color: colors.inkSecondary }]}>
                          「{currentDeckEntry.log.note}」
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* 當日補記另外一餐之行動鈕 */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="為這一天補記另外一餐"
                  onPress={() => {
                    const targetDate = activeDeckDateStr;
                    handleCloseDayDeck();
                    if (targetDate) onOpenComposerForDate(targetDate);
                  }}
                  style={({ pressed }) => [
                    styles.deckAddAnotherBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.deckAddAnotherText, { color: colors.ink }]}>
                    ＋ 補記這天的另一餐
                  </Text>
                </Pressable>
              </ScrollView>
            ) : (
              /* 當天無紀錄時的專屬空狀態 */
              <View style={styles.deckEmptyBox}>
                <Text style={styles.deckEmptyEmoji}>🍽️</Text>
                <Text style={[styles.deckEmptyTitle, { color: colors.ink }]}>
                  這一天尚未記錄用餐
                </Text>
                <Text style={[styles.deckEmptyDesc, { color: colors.inkSecondary }]}>
                  您在這一天吃了什麼令人難忘的味道？立即為這一天寫下手帳與評分！
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="立即補記這天的味道"
                  onPress={() => {
                    const targetDate = activeDeckDateStr;
                    handleCloseDayDeck();
                    if (targetDate) onOpenComposerForDate(targetDate);
                  }}
                  style={({ pressed }) => [
                    styles.deckEmptyActionBtn,
                    { backgroundColor: colors.accent, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Text style={styles.deckEmptyActionBtnText}>
                    📷 補記 {activeDeckDateStr} 的味道
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
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
    width: '13.4%',
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
  monthOverviewSection: {
    width: '100%',
    gap: SPACING.md,
  },
  monthOverviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  monthOverviewTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  monthOverviewCountText: {
    fontSize: 13,
    fontWeight: '600',
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

  // =========================================================================
  // 方案 1：卡牌輪播彈窗 (Day Food Journal Card Deck Modal Styles)
  // =========================================================================
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 18, 16, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  deckModalCard: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  deckModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  deckModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deckDateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  deckDateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  deckCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deckCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckCloseBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  deckCardScroll: {
    width: '100%',
  },
  deckCardScrollContent: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  deckPaginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  deckNavArrowBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  deckNavArrowText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deckDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deckDot: {
    height: 6,
    borderRadius: 3,
  },
  deckPageIndicatorText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
    marginLeft: 4,
  },
  deckPolaroidFrame: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 12,
  },
  deckImageWrapper: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
  },
  deckImage: {
    width: '100%',
    height: '100%',
  },
  deckZoomTag: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(20, 18, 16, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  deckZoomTagText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  deckImageBadgesRow: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deckDarkPill: {
    backgroundColor: 'rgba(20, 18, 16, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  deckDarkPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  deckVerdictPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  deckVerdictText: {
    fontSize: 11,
    fontWeight: '800',
  },
  deckBody: {
    gap: 6,
  },
  deckPlaceBtn: {
    alignSelf: 'flex-start',
  },
  deckPlaceText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  deckDishTitle: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONTS.serif,
  },
  deckPriceRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  deckRatingText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  deckPriceText: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  deckPriceUpText: {
    fontSize: 12,
    fontWeight: '800',
  },
  deckNoteBox: {
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: 2,
  },
  deckNoteText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONTS.serif,
    fontStyle: 'italic',
  },
  deckAddAnotherBtn: {
    width: '100%',
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckAddAnotherText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  deckEmptyBox: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deckEmptyEmoji: {
    fontSize: 40,
  },
  deckEmptyTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    fontFamily: FONTS.serif,
    textAlign: 'center',
  },
  deckEmptyDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
  },
  deckEmptyActionBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
  },
  deckEmptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
