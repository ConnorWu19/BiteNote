/**
 * BiteNote 吃一口 — 個人私密飲食與味覺演變手帳 App
 * 遵循 AGENTS.md 專案品質標準（Awwwards / Webby / FWA 等級視覺、互動、易用性與工程品質）
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AppSettings,
  BiteLog,
  Dish,
  EnrichedDish,
  EnrichedPlace,
  PHOTO_FILTERS,
  Place,
  TastingVerdict,
  UserProfile,
  VERDICT_OPTIONS,
} from './src/types/models';
import {
  DARK_THEME,
  FONTS,
  LIGHT_THEME,
  RADIUS,
  SPACING,
} from './src/theme/theme';
import {
  buildGoogleMapsUrl,
  computeOverallInsights,
  enrichPlaces,
  SEED_BITE_LOGS,
  SEED_DISHES,
  SEED_PLACES,
} from './src/utils/analytics';
import {
  DEFAULT_SETTINGS,
  exportBackupFile,
  loadDatabaseState,
  parseBackupJson,
  saveDatabaseState,
} from './src/services/storage';
import { DishEvolutionChart } from './src/components/DishEvolutionChart';
import {
  BackupSettingsModal,
  BiteComposerModal,
  NewBiteSubmission,
  PhotoLightboxModal,
  PlacePickerModal,
  resetMobileViewportZoom,
} from './src/components/Modals';
import { AuthModal } from './src/components/AuthModal';
import { SplashScreen } from './src/components/SplashScreen';
import { TasteMapTab } from './src/components/TasteMapTab';
import { ProfileTab } from './src/components/ProfileTab';

type MainTab = 'home' | 'map' | 'places' | 'evolution' | 'timeline' | 'profile';
type VerdictFilter = 'all' | 'favorite' | 'price_up' | 'repeat' | TastingVerdict;

export default function App() {
  const systemColorScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const isWideScreen = windowWidth >= 860;

  // 核心資料庫狀態
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [places, setPlaces] = useState<Place[]>(SEED_PLACES);
  const [dishes, setDishes] = useState<Dish[]>(SEED_DISHES);
  const [biteLogs, setBiteLogs] = useState<BiteLog[]>(SEED_BITE_LOGS);

  // 導覽與篩選狀態（預設進入清爽的「主頁」，已紀錄店家獨立於「店家名冊」分頁）
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>(SEED_PLACES[0].id);
  const [placeSubView, setPlaceSubView] = useState<'directory' | 'detail'>('directory');
  const [searchText, setSearchText] = useState<string>('');
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>('all');

  // 彈窗與回饋狀態
  const [composerVisible, setComposerVisible] = useState<boolean>(false);
  const [composerTargetPlaceId, setComposerTargetPlaceId] = useState<string | undefined>(undefined);
  const [composerTargetDish, setComposerTargetDish] = useState<EnrichedDish | null>(null);
  const [placeModalVisible, setPlaceModalVisible] = useState<boolean>(false);
  const [backupModalVisible, setBackupModalVisible] = useState<boolean>(false);
  const [authModalVisible, setAuthModalVisible] = useState<boolean>(false);
  const [splashFinished, setSplashFinished] = useState<boolean>(false);
  const [previewSplash, setPreviewSplash] = useState<boolean>(false);
  const [lightboxDish, setLightboxDish] = useState<EnrichedDish | null>(null);
  const [lightboxLog, setLightboxLog] = useState<BiteLog | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  // 開啟相片全螢幕放大燈箱（嚴格鎖定同一家店、同一個品項之歷次品嚐紀錄，左右滑動僅在同品項各次回訪照片切換）
  const openPhotoLightbox = (dish: EnrichedDish, log?: BiteLog) => {
    setLightboxDish(dish);
    setLightboxLog(log || dish.logs[dish.logs.length - 1] || null);
  };

  // 監聽 Web 端 bfcache 復原，防止從外部分頁/導航返回時整個 App 頁面凍結或空白
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setSettings((prev) => ({ ...prev }));
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, []);

  // 初始化載入本機資料庫，並在行動端 Web 鎖定 Viewport 與輸入框 16px 字級，徹底防止點擊搜尋欄時畫面自動放大與右側跑版
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      resetMobileViewportZoom();
      const styleId = 'bitenote-mobile-viewport-lock';
      if (!document.getElementById(styleId)) {
        const styleEl = document.createElement('style');
        styleEl.id = styleId;
        styleEl.textContent = `
          html, body, #root {
            width: 100% !important;
            max-width: 100vw !important;
            overflow-x: hidden !important;
            margin: 0;
            padding: 0;
            -webkit-text-size-adjust: 100%;
          }
          input, textarea, select {
            font-size: 16px !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        `;
        document.head.appendChild(styleEl);
      }

      const handleFocusOut = () => {
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
            document.documentElement.scrollLeft = 0;
            document.body.scrollLeft = 0;
          }
        }, 60);
      };
      document.addEventListener('focusout', handleFocusOut);
    }

    let mounted = true;
    loadDatabaseState()
      .then((loaded) => {
        if (!mounted) return;
        setSettings(loaded.settings);
        setPlaces(loaded.places);
        setDishes(loaded.dishes);
        setBiteLogs(loaded.biteLogs);
        if (loaded.places.length > 0) {
          setSelectedPlaceId(loaded.places[0].id);
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // 顯示短暫狀態回饋通知
  const showToast = (msg: string, durationMs: number = 1200) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, durationMs);
  };

  // 主題計算
  const colors = useMemo(() => {
    if (settings.themeMode === 'dark') return DARK_THEME;
    if (settings.themeMode === 'light') return LIGHT_THEME;
    return systemColorScheme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }, [settings.themeMode, systemColorScheme]);

  // 聚合計算所有店家、品項演變與統計指標
  const { enrichedPlaces, enrichedDishes } = useMemo(
    () => enrichPlaces(places, dishes, biteLogs),
    [places, dishes, biteLogs]
  );

  const insights = useMemo(
    () => computeOverallInsights(enrichedPlaces, enrichedDishes, biteLogs),
    [enrichedPlaces, enrichedDishes, biteLogs]
  );

  // 搜尋與篩選後的店家與品項
  const filteredPlaces = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return enrichedPlaces.filter((place) => {
      const matchQuery =
        !q ||
        place.name.toLowerCase().includes(q) ||
        place.address.toLowerCase().includes(q) ||
        place.category.toLowerCase().includes(q) ||
        place.dishes.some(
          (d) =>
            d.name.toLowerCase().includes(q) ||
            d.logs.some((l) => l.note.toLowerCase().includes(q))
        );

      if (!matchQuery) return false;
      if (verdictFilter === 'all') return true;
      if (verdictFilter === 'favorite') return place.isFavorite;
      if (verdictFilter === 'price_up') return place.priceUpDishCount > 0;
      if (verdictFilter === 'repeat') return place.dishes.some((d) => d.visitCount >= 2);
      return place.dishes.some((d) => d.latestVerdict === verdictFilter);
    });
  }, [enrichedPlaces, searchText, verdictFilter]);

  const filteredDishes = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return enrichedDishes.filter((dish) => {
      const matchQuery =
        !q ||
        dish.name.toLowerCase().includes(q) ||
        dish.placeName.toLowerCase().includes(q) ||
        dish.logs.some((l) => l.note.toLowerCase().includes(q));
      if (!matchQuery) return false;
      if (verdictFilter === 'all') return true;
      if (verdictFilter === 'favorite') {
        const parentPlace = places.find((p) => p.id === dish.placeId);
        return Boolean(parentPlace?.isFavorite);
      }
      if (verdictFilter === 'price_up') return dish.isPriceUp;
      if (verdictFilter === 'repeat') return dish.visitCount >= 2;
      return dish.latestVerdict === verdictFilter;
    });
  }, [enrichedDishes, places, searchText, verdictFilter]);

  // 主頁精選：最新 4 筆品嚐紀錄與焦點演變品項
  const recentLogEntries = useMemo(() => {
    return enrichedDishes
      .flatMap((dish) =>
        dish.logs.map((log, idx) => ({
          log,
          dish,
          visitIndex: idx + 1,
          prevPrice: idx >= 1 ? dish.logs[idx - 1].price : undefined,
        }))
      )
      .sort((a, b) => {
        const d = b.log.visitedAt.localeCompare(a.log.visitedAt);
        if (d !== 0) return d;
        return b.log.createdAt.localeCompare(a.log.createdAt);
      })
      .slice(0, 4);
  }, [enrichedDishes]);

  // 拍立得日記時間軸照片序列（供相簿左右滑動無縫瀏覽整本日記相片）
  const timelineEntries = useMemo(() => {
    return filteredDishes
      .flatMap((dish) =>
        dish.logs.map((log, idx) => ({
          log,
          dish,
          visitIndex: idx + 1,
          prevPrice: idx >= 1 ? dish.logs[idx - 1].price : undefined,
        }))
      )
      .sort((a, b) => {
        const d = b.log.visitedAt.localeCompare(a.log.visitedAt);
        if (d !== 0) return d;
        return b.log.createdAt.localeCompare(a.log.createdAt);
      });
  }, [filteredDishes]);

  const spotlightEncoreDish = useMemo(
    () =>
      [...enrichedDishes]
        .filter((d) => d.visitCount > 0)
        .sort((a, b) => b.latestRating - a.latestRating)[0],
    [enrichedDishes]
  );

  const spotlightPriceUpDish = useMemo(
    () =>
      [...enrichedDishes]
        .filter((d) => d.isPriceUp)
        .sort((a, b) => b.priceDelta - a.priceDelta)[0],
    [enrichedDishes]
  );

  const activePlace = useMemo(
    () =>
      filteredPlaces.find((p) => p.id === selectedPlaceId) ||
      enrichedPlaces.find((p) => p.id === selectedPlaceId) ||
      filteredPlaces[0] ||
      enrichedPlaces[0],
    [filteredPlaces, enrichedPlaces, selectedPlaceId]
  );

  // 切換至指定店家的詳細頁面（位於「店家名冊」分頁內）
  const navigateToPlaceDetail = (placeId: string) => {
    setSelectedPlaceId(placeId);
    setPlaceSubView('detail');
    setActiveTab('places');
  };

  // 持久化儲存輔助函式
  const persistAll = (
    nextPlaces: Place[],
    nextDishes: Dish[],
    nextLogs: BiteLog[],
    nextSettings: AppSettings = settings
  ) => {
    setPlaces(nextPlaces);
    setDishes(nextDishes);
    setBiteLogs(nextLogs);
    setSettings(nextSettings);
    saveDatabaseState({
      settings: nextSettings,
      places: nextPlaces,
      dishes: nextDishes,
      biteLogs: nextLogs,
    });
  };

  // 處理使用者身分登入成功
  const handleLoginSuccess = (user: UserProfile) => {
    const nextSettings: AppSettings = {
      ...settings,
      userProfile: user,
      lastBackupAt: new Date().toISOString(),
    };
    persistAll(places, dishes, biteLogs, nextSettings);
  };

  // 處理使用者登出（切換回本機離線訪客模式）
  const handleLogout = () => {
    const guestUser: UserProfile = {
      id: 'guest_local_user',
      name: '本機離線探險家',
      email: '',
      avatarEmoji: '🥢',
      provider: 'guest',
      isGuest: true,
      joinedAt: new Date().toISOString().split('T')[0],
    };
    const nextSettings: AppSettings = {
      ...settings,
      userProfile: guestUser,
    };
    persistAll(places, dishes, biteLogs, nextSettings);
  };

  // 新增品嚐紀錄（支援同品項第 N 次評分或建立新品項）
  const handleAddBite = (submission: NewBiteSubmission) => {
    const nowIso = new Date().toISOString();
    let targetDishId = submission.dishId;
    let nextDishes = [...dishes];

    if (!targetDishId) {
      targetDishId = `dish_${Date.now()}`;
      const newDish: Dish = {
        id: targetDishId,
        placeId: submission.placeId,
        name: submission.newDishName || '招牌料理',
        category: submission.newDishCategory || '招牌主食',
        coverUri: submission.photoUri,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      nextDishes = [newDish, ...nextDishes];
    } else {
      nextDishes = nextDishes.map((d) =>
        d.id === targetDishId
          ? {
              ...d,
              coverUri: submission.photoUri || d.coverUri,
              updatedAt: nowIso,
            }
          : d
      );
    }

    const newLog: BiteLog = {
      id: `log_${Date.now()}`,
      dishId: targetDishId,
      placeId: submission.placeId,
      rating: submission.rating,
      price: submission.price,
      verdict: submission.verdict,
      note: submission.note,
      photoUri: submission.photoUri,
      photoFilter: submission.photoFilter,
      visitedAt: submission.visitedAt,
      createdAt: nowIso,
    };

    const nextLogs = [...biteLogs, newLog];
    const nextPlaces = places.map((p) =>
      p.id === submission.placeId
        ? {
            ...p,
            coverUri: submission.photoUri || p.coverUri,
            updatedAt: nowIso,
          }
        : p
    );

    persistAll(nextPlaces, nextDishes, nextLogs);
    setSelectedPlaceId(submission.placeId);
    const visitCountNow = nextLogs.filter((l) => l.dishId === targetDishId).length;
    showToast(`✓ 已寫入手帳（第 ${visitCountNow} 次品嚐紀錄）並同步至本機備份`);
  };

  // 新增 Google Maps 連結店家
  const handleCreatePlace = (newPlaceData: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowIso = new Date().toISOString();
    const created: Place = {
      ...newPlaceData,
      id: `place_${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    const nextPlaces = [created, ...places];
    persistAll(nextPlaces, dishes, biteLogs);
    setSelectedPlaceId(created.id);
    setPlaceSubView('detail');
    setActiveTab('places');
    showToast(`📍 已連結店家「${created.name}」，已為您開啟店家專屬頁面！`);
  };

  // 切換店家私藏星號
  const handleToggleFavoritePlace = (placeId: string) => {
    const nextPlaces = places.map((p) =>
      p.id === placeId ? { ...p, isFavorite: !p.isFavorite } : p
    );
    persistAll(nextPlaces, dishes, biteLogs);
  };

  // 刪除單筆品嚐紀錄
  const handleDeleteLog = (logId: string) => {
    const nextLogs = biteLogs.filter((l) => l.id !== logId);
    persistAll(places, dishes, nextLogs);
    showToast('已從手帳移除該筆品嚐紀錄');
  };

  // 開啟外部 Google Maps 查看或導航（強制開新分頁，徹底避免行動端瀏覽器返回時頁面空白）
  const handleOpenGoogleMaps = (place: Place) => {
    const url = buildGoogleMapsUrl(place);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      try {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
        }, 150);
      } catch (e) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } else {
      Linking.openURL(url).catch(() => {
        showToast('無法開啟外部地圖連結');
      });
    }
  };

  // 開啟條款與隱私權政策（相容 Web 與 Native）
  const openPolicyLink = (path: 'privacy' | 'terms') => {
    const filename = path === 'privacy' ? 'privacy.html' : 'terms.html';
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(`./${filename}`, '_blank', 'noopener,noreferrer');
    } else {
      Linking.openURL(`https://connorwu19.github.io/BiteNote/${filename}`).catch(() => {
        showToast('無法開啟條款頁面');
      });
    }
  };

  // 開啟「記一口」抽屜
  const openComposerForPlace = (placeId?: string) => {
    setComposerTargetDish(null);
    setComposerTargetPlaceId(placeId || activePlace?.id);
    setComposerVisible(true);
  };

  const openComposerForDish = (dish: EnrichedDish) => {
    setComposerTargetPlaceId(dish.placeId);
    setComposerTargetDish(dish);
    setComposerVisible(true);
  };

  const favoritePlacesCount = useMemo(
    () => places.filter((p) => p.isFavorite).length,
    [places]
  );

  const FILTER_CHIPS: { id: VerdictFilter; label: string }[] = [
    { id: 'all', label: '全部紀錄' },
    { id: 'favorite', label: `⭐ 私藏釘選 (${favoritePlacesCount})` },
    { id: 'repeat', label: `🔄 多次回訪 (${insights.repeatDishesCount})` },
    { id: 'price_up', label: `💸 漲價觀察 (${insights.priceUpDishesCount})` },
    { id: 'encore', label: '🔥 驚為天人' },
    { id: 'solid', label: '😋 穩定發揮' },
    { id: 'meh', label: '😐 普通還好' },
    { id: 'avoid', label: '🚫 地雷勿點' },
  ];

  // 應用程式啟動畫面（清爽無硬體負擔：純 CSS/原生 Animated 微動態、紙本印章工藝、無縫淡出切換）
  if (isLoading || !splashFinished || previewSplash) {
    return (
      <SplashScreen
        colors={colors}
        onFinish={() => {
          setSplashFinished(true);
          if (previewSplash) setPreviewSplash(false);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.safeRoot, { backgroundColor: colors.canvas }]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.canvas}
      />

      {/* 頂部動態通知 Toast */}
      {toastMessage ? (
        <View style={[styles.toastBanner, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastBannerText, { color: colors.canvas }]}>
            {toastMessage}
          </Text>
        </View>
      ) : null}

      {/* 頂部雜誌感品牌刊頭 (Masthead Header) — 精簡清爽，主導覽移至底部固定導覽列 */}
      <View style={[styles.masthead, { borderBottomColor: colors.border }]}>
        <View style={styles.mastheadTopRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回 BiteNote 吃一口主頁"
            onPress={() => setActiveTab('home')}
            style={styles.logoRow}
          >
            <View style={styles.brandTextCol}>
              <View style={styles.brandTitleRow}>
                <Text style={[styles.brandTitleEn, { color: colors.ink }]}>BiteNote</Text>
                <Text style={[styles.brandTitleZh, { color: colors.accent }]}>吃一口</Text>
              </View>
              <Text
                numberOfLines={1}
                style={[styles.brandSubtitle, { color: colors.inkSecondary }]}
              >
                只記自己舌尖上的真實歲月與價格軌跡
              </Text>
            </View>
          </Pressable>

          <View style={styles.utilityBtnsRow}>
            {activeTab !== 'home' && activeTab !== 'profile' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="快速記一口"
                onPress={() => openComposerForPlace(activePlace?.id)}
                style={[
                  styles.compactUtilityBtn,
                  { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
              >
                <Text style={[styles.compactUtilityBtnText, { color: '#FFFFFF' }]}>
                  ＋ 記一口
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* 主內容區：美食足跡地圖 (Map Tab) 或 一般內容捲動區 */}
      {activeTab === 'map' ? (
        <TasteMapTab
          places={enrichedPlaces}
          colors={colors}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={(id) => setSelectedPlaceId(id)}
          onNavigateToDetail={navigateToPlaceDetail}
          onOpenComposer={openComposerForPlace}
          isWideScreen={isWideScreen}
        />
      ) : (
        <ScrollView
          style={styles.mainScroll}
          contentContainerStyle={styles.mainScrollContent}
          keyboardShouldPersistTaps="handled"
        >
        {/* ===================================================================
         * 分頁 1：🏠 主頁（專注「快速記一口＋統計摘要＋最近紀錄」，不混雜店家清單）
         * ================================================================= */}
        {activeTab === 'home' && (
          <View style={styles.homeTabContainer}>
            {/* 1. 主頁快速行動主卡 (Hero Quick Action Card) */}
            <View
              style={[
                styles.homeHeroCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.homeHeroHeader}>
                <View
                  style={[
                    styles.homeHeroKickerPill,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.homeHeroKickerText, { color: colors.accent }]}>
                    ✦ 今日私密味覺手札
                  </Text>
                </View>
                <Text style={[styles.homeHeroTitle, { color: colors.ink }]}>
                  今天吃了什麼令人難忘的味道？
                </Text>
                <Text style={[styles.homeHeroSub, { color: colors.inkSecondary }]}>
                  拍下剛上桌的食物照片、記下當下價格與真實評分。同品項第 2 次、第 3 次回訪會自動比對評分起伏與漲價軌跡。
                </Text>

                
              </View>

              <View style={styles.homeHeroActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="新增吃一口品嚐紀錄"
                  onPress={() => openComposerForPlace(activePlace?.id)}
                  style={({ pressed }) => [
                    styles.homePrimaryCta,
                    {
                      backgroundColor: colors.accent,
                      opacity: pressed ? 0.88 : 1,
                    },
                  ]}
                >
                  <Text style={styles.homePrimaryCtaText}>
                    📷 ＋ 記一口（上傳美食與評分）
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="連結 Google Maps 新店家"
                  onPress={() => setPlaceModalVisible(true)}
                  style={({ pressed }) => [
                    styles.homeSecondaryCta,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.homeSecondaryCtaText, { color: colors.ink }]}>
                    📍 連結新店家
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="開啟過往吃過的美食地圖"
                  onPress={() => setActiveTab('map')}
                  style={({ pressed }) => [
                    styles.homeSecondaryCta,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.homeSecondaryCtaText, { color: colors.ink }]}>
                    🗺️ 美食地圖
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 2. 個人味覺統計票根橫條（點擊可跳轉至對應分頁） */}
            <View style={styles.homeSectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                  個人味覺統計摘要
                </Text>
                <Text style={[styles.sectionHeaderSub, { color: colors.inkMuted }]}>
                  點選數字可前往該分頁
                </Text>
              </View>

              <View
                style={[
                  styles.insightRibbon,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`前往店家名冊，共 ${insights.totalPlaces} 家私藏店家`}
                  onPress={() => {
                    setVerdictFilter('all');
                    setPlaceSubView('directory');
                    setActiveTab('places');
                  }}
                  style={styles.insightItem}
                >
                  <Text style={[styles.insightNum, { color: colors.ink }]}>
                    {insights.totalPlaces}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.inkSecondary }]}>
                    已紀錄店家 ›
                  </Text>
                </Pressable>
                <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`前往評分漲跌，共 ${insights.totalDishes} 道記錄品項`}
                  onPress={() => {
                    setVerdictFilter('all');
                    setActiveTab('evolution');
                  }}
                  style={styles.insightItem}
                >
                  <Text style={[styles.insightNum, { color: colors.ink }]}>
                    {insights.totalDishes}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.inkSecondary }]}>
                    記錄品項 ›
                  </Text>
                </Pressable>
                <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`前往拍立得日記，累計吃一口 ${insights.totalBites} 次`}
                  onPress={() => {
                    setVerdictFilter('all');
                    setActiveTab('timeline');
                  }}
                  style={styles.insightItem}
                >
                  <Text style={[styles.insightNum, { color: colors.accent }]}>
                    {insights.totalBites}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.inkSecondary }]}>
                    累計吃一口 ›
                  </Text>
                </Pressable>
                <View style={[styles.insightDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`查看漲價品項，共 ${insights.priceUpDishesCount} 道`}
                  onPress={() => {
                    setVerdictFilter('price_up');
                    setActiveTab('evolution');
                  }}
                  style={styles.insightItem}
                >
                  <Text style={[styles.insightNum, { color: colors.priceUp }]}>
                    {insights.priceUpDishesCount}
                  </Text>
                  <Text style={[styles.insightLabel, { color: colors.inkSecondary }]}>
                    漲價品項 ›
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 3. 味覺演變焦點（必回訪最高分 & 漲價警示精選） */}
            {(spotlightEncoreDish || spotlightPriceUpDish) && (
              <View style={styles.homeSectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                    舌尖演變焦點
                  </Text>
                  <Pressable onPress={() => setActiveTab('evolution')}>
                    <Text style={[styles.sectionHeaderAction, { color: colors.accent }]}>
                      查看全部評分漲跌 →
                    </Text>
                  </Pressable>
                </View>

                <View style={[styles.spotlightRow, isWideScreen && styles.spotlightRowWide]}>
                  {spotlightEncoreDish && (
                    <Pressable
                      onPress={() => navigateToPlaceDetail(spotlightEncoreDish.placeId)}
                      style={[
                        styles.spotlightCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.spotlightBadgeRow}>
                        <View
                          style={[
                            styles.spotlightBadge,
                            { backgroundColor: colors.herbSoft },
                          ]}
                        >
                          <Text style={[styles.spotlightBadgeText, { color: colors.herb }]}>
                            🔥 私藏最高評價
                          </Text>
                        </View>
                        <Text style={[styles.spotlightPlace, { color: colors.inkSecondary }]}>
                          📍 {spotlightEncoreDish.placeName}
                        </Text>
                      </View>
                      <Text style={[styles.spotlightDishTitle, { color: colors.ink }]}>
                        {spotlightEncoreDish.name}
                      </Text>
                      <Text style={[styles.spotlightDesc, { color: colors.inkSecondary }]}>
                        {spotlightEncoreDish.evolutionSummary}
                      </Text>
                    </Pressable>
                  )}

                  {spotlightPriceUpDish && (
                    <Pressable
                      onPress={() => navigateToPlaceDetail(spotlightPriceUpDish.placeId)}
                      style={[
                        styles.spotlightCard,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <View style={styles.spotlightBadgeRow}>
                        <View
                          style={[
                            styles.spotlightBadge,
                            { backgroundColor: colors.priceUpSoft },
                          ]}
                        >
                          <Text style={[styles.spotlightBadgeText, { color: colors.priceUp }]}>
                            💸 漲價幅度顯著
                          </Text>
                        </View>
                        <Text style={[styles.spotlightPlace, { color: colors.inkSecondary }]}>
                          📍 {spotlightPriceUpDish.placeName}
                        </Text>
                      </View>
                      <Text style={[styles.spotlightDishTitle, { color: colors.ink }]}>
                        {spotlightPriceUpDish.name}
                      </Text>
                      <Text style={[styles.spotlightDesc, { color: colors.inkSecondary }]}>
                        {spotlightPriceUpDish.evolutionSummary}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            )}

            {/* 4. 最近吃一口紀錄（精選最新 4 筆，保持主頁清爽） */}
            <View style={styles.homeSectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                  最近吃一口紀錄
                </Text>
                <Pressable onPress={() => setActiveTab('timeline')}>
                  <Text style={[styles.sectionHeaderAction, { color: colors.accent }]}>
                    查看全部日記 ({insights.totalBites}) →
                  </Text>
                </Pressable>
              </View>

              {recentLogEntries.length === 0 ? (
                <View
                  style={[
                    styles.emptyStateBox,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={styles.emptyStateEmoji}>🍽️</Text>
                  <Text style={[styles.emptyStateTitle, { color: colors.ink }]}>
                    目前還沒有任何品嚐紀錄
                  </Text>
                  <Text style={[styles.emptyStateDesc, { color: colors.inkSecondary }]}>
                    點擊上方「連結新店家」或「記一口」，開始寫下專屬於你的第一筆美食筆記！
                  </Text>
                </View>
              ) : (
                <View style={styles.recentLogsList}>
                  {recentLogEntries.map(({ log, dish, visitIndex, prevPrice }) => {
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
                          styles.recentLogCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        {log.photoUri ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`放大檢視 ${dish.name} 照片`}
                            onPress={() => openPhotoLightbox(dish, log)}
                            style={styles.recentLogThumbWrap}
                          >
                            <Image
                              source={{ uri: log.photoUri }}
                              style={styles.recentLogThumb}
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
                            <View style={styles.recentLogThumbZoom}>
                              <Text style={styles.recentLogThumbZoomText}>🔍</Text>
                            </View>
                          </Pressable>
                        ) : (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`查看 ${dish.name} 照片手帳`}
                            onPress={() => openPhotoLightbox(dish, log)}
                            style={[
                              styles.recentLogThumbWrap,
                              {
                                backgroundColor: colors.surfaceSubtle,
                                alignItems: 'center',
                                justifyContent: 'center',
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 24 }}>{vMeta.emoji}</Text>
                          </Pressable>
                        )}

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`查看店家 ${dish.placeName}`}
                          onPress={() => navigateToPlaceDetail(dish.placeId)}
                          style={styles.recentLogBody}
                        >
                          <View style={styles.recentLogTopRow}>
                            <Text
                              numberOfLines={1}
                              style={[styles.recentLogPlace, { color: colors.accent }]}
                            >
                              📍 {dish.placeName} →
                            </Text>
                            <Text style={[styles.recentLogDate, { color: colors.inkMuted }]}>
                              {log.visitedAt}・第 {visitIndex} 次吃
                            </Text>
                          </View>

                          <Text
                            numberOfLines={1}
                            style={[styles.recentLogDish, { color: colors.ink }]}
                          >
                            {dish.name}
                          </Text>

                          <View style={styles.recentLogMetaRow}>
                            <Text style={[styles.recentLogRating, { color: colors.accent }]}>
                              ★ {log.rating.toFixed(1)}
                            </Text>
                            <Text style={[styles.recentLogPrice, { color: colors.ink }]}>
                              NT${log.price}
                            </Text>
                            {priceDiff > 0 && (
                              <Text
                                style={[styles.recentLogPriceUp, { color: colors.priceUp }]}
                              >
                                ▲漲 ${priceDiff}
                              </Text>
                            )}
                            <View
                              style={[
                                styles.recentLogVerdictTag,
                                {
                                  backgroundColor: colors.isDark
                                    ? vMeta.bgDark
                                    : vMeta.bgLight,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.recentLogVerdictText,
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

                          <Text
                            numberOfLines={1}
                            style={[styles.recentLogNote, { color: colors.inkSecondary }]}
                          >
                            {log.note}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 5. 底部引導卡片：引導前往獨立的「🗺️ 店家名冊」分頁 */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="前往店家名冊分頁查看所有紀錄過的店家"
              onPress={() => {
                setPlaceSubView('directory');
                setActiveTab('places');
              }}
              style={[
                styles.placesDirectoryBanner,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.borderStrong },
              ]}
            >
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Text style={[styles.placesDirectoryBannerTitle, { color: colors.ink }]}>
                  🗺️ 紀錄過的店家名冊（共 {insights.totalPlaces} 家）
                </Text>
                <Text
                  style={[styles.placesDirectoryBannerSub, { color: colors.inkSecondary }]}
                >
                  所有已連結的店家、私密備忘與店內各品項圖表已收納在「店家名冊」分頁，讓主頁保持清爽！
                </Text>
              </View>
              <View
                style={[
                  styles.placesDirectoryBannerBtn,
                  { backgroundColor: colors.ink },
                ]}
              >
                <Text
                  style={[
                    styles.placesDirectoryBannerBtnText,
                    { color: colors.canvas },
                  ]}
                >
                  前往查看 →
                </Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* ===================================================================
         * 非主頁共用：搜尋列與味覺印章篩選（供「店家名冊」、「評分漲跌」、「拍立得日記」使用）
         * ================================================================= */}
        {(activeTab === 'places' || activeTab === 'evolution' || activeTab === 'timeline') && (
          <View style={styles.controlsSection}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                value={searchText}
                onChangeText={setSearchText}
                onBlur={resetMobileViewportZoom}
                onSubmitEditing={resetMobileViewportZoom}
                returnKeyType="search"
                placeholder={
                  activeTab === 'places'
                    ? '搜尋紀錄過的店家、地址、料理或私密備忘…'
                    : '搜尋店家、品項或隨手感想（例：拉麵、漲價）…'
                }
                placeholderTextColor={colors.inkMuted}
                style={[styles.searchInput, { color: colors.ink }]}
              />
              {searchText ? (
                <Pressable onPress={() => setSearchText('')} style={styles.clearSearchBtn}>
                  <Text style={{ color: colors.inkMuted, fontWeight: '700' }}>清除</Text>
                </Pressable>
              ) : null}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {FILTER_CHIPS.map((chip) => {
                const selected = verdictFilter === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    onPress={() => setVerdictFilter(chip.id)}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor: selected ? colors.ink : colors.surface,
                        borderColor: selected ? colors.ink : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: selected ? colors.canvas : colors.inkSecondary },
                      ]}
                    >
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ===================================================================
         * 分頁 2：🗺️ 店家名冊（獨立收納所有紀錄過的店家與店內品項詳情）
         * 手機採用「店家名冊列表 ↔ 單店詳細紀錄」兩階層切換，寬螢幕支援左右雙欄
         * ================================================================= */}
        {activeTab === 'places' && (
          <View style={[styles.placesWorkspace, isWideScreen && styles.placesWorkspaceWide]}>
            {/* 左欄（或手機版的「店家名冊總覽列表」模式） */}
            {(isWideScreen || placeSubView === 'directory') && (
              <View style={[styles.placesSidebar, isWideScreen && styles.placesSidebarWide]}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                      已紀錄店家名冊 ({filteredPlaces.length})
                    </Text>
                    <Text style={[styles.sectionHeaderSub, { color: colors.inkSecondary }]}>
                      點選任一店家查看店內私密備忘與各料理歷次評分演變
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setPlaceModalVisible(true)}
                    style={[
                      styles.addPlaceInlineBtn,
                      { backgroundColor: colors.accentSoft },
                    ]}
                  >
                    <Text style={[styles.sectionHeaderAction, { color: colors.accent }]}>
                      ＋ 連結新店家
                    </Text>
                  </Pressable>
                </View>

                {filteredPlaces.length === 0 ? (
                  <View
                    style={[
                      styles.emptyStateBox,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={styles.emptyStateEmoji}>🍽️</Text>
                    <Text style={[styles.emptyStateTitle, { color: colors.ink }]}>
                      找不到符合條件的店家紀錄
                    </Text>
                    <Text style={[styles.emptyStateDesc, { color: colors.inkSecondary }]}>
                      您可以清除篩選條件，或點擊下方按鈕連結新的 Google Maps 店家。
                    </Text>
                    <Pressable
                      onPress={() => {
                        setSearchText('');
                        setVerdictFilter('all');
                      }}
                      style={[styles.emptyStateBtn, { backgroundColor: colors.accent }]}
                    >
                      <Text style={styles.emptyStateBtnText}>顯示全部店家</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.placeListVertical}>
                    {filteredPlaces.map((place) => {
                      const isSelected = activePlace?.id === place.id && isWideScreen;
                      return (
                        <Pressable
                          key={place.id}
                          onPress={() => {
                            setSelectedPlaceId(place.id);
                            setPlaceSubView('detail');
                          }}
                          style={[
                            styles.placeDirectoryCard,
                            {
                              backgroundColor: isSelected
                                ? colors.surfaceElevated
                                : colors.surface,
                              borderColor: isSelected ? colors.accent : colors.border,
                              borderWidth: isSelected ? 2 : 1,
                            },
                          ]}
                        >
                          <View style={styles.placeCardTopRow}>
                            <View style={styles.placeCardTitleGroup}>
                              <View style={styles.placeCardBadgeLine}>
                                <Text
                                  style={[styles.placeCardCategory, { color: colors.accent }]}
                                >
                                  {place.category}
                                </Text>
                                {place.priceUpDishCount > 0 && (
                                  <View
                                    style={[
                                      styles.miniAlertChip,
                                      { backgroundColor: colors.priceUpSoft },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.miniAlertChipText,
                                        { color: colors.priceUp },
                                      ]}
                                    >
                                      💸 {place.priceUpDishCount} 品項漲價
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <Text
                                numberOfLines={1}
                                style={[styles.placeCardName, { color: colors.ink }]}
                              >
                                {place.isFavorite ? '⭐ ' : ''}
                                {place.name}
                              </Text>
                            </View>
                            <View
                              style={[
                                styles.placeScoreBadge,
                                { backgroundColor: colors.surfaceSubtle },
                              ]}
                            >
                              <Text style={[styles.placeScoreText, { color: colors.ink }]}>
                                ★ {place.personalAvgRating.toFixed(1)}
                              </Text>
                            </View>
                          </View>

                          <Text
                            numberOfLines={1}
                            style={[styles.placeCardAddress, { color: colors.inkSecondary }]}
                          >
                            📍 {place.address}
                          </Text>

                          {place.personalNote ? (
                            <Text
                              numberOfLines={2}
                              style={[
                                styles.placeCardNotePreview,
                                {
                                  color: colors.inkSecondary,
                                  backgroundColor: colors.surfaceSubtle,
                                },
                              ]}
                            >
                              🔒 {place.personalNote}
                            </Text>
                          ) : null}

                          {place.dishes.length > 0 && (
                            <View style={styles.placeDishTagsRow}>
                              {place.dishes.slice(0, 3).map((d) => (
                                <View
                                  key={d.id}
                                  style={[
                                    styles.placeDishMiniTag,
                                    {
                                      backgroundColor: colors.surfaceSubtle,
                                      borderColor: colors.border,
                                    },
                                  ]}
                                >
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.placeDishMiniTagText,
                                      { color: colors.ink },
                                    ]}
                                  >
                                    {VERDICT_OPTIONS[d.latestVerdict].emoji} {d.name} (
                                    {d.visitCount}次)
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <View
                            style={[
                              styles.placeCardFooterRow,
                              { borderTopColor: colors.border },
                            ]}
                          >
                            <Text style={[styles.placeCardStatTag, { color: colors.inkMuted }]}>
                              {place.totalDishes} 道料理・累計 {place.totalVisits} 次・最近{' '}
                              {place.lastVisitedAt}
                            </Text>

                            <View style={styles.placeCardFooterBtns}>
                              <Pressable
                                onPress={() => handleOpenGoogleMaps(place)}
                                style={[
                                  styles.placeCardQuickAddBtn,
                                  {
                                    backgroundColor: colors.herbSoft,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.placeCardQuickAddText,
                                    { color: colors.herb },
                                  ]}
                                >
                                  🗺️ 地圖
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => openComposerForPlace(place.id)}
                                style={[
                                  styles.placeCardQuickAddBtn,
                                  {
                                    backgroundColor: colors.surfaceSubtle,
                                    borderColor: colors.border,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.placeCardQuickAddText,
                                    { color: colors.ink },
                                  ]}
                                >
                                  ＋ 記一口
                                </Text>
                              </Pressable>

                              <View
                                style={[
                                  styles.placeCardEnterBtn,
                                  { backgroundColor: colors.accent },
                                ]}
                              >
                                <Text style={styles.placeCardEnterText}>
                                  店內紀錄 →
                                </Text>
                              </View>
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* 右欄（或手機版點選店家後的「單店詳細紀錄」視圖） */}
            {(isWideScreen || placeSubView === 'detail') && activePlace && (
              <View style={styles.placeDetailPane}>
                {/* 手機版頂部：返回店家名冊列表按鈕 + 快速切換列 */}
                {!isWideScreen && (
                  <View style={styles.mobilePlaceDetailNav}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="返回已紀錄店家名冊列表"
                      onPress={() => setPlaceSubView('directory')}
                      style={[
                        styles.backToDirectoryBtn,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.backToDirectoryBtnText, { color: colors.ink }]}>
                        ← 返回店家名冊列表（共 {filteredPlaces.length} 家）
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* 店家資訊大卡片 */}
                <View
                  style={[
                    styles.placeHeroCard,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.placeHeroBadgeRow}>
                    <View
                      style={[
                        styles.placeCatTag,
                        { backgroundColor: colors.accentSoft },
                      ]}
                    >
                      <Text style={[styles.placeCatTagText, { color: colors.accent }]}>
                        {activePlace.category}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.googleLinkedTag,
                        { backgroundColor: colors.herbSoft },
                      ]}
                    >
                      <Text style={[styles.googleLinkedTagText, { color: colors.herb }]}>
                        ✓ 已連結 Google 地圖地標
                      </Text>
                    </View>
                  </View>

                  <Text style={[styles.placeHeroTitle, { color: colors.ink }]}>
                    {activePlace.name}
                  </Text>
                  <Text style={[styles.placeHeroAddr, { color: colors.inkSecondary }]}>
                    📍 {activePlace.address}
                  </Text>

                  <View style={styles.placeHeroActionsRow}>
                    <Pressable
                      onPress={() => handleToggleFavoritePlace(activePlace.id)}
                      style={[
                        styles.secondaryActionBtn,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryActionBtnText, { color: colors.ink }]}>
                        {activePlace.isFavorite ? '⭐ 已釘選私藏' : '☆ 釘選私藏'}
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => handleOpenGoogleMaps(activePlace)}
                      style={[
                        styles.secondaryActionBtn,
                        {
                          backgroundColor: colors.surfaceSubtle,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.secondaryActionBtnText, { color: colors.herb }]}>
                        🗺️ 在 Google 地圖開啟
                      </Text>
                    </Pressable>
                  </View>

                  {/* 店家私密筆記區 */}
                  <View
                    style={[
                      styles.privateNoteStrip,
                      {
                        backgroundColor: colors.surfaceSubtle,
                        borderColor: colors.borderStrong,
                      },
                    ]}
                  >
                    <Text style={[styles.privateNoteLabel, { color: colors.inkMuted }]}>
                      🔒 店家私密備忘（僅自己可見，不看他人評價）：
                    </Text>
                    <Text style={[styles.privateNoteContent, { color: colors.ink }]}>
                      {activePlace.personalNote}
                    </Text>
                  </View>

                  {/* 店家底部快速新增品嚐按鈕列 */}
                  <View style={styles.placeHeroBottomBar}>
                    <Text style={[styles.placeHeroMetaText, { color: colors.inkSecondary }]}>
                      已記錄 {activePlace.totalDishes} 道料理・累計品嚐 {activePlace.totalVisits} 次・最近造訪 {activePlace.lastVisitedAt}
                    </Text>
                    <Pressable
                      onPress={() => openComposerForPlace(activePlace.id)}
                      style={[
                        styles.addDishInPlaceBtn,
                        { backgroundColor: colors.ink },
                      ]}
                    >
                      <Text style={[styles.addDishInPlaceBtnText, { color: colors.canvas }]}>
                        📷 上傳此店食物照片 / 記一口
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* 店內各品項的歷次評分與價格演變卡片 */}
                {activePlace.dishes.length === 0 ? (
                  <View
                    style={[
                      styles.emptyStateBox,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={styles.emptyStateEmoji}>📷</Text>
                    <Text style={[styles.emptyStateTitle, { color: colors.ink }]}>
                      這家店還沒有品項紀錄
                    </Text>
                    <Text style={[styles.emptyStateDesc, { color: colors.inkSecondary }]}>
                      點選下方按鈕上傳第一張自己吃的食物照片、填入價格與感想！
                    </Text>
                    <Pressable
                      onPress={() => openComposerForPlace(activePlace.id)}
                      style={[styles.emptyStateBtn, { backgroundColor: colors.accent }]}
                    >
                      <Text style={styles.emptyStateBtnText}>＋ 記錄第一道品項</Text>
                    </Pressable>
                  </View>
                ) : (
                  activePlace.dishes.map((dish) => (
                    <DishEvolutionChart
                      key={dish.id}
                      dish={dish}
                      colors={colors}
                      onPressPhoto={openPhotoLightbox}
                      onAddVisit={openComposerForDish}
                      onDeleteLog={handleDeleteLog}
                    />
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* ===================================================================
         * 分頁 3：📈 品項多次評分與漲跌總覽（跨店家直接比較所有品項演變）
         * ================================================================= */}
        {activeTab === 'evolution' && (
          <View style={styles.evolutionTabContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                跨店家品項演變追蹤（共 {filteredDishes.length} 道料理）
              </Text>
              <Text style={[styles.sectionHeaderSub, { color: colors.inkSecondary }]}>
                自動比對第 1 次吃、第 2 次吃、第 3 次吃的評分起伏與價格漲跌
              </Text>
            </View>

            {filteredDishes.map((dish) => (
              <View key={dish.id}>
                <Pressable
                  onPress={() => navigateToPlaceDetail(dish.placeId)}
                  style={styles.dishPlaceHeaderLabel}
                >
                  <Text style={[styles.dishPlaceHeaderText, { color: colors.accent }]}>
                    📍 {dish.placeName}（{dish.placeAddress}） · 查看店家 →
                  </Text>
                </Pressable>
                <DishEvolutionChart
                  dish={dish}
                  colors={colors}
                  onPressPhoto={openPhotoLightbox}
                  onAddVisit={openComposerForDish}
                  onDeleteLog={handleDeleteLog}
                />
              </View>
            ))}
          </View>
        )}

        {/* ===================================================================
         * 分頁 4：📸 拍立得時間軸（依用餐日期瀏覽每一口食物照片與心情）
         * ================================================================= */}
        {activeTab === 'timeline' && (
          <View style={styles.timelineTabContainer}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeaderTitle, { color: colors.ink }]}>
                個人飲食拍立得日記時間軸
              </Text>
              <Text style={[styles.sectionHeaderSub, { color: colors.inkSecondary }]}>
                按日期倒序排列，重溫每一次用餐當下的照片、價格與真實感受
              </Text>
            </View>

            <View style={styles.polaroidGrid}>
              {timelineEntries.map(({ log, dish, visitIndex, prevPrice }) => {
                const vMeta = VERDICT_OPTIONS[log.verdict];
                const fMeta =
                  PHOTO_FILTERS.find((f) => f.id === log.photoFilter) || PHOTO_FILTERS[0];
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
                      onPress={() => openPhotoLightbox(dish, log)}
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
                          onPress={() => navigateToPlaceDetail(dish.placeId)}
                          style={styles.polaroidPlacePressable}
                        >
                          <Text style={[styles.polaroidPlaceText, { color: colors.accent }]}>
                            📍 {dish.placeName} →
                          </Text>
                        </Pressable>

                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`點擊放大檢視 ${dish.name}`}
                          onPress={() => openPhotoLightbox(dish, log)}
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

            {/* 頁尾法律與隱私連結（Web 版與 App 底端均可常駐查閱） */}
            <View style={styles.appFooterContainer}>
              <Text style={[styles.appFooterText, { color: colors.inkMuted }]}>
                © 2026 BiteNote 吃一口 · 本機優先極簡飲食手帳
              </Text>
              <View style={styles.appFooterLinksRow}>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="查看隱私權政策"
                  onPress={() => openPolicyLink('privacy')}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.appFooterLinkText, { color: colors.accent }]}>
                    隱私權政策 (Privacy)
                  </Text>
                </Pressable>
                <Text style={{ fontSize: 12, color: colors.inkMuted }}>·</Text>
                <Pressable
                  accessibilityRole="link"
                  accessibilityLabel="查看服務條款"
                  onPress={() => openPolicyLink('terms')}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.appFooterLinkText, { color: colors.accent }]}>
                    服務條款 (Terms)
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ===================================================================
         * 分頁 5：👤 「我的」個人手帳與設定中心
         * ================================================================= */}
        {activeTab === 'profile' && (
          <ProfileTab
            settings={settings}
            colors={colors}
            places={places}
            dishes={dishes}
            biteLogs={biteLogs}
            onUpdateSettings={(partial) => {
              const next = { ...settings, ...partial };
              persistAll(places, dishes, biteLogs, next);
            }}
            onLoginSuccess={handleLoginSuccess}
            onLogout={handleLogout}
            onOpenAuthModal={() => setAuthModalVisible(true)}
            onOpenBackupModal={() => setBackupModalVisible(true)}
            onOpenPrivacy={() => openPolicyLink('privacy')}
            onOpenTerms={() => openPolicyLink('terms')}
            onExportBackup={() => {
              exportBackupFile({ settings, places, dishes, biteLogs });
            }}
            onResetToSeed={() => {
              persistAll(SEED_PLACES, SEED_DISHES, SEED_BITE_LOGS, DEFAULT_SETTINGS);
              setSelectedPlaceId(SEED_PLACES[0].id);
            }}
            onClearAllData={() => {
              persistAll([], [], [], settings);
              setSelectedPlaceId('');
              showToast('🧹 已清空所有資料！');
            }}
            onShowToast={showToast}
          />
        )}
      </ScrollView>
      )}

      {/* =====================================================================
       * 底部固定導覽列 (Bottom Tab Bar) — 讓主頁、足跡地圖與已紀錄店家名冊徹底分流
       * =================================================================== */}
      <View
        style={[
          styles.bottomTabBar,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        {[
          { id: 'home' as MainTab, icon: '🏠', label: '主頁' },
          { id: 'map' as MainTab, icon: '🗺️', label: '美食地圖' },
          { id: 'places' as MainTab, icon: '📖', label: '店家名冊' },
          { id: 'evolution' as MainTab, icon: '📈', label: '評分漲跌' },
          { id: 'timeline' as MainTab, icon: '📸', label: '拍立得日記' },
          { id: 'profile' as MainTab, icon: '👤', label: '我的' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`${tab.label}分頁`}
              onPress={() => {
                setActiveTab(tab.id);
                if (tab.id === 'places') {
                  setPlaceSubView('directory');
                }
              }}
              style={[
                styles.bottomTabItem,
                isActive && { backgroundColor: colors.accentSoft },
              ]}
            >
              <Text style={styles.bottomTabIcon}>{tab.icon}</Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.bottomTabLabel,
                  {
                    color: isActive ? colors.accent : colors.inkSecondary,
                    fontWeight: isActive ? '800' : '600',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 彈窗 1：記一口（上傳照片、品項多次評分、價格漲跌預覽） */}
      <BiteComposerModal
        visible={composerVisible}
        colors={colors}
        places={enrichedPlaces}
        initialPlaceId={composerTargetPlaceId}
        initialDish={composerTargetDish}
        autoSaveToAlbum={settings.autoSaveToAlbum}
        onClose={() => setComposerVisible(false)}
        onSubmit={handleAddBite}
        onOpenNewPlaceModal={() => {
          setComposerVisible(false);
          setPlaceModalVisible(true);
        }}
      />

      {/* 彈窗 2：連結 Google Maps 店家 / 建立私房店家 */}
      <PlacePickerModal
        visible={placeModalVisible}
        colors={colors}
        googleMapsApiKey={settings.googleMapsApiKey}
        onClose={() => setPlaceModalVisible(false)}
        onCreatePlace={handleCreatePlace}
      />

      {/* 彈窗 3：原生雲端備份 (iOS iCloud / Android Google Drive) 與設定 */}
      <BackupSettingsModal
        visible={backupModalVisible}
        colors={colors}
        settings={settings}
        statsSummary={{
          places: places.length,
          dishes: dishes.length,
          logs: biteLogs.length,
        }}
        onClose={() => setBackupModalVisible(false)}
        onUpdateSettings={(partial) => {
          const next = { ...settings, ...partial };
          persistAll(places, dishes, biteLogs, next);
        }}
        onExportBackup={() => {
          exportBackupFile({ settings, places, dishes, biteLogs });
        }}
        onImportBackupJson={(raw) => {
          const restored = parseBackupJson(raw);
          persistAll(
            restored.places,
            restored.dishes,
            restored.biteLogs,
            restored.settings
          );
          if (restored.places.length > 0) {
            setSelectedPlaceId(restored.places[0].id);
          }
        }}
        onResetToSeed={() => {
          persistAll(SEED_PLACES, SEED_DISHES, SEED_BITE_LOGS, DEFAULT_SETTINGS);
          setSelectedPlaceId(SEED_PLACES[0].id);
        }}
        onClearAllData={() => {
          persistAll([], [], [], settings);
          setSelectedPlaceId('');
          showToast('🧹 已清空示範資料，點選「📍 連結新店家」開始您的第一筆美食紀錄！');
        }}
        onOpenAuthModal={() => {
          setBackupModalVisible(false);
          setAuthModalVisible(true);
        }}
        onOpenPrivacy={() => openPolicyLink('privacy')}
        onOpenTerms={() => openPolicyLink('terms')}
        onPreviewSplash={() => {
          setBackupModalVisible(false);
          setPreviewSplash(true);
        }}
      />

      {/* 彈窗 4：照片全螢幕暗房（LINE / iOS 相簿風格：鎖定同一店家同品項左右滑動歷次照片、底片濾鏡對照） */}
      <PhotoLightboxModal
        visible={Boolean(lightboxDish)}
        colors={colors}
        dish={lightboxDish}
        initialLog={lightboxLog}
        onClose={() => {
          setLightboxDish(null);
          setLightboxLog(null);
        }}
        onNavigateToPlace={navigateToPlaceDetail}
        onAddVisitForDish={openComposerForDish}
      />

      {/* 彈窗 5：極簡無負擔之登入與身分面板 (AuthModal) */}
      <AuthModal
        visible={authModalVisible}
        currentUser={settings.userProfile}
        colors={colors}
        settings={settings}
        onUpdateSettings={(partial) => {
          const next = { ...settings, ...partial };
          persistAll(places, dishes, biteLogs, next);
        }}
        onClose={() => setAuthModalVisible(false)}
        onOpenPrivacy={() => openPolicyLink('privacy')}
        onOpenTerms={() => openPolicyLink('terms')}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
        onShowToast={showToast}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 18,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.pill,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  toastBannerText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  masthead: {
    width: '100%',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  mastheadTopRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  logoRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTextCol: {
    flex: 1,
    minWidth: 0,
  },
  logoStamp: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  logoStampText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  brandTitleEn: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FONTS.serif,
    letterSpacing: -0.4,
  },
  brandTitleZh: {
    fontSize: 17,
    fontWeight: '900',
    fontFamily: FONTS.serif,
  },
  brandSubtitle: {
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
    fontFamily: FONTS.sans,
  },
  utilityBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  compactUtilityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  compactUtilityBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  mainScroll: {
    flex: 1,
    width: '100%',
  },
  mainScrollContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
    gap: SPACING.md,
  },
  homeTabContainer: {
    width: '100%',
    gap: SPACING.lg,
  },
  homeHeroCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  homeHeroHeader: {
    gap: 8,
  },
  homeHeroKickerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  homeHeroKickerText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  homeHeroTitle: {
    fontSize: 22,
    fontWeight: '900',
    fontFamily: FONTS.serif,
    lineHeight: 30,
  },
  homeHeroSub: {
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FONTS.sans,
  },
  
  homeHeroActionsRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
  homePrimaryCta: {
    flex: 1.6,
    minWidth: 200,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePrimaryCtaText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  homeSecondaryCta: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeSecondaryCtaText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  homeAuthBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 12,
  },
  homeAuthBannerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  homeAuthBadgeIconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  homeAuthBadgeIconText: {
    fontSize: 18,
  },
  homeAuthBannerMeta: {
    flex: 1,
    minWidth: 0,
  },
  homeAuthBannerTitle: {
    fontFamily: FONTS.sans,
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  homeAuthBannerDesc: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
  },
  homeAuthBannerPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    flexShrink: 0,
  },
  homeAuthBannerPillText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
  },
  homeSectionBlock: {
    width: '100%',
    gap: SPACING.sm,
  },
  insightRibbon: {
    width: '100%',
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  insightItem: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 2,
  },
  insightDivider: {
    width: 1,
    marginVertical: 4,
  },
  insightNum: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FONTS.mono,
  },
  insightLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  spotlightRow: {
    width: '100%',
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  spotlightRowWide: {
    flexDirection: 'row',
  },
  spotlightCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 6,
  },
  spotlightBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  spotlightBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  spotlightBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  spotlightPlace: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  spotlightDishTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  spotlightDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  recentLogsList: {
    width: '100%',
    gap: SPACING.sm,
  },
  recentLogCard: {
    width: '100%',
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 12,
    alignItems: 'center',
  },
  recentLogThumbWrap: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    position: 'relative',
    flexShrink: 0,
  },
  recentLogThumb: {
    width: '100%',
    height: '100%',
  },
  recentLogThumbZoom: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    backgroundColor: 'rgba(18, 17, 16, 0.72)',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentLogThumbZoomText: {
    fontSize: 10,
    lineHeight: 12,
  },
  recentLogBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  recentLogTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  recentLogPlace: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
  },
  recentLogDate: {
    fontSize: 11,
    fontFamily: FONTS.mono,
    flexShrink: 0,
  },
  recentLogDish: {
    fontSize: 15.5,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  recentLogMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 1,
  },
  recentLogRating: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  recentLogPrice: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  recentLogPriceUp: {
    fontSize: 11,
    fontWeight: '800',
  },
  recentLogVerdictTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recentLogVerdictText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  recentLogNote: {
    fontSize: 12,
  },
  placesDirectoryBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 12,
  },
  placesDirectoryBannerTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  placesDirectoryBannerSub: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  placesDirectoryBannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    flexShrink: 0,
  },
  placesDirectoryBannerBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
  },
  controlsSection: {
    width: '100%',
    gap: SPACING.sm,
  },
  searchBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
  },
  searchIcon: {
    fontSize: 15,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
  },
  clearSearchBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  filterPillsRow: {
    gap: 8,
    paddingVertical: 2,
    paddingRight: SPACING.md,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  placesWorkspace: {
    width: '100%',
    gap: SPACING.md,
  },
  placesWorkspaceWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  placesSidebar: {
    width: '100%',
    gap: SPACING.sm,
  },
  placesSidebarWide: {
    width: 360,
  },
  sectionHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  sectionHeaderSub: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionHeaderAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  addPlaceInlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.pill,
  },
  placeListVertical: {
    gap: SPACING.sm,
  },
  placeDirectoryCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 8,
  },
  placeCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  placeCardTitleGroup: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  placeCardBadgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  placeCardCategory: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  placeCardName: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  placeScoreBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    flexShrink: 0,
  },
  placeScoreText: {
    fontSize: 12.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  placeCardAddress: {
    fontSize: 12.5,
  },
  placeCardNotePreview: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  placeDishTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  placeDishMiniTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  placeDishMiniTagText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  placeCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 8,
    marginTop: 2,
    borderTopWidth: 1,
    gap: 8,
  },
  placeCardStatTag: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  placeCardFooterBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  placeCardQuickAddBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  placeCardQuickAddText: {
    fontSize: 12,
    fontWeight: '700',
  },
  placeCardEnterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
  },
  placeCardEnterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  miniAlertChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniAlertChipText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  placeDetailPane: {
    width: '100%',
    flex: 1,
    minWidth: 0,
    gap: SPACING.md,
  },
  mobilePlaceDetailNav: {
    width: '100%',
  },
  backToDirectoryBtn: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backToDirectoryBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  placeHeroCard: {
    width: '100%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 10,
  },
  placeHeroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  placeCatTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  placeCatTagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  googleLinkedTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  googleLinkedTagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  placeHeroTitle: {
    width: '100%',
    fontSize: 21,
    fontWeight: '900',
    fontFamily: FONTS.serif,
    lineHeight: 28,
  },
  placeHeroAddr: {
    width: '100%',
    fontSize: 13,
    lineHeight: 18,
  },
  placeHeroActionsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionBtn: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  privateNoteStrip: {
    width: '100%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 4,
  },
  privateNoteLabel: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  privateNoteContent: {
    fontSize: 13,
    lineHeight: 19,
  },
  placeHeroBottomBar: {
    width: '100%',
    flexDirection: 'column',
    gap: 8,
  },
  placeHeroMetaText: {
    fontSize: 12,
    lineHeight: 17,
  },
  addDishInPlaceBtn: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addDishInPlaceBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyStateBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
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
  },
  emptyStateDesc: {
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 19,
  },
  emptyStateBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
  },
  emptyStateBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  evolutionTabContainer: {
    gap: SPACING.md,
  },
  dishPlaceHeaderLabel: {
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dishPlaceHeaderText: {
    fontSize: 13,
    fontWeight: '800',
  },
  timelineTabContainer: {
    gap: SPACING.md,
  },
  polaroidGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  polaroidCard: {
    flexGrow: 1,
    flexBasis: 280,
    maxWidth: 400,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  polaroidImageWrapper: {
    width: '100%',
    height: 195,
    position: 'relative',
  },
  polaroidZoomOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(18, 17, 16, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  polaroidZoomOverlayText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  polaroidImage: {
    width: '100%',
    height: '100%',
  },
  polaroidTopBadges: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  polaroidDarkPill: {
    backgroundColor: 'rgba(18, 17, 16, 0.78)',
    paddingHorizontal: 9,
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
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  polaroidVerdictText: {
    fontSize: 11,
    fontWeight: '800',
  },
  polaroidBody: {
    padding: SPACING.md,
    gap: 4,
  },
  polaroidPlaceText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  polaroidPlacePressable: {
    alignSelf: 'flex-start',
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
    marginVertical: 4,
  },
  polaroidRating: {
    fontSize: 14.5,
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
    fontWeight: '700',
  },
  polaroidNote: {
    fontSize: 13,
    lineHeight: 19,
  },
  bottomTabBar: {
    width: '100%',
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: 2,
    paddingVertical: 5,
    gap: 2,
  },
  bottomTabItem: {
    flex: 1,
    minWidth: 0,
    borderRadius: RADIUS.md,
    paddingVertical: 5,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  bottomTabIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bottomTabIcon: {
    fontSize: 16,
  },
  bottomTabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: RADIUS.pill,
  },
  bottomTabBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  bottomTabLabel: {
    fontSize: 10.5,
    textAlign: 'center',
  },
  appFooterContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    gap: 6,
  },
  appFooterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  appFooterLinksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appFooterLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});