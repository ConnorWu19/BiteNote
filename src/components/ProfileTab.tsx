/**
 * BiteNote 吃一口 — 「我的」個人手帳與設定中心 (Profile & Settings Tab)
 * 整合「登入身分與雲端同步」、「外觀深淺色主題」、「手帳備份與還原」與「API 金鑰自訂」
 * 遵循 Awwwards / Editorial Tactile Gastronomy 視覺與互動高標準
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { ThemeColors, FONTS, SPACING, RADIUS } from '../theme/theme';
import {
  AppSettings,
  UserProfile,
  Place,
  Dish,
  BiteLog,
  ThemeMode,
} from '../types/models';
import { signInWithGoogle, signInWithApple, DEFAULT_GOOGLE_CLIENT_ID } from '../services/oauth';

interface ProfileTabProps {
  settings: AppSettings;
  colors: ThemeColors;
  places: Place[];
  dishes: Dish[];
  biteLogs: BiteLog[];
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onLoginSuccess: (profile: UserProfile) => void;
  onLogout: () => void;
  onOpenAuthModal: () => void;
  onOpenBackupModal: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onExportBackup: () => void;
  onResetToSeed: () => void;
  onClearAllData: () => void;
  onShowToast: (msg: string, duration?: number) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  settings,
  colors,
  places,
  dishes,
  biteLogs,
  onUpdateSettings,
  onLoginSuccess,
  onLogout,
  onOpenAuthModal,
  onOpenBackupModal,
  onOpenPrivacy,
  onOpenTerms,
  onExportBackup,
  onResetToSeed,
  onClearAllData,
  onShowToast,
}) => {
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const currentUser = settings.userProfile;
  const isLoggedIn = currentUser && !currentUser.isGuest;

  const currentThemeMode: ThemeMode = settings.themeMode || 'system';

  const handleGoogleQuickSignIn = async () => {
    try {
      setOauthLoading('google');
      const activeClientId = settings.googleClientId || DEFAULT_GOOGLE_CLIENT_ID;
      const user = await signInWithGoogle(activeClientId);
      onLoginSuccess(user);
      onShowToast(`🎉 歡迎回來，${user.name}！已同步 Google 帳號`, 2000);
    } catch (err: any) {
      if (err.message === 'POPUP_CLOSED') {
        // 使用者主動取消，不跳紅字警示
        return;
      }
      onShowToast(`Google 登入提示：${err.message || '無法連線登入視窗'}，為您開啟身分面板`, 2500);
      onOpenAuthModal();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleQuickSignIn = async () => {
    try {
      setOauthLoading('apple');
      const activeServiceId = settings.appleServiceId || 'com.bitenote.web';
      const user = await signInWithApple(activeServiceId);
      onLoginSuccess(user);
      onShowToast(`🎉 歡迎回來，${user.name}！已同步 Apple ID`, 2000);
    } catch (err: any) {
      if (err.message === 'POPUP_CLOSED') {
        return;
      }
      onShowToast(`Apple 登入提示：${err.message || '驗證中斷'}，為您開啟身分面板`, 2500);
      onOpenAuthModal();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleThemeChange = (mode: ThemeMode) => {
    onUpdateSettings({ themeMode: mode });
    const labelMap: Record<ThemeMode, string> = {
      light: '亞麻和紙（淺色）',
      dark: '深夜食堂（深色）',
      system: '跟隨系統偏好',
    };
    onShowToast(`🎨 已切換外觀主題為「${labelMap[mode]}」`, 1200);
  };

  const handleConfirmResetSeed = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('確定要載入預設的台北私房拉麵與甜點示範資料嗎？現有資料將被示範內容覆蓋。');
      if (ok) {
        onResetToSeed();
        onShowToast('🌱 已重設為示範名冊與品項！');
      }
    } else {
      Alert.alert(
        '載入示範資料',
        '確定要載入預設的台北私房拉麵與甜點示範資料嗎？現有資料將被示範內容覆蓋。',
        [
          { text: '取消', style: 'cancel' },
          { text: '確定載入', style: 'destructive', onPress: onResetToSeed },
        ]
      );
    }
  };

  const handleConfirmClearAll = () => {
    if (Platform.OS === 'web') {
      const ok = window.confirm('⚠️ 警告：這將徹底清空本機的所有店家、菜單、評分與照片！此動作無法復原，是否確定？');
      if (ok) {
        onClearAllData();
      }
    } else {
      Alert.alert(
        '清空手帳所有資料',
        '⚠️ 警告：這將徹底清空本機的所有店家、菜單、評分與照片！此動作無法復原，是否確定？',
        [
          { text: '取消', style: 'cancel' },
          { text: '清空所有資料', style: 'destructive', onPress: onClearAllData },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* 頂部雜誌風標題 */}
      <View style={styles.headerBlock}>
        <View style={styles.badgeRow}>
          <Text
            style={[
              styles.eyebrowBadge,
              { backgroundColor: colors.accentSoft, color: colors.accent },
            ]}
          >
            ✦ BITENOTE PROFILE & SETTINGS
          </Text>
        </View>
        <Text style={[styles.headerTitle, { color: colors.ink }]}>
          我的手帳中心
        </Text>
        <Text style={[styles.headerSub, { color: colors.inkSecondary }]}>
          掌控身分同步、手帳外觀風格、雲端備份與私有資料主權
        </Text>
      </View>

      {/* =====================================================================
       * 區塊 1：個人身分與雲端狀態 (Profile & Identity Card)
       * =================================================================== */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>
            👤 個人身分與同步狀態
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="開啟完整身分管理"
            onPress={onOpenAuthModal}
            style={({ pressed }) => [
              styles.linkButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.linkButtonText, { color: colors.accent }]}>
              {isLoggedIn ? '帳號詳情 ❯' : '身分設定 ❯'}
            </Text>
          </Pressable>
        </View>

        {isLoggedIn ? (
          <View style={styles.loggedInRow}>
            <View
              style={[
                styles.avatarCircle,
                { backgroundColor: colors.accentSoft, borderColor: colors.accent },
              ]}
            >
              <Text style={styles.avatarEmoji}>
                {currentUser.avatarEmoji || (currentUser.provider === 'apple' ? '🍏' : '🌐')}
              </Text>
            </View>

            <View style={styles.userInfoCol}>
              <View style={styles.userNameRow}>
                <Text style={[styles.userNameText, { color: colors.ink }]}>
                  {currentUser.name}
                </Text>
                <View
                  style={[
                    styles.providerBadge,
                    { backgroundColor: colors.herbSoft, borderColor: colors.herb },
                  ]}
                >
                  <Text style={[styles.providerBadgeText, { color: colors.herb }]}>
                    {currentUser.provider === 'apple'
                      ? '🍏 Apple 已連結'
                      : currentUser.provider === 'google'
                      ? '🌐 Google 已連結'
                      : '✓ 已認證'}
                  </Text>
                </View>
              </View>

              {currentUser.email ? (
                <Text
                  numberOfLines={1}
                  style={[styles.userEmailText, { color: colors.inkSecondary }]}
                >
                  {currentUser.email}
                </Text>
              ) : null}

              <Text style={[styles.userSyncNote, { color: colors.inkMuted }]}>
                手帳資料由本機優先防護，支援雲端自動同步
              </Text>

              <View style={styles.authActionBtnsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="更換登入身分"
                  onPress={onOpenAuthModal}
                  style={[
                    styles.secondaryActionBtn,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: colors.ink }]}>
                    切換身分
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="登出帳號"
                  onPress={onLogout}
                  style={[
                    styles.secondaryActionBtn,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.secondaryActionBtnText, { color: colors.priceUp }]}>
                    登出
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.guestContainer}>
            <View style={styles.guestNoticeRow}>
              <View
                style={[
                  styles.guestAvatarCircle,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
              >
                <Text style={styles.guestAvatarEmoji}>👤</Text>
              </View>
              <View style={styles.guestNoticeTextCol}>
                <Text style={[styles.guestTitle, { color: colors.ink }]}>
                  目前以「本機手帳訪客」記錄
                </Text>
                <Text style={[styles.guestDesc, { color: colors.inkSecondary }]}>
                  您記錄的店家、私房菜單與價格變化均已安全儲存於本機。登入帳號可啟用雲端雙重備份，換機不遺失！
                </Text>
              </View>
            </View>

            {/* 一鍵官方登入按鈕列 */}
            <View style={styles.oauthButtonsGroup}>
              {/* Apple 登入按鈕 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="使用 Apple 帳號快速登入"
                disabled={oauthLoading !== null}
                onPress={handleAppleQuickSignIn}
                style={({ pressed }) => [
                  styles.oauthLargeBtn,
                  {
                    backgroundColor: colors.isDark ? '#F5F5F7' : '#000000',
                    opacity: pressed || oauthLoading !== null ? 0.75 : 1,
                  },
                ]}
              >
                {oauthLoading === 'apple' ? (
                  <ActivityIndicator size="small" color={colors.isDark ? '#000' : '#FFF'} />
                ) : (
                  <Text
                    style={[
                      styles.oauthLargeBtnText,
                      { color: colors.isDark ? '#000000' : '#FFFFFF' },
                    ]}
                  >
                     Sign in with Apple 登入
                  </Text>
                )}
              </Pressable>

              {/* Google 登入按鈕 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="使用 Google 帳號快速登入"
                disabled={oauthLoading !== null}
                onPress={handleGoogleQuickSignIn}
                style={({ pressed }) => [
                  styles.oauthLargeBtn,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderStrong,
                    borderWidth: 1.5,
                    opacity: pressed || oauthLoading !== null ? 0.75 : 1,
                  },
                ]}
              >
                {oauthLoading === 'google' ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <View style={styles.oauthBtnInnerRow}>
                    <Text style={styles.googleIconText}>🌐</Text>
                    <Text style={[styles.oauthLargeBtnText, { color: colors.ink }]}>
                      以 Google 帳號登入
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="自訂訪客暱稱與詳細登入設定"
                onPress={onOpenAuthModal}
                style={({ pressed }) => [
                  styles.textSubLinkBtn,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text style={[styles.textSubLink, { color: colors.inkSecondary }]}>
                  或自訂訪客手帳暱稱／查看自訂 OAuth 用戶端 ID ❯
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* =====================================================================
       * 區塊 2：外觀主題風格 (Theme & Appearance)
       * =================================================================== */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.ink, marginBottom: SPACING.xs }]}>
          🎨 手帳外觀主題風格
        </Text>
        <Text style={[styles.cardSubDesc, { color: colors.inkSecondary }]}>
          為您的味覺書寫空間選擇最舒適的光影色調
        </Text>

        <View style={styles.themeOptionsGrid}>
          {/* 1. 亞麻和紙（淺色） */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: currentThemeMode === 'light' }}
            accessibilityLabel="切換為亞麻和紙淺色主題"
            onPress={() => handleThemeChange('light')}
            style={[
              styles.themeOptionCard,
              {
                backgroundColor: '#FAF7F2',
                borderColor:
                  currentThemeMode === 'light' ? colors.accent : '#E8E1D7',
                borderWidth: currentThemeMode === 'light' ? 2 : 1,
              },
            ]}
          >
            <View style={styles.themePreviewRow}>
              <Text style={styles.themeEmoji}>☀️</Text>
              {currentThemeMode === 'light' && (
                <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              )}
            </View>
            <Text style={[styles.themeOptionName, { color: '#2B231D' }]}>
              亞麻和紙
            </Text>
            <Text style={[styles.themeOptionDesc, { color: '#7A6E65' }]}>
              溫潤米白紙感，典雅柔和
            </Text>
          </Pressable>

          {/* 2. 深夜食堂（深色） */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: currentThemeMode === 'dark' }}
            accessibilityLabel="切換為深夜食堂深色主題"
            onPress={() => handleThemeChange('dark')}
            style={[
              styles.themeOptionCard,
              {
                backgroundColor: '#1E1916',
                borderColor:
                  currentThemeMode === 'dark' ? colors.accent : '#3A322C',
                borderWidth: currentThemeMode === 'dark' ? 2 : 1,
              },
            ]}
          >
            <View style={styles.themePreviewRow}>
              <Text style={styles.themeEmoji}>🌙</Text>
              {currentThemeMode === 'dark' && (
                <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              )}
            </View>
            <Text style={[styles.themeOptionName, { color: '#F0EBE1' }]}>
              深夜食堂
            </Text>
            <Text style={[styles.themeOptionDesc, { color: '#A89E92' }]}>
              深炭焙茶暖調，夜探不刺眼
            </Text>
          </Pressable>

          {/* 3. 跟隨系統 */}
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: currentThemeMode === 'system' }}
            accessibilityLabel="切換為跟隨系統外觀設定"
            onPress={() => handleThemeChange('system')}
            style={[
              styles.themeOptionCard,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor:
                  currentThemeMode === 'system' ? colors.accent : colors.border,
                borderWidth: currentThemeMode === 'system' ? 2 : 1,
              },
            ]}
          >
            <View style={styles.themePreviewRow}>
              <Text style={styles.themeEmoji}>⚙️</Text>
              {currentThemeMode === 'system' && (
                <View style={[styles.activeDot, { backgroundColor: colors.accent }]} />
              )}
            </View>
            <Text style={[styles.themeOptionName, { color: colors.ink }]}>
              跟隨系統
            </Text>
            <Text style={[styles.themeOptionDesc, { color: colors.inkSecondary }]}>
              自動適應裝置深淺設定
            </Text>
          </Pressable>
        </View>
      </View>

      {/* =====================================================================
       * 區塊 3：手帳統計與資料庫備份 (Data Sovereignty & Backup)
       * =================================================================== */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { color: colors.ink }]}>
            ☁️ 手帳資料庫與本機備份
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="開啟手帳備份與自訂設定"
            onPress={onOpenBackupModal}
            style={({ pressed }) => [
              styles.linkButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text style={[styles.linkButtonText, { color: colors.herb }]}>
              自訂與完整設定 ❯
            </Text>
          </Pressable>
        </View>

        {/* 統計摘要膠囊 */}
        <View
          style={[
            styles.statsSummaryBox,
            { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
          ]}
        >
          <View style={styles.statSummaryCol}>
            <Text style={[styles.statSummaryNum, { color: colors.ink }]}>
              {places.length}
            </Text>
            <Text style={[styles.statSummaryLabel, { color: colors.inkSecondary }]}>
              已記店家
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statSummaryCol}>
            <Text style={[styles.statSummaryNum, { color: colors.ink }]}>
              {dishes.length}
            </Text>
            <Text style={[styles.statSummaryLabel, { color: colors.inkSecondary }]}>
              舌尖品項
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statSummaryCol}>
            <Text style={[styles.statSummaryNum, { color: colors.ink }]}>
              {biteLogs.length}
            </Text>
            <Text style={[styles.statSummaryLabel, { color: colors.inkSecondary }]}>
              親嚐紀錄
            </Text>
          </View>
        </View>

        {/* 備份按鈕群 */}
        <View style={styles.backupActionsGrid}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="匯出一鍵完整備份 JSON 檔案"
            onPress={onExportBackup}
            style={({ pressed }) => [
              styles.backupActionTile,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={styles.backupTileIcon}>📥</Text>
            <View style={styles.backupTileTextCol}>
              <Text style={[styles.backupTileTitle, { color: colors.ink }]}>
                匯出一鍵備份 (JSON)
              </Text>
              <Text style={[styles.backupTileDesc, { color: colors.inkSecondary }]}>
                下載完整本機手帳資料庫，防範資料遺失
              </Text>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="開啟還原備份或貼上 JSON 視窗"
            onPress={onOpenBackupModal}
            style={({ pressed }) => [
              styles.backupActionTile,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={styles.backupTileIcon}>📤</Text>
            <View style={styles.backupTileTextCol}>
              <Text style={[styles.backupTileTitle, { color: colors.ink }]}>
                還原手帳備份
              </Text>
              <Text style={[styles.backupTileDesc, { color: colors.inkSecondary }]}>
                貼上先前匯出的 JSON 或更換裝置同步
              </Text>
            </View>
          </Pressable>
        </View>

        {/* 示範資料重設與清空手帳 */}
        <View style={[styles.dangerSection, { borderTopColor: colors.border }]}>
          <Text style={[styles.dangerTitle, { color: colors.inkSecondary }]}>
            🛠️ 手帳重整與維護選項
          </Text>
          <View style={styles.dangerButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="重設為預設示範資料"
              onPress={handleConfirmResetSeed}
              style={[
                styles.smallActionButton,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.smallActionButtonText, { color: colors.ink }]}>
                🌱 載入示範資料
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空所有手帳資料"
              onPress={handleConfirmClearAll}
              style={[
                styles.smallActionButton,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.smallActionButtonText, { color: colors.priceUp }]}>
                🧹 清空本機資料
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* =====================================================================
       * 區塊 4：法律聲明、隱私權政策與致謝
       * =================================================================== */}
      <View style={styles.legalSection}>
        <Text style={[styles.legalBrandTitle, { color: colors.ink }]}>
          BiteNote 吃一口
        </Text>
        <Text style={[styles.legalVersion, { color: colors.inkMuted }]}>
          版本 1.2.0 · 本機優先極簡飲食手帳
        </Text>
        <Text style={[styles.legalPhilosophy, { color: colors.inkSecondary }]}>
          「漲跌起伏的是價格，歷久彌新的是味覺記憶。」{'\n'}
          為每位真誠對待自己舌尖的饕客而生。
        </Text>

        <View style={styles.legalLinksRow}>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="閱讀隱私權政策"
            onPress={onOpenPrivacy}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.legalLinkText, { color: colors.accent }]}>
              隱私權政策 (Privacy Policy)
            </Text>
          </Pressable>
          <Text style={{ color: colors.inkMuted, fontSize: 13 }}>·</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="閱讀服務條款"
            onPress={onOpenTerms}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.legalLinkText, { color: colors.accent }]}>
              服務條款 (Terms of Service)
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.legalContactText, { color: colors.inkMuted }]}>
          技術支援與回饋：eddie99876@gmail.com
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },
  headerBlock: {
    gap: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  badgeRow: {
    flexDirection: 'row',
  },
  eyebrowBadge: {
    fontSize: 10.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FONTS.serif,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headerSub: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 16.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardSubDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  linkButton: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  linkButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loggedInRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: {
    fontSize: 26,
  },
  userInfoCol: {
    flex: 1,
    gap: 4,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userNameText: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: FONTS.serif,
  },
  providerBadge: {
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  providerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userEmailText: {
    fontSize: 13,
    fontFamily: FONTS.mono,
  },
  userSyncNote: {
    fontSize: 12,
    marginTop: 2,
  },
  authActionBtnsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryActionBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  secondaryActionBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  guestContainer: {
    gap: SPACING.md,
  },
  guestNoticeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  guestAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestAvatarEmoji: {
    fontSize: 22,
  },
  guestNoticeTextCol: {
    flex: 1,
    gap: 2,
  },
  guestTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  guestDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  oauthButtonsGroup: {
    gap: 10,
    marginTop: SPACING.xs,
  },
  oauthLargeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oauthBtnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  googleIconText: {
    fontSize: 16,
  },
  oauthLargeBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSubLinkBtn: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
  textSubLink: {
    fontSize: 12.5,
    textDecorationLine: 'underline',
  },
  themeOptionsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  themeOptionCard: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    gap: 4,
    minHeight: 90,
  },
  themePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeEmoji: {
    fontSize: 20,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  themeOptionName: {
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
  },
  themeOptionDesc: {
    fontSize: 11,
    lineHeight: 14,
  },
  statsSummaryBox: {
    flexDirection: 'row',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statSummaryCol: {
    alignItems: 'center',
    gap: 2,
  },
  statSummaryNum: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  statSummaryLabel: {
    fontSize: 11.5,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  backupActionsGrid: {
    gap: 8,
  },
  backupActionTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    gap: SPACING.md,
  },
  backupTileIcon: {
    fontSize: 24,
  },
  backupTileTextCol: {
    flex: 1,
    gap: 2,
  },
  backupTileTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  backupTileDesc: {
    fontSize: 12,
  },
  dangerSection: {
    borderTopWidth: 1,
    paddingTop: SPACING.md,
    gap: SPACING.sm,
  },
  dangerTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  dangerButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallActionButtonText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  legalSection: {
    alignItems: 'center',
    gap: 6,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  legalBrandTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  legalVersion: {
    fontSize: 12,
    fontFamily: FONTS.mono,
  },
  legalPhilosophy: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: 'center',
    marginVertical: 4,
  },
  legalLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  legalLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalContactText: {
    fontSize: 11.5,
    fontFamily: FONTS.mono,
    marginTop: 4,
  },
});
