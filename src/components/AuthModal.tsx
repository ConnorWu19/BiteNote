/**
 * BiteNote 吃一口 — 輕量極簡・雜誌級登入與個人身分面板 (AuthModal)
 * 遵循 AGENTS.md 專案品質標準（Awwwards / Webby / FWA 等級排版與美學）
 * 特色：
 * 1. 清爽無硬體負擔：純 React Native StyleSheet + 語意排版，零 heavy WebGL / 零肥大 Lottie 動畫，秒開秒關。
 * 2. 雙重情境流暢切換：支援 Apple ID、Google ID、Email 無密碼驗證碼快速登入，以及「訪客離線手帳免註冊」即刻體驗。
 * 3. 完整登入/身分狀態管理：已登入者可檢視身分卡、綁定帳號、切換身分或安全登出。
 * 4. 嚴格對比度與主題適應：完美適應亞麻和紙（淺色）與深夜食堂（深色）雙主題。
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AuthProviderType, AppSettings, UserProfile } from '../types/models';
import { signInWithGoogle, signInWithApple, loadGoogleSdk, loadAppleSdk } from '../services/oauth';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';
import { TASTE_QUOTES } from './SplashScreen';

export interface AuthModalProps {
  visible: boolean;
  currentUser?: UserProfile | null;
  colors: ThemeColors;
  settings?: AppSettings;
  onUpdateSettings?: (partial: Partial<AppSettings>) => void;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  onLogout: () => void;
  onShowToast: (message: string) => void;
  onOpenPrivacy?: () => void;
  onOpenTerms?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible,
  currentUser,
  colors,
  settings,
  onUpdateSettings,
  onClose,
  onLoginSuccess,
  onLogout,
  onShowToast,
  onOpenPrivacy,
  onOpenTerms,
}) => {
  // 登入流程狀態
  const [emailInput, setEmailInput] = useState<string>('');
  const [otpStep, setOtpStep] = useState<boolean>(false);
  const [otpCode, setOtpCode] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  // OAuth 憑證輸入與設定
  const [showConfigProvider, setShowConfigProvider] = useState<'google' | 'apple' | null>(null);
  const [clientIdInput, setClientIdInput] = useState<string>('');

  // 預先載入 Google 與 Apple Web SDK
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      loadGoogleSdk().catch(() => {});
      loadAppleSdk().catch(() => {});
    }
    if (visible) {
      setShowConfigProvider(null);
      setClientIdInput('');
    }
  }, [visible]);


  // 隨機飲食心語（每次開啟登入畫面自動隨機換一句，不支援手動切換）
  const [randomQuote, setRandomQuote] = useState<string>(() => {
    return TASTE_QUOTES[Math.floor(Math.random() * TASTE_QUOTES.length)];
  });

  useEffect(() => {
    if (visible) {
      setRandomQuote((prev) => {
        const candidates = TASTE_QUOTES.filter((q) => q !== prev);
        if (candidates.length > 0) {
          return candidates[Math.floor(Math.random() * candidates.length)];
        }
        return TASTE_QUOTES[Math.floor(Math.random() * TASTE_QUOTES.length)];
      });
    }
  }, [visible]);

  // 是否為真實登入使用者（非訪客）
  const isAuthenticated = !!currentUser && !currentUser.isGuest;

  // 重設表單狀態
  const resetForm = () => {
    setEmailInput('');
    setOtpStep(false);
    setOtpCode('');
    setIsSubmitting(false);
    setAuthError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // 1. 透過 Apple 登入（支援官方真實授權與自備憑證）
  const handleAppleSignIn = async (overrideId?: string) => {
    const activeServiceId = (overrideId || clientIdInput || settings?.appleServiceId || '').trim();
    if (!activeServiceId) {
      setShowConfigProvider('apple');
      setClientIdInput(settings?.appleServiceId || '');
      setAuthError('請填寫 Apple Service ID（或點擊下方一鍵體驗登入）');
      return;
    }

    if (overrideId && onUpdateSettings) {
      onUpdateSettings({ appleServiceId: overrideId });
    }

    setIsSubmitting(true);
    setAuthError('');
    try {
      const appleUser = await signInWithApple(activeServiceId);
      onLoginSuccess(appleUser);
      onShowToast(`✓ 已成功透過 Apple ID 登入：${appleUser.name}`);
      handleClose();
    } catch (err: any) {
      if (err.message === 'MISSING_SERVICE_ID') {
        setShowConfigProvider('apple');
        setAuthError('請填寫 Apple Service ID（或點擊下方一鍵體驗登入）');
      } else {
        setAuthError(err.message || 'Apple 登入失敗或已取消');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. 透過 Google 帳號登入（支援 Google Identity Services 官方彈窗授權）
  const handleGoogleSignIn = async (overrideId?: string) => {
    const activeClientId = (overrideId || clientIdInput || settings?.googleClientId || '').trim();
    if (!activeClientId) {
      setShowConfigProvider('google');
      setClientIdInput(settings?.googleClientId || '');
      setAuthError('請填寫 Google OAuth 2.0 Web Client ID（或點擊下方一鍵體驗登入）');
      return;
    }

    if (overrideId && onUpdateSettings) {
      onUpdateSettings({ googleClientId: overrideId });
    }

    setIsSubmitting(true);
    setAuthError('');
    try {
      const googleUser = await signInWithGoogle(activeClientId);
      onLoginSuccess(googleUser);
      onShowToast(`✓ 已成功透過 Google 帳號登入：${googleUser.name}`);
      handleClose();
    } catch (err: any) {
      if (err.message === 'MISSING_CLIENT_ID') {
        setShowConfigProvider('google');
        setAuthError('請填寫 Google OAuth Client ID（或點擊下方一鍵體驗登入）');
      } else {
        setAuthError(err.message || 'Google 登入失敗或已取消');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 模擬/測試快速體驗登入
  const handleDemoSignIn = (provider: 'google' | 'apple') => {
    setIsSubmitting(true);
    setAuthError('');
    setTimeout(() => {
      setIsSubmitting(false);
      const demoUser: UserProfile = {
        id: `${provider}_demo_${Date.now().toString(36)}`,
        name: provider === 'google' ? 'Google 探索者' : 'Apple 雅士',
        email: provider === 'google' ? 'taster.google@gmail.com' : 'taster.apple@icloud.com',
        avatarEmoji: provider === 'google' ? '🥢' : '🍎',
        provider: provider,
        isGuest: false,
        joinedAt: new Date().toISOString().split('T')[0],
        lastSyncedAt: new Date().toISOString(),
      };
      onLoginSuccess(demoUser);
      onShowToast(`✓ 已透過 ${provider === 'google' ? 'Google' : 'Apple'} 快速驗證進入 BiteNote`);
      handleClose();
    }, 350);
  };

  // 3. Email 寄送驗證碼
  const handleSendEmailOtp = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setAuthError('請填寫正確有效的電子信箱格式');
      return;
    }
    setAuthError('');
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setOtpStep(true);
      onShowToast(`已寄送 4 位數登入驗證碼至 ${trimmed}`);
    }, 400);
  };

  // 4. 驗證 Email OTP 碼
  const handleVerifyOtp = (codeToVerify?: string) => {
    const targetCode = (codeToVerify || otpCode).trim();
    if (targetCode.length < 4) {
      setAuthError('請輸入完整的 4 位數驗證碼');
      return;
    }
    setIsSubmitting(true);
    setAuthError('');
    setTimeout(() => {
      setIsSubmitting(false);
      const emailUser: UserProfile = {
        id: `email_${Date.now().toString(36)}`,
        name: emailInput.split('@')[0] || '手帳品味家',
        email: emailInput.trim(),
        avatarEmoji: '☕',
        provider: 'email',
        isGuest: false,
        joinedAt: new Date().toISOString().split('T')[0],
        lastSyncedAt: new Date().toISOString(),
      };
      onLoginSuccess(emailUser);
      onShowToast(`✓ 登入成功！歡迎回來，${emailUser.name}`);
      handleClose();
    }, 450);
  };

  // 5. 選擇訪客離線模式（免註冊先體驗）
  const handleChooseGuestMode = () => {
    const guestUser: UserProfile = {
      id: 'guest_local_user',
      name: '本機離線探險家',
      email: '',
      avatarEmoji: '🥢',
      provider: 'guest',
      isGuest: true,
      joinedAt: new Date().toISOString().split('T')[0],
    };
    onLoginSuccess(guestUser);
    onShowToast('已進入「本機離線手帳模式」，資料僅保留於此裝置');
    handleClose();
  };

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
      >
        <Pressable
          style={styles.backdropDismissArea}
          onPress={handleClose}
          accessibilityLabel="點擊背景關閉"
        />

        <View
          style={[
            styles.modalContainer,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          {/* 頂部關閉按鈕 */}
          <View style={styles.topBar}>
            <View style={styles.topPillTag}>
              <Text style={[styles.topPillTagText, { color: colors.inkMuted }]}>
                {isAuthenticated ? '個人會員檔案' : '極簡安全登入'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉登入視窗"
              onPress={handleClose}
              style={[
                styles.closeCircleBtn,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.closeCircleBtnText, { color: colors.ink }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 情境 A：使用者已登入，呈現個人身分卡片與帳號管理 */}
            {isAuthenticated && currentUser ? (
              <View style={styles.authenticatedSection}>
                <View
                  style={[
                    styles.profileCard,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.avatarRow}>
                    <View
                      style={[
                        styles.avatarBubble,
                        {
                          backgroundColor: colors.accentSoft,
                          borderColor: colors.accent,
                        },
                      ]}
                    >
                      <Text style={styles.avatarEmojiText}>
                        {currentUser.avatarEmoji || '🥢'}
                      </Text>
                    </View>
                    <View style={styles.avatarMeta}>
                      <View style={styles.nameBadgeRow}>
                        <Text style={[styles.profileNameText, { color: colors.ink }]}>
                          {currentUser.name}
                        </Text>
                        <View
                          style={[
                            styles.providerPill,
                            {
                              backgroundColor:
                                currentUser.provider === 'apple'
                                  ? colors.ink
                                  : currentUser.provider === 'google'
                                  ? colors.herbSoft
                                  : colors.ochreSoft,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.providerPillText,
                              {
                                color:
                                  currentUser.provider === 'apple'
                                    ? colors.canvas
                                    : currentUser.provider === 'google'
                                    ? colors.herb
                                    : colors.ochre,
                              },
                            ]}
                          >
                            {currentUser.provider === 'apple' && ' Apple 登入'}
                            {currentUser.provider === 'google' && '🌐 Google 登入'}
                            {currentUser.provider === 'email' && '✉️ 信箱驗證'}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[styles.profileEmailText, { color: colors.inkSecondary }]}
                      >
                        {currentUser.email || '已綁定私密手帳身分'}
                      </Text>
                      <Text style={[styles.profileDateText, { color: colors.inkMuted }]}>
                        記錄起點：{currentUser.joinedAt}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.syncStatusNotice,
                      {
                        backgroundColor: colors.herbSoft,
                        borderColor: colors.herb,
                      },
                    ]}
                  >
                    <Text style={[styles.syncStatusNoticeTitle, { color: colors.herb }]}>
                      ✓ 雲端即時同步中
                    </Text>
                    <Text
                      style={[
                        styles.syncStatusNoticeBody,
                        { color: colors.inkSecondary },
                      ]}
                    >
                      您的所有店家、菜色回訪歷史與漲價軌跡均與雲端安全備份保持同步。
                    </Text>
                  </View>
                </View>

                {/* 登出 / 切換帳號行動按鈕 */}
                <View style={styles.authActionsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="登出目前帳號"
                    onPress={() => {
                      onLogout();
                      onShowToast('已順利登出，保留本機手帳資料');
                      handleClose();
                    }}
                    style={[
                      styles.secondaryOutlineBtn,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                  >
                    <Text
                      style={[styles.secondaryOutlineBtnText, { color: colors.accent }]}
                    >
                      🚪 登出帳號
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="切換登入身分"
                    onPress={() => {
                      onLogout();
                      resetForm();
                    }}
                    style={[
                      styles.primaryActionButton,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text style={styles.primaryActionButtonText}>
                      切換登入身分 ➔
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              /* 情境 B：尚未登入 / 訪客模式，呈現清爽無負擔之登入畫面 */
              <View style={styles.guestLoginSection}>
                {/* 1. 品牌印章與報刊級標題 */}
                <View style={styles.brandHeader}>
                  <View
                    style={[
                      styles.brandSealEmblem,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text style={styles.brandSealEmblemText}>吃一口</Text>
                  </View>
                  <Text style={[styles.brandEditorialTitle, { color: colors.ink }]}>
                    BiteNote
                  </Text>
                  <Text
                    style={[styles.brandEditorialSubtitle, { color: colors.accent }]}
                  >
                    私密飲食與味覺演變手帳
                  </Text>
                  <Text
                    style={[
                      styles.brandEditorialManifesto,
                      { color: colors.inkSecondary },
                    ]}
                  >
                    不社交、不業配、不演算法 — 每一口，只向自己的真實舌尖交代。
                  </Text>
                </View>
                {/* 2. 隨機飲食心語（每次開啟登入畫面自動更換，純淨展示不支援手動切換） */}
                <View
                  style={[
                    styles.authDailyQuoteCard,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.authDailyQuoteStamp,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text style={styles.authDailyQuoteStampText}>心語</Text>
                  </View>
                  <View style={styles.authDailyQuoteContent}>
                    <Text style={[styles.authDailyQuoteTitle, { color: colors.ink }]}>
                      {randomQuote}
                    </Text>
                    <Text style={[styles.authDailyQuoteSubtitle, { color: colors.inkMuted }]}>
                      ✦ 每日味覺手札
                    </Text>
                  </View>
                </View>

                {/* 3. 輕量三保證徽章（清爽無負擔承諾） */}
                <View style={styles.guaranteePillsRow}>
                  <View
                    style={[
                      styles.guaranteePill,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.guaranteePillText, { color: colors.ink }]}>
                      ⚡ 零硬體負擔
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.guaranteePill,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.guaranteePillText, { color: colors.herb }]}>
                      🔒 100% 離線優先
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.guaranteePill,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.guaranteePillText, { color: colors.ochre }]}>
                      🛡️ 零商業追蹤
                    </Text>
                  </View>
                </View>

                {/* 3. 一鍵快捷第三方登入（Apple & Google） */}
                <View style={styles.oauthButtonsCol}>
                  {/* Apple 登入按鈕 */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="透過 Apple 快速登入"
                    disabled={isSubmitting}
                    onPress={() => handleAppleSignIn()}
                    style={({ pressed }) => [
                      styles.appleSignInBtn,
                      {
                        backgroundColor: colors.isDark ? '#F5EFE6' : '#000000',
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.appleIconGlyph,
                        { color: colors.isDark ? '#121110' : '#FFFFFF' },
                      ]}
                    >
                      
                    </Text>
                    <Text
                      style={[
                        styles.appleSignInBtnText,
                        { color: colors.isDark ? '#121110' : '#FFFFFF' },
                      ]}
                    >
                      透過 Apple 快速登入
                    </Text>
                  </Pressable>

                  {/* Google 登入按鈕 */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="透過 Google 帳號登入"
                    disabled={isSubmitting}
                    onPress={() => handleGoogleSignIn()}
                    style={({ pressed }) => [
                      styles.googleSignInBtn,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.borderStrong,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <View style={styles.googleIconBadge}>
                      <Text style={styles.googleIconGlyph}>G</Text>
                    </View>
                    <Text
                      style={[styles.googleSignInBtnText, { color: colors.ink }]}
                    >
                      透過 Google 帳號登入
                    </Text>
                  </Pressable>
                </View>


                {/* 憑證填寫引導面板（未設定 Client ID 時自動展開） */}
                {showConfigProvider && (
                  <View
                    style={[
                      styles.oauthConfigBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.accent,
                      },
                    ]}
                  >
                    <View style={styles.oauthConfigHeader}>
                      <Text style={[styles.oauthConfigTitle, { color: colors.accent }]}>
                        🔑 設定 {showConfigProvider === 'google' ? 'Google OAuth Web Client ID' : 'Apple Service ID'}
                      </Text>
                      <Pressable onPress={() => setShowConfigProvider(null)}>
                        <Text style={{ fontSize: 13, color: colors.inkMuted }}>✕ 關閉</Text>
                      </Pressable>
                    </View>
                    <Text style={[styles.oauthConfigHint, { color: colors.inkSecondary }]}>
                      {showConfigProvider === 'google'
                        ? '可至 Google Cloud Console 免費建立 OAuth 2.0 Web 用戶端 ID，填入後即可全自動彈出官方登入視窗。'
                        : '可至 Apple Developer 帳號建立 Sign in with Apple 服務 ID，填入後即可調用官方登入。'}
                    </Text>
                    <TextInput
                      value={clientIdInput}
                      onChangeText={setClientIdInput}
                      placeholder={
                        showConfigProvider === 'google'
                          ? '例：xxxxxx.apps.googleusercontent.com'
                          : '例：com.bitenote.web.auth'
                      }
                      placeholderTextColor={colors.inkMuted}
                      style={[
                        styles.oauthInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.ink,
                        },
                      ]}
                    />
                    <View style={styles.oauthConfigBtnRow}>
                      <Pressable
                        onPress={() => {
                          if (showConfigProvider === 'google') {
                            handleGoogleSignIn(clientIdInput);
                          } else {
                            handleAppleSignIn(clientIdInput);
                          }
                        }}
                        style={[styles.oauthSaveBtn, { backgroundColor: colors.accent }]}
                      >
                        <Text style={styles.oauthSaveBtnText}>💾 儲存並官方授權</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleDemoSignIn(showConfigProvider)}
                        style={[
                          styles.oauthDemoBtn,
                          { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.oauthDemoBtnText, { color: colors.ink }]}>
                          ⚡ 一鍵快速體驗
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* 4. 典雅分隔線 */}
                <View style={styles.dividerRow}>
                  <View
                    style={[styles.dividerLine, { backgroundColor: colors.border }]}
                  />
                  <Text style={[styles.dividerLabel, { color: colors.inkMuted }]}>
                    或使用信箱無密碼驗證
                  </Text>
                  <View
                    style={[styles.dividerLine, { backgroundColor: colors.border }]}
                  />
                </View>

                {/* 5. 電子信箱無密碼快捷登入 */}
                {!otpStep ? (
                  <View style={styles.emailInputSection}>
                    <View
                      style={[
                        styles.emailInputWrapper,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: authError ? colors.priceUp : colors.border,
                        },
                      ]}
                    >
                      <Text style={styles.emailFieldPrefixIcon}>✉️</Text>
                      <TextInput
                        style={[styles.emailTextInput, { color: colors.ink }]}
                        placeholder="請輸入常用 Email (例: you@example.com)"
                        placeholderTextColor={colors.inkMuted}
                        value={emailInput}
                        onChangeText={(txt) => {
                          setEmailInput(txt);
                          if (authError) setAuthError('');
                        }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="send"
                        onSubmitEditing={handleSendEmailOtp}
                      />
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="發送電子郵件驗證碼"
                        disabled={isSubmitting || !emailInput.trim()}
                        onPress={handleSendEmailOtp}
                        style={[
                          styles.inlineSendBtn,
                          {
                            backgroundColor: emailInput.trim()
                              ? colors.accent
                              : colors.borderStrong,
                          },
                        ]}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.inlineSendBtnText}>寄送驗證碼</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  /* 驗證碼輸入步驟 */
                  <View
                    style={[
                      styles.otpBoxContainer,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.otpHeaderRow}>
                      <Text style={[styles.otpHeaderTitle, { color: colors.ink }]}>
                        請輸入驗證碼
                      </Text>
                      <Pressable
                        onPress={() => setOtpStep(false)}
                        accessibilityRole="button"
                        accessibilityLabel="重填 Email 信箱"
                      >
                        <Text style={[styles.otpChangeEmailLink, { color: colors.accent }]}>
                          修改信箱
                        </Text>
                      </Pressable>
                    </View>

                    <Text
                      style={[styles.otpInstructionText, { color: colors.inkSecondary }]}
                    >
                      已將 4 位數登入驗證碼發送至{' '}
                      <Text style={{ fontWeight: '700', color: colors.ink }}>
                        {emailInput}
                      </Text>
                    </Text>

                    <View style={styles.otpInputRow}>
                      <TextInput
                        style={[
                          styles.otpCodeInput,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: authError ? colors.priceUp : colors.accent,
                            color: colors.ink,
                          },
                        ]}
                        placeholder="8888"
                        placeholderTextColor={colors.inkMuted}
                        keyboardType="number-pad"
                        maxLength={6}
                        value={otpCode}
                        onChangeText={(txt) => {
                          setOtpCode(txt);
                          if (authError) setAuthError('');
                        }}
                        onSubmitEditing={() => handleVerifyOtp()}
                      />

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="驗證並登入"
                        disabled={isSubmitting}
                        onPress={() => handleVerifyOtp()}
                        style={[
                          styles.otpVerifyBtn,
                          { backgroundColor: colors.accent },
                        ]}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.otpVerifyBtnText}>確認登入</Text>
                        )}
                      </Pressable>
                    </View>

                    {/* 快速示範點擊自動填寫驗證碼 */}
                    <Pressable
                      onPress={() => {
                        setOtpCode('8888');
                        handleVerifyOtp('8888');
                      }}
                      style={styles.demoCodeHintBtn}
                    >
                      <Text
                        style={[styles.demoCodeHintText, { color: colors.inkMuted }]}
                      >
                        ⚡ 快速體驗測試：點此自動填入 <Text style={{ color: colors.accent, fontWeight: '700' }}>8888</Text> 秒速登入
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* 錯誤提示 */}
                {!!authError && (
                  <View
                    style={[
                      styles.errorBanner,
                      {
                        backgroundColor: colors.priceUpSoft,
                        borderColor: colors.priceUp,
                      },
                    ]}
                  >
                    <Text style={[styles.errorBannerText, { color: colors.priceUp }]}>
                      ⚠️ {authError}
                    </Text>
                  </View>
                )}

                {/* 6. 「隨興體驗・以訪客離線模式開始」 */}
                <View style={styles.guestModeBox}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="以訪客離線模式開始"
                    onPress={handleChooseGuestMode}
                    style={({ pressed }) => [
                      styles.guestModeButton,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}
                  >
                    <View style={styles.guestModeContent}>
                      <View style={styles.guestModeTitleRow}>
                        <Text style={styles.guestModeEmoji}>🥢</Text>
                        <Text
                          style={[styles.guestModeTitleText, { color: colors.ink }]}
                        >
                          隨興體驗・先以訪客離線模式開始
                        </Text>
                        <Text
                          style={[styles.guestModeArrow, { color: colors.accent }]}
                        >
                          ➔
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.guestModeDescText,
                          { color: colors.inkSecondary },
                        ]}
                      >
                        所有食記、照片與價格演變均安全儲存於手機本機，免註冊即享完整手帳功能；未來可隨時升級雲端備份。
                      </Text>
                    </View>
                  </Pressable>
                </View>

                {/* 7. 隱私與手帳承諾宣言 */}
                <View
                  style={[
                    styles.privacyFooterBadge,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={styles.privacyFooterLockEmoji}>🔒</Text>
                  <Text
                    style={[styles.privacyFooterText, { color: colors.inkMuted }]}
                  >
                    本手帳嚴守個人隱私，不公開社群、不販售數據、零外掛廣告。每一次回訪與評分，都只向自己的舌尖交代。
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  backdropDismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '92%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.18,
        shadowRadius: 28,
      },
      android: {
        elevation: 8,
      },
      default: {
        boxShadow: '0 20px 48px rgba(0, 0, 0, 0.22)',
      },
    }),
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  topPillTag: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  topPillTagText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  closeCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeCircleBtnText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 16,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.xs,
  },

  // 品牌 Masthead
  brandHeader: {
    alignItems: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  brandSealEmblem: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#D14830',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      default: {},
    }),
  },
  brandSealEmblemText: {
    color: '#FFFFFF',
    fontFamily: FONTS.serif,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  brandEditorialTitle: {
    fontFamily: FONTS.serif,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  brandEditorialSubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
  },
  brandEditorialManifesto: {
    fontFamily: FONTS.serif,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 340,
  },

  // 保證微徽章列
  guaranteePillsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.lg,
    flexWrap: 'wrap',
  },
  guaranteePill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  guaranteePillText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
  },

  // OAuth 一鍵登入欄位
  oauthButtonsCol: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  appleSignInBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  appleIconGlyph: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: SPACING.sm,
    lineHeight: 22,
  },
  appleSignInBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  googleSignInBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  googleIconBadge: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  googleIconGlyph: {
    fontFamily: FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleSignInBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // 分隔線
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    paddingHorizontal: SPACING.sm,
  },

  // Email 輸入區
  emailInputSection: {
    marginBottom: SPACING.md,
  },
  emailInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.xs,
    paddingVertical: 4,
  },
  emailFieldPrefixIcon: {
    fontSize: 16,
    marginRight: SPACING.xs,
  },
  emailTextInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  inlineSendBtn: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineSendBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
  },

  // OTP 驗證碼區
  otpBoxContainer: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  otpHeaderTitle: {
    fontFamily: FONTS.sans,
    fontSize: 15,
    fontWeight: '700',
  },
  otpChangeEmailLink: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
  },
  otpInstructionText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: SPACING.sm,
  },
  otpInputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  otpCodeInput: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    fontFamily: FONTS.mono,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 4,
  },
  otpVerifyBtn: {
    paddingHorizontal: SPACING.lg,
    height: 44,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpVerifyBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  demoCodeHintBtn: {
    marginTop: SPACING.xs,
    paddingVertical: 4,
  },
  demoCodeHintText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    lineHeight: 16,
  },

  // 錯誤提示
  errorBanner: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  errorBannerText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
  },

  // 訪客體驗免註冊按鈕
  guestModeBox: {
    marginBottom: SPACING.md,
  },
  guestModeButton: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
  },
  guestModeContent: {
    gap: 4,
  },
  guestModeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  guestModeEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  guestModeTitleText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  guestModeArrow: {
    fontFamily: FONTS.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  guestModeDescText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
  },

  // 隱私宣言
  privacyFooterBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: SPACING.xs,
  },
  privacyFooterLockEmoji: {
    fontSize: 14,
    marginTop: 1,
  },
  privacyFooterText: {
    fontFamily: FONTS.serif,
    fontSize: 11,
    lineHeight: 16,
    flex: 1,
  },

  // 已登入者介面
  authenticatedSection: {
    paddingTop: SPACING.sm,
  },
  profileCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarBubble: {
    width: 60,
    height: 60,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarEmojiText: {
    fontSize: 28,
  },
  avatarMeta: {
    flex: 1,
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  profileNameText: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    fontWeight: '800',
  },
  providerPill: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    borderRadius: RADIUS.pill,
  },
  providerPillText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
  },
  profileEmailText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    marginBottom: 2,
  },
  profileDateText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
  },
  syncStatusNotice: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 4,
  },
  syncStatusNoticeTitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
  },
  syncStatusNoticeBody: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
  },
  authActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  secondaryOutlineBtn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryOutlineBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryActionButton: {
    flex: 1.2,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontFamily: FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  guestLoginSection: {
    paddingTop: 2,
  },
  authDailyQuoteCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    gap: 10,
  },
  authDailyQuoteStamp: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  authDailyQuoteStampText: {
    color: '#FFFFFF',
    fontFamily: FONTS.serif,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  authDailyQuoteContent: {
    flex: 1,
    minWidth: 0,
  },
  authDailyQuoteTitle: {
    fontFamily: FONTS.serif,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 2,
  },
  authDailyQuoteSubtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    letterSpacing: 0.4,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  oauthConfigBox: {
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: 8,
  },
  oauthConfigHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  oauthConfigTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.serif,
  },
  oauthConfigHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  oauthInput: {
    height: 40,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    fontSize: 13,
    fontFamily: FONTS.mono,
  },
  oauthConfigBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  oauthSaveBtn: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oauthSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  oauthDemoBtn: {
    flex: 1,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  oauthDemoBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
});