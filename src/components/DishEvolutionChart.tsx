/**
 * BiteNote 吃一口 — 品項歷次評分與價格演變視覺化元件
 * 呈現同一道料理第 1 次吃、第 2 次吃、第 3 次吃…的「評分折線」與「價格漲跌軌跡」
 */

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import {
  BiteLog,
  EnrichedDish,
  PHOTO_FILTERS,
  VERDICT_OPTIONS,
} from '../types/models';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';

interface DishEvolutionChartProps {
  dish: EnrichedDish;
  colors: ThemeColors;
  onAddVisit: (dish: EnrichedDish) => void;
  onDeleteLog?: (logId: string) => void;
  onPressPhoto?: (dish: EnrichedDish, log: BiteLog) => void;
}

export const DishEvolutionChart: React.FC<DishEvolutionChartProps> = ({
  dish,
  colors,
  onAddVisit,
  onDeleteLog,
  onPressPhoto,
}) => {
  const logs = dish.logs;
  const chartWidth = 320;
  const chartHeight = 148;
  const padLeft = 36;
  const padRight = 32;
  const padTop = 26;
  const padBottom = 30;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = chartHeight - padTop - padBottom;

  const prices = logs.map((l) => l.price);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 100;
  const priceSpan = Math.max(maxPrice - minPrice, 20);

  const getPointX = (idx: number) => {
    if (logs.length <= 1) return padLeft + plotW / 2;
    return padLeft + (idx / (logs.length - 1)) * plotW;
  };

  // 評分座標 (1.0 ~ 5.0 對應 plotH)
  const getRatingY = (rating: number) => {
    const clamped = Math.max(0.5, Math.min(5, rating));
    const ratio = (clamped - 0.5) / 4.5;
    return padTop + plotH * (1 - ratio);
  };

  // 價格座標
  const getPriceY = (price: number) => {
    if (maxPrice === minPrice) return padTop + plotH * 0.65;
    const ratio = (price - minPrice) / priceSpan;
    return padTop + plotH * (1 - ratio * 0.75 - 0.1);
  };

  const ratingPoints = logs.map((log, i) => ({
    x: getPointX(i),
    y: getRatingY(log.rating),
    log,
  }));

  const pricePoints = logs.map((log, i) => ({
    x: getPointX(i),
    y: getPriceY(log.price),
    log,
  }));

  const ratingPath = ratingPoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    ratingPoints.length >= 2
      ? `${ratingPath} L ${ratingPoints[ratingPoints.length - 1].x.toFixed(1)} ${(
          padTop + plotH
        ).toFixed(1)} L ${ratingPoints[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`
      : '';

  const pricePath = pricePoints
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
    .join(' ');

  const latestMeta = VERDICT_OPTIONS[dish.latestVerdict];

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* 品項頂部摘要票根 */}
      <View style={[styles.receiptHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleArea}>
          <View style={styles.categoryBadgeRow}>
            <View style={[styles.categoryChip, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.categoryChipText, { color: colors.inkSecondary }]}>
                {dish.category}
              </Text>
            </View>
            <View
              style={[
                styles.verdictChip,
                {
                  backgroundColor: colors.isDark ? latestMeta.bgDark : latestMeta.bgLight,
                },
              ]}
            >
              <Text
                style={[
                  styles.verdictChipText,
                  { color: colors.isDark ? latestMeta.colorDark : latestMeta.colorLight },
                ]}
              >
                {latestMeta.emoji} 最新判定：{latestMeta.label}
              </Text>
            </View>
          </View>

          <Text style={[styles.dishTitle, { color: colors.ink }]}>{dish.name}</Text>
          <Text style={[styles.evolutionText, { color: colors.inkSecondary }]}>
            {dish.evolutionSummary}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`為 ${dish.name} 新增下一次品嚐紀錄`}
          onPress={() => onAddVisit(dish)}
          style={({ pressed }) => [
            styles.addVisitBtn,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={styles.addVisitBtnText}>＋ 再吃一口（第 {dish.visitCount + 1} 次）</Text>
        </Pressable>
      </View>

      {/* 三格關鍵指標對比：初次 vs 最新評分、初次 vs 最新價格、累計次數 */}
      <View style={[styles.metricsGrid, { backgroundColor: colors.surfaceSubtle }]}>
        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.inkMuted }]}>評分演變</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>
            {dish.visitCount >= 2
              ? `${dish.firstRating.toFixed(1)}★ → ${dish.latestRating.toFixed(1)}★`
              : `${dish.latestRating.toFixed(1)}★`}
          </Text>
          <Text
            style={[
              styles.metricSub,
              {
                color:
                  dish.ratingDelta < 0
                    ? colors.priceUp
                    : dish.ratingDelta > 0
                    ? colors.herb
                    : colors.inkSecondary,
              },
            ]}
          >
            {dish.visitCount >= 2
              ? dish.ratingDelta < 0
                ? `▼ 下降 ${Math.abs(dish.ratingDelta).toFixed(1)} 分`
                : dish.ratingDelta > 0
                ? `▲ 上升 ${dish.ratingDelta.toFixed(1)} 分`
                : '● 維持穩定'
              : `平均 ${dish.averageRating.toFixed(1)} 分`}
          </Text>
        </View>

        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.inkMuted }]}>價格軌跡</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>
            {dish.visitCount >= 2 && dish.firstPrice !== dish.latestPrice
              ? `$${dish.firstPrice} → $${dish.latestPrice}`
              : `NT$${dish.latestPrice}`}
          </Text>
          <Text
            style={[
              styles.metricSub,
              {
                color: dish.isPriceUp
                  ? colors.priceUp
                  : dish.priceDelta < 0
                  ? colors.herb
                  : colors.inkSecondary,
              },
            ]}
          >
            {dish.isPriceUp
              ? `▲ 漲價 $${dish.priceDelta} (+${dish.priceChangePercent}%)`
              : dish.priceDelta < 0
              ? `▼ 降價 $${Math.abs(dish.priceDelta)}`
              : '● 價格未變動'}
          </Text>
        </View>

        <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

        <View style={styles.metricCell}>
          <Text style={[styles.metricLabel, { color: colors.inkMuted }]}>品嚐次數</Text>
          <Text style={[styles.metricValue, { color: colors.ink }]}>共 {dish.visitCount} 次</Text>
          <Text style={[styles.metricSub, { color: colors.inkSecondary }]}>
            最近：{dish.latestVisitedAt}
          </Text>
        </View>
      </View>

      {/* SVG 雙軌走勢圖（當品嚐 >= 2 次時顯示完整演變折線） */}
      {logs.length >= 2 && (
        <View style={[styles.chartBox, { borderColor: colors.border }]}>
          <View style={styles.chartLegendRow}>
            <Text style={[styles.chartTitle, { color: colors.inkSecondary }]}>
              歷次評分與價格走勢圖
            </Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
                <Text style={[styles.legendText, { color: colors.inkSecondary }]}>個人評分 (★)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.ochre }]} />
                <Text style={[styles.legendText, { color: colors.inkSecondary }]}>當下價格 ($)</Text>
              </View>
            </View>
          </View>

          <View style={styles.svgWrapper}>
            <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
              <Defs>
                <LinearGradient id="ratingGrad" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.22" />
                  <Stop offset="100%" stopColor={colors.accent} stopOpacity="0.0" />
                </LinearGradient>
              </Defs>

              {/* 背景水平參考線 */}
              {[5, 3, 1].map((star) => {
                const y = getRatingY(star);
                return (
                  <React.Fragment key={star}>
                    <Line
                      x1={padLeft}
                      y1={y}
                      x2={chartWidth - padRight}
                      y2={y}
                      stroke={colors.border}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <SvgText
                      x={padLeft - 8}
                      y={y + 4}
                      fontSize="10"
                      fill={colors.inkMuted}
                      textAnchor="end"
                    >
                      {`${star}★`}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* 評分漸層區域 */}
              {areaPath ? <Path d={areaPath} fill="url(#ratingGrad)" /> : null}

              {/* 價格虛線軌跡 */}
              <Path
                d={pricePath}
                fill="none"
                stroke={colors.ochre}
                strokeWidth="2"
                strokeDasharray="4 3"
              />

              {/* 評分實線軌跡 */}
              <Path d={ratingPath} fill="none" stroke={colors.accent} strokeWidth="2.8" />

              {/* 價格節點與標籤 */}
              {pricePoints.map((pt, idx) => (
                <React.Fragment key={`p_${pt.log.id}`}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3.5"
                    fill={colors.surface}
                    stroke={colors.ochre}
                    strokeWidth="2"
                  />
                  <SvgText
                    x={pt.x}
                    y={pt.y + 14}
                    fontSize="9.5"
                    fontWeight="600"
                    fill={colors.ochre}
                    textAnchor="middle"
                  >
                    {`$${pt.log.price}`}
                  </SvgText>
                </React.Fragment>
              ))}

              {/* 評分節點與第 N 次標籤 */}
              {ratingPoints.map((pt, idx) => (
                <React.Fragment key={`r_${pt.log.id}`}>
                  <Circle
                    cx={pt.x}
                    cy={pt.y}
                    r="5"
                    fill={colors.accent}
                    stroke={colors.surface}
                    strokeWidth="2"
                  />
                  <SvgText
                    x={pt.x}
                    y={pt.y - 9}
                    fontSize="10.5"
                    fontWeight="700"
                    fill={colors.ink}
                    textAnchor="middle"
                  >
                    {`${pt.log.rating.toFixed(1)}★`}
                  </SvgText>
                  <SvgText
                    x={pt.x}
                    y={chartHeight - 6}
                    fontSize="10"
                    fill={colors.inkSecondary}
                    textAnchor="middle"
                  >
                    {`第 ${idx + 1} 次`}
                  </SvgText>
                </React.Fragment>
              ))}
            </Svg>
          </View>
        </View>
      )}

      {/* 歷次品嚐時間軸清單（由最新到第 1 次，清楚標示每次感想與漲跌） */}
      <View style={styles.timelineSection}>
        <Text style={[styles.timelineSectionTitle, { color: colors.inkSecondary }]}>
          歷次品嚐手帳紀錄（共 {logs.length} 筆）
        </Text>

        {[...logs].reverse().map((log, reversedIndex) => {
          const visitNumber = logs.length - reversedIndex;
          const prevLog: BiteLog | undefined =
            visitNumber >= 2 ? logs[visitNumber - 2] : undefined;
          const diffPrice = prevLog ? log.price - prevLog.price : 0;
          const diffRating = prevLog
            ? Math.round((log.rating - prevLog.rating) * 10) / 10
            : 0;
          const verdictMeta = VERDICT_OPTIONS[log.verdict];
          const filterMeta =
            PHOTO_FILTERS.find((f) => f.id === log.photoFilter) || PHOTO_FILTERS[0];

          return (
            <View
              key={log.id}
              style={[
                styles.logCard,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.border,
                },
              ]}
            >
              {/* 左側拍立得食物照片（點擊可放大回味當下照片與細節） */}
              {log.photoUri ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`放大檢視 ${dish.name} 第 ${visitNumber} 次品嚐照片`}
                  onPress={() => onPressPhoto && onPressPhoto(dish, log)}
                  style={({ pressed }) => [
                    styles.polaroidFrame,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Image
                    source={{ uri: log.photoUri }}
                    style={styles.logPhoto}
                    resizeMode="cover"
                  />
                  {filterMeta.overlayOpacity > 0 && (
                    <View
                      pointerEvents="none"
                      style={[
                        StyleSheet.absoluteFillObject,
                        {
                          backgroundColor: filterMeta.overlayColor,
                          opacity: filterMeta.overlayOpacity,
                          borderRadius: RADIUS.sm,
                        },
                      ]}
                    />
                  )}
                  <View style={styles.zoomHintOverlay}>
                    <Text style={styles.zoomHintOverlayText}>🔍</Text>
                  </View>
                  <View style={styles.visitBadgeOverlay}>
                    <Text style={styles.visitBadgeOverlayText}>第 {visitNumber} 次吃</Text>
                  </View>
                </Pressable>
              ) : (
                <View
                  style={[
                    styles.noPhotoBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.noPhotoEmoji}>{verdictMeta.emoji}</Text>
                  <Text style={[styles.noPhotoLabel, { color: colors.inkMuted }]}>
                    第 {visitNumber} 次吃
                  </Text>
                </View>
              )}

              {/* 右側當下評分、價格變化與感想 */}
              <View style={styles.logContent}>
                <View style={styles.logTopRow}>
                  <View style={styles.visitTagGroup}>
                    <Text style={[styles.visitDateText, { color: colors.inkMuted }]}>
                      {log.visitedAt}
                    </Text>
                    <View
                      style={[
                        styles.verdictStamp,
                        {
                          backgroundColor: colors.isDark
                            ? verdictMeta.bgDark
                            : verdictMeta.bgLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.verdictStampText,
                          {
                            color: colors.isDark
                              ? verdictMeta.colorDark
                              : verdictMeta.colorLight,
                          },
                        ]}
                      >
                        {verdictMeta.emoji} {verdictMeta.label}
                      </Text>
                    </View>
                  </View>

                  {onDeleteLog && logs.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`刪除第 ${visitNumber} 次品嚐紀錄`}
                      onPress={() => onDeleteLog(log.id)}
                      style={styles.deleteBtn}
                    >
                      <Text style={[styles.deleteBtnText, { color: colors.inkMuted }]}>刪除</Text>
                    </Pressable>
                  )}
                </View>

                {/* 評分與當下價格列 */}
                <View style={styles.priceRatingRow}>
                  <View style={styles.ratingBox}>
                    <Text style={[styles.ratingScore, { color: colors.accent }]}>
                      ★ {log.rating.toFixed(1)}
                    </Text>
                    {prevLog && diffRating !== 0 && (
                      <Text
                        style={[
                          styles.deltaMiniText,
                          { color: diffRating > 0 ? colors.herb : colors.priceUp },
                        ]}
                      >
                        ({diffRating > 0 ? `+${diffRating}` : diffRating})
                      </Text>
                    )}
                  </View>

                  <View style={styles.priceBox}>
                    <Text style={[styles.priceScore, { color: colors.ink }]}>
                      NT${log.price}
                    </Text>
                    {prevLog && diffPrice !== 0 && (
                      <View
                        style={[
                          styles.priceDeltaBadge,
                          {
                            backgroundColor:
                              diffPrice > 0 ? colors.priceUpSoft : colors.herbSoft,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.priceDeltaBadgeText,
                            { color: diffPrice > 0 ? colors.priceUp : colors.herb },
                          ]}
                        >
                          {diffPrice > 0
                            ? `▲ 比上次貴 $${diffPrice}`
                            : `▼ 比上次便宜 $${Math.abs(diffPrice)}`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* 當下品嚐感想 */}
                <Text style={[styles.logNoteText, { color: colors.ink }]}>
                  {log.note || '（無填寫文字感想）'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  receiptHeader: {
    width: '100%',
    borderBottomWidth: 1,
    paddingBottom: SPACING.md,
    marginBottom: SPACING.md,
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  headerTitleArea: {
    width: '100%',
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  categoryChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.sans,
  },
  verdictChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  verdictChipText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.sans,
  },
  dishTitle: {
    width: '100%',
    fontSize: 19,
    fontWeight: '800',
    fontFamily: FONTS.serif,
    lineHeight: 26,
    marginBottom: 4,
  },
  evolutionText: {
    width: '100%',
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: FONTS.sans,
  },
  addVisitBtn: {
    width: '100%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addVisitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.sans,
    textAlign: 'center',
  },
  metricsGrid: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    marginBottom: SPACING.md,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  metricDivider: {
    width: 1,
    marginVertical: 4,
  },
  metricLabel: {
    fontSize: 11,
    marginBottom: 2,
    fontFamily: FONTS.sans,
    textAlign: 'center',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    marginBottom: 2,
    textAlign: 'center',
  },
  metricSub: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: FONTS.sans,
    textAlign: 'center',
  },
  chartBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  chartLegendRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.sans,
  },
  legendItems: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontFamily: FONTS.sans,
  },
  svgWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineSection: {
    width: '100%',
    gap: SPACING.sm,
  },
  timelineSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
    fontFamily: FONTS.sans,
  },
  logCard: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 10,
    alignItems: 'flex-start',
  },
  polaroidFrame: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  logPhoto: {
    width: '100%',
    height: '100%',
  },
  visitBadgeOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(18, 17, 16, 0.78)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  visitBadgeOverlayText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '700',
  },
  zoomHintOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(18, 17, 16, 0.68)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHintOverlayText: {
    fontSize: 11,
  },
  noPhotoBox: {
    width: 80,
    height: 80,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  noPhotoEmoji: {
    fontSize: 22,
    marginBottom: 4,
  },
  noPhotoLabel: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  logContent: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  logTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  visitTagGroup: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  visitDateText: {
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  verdictStamp: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verdictStampText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  deleteBtn: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    flexShrink: 0,
  },
  deleteBtnText: {
    fontSize: 11,
  },
  priceRatingRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  ratingScore: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  deltaMiniText: {
    fontSize: 10.5,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  priceScore: {
    fontSize: 13.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  priceDeltaBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  priceDeltaBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  logNoteText: {
    width: '100%',
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FONTS.sans,
  },
});
