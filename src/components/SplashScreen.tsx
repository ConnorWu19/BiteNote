/**
 * BiteNote 吃一口 — 極簡清爽・雜誌級應用程式啟動畫面 (SplashScreen)
 * 遵循 AGENTS.md 專案品質標準（Awwwards / Webby / FWA 頂尖設計水準）
 * 方案 A 特性：
 * 1. 充足且舒適的閱讀時間（2.4 秒）：讓手機效能再好也能從容品味朱泥落墨、刊頭與飲食心語。
 * 2. 隨手點擊即刻開飯：點擊螢幕任意處即啟動 260ms 流暢淡出，隨時秒進主頁面，絕不拖泥帶水。
 * 3. 純原生輕量驅動：零 WebGL / 零 Lottie / 零高負載著色器，手機不發燙、純 60fps。
 * 4. 雙主題完美適應：亞麻和紙（淺色）與深夜食堂（深色）自適應高對比。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';

export interface SplashScreenProps {
  colors: ThemeColors;
  onFinish?: () => void;
  minDurationMs?: number; // 啟動畫面平穩展示之自然時間（預設 2400ms，確保品牌視覺溫潤完整）
  statusHint?: string;    // 自訂載入狀態字樣
}

export const TASTE_QUOTES = [
  '「每一口滋味，皆是歲月的註腳。」',
  '「只向自己的舌尖交代，不向演算法妥協。」',
  '「漲跌起伏的是價格，歷久彌新的是味覺記憶。」',
  '「用心記下食物的溫度，留下舌尖的誠實軌跡。」',
];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  colors,
  onFinish,
  minDurationMs = 2400,
  statusHint,
}) => {
  // 動畫控制器（純原生驅動，零硬體負擔）
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stampOpacity = useRef(new Animated.Value(0)).current;
  const isExitingRef = useRef<boolean>(false);

  // 隨機抽選一句舌尖格言
  const [quote] = useState<string>(() => {
    const idx = Math.floor(Math.random() * TASTE_QUOTES.length);
    return TASTE_QUOTES[idx];
  });

  // 輕量微狀態提示
  const [microStatus, setMicroStatus] = useState<string>('正在喚醒味蕾記憶…');

  // 觸發淡出離開（支援點擊螢幕任意處立即觸發）
  const triggerExit = useCallback(() => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    const useNative = Platform.OS !== 'web';

    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 260,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: useNative,
    }).start(() => {
      if (onFinish) onFinish();
    });
  }, [fadeAnim, onFinish]);

  useEffect(() => {
    const useNative = Platform.OS !== 'web';

    // 1. 溫潤落印與刊頭淡入 (Ease-out 柔和進入)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: useNative,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 520,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: useNative,
      }),
      Animated.timing(stampOpacity, {
        toValue: 1,
        duration: 380,
        easing: Easing.ease,
        useNativeDriver: useNative,
      }),
    ]).start();

    // 2. 髮絲紋進度條平滑推進
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: minDurationMs - 300,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();

    // 3. 微步驟文案輕量推進（節奏適應 2.4 秒舒適時間軸）
    const stepTimer1 = setTimeout(() => {
      if (!isExitingRef.current) {
        setMicroStatus('檢索本機私密食記軌跡…');
      }
    }, 800);

    const stepTimer2 = setTimeout(() => {
      if (!isExitingRef.current) {
        setMicroStatus('手帳就緒，準備開飯 🥢');
      }
    }, 1600);

    // 4. 自然時間到期時自動優雅離開
    const finishTimer = setTimeout(() => {
      triggerExit();
    }, minDurationMs);

    return () => {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(finishTimer);
    };
  }, [minDurationMs, triggerExit]);

  const progressWidthInterpolate = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView
      style={[
        styles.safeContainer,
        { backgroundColor: colors.canvas },
      ]}
    >
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.canvas}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="點擊螢幕任意處跳過啟動畫面並進入主手帳"
        onPress={triggerExit}
        style={styles.pressableRoot}
      >
        <Animated.View
          style={[
            styles.mainContent,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* 頂部極簡副標徽章 */}
          <View style={styles.topKickerRow}>
            <View
              style={[
                styles.kickerPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.kickerText, { color: colors.inkMuted }]}>
                LOCAL-FIRST TASTE ARCHIVE
              </Text>
            </View>
          </View>

          {/* 中央主視覺：雜誌級品牌刊頭 (Editorial Masthead Lockup) */}
          <View style={styles.centerHeroSection}>
            {/* 品牌刊頭主標：BiteNote 與 吃一口 典雅字體雙璧並列 */}
            <Animated.View
              style={[
                styles.titleGroup,
                { opacity: stampOpacity },
              ]}
            >
              <View style={styles.brandTitleRow}>
                <Text style={[styles.mainBrandEn, { color: colors.ink }]}>
                  BiteNote
                </Text>
                <Text style={[styles.mainBrandZh, { color: colors.accent }]}>
                  吃一口
                </Text>
              </View>
              <Text style={[styles.mainBrandCategory, { color: colors.inkSecondary }]}>
                私密飲食與味覺演變手帳
              </Text>
              <Text style={[styles.mainBrandManifesto, { color: colors.inkMuted }]}>
                每一口，只向自己的真實舌尖交代
              </Text>
            </Animated.View>

            {/* 溫暖的飲食心語題詞卡片 */}
            <View
              style={[
                styles.quoteCard,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                  borderLeftColor: colors.accent,
                },
              ]}
            >
              <Text style={[styles.quoteText, { color: colors.ink }]}>
                「{quote}」
              </Text>
              <Text style={[styles.quoteAuthor, { color: colors.inkMuted }]}>
                ✦ 每日隨想 · 舌尖手札
              </Text>
            </View>

            {/* 極簡微型載入指示器與進度條 */}
            <View style={styles.progressSection}>
              <View
                style={[
                  styles.progressBarTrack,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.progressBarFill,
                    {
                      backgroundColor: colors.accent,
                      width: progressWidthInterpolate,
                    },
                  ]}
                />
              </View>

              <Text style={[styles.statusHintText, { color: colors.inkMuted }]}>
                {statusHint || microStatus}
              </Text>
            </View>

            {/* 方案 A：醒目卻柔和的跳過提示徽章（點擊即刻開飯） */}
            <View style={styles.skipPromptRow}>
              <View
                style={[
                  styles.skipPromptPill,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.skipPromptText, { color: colors.inkMuted }]}>
                  點擊任意處立即進入 ➔
                </Text>
              </View>
            </View>
          </View>

          {/* 底部品質保證與版本宣示 */}
          <View style={styles.footerSection}>
            <View
              style={[
                styles.privacyPill,
                {
                  backgroundColor: colors.surfaceSubtle,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={styles.privacyLockEmoji}>🔒</Text>
              <Text style={[styles.privacyPillText, { color: colors.inkMuted }]}>
                100% 本機優先離線儲存・零社群追蹤・無廣告
              </Text>
            </View>

            <Text style={[styles.copyrightText, { color: colors.inkMuted }]}>
              BiteNote Studio © 2026 ・ Crafted for Honest Palates
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  pressableRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  topKickerRow: {
    marginTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.md,
    alignItems: 'center',
  },
  kickerPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  kickerText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 1.5,
    fontWeight: '700',
  },

  // 中央主視覺
  centerHeroSection: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 440,
    marginTop: -SPACING.md,
  },
  titleGroup: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: SPACING.sm + 2,
    marginBottom: 6,
  },
  mainBrandEn: {
    fontFamily: FONTS.serif,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -0.5,
    lineHeight: 48,
  },
  mainBrandZh: {
    fontFamily: FONTS.serif,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2.5,
    lineHeight: 34,
  },
  mainBrandCategory: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  mainBrandManifesto: {
    fontFamily: FONTS.serif,
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
  },
  quoteCard: {
    width: '100%',
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderLeftWidth: 3,
    marginBottom: SPACING.lg,
    alignItems: 'center',
  },
  quoteText: {
    fontFamily: FONTS.serif,
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  quoteAuthor: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.6,
  },

  // 髮絲紋進度條
  progressSection: {
    width: '100%',
    maxWidth: 240,
    alignItems: 'center',
    gap: 8,
    marginBottom: SPACING.md,
  },
  progressBarTrack: {
    width: '100%',
    height: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  statusHintText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.5,
  },

  // 點擊立即進入徽章
  skipPromptRow: {
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  skipPromptPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  skipPromptText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // 底部宣示
  footerSection: {
    alignItems: 'center',
    gap: SPACING.xs + 2,
    marginBottom: Platform.OS === 'ios' ? SPACING.sm : SPACING.xs,
  },
  privacyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    gap: 6,
  },
  privacyLockEmoji: {
    fontSize: 11,
  },
  privacyPillText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  copyrightText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 0.4,
  },
});
