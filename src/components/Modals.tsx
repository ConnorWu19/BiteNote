/**
 * BiteNote 吃一口 — 互動抽屜與對話框元件群
 * 1. BiteComposerModal: 「記一口」上傳食物照片、填寫品項/價格/感想、同品項多次評分與漲跌即時預覽
 * 2. PlacePickerModal: 連接 Google Maps 店家搜尋、貼上地圖網址解析、GPS 定位與私房小店建立
 * 3. BackupSettingsModal: iOS iCloud / Android Google Drive 系統原生備份狀態、相簿同步與手動匯出還原
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  AppSettings,
  BiteLog,
  DISH_CATEGORIES,
  DishCategory,
  EnrichedDish,
  EnrichedPlace,
  PHOTO_FILTERS,
  PLACE_CATEGORIES,
  PhotoFilter,
  Place,
  PlaceCategory,
  TastingVerdict,
  ThemeMode,
  VERDICT_OPTIONS,
} from '../types/models';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';
import {
  GooglePlaceCandidate,
  PRESET_FOOD_PHOTOS,
  parseGoogleMapsInput,
} from '../utils/analytics';
import {
  getCurrentGpsCoordinates,
  pickPhotoFromLibrary,
  searchGooglePlaces,
  takePhotoWithCamera,
} from '../services/storage';

/* ============================================================================
 * 1. BiteComposerModal — 記一口（支援同品項第 N 次評分、價格漲跌預覽與上傳食物照片）
 * ========================================================================== */

export interface NewBiteSubmission {
  placeId: string;
  dishId?: string;          // 若指定則代表「同品項再吃一次」，否則建立新品項
  newDishName?: string;
  newDishCategory?: DishCategory;
  price: number;
  rating: number;
  verdict: TastingVerdict;
  note: string;
  photoUri?: string;
  photoFilter: PhotoFilter;
  visitedAt: string;
}

interface BiteComposerModalProps {
  visible: boolean;
  colors: ThemeColors;
  places: EnrichedPlace[];
  initialPlaceId?: string;
  initialDish?: EnrichedDish | null;
  autoSaveToAlbum: boolean;
  onClose: () => void;
  onSubmit: (payload: NewBiteSubmission) => void;
  onOpenNewPlaceModal: () => void;
}

const RATING_STEPS = [5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0];

/**
 * 強制收起手機鍵盤並重置行動端瀏覽器（iOS Safari / Android Chrome）自動放大的視窗縮放與水平偏移
 */
export function resetMobileViewportZoom() {
  try {
    Keyboard.dismiss();
  } catch {
    // ignore
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && typeof activeEl.blur === 'function') {
        activeEl.blur();
      }
      let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
      }
      viewportMeta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any });
      document.documentElement.scrollLeft = 0;
      document.body.scrollLeft = 0;
    } catch {
      // ignore
    }
  }
}

export const BiteComposerModal: React.FC<BiteComposerModalProps> = ({
  visible,
  colors,
  places,
  initialPlaceId,
  initialDish,
  autoSaveToAlbum,
  onClose,
  onSubmit,
  onOpenNewPlaceModal,
}) => {
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>('');
  const [dishMode, setDishMode] = useState<'existing' | 'new'>('existing');
  const [selectedDishId, setSelectedDishId] = useState<string>('');
  const [newDishName, setNewDishName] = useState<string>('');
  const [newDishCategory, setNewDishCategory] = useState<DishCategory>('招牌主食');

  const [priceText, setPriceText] = useState<string>('190');
  const [rating, setRating] = useState<number>(4.5);
  const [verdict, setVerdict] = useState<TastingVerdict>('encore');
  const [note, setNote] = useState<string>('');
  const [photoUri, setPhotoUri] = useState<string>(PRESET_FOOD_PHOTOS[0].url);
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>('warm');
  const [visitedAt, setVisitedAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isPickingPhoto, setIsPickingPhoto] = useState<boolean>(false);

  const currentPlace = places.find((p) => p.id === selectedPlaceId) || places[0];
  const existingDishes = currentPlace ? currentPlace.dishes : [];
  const activeExistingDish =
    dishMode === 'existing'
      ? existingDishes.find((d) => d.id === selectedDishId) || existingDishes[0]
      : undefined;

  // 當開啟視窗或帶入指定店家/品項時初始化表單
  useEffect(() => {
    if (!visible) return;
    setErrorMsg('');
    const today = new Date().toISOString().slice(0, 10);
    setVisitedAt(today);

    if (initialDish) {
      setSelectedPlaceId(initialDish.placeId);
      setDishMode('existing');
      setSelectedDishId(initialDish.id);
      setPriceText(String(initialDish.latestPrice || 150));
      setRating(initialDish.latestRating || 4.0);
      setVerdict(initialDish.latestVerdict || 'solid');
      setPhotoUri(initialDish.coverUri || PRESET_FOOD_PHOTOS[0].url);
      setNote('');
      return;
    }

    const targetPlace =
      places.find((p) => p.id === initialPlaceId) || places[0];
    if (targetPlace) {
      setSelectedPlaceId(targetPlace.id);
      if (targetPlace.dishes.length > 0) {
        setDishMode('existing');
        const firstDish = targetPlace.dishes[0];
        setSelectedDishId(firstDish.id);
        setPriceText(String(firstDish.latestPrice || 150));
        setRating(firstDish.latestRating || 4.5);
        setVerdict(firstDish.latestVerdict || 'solid');
        setPhotoUri(firstDish.coverUri || PRESET_FOOD_PHOTOS[0].url);
      } else {
        setDishMode('new');
        setNewDishName('');
        setPriceText('150');
        setRating(4.5);
        setVerdict('encore');
        setPhotoUri(PRESET_FOOD_PHOTOS[0].url);
      }
    }
    setNote('');
  }, [visible, initialPlaceId, initialDish]);

  // 切換既有品項時自動帶入上次價格與照片供對比
  const handleSelectExistingDish = (dish: EnrichedDish) => {
    setSelectedDishId(dish.id);
    setPriceText(String(dish.latestPrice || 150));
    setRating(dish.latestRating || 4.0);
    if (dish.coverUri) setPhotoUri(dish.coverUri);
  };

  const numericPrice = Math.max(0, Math.round(Number(priceText) || 0));
  const prevPrice = activeExistingDish ? activeExistingDish.latestPrice : null;
  const priceDiff =
    prevPrice !== null && prevPrice > 0 ? numericPrice - prevPrice : 0;

  // 若價格比上次貴，提供一鍵切換為「漲價退步」提示
  const handlePriceChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '');
    setPriceText(cleaned);
    const num = Number(cleaned) || 0;
    if (activeExistingDish && activeExistingDish.latestPrice > 0 && num > activeExistingDish.latestPrice) {
      // 自動提示使用者可標記為漲價退步
    }
  };

  const handlePickAlbum = async () => {
    try {
      setIsPickingPhoto(true);
      setErrorMsg('');
      const uri = await pickPhotoFromLibrary(autoSaveToAlbum);
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      setErrorMsg(e?.message || '無法開啟相簿，請確認權限或改選下方內建美食相片');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleTakeCamera = async () => {
    try {
      setIsPickingPhoto(true);
      setErrorMsg('');
      const uri = await takePhotoWithCamera(autoSaveToAlbum);
      if (uri) setPhotoUri(uri);
    } catch (e: any) {
      setErrorMsg(e?.message || '無法開啟相機，請確認權限或改用相簿選圖');
    } finally {
      setIsPickingPhoto(false);
    }
  };

  const handleSave = () => {
    if (!currentPlace) {
      setErrorMsg('請先選擇或建立一家店家');
      return;
    }
    if (dishMode === 'new' && !newDishName.trim()) {
      setErrorMsg('請輸入您這次吃的品項名稱（例如：紅燒牛肉麵）');
      return;
    }
    if (dishMode === 'existing' && !activeExistingDish) {
      setErrorMsg('請選擇品項，或切換至「新增店內品項」');
      return;
    }

    onSubmit({
      placeId: currentPlace.id,
      dishId: dishMode === 'existing' && activeExistingDish ? activeExistingDish.id : undefined,
      newDishName: dishMode === 'new' ? newDishName.trim() : undefined,
      newDishCategory: dishMode === 'new' ? newDishCategory : undefined,
      price: numericPrice,
      rating,
      verdict,
      note:
        note.trim() ||
        `${VERDICT_OPTIONS[verdict].label}！價格 NT$${numericPrice}，個人評分 ${rating.toFixed(1)} 分。`,
      photoUri: photoUri.trim() || undefined,
      photoFilter,
      visitedAt: visitedAt.trim() || new Date().toISOString().slice(0, 10),
    });
    onClose();
  };

  const selectedFilterMeta =
    PHOTO_FILTERS.find((f) => f.id === photoFilter) || PHOTO_FILTERS[0];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.canvas, borderColor: colors.border },
          ]}
        >
          {/* 頂部標題列 */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <Text style={[styles.modalKicker, { color: colors.accent }]}>
                個人私密味覺手帳
              </Text>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                {dishMode === 'existing' && activeExistingDish
                  ? `再吃一口：第 ${activeExistingDish.visitCount + 1} 次品嚐記錄`
                  : '記一口：新增品項與品嚐感想'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="關閉視窗"
              onPress={onClose}
              style={[styles.closeCircle, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Text style={[styles.closeCircleText, { color: colors.ink }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {errorMsg ? (
              <View style={[styles.errorBanner, { backgroundColor: colors.priceUpSoft }]}>
                <Text style={[styles.errorBannerText, { color: colors.priceUp }]}>
                  ⚠️ {errorMsg}
                </Text>
              </View>
            ) : null}

            {/* 步驟 1：選擇店家 */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                  1. 用餐店家（已連結 Google 地圖）
                </Text>
                <Pressable onPress={onOpenNewPlaceModal}>
                  <Text style={[styles.inlineLinkText, { color: colors.accent }]}>
                    ＋ 連結新店家
                  </Text>
                </Pressable>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalPills}
              >
                {places.map((p) => {
                  const selected = currentPlace?.id === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        setSelectedPlaceId(p.id);
                        if (p.dishes.length > 0) {
                          setDishMode('existing');
                          handleSelectExistingDish(p.dishes[0]);
                        } else {
                          setDishMode('new');
                        }
                      }}
                      style={[
                        styles.selectablePill,
                        {
                          backgroundColor: selected ? colors.accent : colors.surface,
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.selectablePillText,
                          { color: selected ? '#FFFFFF' : colors.ink },
                        ]}
                      >
                        📍 {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* 步驟 2：選擇「同品項再訪評分」或「新增店內品項」 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                2. 品項選擇（支援同一品項多次評分與價格追蹤）
              </Text>

              <View style={[styles.segmentedBar, { backgroundColor: colors.surfaceSubtle }]}>
                <Pressable
                  disabled={existingDishes.length === 0}
                  onPress={() => setDishMode('existing')}
                  style={[
                    styles.segmentBtn,
                    dishMode === 'existing' && {
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color:
                          existingDishes.length === 0
                            ? colors.inkMuted
                            : dishMode === 'existing'
                            ? colors.accent
                            : colors.inkSecondary,
                      },
                    ]}
                  >
                    同品項再吃一次 ({existingDishes.length})
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setDishMode('new')}
                  style={[
                    styles.segmentBtn,
                    dishMode === 'new' && {
                      backgroundColor: colors.surface,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentBtnText,
                      {
                        color:
                          dishMode === 'new' ? colors.accent : colors.inkSecondary,
                      },
                    ]}
                  >
                    ＋ 新增店內品項
                  </Text>
                </Pressable>
              </View>

              {dishMode === 'existing' && existingDishes.length > 0 ? (
                <View style={styles.existingDishSelector}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalPills}
                  >
                    {existingDishes.map((d) => {
                      const isSel = activeExistingDish?.id === d.id;
                      return (
                        <Pressable
                          key={d.id}
                          onPress={() => handleSelectExistingDish(d)}
                          style={[
                            styles.dishSelectCard,
                            {
                              backgroundColor: isSel
                                ? colors.accentSoft
                                : colors.surface,
                              borderColor: isSel ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dishSelectName,
                              { color: isSel ? colors.accent : colors.ink },
                            ]}
                          >
                            {d.name}
                          </Text>
                          <Text style={[styles.dishSelectMeta, { color: colors.inkSecondary }]}>
                            已吃 {d.visitCount} 次・上次 NT${d.latestPrice}・{d.latestRating.toFixed(1)}★
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  {activeExistingDish && (
                    <View
                      style={[
                        styles.previousVisitCallout,
                        { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.previousVisitText, { color: colors.inkSecondary }]}>
                        💡 您之前吃過「{activeExistingDish.name}」共{' '}
                        <Text style={{ fontWeight: '700', color: colors.ink }}>
                          {activeExistingDish.visitCount} 次
                        </Text>
                        ：初次價格 NT${activeExistingDish.firstPrice}（{activeExistingDish.firstRating.toFixed(1)}★），上次價格 NT${activeExistingDish.latestPrice}（{activeExistingDish.latestRating.toFixed(1)}★）。
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={styles.newDishFields}>
                  <TextInput
                    value={newDishName}
                    onChangeText={setNewDishName}
                    placeholder="輸入品項名稱，例如：濃厚松露雞白湯拉麵"
                    placeholderTextColor={colors.inkMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.ink,
                      },
                    ]}
                  />
                  <View style={styles.wrapPills}>
                    {DISH_CATEGORIES.map((cat) => {
                      const selected = newDishCategory === cat;
                      return (
                        <Pressable
                          key={cat}
                          onPress={() => setNewDishCategory(cat)}
                          style={[
                            styles.smallChip,
                            {
                              backgroundColor: selected
                                ? colors.ink
                                : colors.surface,
                              borderColor: selected ? colors.ink : colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.smallChipText,
                              { color: selected ? colors.canvas : colors.inkSecondary },
                            ]}
                          >
                            {cat}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* 步驟 3：上傳自己吃的食物照片 + 底片色溫 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                3. 上傳食物照片与底片濾鏡
              </Text>

              <View style={styles.photoUploadContainer}>
                <View
                  style={[
                    styles.photoPreviewBox,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  {photoUri ? (
                    <>
                      <Image
                        source={{ uri: photoUri }}
                        style={styles.photoPreviewImg}
                        resizeMode="cover"
                      />
                      {selectedFilterMeta.overlayOpacity > 0 && (
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            {
                              backgroundColor: selectedFilterMeta.overlayColor,
                              opacity: selectedFilterMeta.overlayOpacity,
                            },
                          ]}
                        />
                      )}
                    </>
                  ) : (
                    <Text style={{ color: colors.inkMuted }}>尚未選擇照片</Text>
                  )}
                </View>

                <View style={styles.photoActionsCol}>
                  <Pressable
                    disabled={isPickingPhoto}
                    onPress={handlePickAlbum}
                    style={[
                      styles.photoActionBtn,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text style={styles.photoActionBtnPrimaryText}>
                      🖼️ 從手機相簿上傳照片
                    </Text>
                  </Pressable>

                  <Pressable
                    disabled={isPickingPhoto}
                    onPress={handleTakeCamera}
                    style={[
                      styles.photoActionBtn,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text style={[styles.photoActionBtnSecondaryText, { color: colors.ink }]}>
                      📷 開啟相機隨手拍
                    </Text>
                  </Pressable>

                  <Text style={[styles.photoHintText, { color: colors.inkMuted }]}>
                    {autoSaveToAlbum
                      ? '✓ 已開啟自動同步至手機「BiteNote 吃一口」相簿與系統備份'
                      : '照片將安全保存於應用程式本機儲存空間'}
                  </Text>
                </View>
              </View>

              {/* 快速體驗相片庫（方便即時切換測試不同食物照片） */}
              <Text style={[styles.subFieldCaption, { color: colors.inkSecondary }]}>
                或一鍵套用內建美食示意照片：
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalPills}
              >
                {PRESET_FOOD_PHOTOS.map((preset) => {
                  const selected = photoUri === preset.url;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => setPhotoUri(preset.url)}
                      style={[
                        styles.presetThumbBtn,
                        {
                          borderColor: selected ? colors.accent : colors.border,
                          backgroundColor: colors.surface,
                        },
                      ]}
                    >
                      <Image source={{ uri: preset.url }} style={styles.presetThumbImg} />
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.presetThumbText,
                          { color: selected ? colors.accent : colors.inkSecondary },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* 濾鏡色溫選擇 */}
              <View style={styles.filterRow}>
                {PHOTO_FILTERS.map((f) => {
                  const selected = photoFilter === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setPhotoFilter(f.id)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selected ? colors.ink : colors.surface,
                          borderColor: selected ? colors.ink : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          { color: selected ? colors.canvas : colors.inkSecondary },
                        ]}
                      >
                        🎨 {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 步驟 4：價格與用餐日期（自動偵測是否漲價） */}
            <View style={styles.fieldBlock}>
              <View style={styles.twoColRow}>
                <View style={[styles.fieldBlock, { flex: 1, minWidth: 0 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                    4. 本次價格 (NT$)
                  </Text>
                  <TextInput
                    value={priceText}
                    onChangeText={handlePriceChange}
                    keyboardType="numeric"
                    placeholder="例如：190"
                    placeholderTextColor={colors.inkMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor:
                          priceDiff > 0 ? colors.priceUp : colors.border,
                        color: colors.ink,
                        fontFamily: FONTS.mono,
                        fontWeight: '700',
                      },
                    ]}
                  />
                </View>

                <View style={[styles.fieldBlock, { flex: 1, minWidth: 0 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                    用餐日期
                  </Text>
                  <TextInput
                    value={visitedAt}
                    onChangeText={setVisitedAt}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.inkMuted}
                    style={[
                      styles.textInput,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.ink,
                        fontFamily: FONTS.mono,
                      },
                    ]}
                  />
                </View>
              </View>

              {dishMode === 'existing' && activeExistingDish && priceDiff !== 0 && (
                <Pressable
                  onPress={() => {
                    if (priceDiff > 0) {
                      setVerdict('price_up');
                      if (rating > 3.0) setRating(2.5);
                    }
                  }}
                  style={[
                    styles.priceAlertTag,
                    {
                      backgroundColor:
                        priceDiff > 0 ? colors.priceUpSoft : colors.herbSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.priceAlertTagText,
                      { color: priceDiff > 0 ? colors.priceUp : colors.herb },
                    ]}
                  >
                    {priceDiff > 0
                      ? `▲ 比上次漲價 NT$${priceDiff}！點此標記「漲價退步」`
                      : `▼ 比上次降價 NT$${Math.abs(priceDiff)}`}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* 步驟 5：本次個人評分與味覺判定印章 */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                  5. 本次個人評分與味覺印章
                </Text>
                <Text style={[styles.ratingBigPreview, { color: colors.accent }]}>
                  ★ {rating.toFixed(1)} 分
                </Text>
              </View>

              <View style={styles.ratingGrid}>
                {RATING_STEPS.map((r) => {
                  const selected = Math.abs(rating - r) < 0.05;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => setRating(r)}
                      style={[
                        styles.ratingStepBtn,
                        {
                          backgroundColor: selected ? colors.accent : colors.surface,
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.ratingStepText,
                          { color: selected ? '#FFFFFF' : colors.ink },
                        ]}
                      >
                        ★ {r.toFixed(1)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 5 種純中文味覺判定印章 */}
              <View style={styles.verdictGrid}>
                {(Object.keys(VERDICT_OPTIONS) as TastingVerdict[]).map((vKey) => {
                  const meta = VERDICT_OPTIONS[vKey];
                  const selected = verdict === vKey;
                  return (
                    <Pressable
                      key={vKey}
                      onPress={() => setVerdict(vKey)}
                      style={[
                        styles.verdictOptionCard,
                        {
                          backgroundColor: selected
                            ? colors.isDark
                              ? meta.bgDark
                              : meta.bgLight
                            : colors.surface,
                          borderColor: selected
                            ? colors.isDark
                              ? meta.colorDark
                              : meta.colorLight
                            : colors.border,
                        },
                      ]}
                    >
                      <View style={styles.verdictOptionTop}>
                        <Text style={styles.verdictOptionEmoji}>{meta.emoji}</Text>
                        <Text
                          style={[
                            styles.verdictOptionTitle,
                            {
                              color: selected
                                ? colors.isDark
                                  ? meta.colorDark
                                  : meta.colorLight
                                : colors.ink,
                            },
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.verdictOptionDesc,
                          { color: colors.inkSecondary },
                        ]}
                      >
                        {meta.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* 步驟 6：個人真實感想隨筆 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                6. 個人品嚐感想（完全私密，不公開給任何人）
              </Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={4}
                placeholder="寫下這次吃的真實感受…例如：第一次吃超驚豔！或是：第三次來發現漲了 50 元，肉變薄了，以後不太想再點了。"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textArea,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>
          </ScrollView>

          {/* 底部送出按鈕列 */}
          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={onClose}
              style={[
                styles.footerCancelBtn,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.footerCancelText, { color: colors.inkSecondary }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={[styles.footerSubmitBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={styles.footerSubmitText}>
                ✓ 寫入「BiteNote 吃一口」手帳
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ============================================================================
 * 2. PlacePickerModal — 連接 Google Maps 店家或手動建立私房店家
 * ========================================================================== */

interface PlacePickerModalProps {
  visible: boolean;
  colors: ThemeColors;
  googleMapsApiKey: string;
  onClose: () => void;
  onCreatePlace: (newPlace: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

export const PlacePickerModal: React.FC<PlacePickerModalProps> = ({
  visible,
  colors,
  googleMapsApiKey,
  onClose,
  onCreatePlace,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [candidates, setCandidates] = useState<GooglePlaceCandidate[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasPickedCandidate, setHasPickedCandidate] = useState<boolean>(false);

  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<PlaceCategory>('拉麵與麵食');
  const [address, setAddress] = useState<string>('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string>('');
  const [googlePlaceId, setGooglePlaceId] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [personalNote, setPersonalNote] = useState<string>('');
  const [isFavorite, setIsFavorite] = useState<boolean>(true);
  const [statusNotice, setStatusNotice] = useState<string>('');

  useEffect(() => {
    if (!visible) return;
    setSearchQuery('');
    setHasPickedCandidate(false);
    setName('');
    setAddress('');
    setGoogleMapsUrl('');
    setGooglePlaceId('');
    setLatitude('');
    setLongitude('');
    setPersonalNote('');
    setStatusNotice('');
  }, [visible]);

  // 當使用者輸入關鍵字（例如「今大」）時，即時聯網檢索全台店家並防抖動處理
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    const q = searchQuery.trim();
    setIsSearching(true);

    const timer = setTimeout(
      async () => {
        try {
          const list = await searchGooglePlaces(q, googleMapsApiKey);
          if (!cancelled) {
            setCandidates(list);
          }
        } finally {
          if (!cancelled) {
            setIsSearching(false);
          }
        }
      },
      q ? 180 : 0
    );

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, googleMapsApiKey, visible]);

  const handleRunSearch = (text: string) => {
    setSearchQuery(text);
    setHasPickedCandidate(false);
  };

  const handleSelectCandidate = (c: GooglePlaceCandidate) => {
    resetMobileViewportZoom();
    setName(c.name);
    setCategory(c.category);
    setAddress(c.address);
    setGooglePlaceId(c.googlePlaceId);
    setLatitude(String(c.latitude));
    setLongitude(String(c.longitude));
    setHasPickedCandidate(true);
    setStatusNotice(`✓ 已帶入「${c.name}」（${c.address}），確認下方資訊即可建立！`);
  };

  const handlePasteMapsUrl = (val: string) => {
    setGoogleMapsUrl(val);
    const parsed = parseGoogleMapsInput(val);
    if (parsed.extractedName && !name) {
      setName(parsed.extractedName);
    }
    if (typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
      setLatitude(String(parsed.latitude));
      setLongitude(String(parsed.longitude));
      setStatusNotice('已從 Google 地圖連結解析出店家經緯度座標');
    }
  };

  const handleUseCurrentGps = async () => {
    resetMobileViewportZoom();
    setStatusNotice('正在取得目前 GPS 位置…');
    const coords = await getCurrentGpsCoordinates();
    if (coords) {
      setLatitude(String(coords.latitude));
      setLongitude(String(coords.longitude));
      setStatusNotice(`已定位目前座標：${coords.latitude}, ${coords.longitude}`);
    } else {
      setStatusNotice('無法取得定位權限，可直接搜尋或手動填寫地址');
    }
  };

  const handleConfirmPlace = () => {
    resetMobileViewportZoom();
    if (!name.trim()) {
      setStatusNotice('請輸入店家名稱或從上方點選 Google 地圖地標');
      return;
    }
    onCreatePlace({
      name: name.trim(),
      category,
      address: address.trim() || '台灣（個人私藏地點）',
      googlePlaceId: googlePlaceId || `custom_${Date.now()}`,
      googleMapsUrl: googleMapsUrl.trim() || undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      coverUri: PRESET_FOOD_PHOTOS[0].url,
      isFavorite,
      personalNote: personalNote.trim() || '個人私密探店筆記，不理會網路業配評價。',
    });
    onClose();
  };

  const handleCloseModal = () => {
    resetMobileViewportZoom();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCloseModal}>
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.canvas, borderColor: colors.border },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
              <Text style={[styles.modalKicker, { color: colors.herb }]}>
                GOOGLE MAPS 店家連結與私房建檔
              </Text>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                連結 Google 地圖店家
              </Text>
            </View>
            <Pressable
              onPress={handleCloseModal}
              style={[styles.closeCircle, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Text style={[styles.closeCircleText, { color: colors.ink }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.modalBody}
            contentContainerStyle={styles.modalBodyContent}
            keyboardShouldPersistTaps="handled"
          >
            {statusNotice ? (
              <View style={[styles.noticeBanner, { backgroundColor: colors.herbSoft }]}>
                <Text style={[styles.noticeBannerText, { color: colors.herb }]}>
                  📍 {statusNotice}
                </Text>
              </View>
            ) : null}

            {/* Google Maps 快速搜尋列（支援全台餐廳即時聯網搜尋） */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                搜尋台灣店家名稱或地區（輸入關鍵字即時跳出地標）
              </Text>
              <View style={styles.searchRowWithAction}>
                <TextInput
                  value={searchQuery}
                  onChangeText={handleRunSearch}
                  onBlur={resetMobileViewportZoom}
                  onSubmitEditing={resetMobileViewportZoom}
                  returnKeyType="search"
                  placeholder="輸入店名（例：今大、五燈獎、一蘭、雙月…）"
                  placeholderTextColor={colors.inkMuted}
                  style={[
                    styles.textInput,
                    {
                      flex: 1,
                      minWidth: 0,
                      backgroundColor: colors.surface,
                      borderColor: colors.accent,
                      color: colors.ink,
                    },
                  ]}
                />
                {searchQuery ? (
                  <Pressable
                    onPress={() => {
                      setSearchQuery('');
                      setHasPickedCandidate(false);
                      resetMobileViewportZoom();
                    }}
                    style={[
                      styles.clearInputInlineBtn,
                      { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: colors.inkSecondary }}>
                      清除
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {hasPickedCandidate && name ? (
                <View
                  style={[
                    styles.collapsedCandidateBar,
                    { backgroundColor: colors.accentSoft, borderColor: colors.accent },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 13.5, fontWeight: '800', color: colors.accent }}
                    >
                      ✓ 已選取並帶入：{name}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 12, color: colors.inkSecondary, marginTop: 2 }}
                    >
                      📍 {address || '自訂私房地點'}（候選清單已自動收合）
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setHasPickedCandidate(false)}
                    style={[
                      styles.reexpandBtn,
                      { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>
                      更換地標
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <>
                  <Text style={[styles.subFieldCaption, { color: colors.inkSecondary }]}>
                    {isSearching
                      ? `🔎 正在搜尋「${searchQuery}」相關店家…`
                      : searchQuery.trim()
                      ? `找到 ${candidates.length} 家相符地標，點選即可帶入並收起清單：`
                      : '熱門推薦地標（輸入任意店名可即時搜尋全台店家）：'}
                  </Text>

                  {/* 直式自動完成地標清單（點選後自動收合並還原畫面比例） */}
                  <View style={styles.candidateVerticalList}>
                    {candidates.slice(0, 6).map((c) => {
                      const isSelected = name === c.name && address === c.address;
                      return (
                        <Pressable
                          key={c.googlePlaceId}
                          onPress={() => handleSelectCandidate(c)}
                          style={[
                            styles.candidateRowCard,
                            {
                              backgroundColor: isSelected
                                ? colors.accentSoft
                                : colors.surface,
                              borderColor: isSelected ? colors.accent : colors.border,
                            },
                          ]}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <View style={styles.candidateTopLine}>
                              <Text
                                numberOfLines={1}
                                style={[styles.placeCandidateName, { color: colors.ink }]}
                              >
                                📍 {c.name}
                              </Text>
                              <View
                                style={[
                                  styles.candidateCatBadge,
                                  { backgroundColor: colors.surfaceSubtle },
                                ]}
                              >
                                <Text style={[styles.placeCandidateCat, { color: colors.accent }]}>
                                  {c.category}
                                </Text>
                              </View>
                            </View>
                            <Text
                              numberOfLines={2}
                              style={[styles.placeCandidateAddr, { color: colors.inkSecondary }]}
                            >
                              {c.address}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.candidateSelectPill,
                              {
                                backgroundColor: isSelected ? colors.accent : colors.surfaceSubtle,
                              },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: '700',
                                color: isSelected ? '#FFFFFF' : colors.ink,
                              }}
                            >
                              {isSelected ? '✓ 已選' : '點選帶入'}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                    {searchQuery.trim() && (
                      <Pressable
                        onPress={() => {
                          resetMobileViewportZoom();
                          setName(searchQuery.trim());
                          setHasPickedCandidate(true);
                          setStatusNotice(`✓ 已直接將「${searchQuery.trim()}」設為店家名稱`);
                        }}
                        style={[
                          styles.candidateRowCard,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.borderStrong,
                            borderStyle: 'dashed',
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>
                          ➕ 直接使用「{searchQuery.trim()}」建立自訂私房店家
                        </Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>

            {/* 貼上 Google Maps 分享網址或取得目前 GPS */}
            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                  或貼上 Google 地圖分享連結 / 取得目前定位
                </Text>
                <Pressable onPress={handleUseCurrentGps}>
                  <Text style={[styles.inlineLinkText, { color: colors.herb }]}>
                    🎯 取得目前 GPS 座標
                  </Text>
                </Pressable>
              </View>
              <TextInput
                value={googleMapsUrl}
                onChangeText={handlePasteMapsUrl}
                onBlur={resetMobileViewportZoom}
                placeholder="貼上 https://www.google.com/maps/place/... 連結自動解析"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>

            {/* 店家基本資料確認 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                店家名稱（可自訂巷口無名攤車名稱）
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={resetMobileViewportZoom}
                placeholder="例如：赤峰街無名雞白湯拉麵"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>店家分類</Text>
              <View style={styles.wrapPills}>
                {PLACE_CATEGORIES.map((cat) => {
                  const selected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.smallChip,
                        {
                          backgroundColor: selected ? colors.ink : colors.surface,
                          borderColor: selected ? colors.ink : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.smallChipText,
                          { color: selected ? colors.canvas : colors.inkSecondary },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>店家地址</Text>
              <TextInput
                value={address}
                onChangeText={setAddress}
                onBlur={resetMobileViewportZoom}
                placeholder="例如：台北市中山區赤峰街 49 巷"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                店家私密備忘錄（公休日、點餐秘訣、座位偏好）
              </Text>
              <TextInput
                value={personalNote}
                onChangeText={setPersonalNote}
                onBlur={resetMobileViewportZoom}
                placeholder="例如：只收現金、辣椒醬在左邊桌角、不看路人評論只記自己的感受"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.fieldLabel, { color: colors.ink, marginBottom: 0 }]}>
                ⭐ 列為私藏釘選店家
              </Text>
              <Switch
                value={isFavorite}
                onValueChange={setIsFavorite}
                trackColor={{ false: colors.borderStrong, true: colors.accent }}
              />
            </View>
          </ScrollView>

          <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
            <Pressable
              onPress={handleCloseModal}
              style={[
                styles.footerCancelBtn,
                { borderColor: colors.border, backgroundColor: colors.surface },
              ]}
            >
              <Text style={[styles.footerCancelText, { color: colors.inkSecondary }]}>
                取消
              </Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmPlace}
              style={[styles.footerSubmitBtn, { backgroundColor: colors.herb }]}
            >
              <Text style={styles.footerSubmitText}>＋ 建立並連結此店家</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/* ============================================================================
 * 3. BackupSettingsModal — iOS iCloud / Android Google Drive 原生備份與設定
 * ========================================================================== */

interface BackupSettingsModalProps {
  visible: boolean;
  colors: ThemeColors;
  settings: AppSettings;
  statsSummary: { places: number; dishes: number; logs: number };
  onClose: () => void;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onExportBackup: () => void;
  onImportBackupJson: (rawJson: string) => void;
  onResetToSeed: () => void;
  onClearAllData?: () => void;
  onOpenAuthModal?: () => void;
  onPreviewSplash?: () => void;
}

export const BackupSettingsModal: React.FC<BackupSettingsModalProps> = ({
  visible,
  colors,
  settings,
  statsSummary,
  onClose,
  onUpdateSettings,
  onExportBackup,
  onImportBackupJson,
  onResetToSeed,
  onClearAllData,
  onOpenAuthModal,
  onPreviewSplash,
}) => {
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [showImportBox, setShowImportBox] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string>('');

  const handleImportSubmit = () => {
    try {
      onImportBackupJson(importJsonText);
      setImportJsonText('');
      setShowImportBox(false);
      setFeedback('✓ 備份資料已成功還原至本機資料庫！');
    } catch (e: any) {
      setFeedback(`⚠️ 還原失敗：${e?.message || 'JSON 格式不正確'}`);
    }
  };

  const THEME_CHOICES: { mode: ThemeMode; label: string }[] = [
    { mode: 'light', label: '☀️ 亞麻和紙（淺色）' },
    { mode: 'dark', label: '🌙 深夜食堂（深色）' },
    { mode: 'system', label: '📱 跟隨系統自動切換' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.modalSheet,
            { backgroundColor: colors.canvas, borderColor: colors.border },
          ]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.modalKicker, { color: colors.accent }]}>
                LOCAL-FIRST 隱私儲存與系統備份
              </Text>
              <Text style={[styles.modalTitle, { color: colors.ink }]}>
                手帳設定與原生雲端備份
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.closeCircle, { backgroundColor: colors.surfaceSubtle }]}
            >
              <Text style={[styles.closeCircleText, { color: colors.ink }]}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
            {feedback ? (
              <View style={[styles.noticeBanner, { backgroundColor: colors.herbSoft }]}>
                <Text style={[styles.noticeBannerText, { color: colors.herb }]}>
                  {feedback}
                </Text>
              </View>
            ) : null}

            {/* 個人會員與登入身分 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                手帳身分與雲端同步
              </Text>
              <View
                style={[
                  styles.backupStatusCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 12 }}>
                    <Text style={[styles.backupCardTitle, { color: colors.ink }]}>
                      {settings.userProfile && !settings.userProfile.isGuest
                        ? `${settings.userProfile.avatarEmoji || '👤'} ${settings.userProfile.name} (已登入)`
                        : '🥢 本機離線手帳模式（訪客身分）'}
                    </Text>
                    <Text style={[styles.backupCardDesc, { color: colors.inkSecondary }]}>
                      {settings.userProfile && !settings.userProfile.isGuest
                        ? `帳號：${settings.userProfile.email || '已綁定私密身分'}・已與雲端同步`
                        : '所有食記皆保存在此裝置；可隨時登入 Apple、Google 或 Email 啟用跨裝置同步。'}
                    </Text>
                  </View>
                  {onOpenAuthModal && (
                    <Pressable
                      onPress={() => {
                        onClose();
                        onOpenAuthModal();
                      }}
                      style={[
                        styles.themeChoiceBtn,
                        {
                          backgroundColor: colors.accent,
                          borderColor: colors.accent,
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                        },
                      ]}
                    >
                      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 }}>
                        {settings.userProfile && !settings.userProfile.isGuest ? '會員管理' : '前往登入'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* 外觀主題切換 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                手帳外觀主題
              </Text>
              <View style={styles.themeChoicesRow}>
                {THEME_CHOICES.map((choice) => {
                  const selected = settings.themeMode === choice.mode;
                  return (
                    <Pressable
                      key={choice.mode}
                      onPress={() => onUpdateSettings({ themeMode: choice.mode })}
                      style={[
                        styles.themeChoiceBtn,
                        {
                          backgroundColor: selected ? colors.accent : colors.surface,
                          borderColor: selected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.themeChoiceText,
                          { color: selected ? '#FFFFFF' : colors.ink },
                        ]}
                      >
                        {choice.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {onPreviewSplash && (
                <Pressable
                  onPress={() => {
                    onClose();
                    onPreviewSplash();
                  }}
                  style={[
                    styles.themeChoiceBtn,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      marginTop: 10,
                      alignSelf: 'flex-start',
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                    },
                  ]}
                >
                  <Text style={[styles.themeChoiceText, { color: colors.ink }]}>
                    ✨ 重新體驗 App 啟動畫面（Splash Screen）
                  </Text>
                </Pressable>
              )}
            </View>

            {/* iOS iCloud 與 Android Google Drive 原生備份狀態卡片 */}
            <View
              style={[
                styles.backupStatusCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.backupCardTitle, { color: colors.ink }]}>
                ☁️ 系統原生自動備份（免註冊登入・完全私密）
              </Text>
              <Text style={[styles.backupCardDesc, { color: colors.inkSecondary }]}>
                目前本機共保存 {statsSummary.places} 家店、{statsSummary.dishes} 道品項、
                {statsSummary.logs} 筆品嚐紀錄。最近同步寫入時間：
                {settings.lastBackupAt ? settings.lastBackupAt.slice(0, 19).replace('T', ' ') : '剛剛'}
              </Text>

              <View style={[styles.backupRuleRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backupRuleTitle, { color: colors.ink }]}>
                    🍎 iOS 系統 iCloud 自動備份
                  </Text>
                  <Text style={[styles.backupRuleSub, { color: colors.inkSecondary }]}>
                    SQLite 資料庫與相片存放於 NSDocumentDirectory，隨 iOS iCloud 自動備份整機資料與相簿
                  </Text>
                </View>
                <Switch
                  value={settings.icloudBackupEnabled}
                  onValueChange={(v) => onUpdateSettings({ icloudBackupEnabled: v })}
                  trackColor={{ false: colors.borderStrong, true: colors.herb }}
                />
              </View>

              <View style={[styles.backupRuleRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backupRuleTitle, { color: colors.ink }]}>
                    🤖 Android 系統 Google Drive 自動備份
                  </Text>
                  <Text style={[styles.backupRuleSub, { color: colors.inkSecondary }]}>
                    已啟用 allowBackup 與 data_extraction_rules.xml，自動備份內部 SQLite 與相片目錄
                  </Text>
                </View>
                <Switch
                  value={settings.googleDriveBackupEnabled}
                  onValueChange={(v) => onUpdateSettings({ googleDriveBackupEnabled: v })}
                  trackColor={{ false: colors.borderStrong, true: colors.herb }}
                />
              </View>

              <View style={[styles.backupRuleRow, { borderTopColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backupRuleTitle, { color: colors.ink }]}>
                    🖼️ 自動同步照片至手機「BiteNote 吃一口」相簿
                  </Text>
                  <Text style={[styles.backupRuleSub, { color: colors.inkSecondary }]}>
                    上傳或拍攝食物照片時同步寫入系統相簿，由 iCloud 照片或 Google 相簿雙重保護
                  </Text>
                </View>
                <Switch
                  value={settings.autoSaveToAlbum}
                  onValueChange={(v) => onUpdateSettings({ autoSaveToAlbum: v })}
                  trackColor={{ false: colors.borderStrong, true: colors.accent }}
                />
              </View>
            </View>

            {/* Google Maps API Key 選填設定 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                Google Maps Places API 金鑰（選填）
              </Text>
              <TextInput
                value={settings.googleMapsApiKey}
                onChangeText={(v) => onUpdateSettings({ googleMapsApiKey: v })}
                placeholder="未填寫時預設使用內建台灣店家搜尋與連結解析"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.ink,
                  },
                ]}
              />
            </View>

            {/* 手動匯出與匯入備份檔 */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.ink }]}>
                手動封存匯出與跨裝置還原
              </Text>
              <View style={styles.backupActionButtons}>
                <Pressable
                  onPress={() => {
                    onExportBackup();
                    setFeedback('✓ 已匯出完整手帳 JSON 備份檔！');
                  }}
                  style={[styles.backupBtn, { backgroundColor: colors.ink }]}
                >
                  <Text style={[styles.backupBtnText, { color: colors.canvas }]}>
                    📤 匯出完整手帳備份檔 (.json)
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowImportBox(!showImportBox)}
                  style={[
                    styles.backupBtn,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[styles.backupBtnText, { color: colors.ink }]}>
                    📥 從備份 JSON 還原資料
                  </Text>
                </Pressable>
              </View>

              {showImportBox && (
                <View style={styles.importBoxArea}>
                  <TextInput
                    value={importJsonText}
                    onChangeText={setImportJsonText}
                    multiline
                    numberOfLines={4}
                    placeholder="在此貼上先前匯出的 BiteNote JSON 備份內容…"
                    placeholderTextColor={colors.inkMuted}
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                        color: colors.ink,
                      },
                    ]}
                  />
                  <Pressable
                    onPress={handleImportSubmit}
                    style={[styles.footerSubmitBtn, { backgroundColor: colors.herb, marginTop: 8 }]}
                  >
                    <Text style={styles.footerSubmitText}>確認還原備份</Text>
                  </Pressable>
                </View>
              )}
            </View>

            {/* 重置或清空示範資料 */}
            <View style={styles.fieldBlock}>
              {onClearAllData && (
                <Pressable
                  onPress={() => {
                    onClearAllData();
                    setFeedback('✓ 已清空示範資料，現在可以開始記錄您自己的私密美食手帳！');
                  }}
                  style={[
                    styles.resetSeedBtn,
                    { borderColor: colors.accent, backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text style={[styles.resetSeedBtnText, { color: colors.accent, fontWeight: '700' }]}>
                    🧹 清空示範資料（開始我自己的空白手帳）
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => {
                  onResetToSeed();
                  setFeedback('✓ 已重置為初始示範手帳資料！');
                }}
                style={[
                  styles.resetSeedBtn,
                  { borderColor: colors.border, backgroundColor: colors.surfaceSubtle },
                ]}
              >
                <Text style={[styles.resetSeedBtnText, { color: colors.inkSecondary }]}>
                  🔄 恢復預設示範資料（含雞白湯拉麵 3 次價格與評分演變範例）
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

/* ============================================================================
 * 4. PhotoLightboxModal — 拍立得相片全螢幕燈箱（支援原圖濾鏡對照與同品項歷次照片切換回味）
 * ========================================================================== */

export interface LightboxItem {
  dish: EnrichedDish;
  log: BiteLog;
  visitIndex?: number;
}

interface PhotoLightboxModalProps {
  visible: boolean;
  colors: ThemeColors;
  dish: EnrichedDish | null;
  initialLog: BiteLog | null;
  onClose: () => void;
  onNavigateToPlace?: (placeId: string) => void;
  onAddVisitForDish?: (dish: EnrichedDish) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  visible,
  colors,
  dish,
  initialLog,
  onClose,
  onNavigateToPlace,
  onAddVisitForDish,
}) => {
  const { width: winWidth, height: winHeight } = useWindowDimensions();

  // 嚴格鎖定「同一家店、同一個品項」之歷次品嚐紀錄，左右滑動只在該品項歷次吃過的照片間切換，絕不跨店家或跨品項亂跳
  const items: LightboxItem[] = useMemo(() => {
    if (!dish) return [];
    return dish.logs.map((log, idx) => ({
      dish,
      log,
      visitIndex: idx + 1,
    }));
  }, [dish]);

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [applyFilter, setApplyFilter] = useState<boolean>(true);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [showNoteDrawer, setShowNoteDrawer] = useState<boolean>(false);

  const horizontalScrollRef = useRef<ScrollView>(null);
  const filmstripScrollRef = useRef<ScrollView>(null);

  // 計算原圖檢視區之安全顯示長寬（上方 56~64px、下方 76~84px 保留呼吸邊界，以具體數值設定防塌陷）
  const stageTopMargin = Platform.OS === 'web' ? 56 : 64;
  const stageBottomMargin = Platform.OS === 'web' ? 76 : 84;
  const stageHeight = Math.max(300, winHeight - (stageTopMargin + stageBottomMargin));

  // 初始化選中的相片索引並滑動定位
  useEffect(() => {
    if (!visible || items.length === 0) return;
    const targetLogId = initialLog?.id || '';
    const foundIdx = items.findIndex((it) => it.log.id === targetLogId);
    const initialIdx = foundIdx >= 0 ? foundIdx : 0;
    setActiveIndex(initialIdx);
    setApplyFilter(true);
    setShowHud(true);
    setShowNoteDrawer(false);

    const timer = setTimeout(() => {
      horizontalScrollRef.current?.scrollTo({
        x: initialIdx * winWidth,
        animated: false,
      });
    }, 40);
    return () => clearTimeout(timer);
  }, [visible, initialLog, items, winWidth]);

  // 當滑動切換相片時，自動捲動底部膠卷讓當前縮圖置中
  useEffect(() => {
    if (!visible) return;
    filmstripScrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * 52 - winWidth / 2 + 26),
      animated: true,
    });
  }, [activeIndex, visible, winWidth]);

  const jumpToIndex = (index: number, animated = true) => {
    if (index < 0 || index >= items.length) return;
    setActiveIndex(index);
    horizontalScrollRef.current?.scrollTo({
      x: index * winWidth,
      animated,
    });
  };

  const goToNext = () => {
    if (activeIndex < items.length - 1) {
      jumpToIndex(activeIndex + 1);
    }
  };

  const goToPrev = () => {
    if (activeIndex > 0) {
      jumpToIndex(activeIndex - 1);
    }
  };

  const toggleHud = () => {
    setShowHud((prev) => !prev);
  };

  // 鍵盤 ← → 鍵與 ESC 鍵導覽支援（網頁與桌面端無障礙操作）
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, activeIndex, items.length]);

  if (!dish && items.length === 0) return null;

  const activeItem = items[activeIndex] || items[0];
  if (!activeItem) return null;

  const currentDish = activeItem.dish;
  const currentLog = activeItem.log;
  const visitNumber =
    activeItem.visitIndex ||
    currentDish.logs.findIndex((l) => l.id === currentLog.id) + 1;
  const prevLog =
    activeIndex >= 1 ? items[activeIndex - 1].log : undefined;
  const priceDiff = prevLog ? currentLog.price - prevLog.price : 0;
  const verdictMeta = VERDICT_OPTIONS[currentLog.verdict];
  const filterMeta =
    PHOTO_FILTERS.find((f) => f.id === currentLog.photoFilter) ||
    PHOTO_FILTERS[0];
  const photoUri = currentLog.photoUri || currentDish.coverUri;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.lightboxFullscreenRoot}>
        <StatusBar barStyle="light-content" backgroundColor="#050505" />

        {/* 1. 左右滑動原圖畫廊主舞台（原生 120fps 硬體加速橫向翻頁，實體長寬防坍縮，最上方與最下方保留呼吸邊界） */}
        <View style={styles.lightboxViewport}>
          <ScrollView
              ref={horizontalScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={(e) => {
                const offsetX = e.nativeEvent?.contentOffset?.x;
                if (typeof offsetX === 'number' && winWidth > 0) {
                  const page = Math.round(offsetX / winWidth);
                  if (page >= 0 && page < items.length && page !== activeIndex) {
                    setActiveIndex(page);
                  }
                }
              }}
              onMomentumScrollEnd={(e) => {
                const page = Math.round(e.nativeEvent.contentOffset.x / winWidth);
                if (page >= 0 && page < items.length && page !== activeIndex) {
                  setActiveIndex(page);
                }
              }}
              style={{ width: winWidth, height: stageHeight }}
              contentContainerStyle={{ height: stageHeight }}
            >
              {items.map((item) => {
                const itemFilterMeta =
                  PHOTO_FILTERS.find((f) => f.id === item.log.photoFilter) ||
                  PHOTO_FILTERS[0];
                const itemUri = item.log.photoUri || item.dish.coverUri;
                const itemVerdict = VERDICT_OPTIONS[item.log.verdict];

                return (
                  <View
                    key={item.log.id}
                    style={[
                      {
                        width: winWidth,
                        height: stageHeight,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      Platform.OS === 'web' && ({ scrollSnapAlign: 'start', scrollSnapStop: 'always' } as any),
                    ]}
                  >
                    {itemUri ? (
                      <Pressable
                        onPress={toggleHud}
                        style={{
                          width: winWidth,
                          height: stageHeight,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        accessibilityRole="imagebutton"
                        accessibilityLabel="點擊切換介面顯示或隱藏，左右滑動切換相片"
                      >
                        <View
                          pointerEvents="none"
                          style={{
                            width: winWidth,
                            height: stageHeight,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Image
                            source={{ uri: itemUri }}
                            style={{
                              width: winWidth,
                              height: stageHeight,
                            }}
                            resizeMode="contain"
                          />
                          {applyFilter && itemFilterMeta.overlayOpacity > 0 && (
                            <View
                              style={[
                                StyleSheet.absoluteFillObject,
                                {
                                  backgroundColor: itemFilterMeta.overlayColor,
                                  opacity: itemFilterMeta.overlayOpacity,
                                },
                              ]}
                            />
                          )}
                        </View>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={toggleHud}
                        style={[
                          styles.lightboxNoPhotoStage,
                          { width: winWidth, height: stageHeight },
                        ]}
                      >
                        <Text style={{ fontSize: 60 }}>{itemVerdict.emoji}</Text>
                        <Text style={styles.lightboxNoPhotoText}>此筆紀錄未附相片</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
        </View>

        {/* 浮動左右切換按鈕（在桌面或平板方便一鍵切換，手機上可直接滑動） */}
        {showHud && items.length > 1 && activeIndex > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="上一張相片"
            onPress={goToPrev}
            style={[styles.lightboxNavChevron, styles.lightboxNavChevronLeft]}
          >
            <Text style={styles.lightboxNavChevronText}>‹</Text>
          </Pressable>
        )}

        {showHud && items.length > 1 && activeIndex < items.length - 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="下一張相片"
            onPress={goToNext}
            style={[styles.lightboxNavChevron, styles.lightboxNavChevronRight]}
          >
            <Text style={styles.lightboxNavChevronText}>›</Text>
          </Pressable>
        )}

        {/* 2. 最上方浮動導覽列（LINE / iOS 相簿風格：關閉鍵、品名/日期標題、1x/2x放大與濾鏡開關） */}
        {showHud && (
          <SafeAreaView style={styles.lightboxTopHudSafe}>
            <View style={styles.lightboxTopHudRow}>
              {/* 關閉按鈕 */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="關閉全螢幕相片"
                onPress={onClose}
                style={styles.lightboxHudCircleBtn}
              >
                <Text style={styles.lightboxHudCircleBtnText}>✕</Text>
              </Pressable>

              {/* 中央品名與相片計數（類似 iOS / LINE 相簿：3 / 10） */}
              <View style={styles.lightboxTopCenterMeta}>
                <Text numberOfLines={1} style={styles.lightboxTopTitle}>
                  {currentDish.name}
                </Text>
                <Text numberOfLines={1} style={styles.lightboxTopSub}>
                  {currentLog.visitedAt}・第 {visitNumber} 次吃 ({activeIndex + 1}/{items.length})
                </Text>
              </View>

              {/* 右側工具：濾鏡對照 */}
              <View style={styles.lightboxTopActionsRight}>
                {photoUri && filterMeta.overlayOpacity > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="切換原圖與濾鏡"
                    onPress={() => setApplyFilter((v) => !v)}
                    style={[
                      styles.lightboxHudPillBtn,
                      !applyFilter && styles.lightboxHudPillBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.lightboxHudPillText,
                        !applyFilter && styles.lightboxHudPillTextActive,
                      ]}
                    >
                      {applyFilter ? '🎨 底片' : '📷 原圖'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </SafeAreaView>
        )}

        {/* 3. 最下方浮動手札列（LINE / iOS 相簿風格：歷次迷你膠卷、單行精簡資訊、可展開筆記） */}
        {showHud && (
          <SafeAreaView style={styles.lightboxBottomHudSafe}>
            {/* 展開之私密筆記卡片（若使用者點擊 💬 筆記） */}
            {showNoteDrawer && (
              <View style={styles.lightboxNoteDrawer}>
                <View style={styles.lightboxNoteDrawerHeader}>
                  <Text style={styles.lightboxNoteDrawerTitle}>
                    ✍️ 當下味覺手記（{currentLog.visitedAt}・第 {visitNumber} 次吃）
                  </Text>
                  <Pressable onPress={() => setShowNoteDrawer(false)}>
                    <Text style={styles.lightboxNoteDrawerClose}>✕ 收合</Text>
                  </Pressable>
                </View>
                <Text style={styles.lightboxNoteDrawerContent}>
                  {currentLog.note || '（未記錄文字感想，僅留存照片與評分價格）'}
                </Text>
              </View>
            )}

            {/* 歷次品嚐迷你膠卷（iOS 相簿縮圖列：吃過 >= 2 次才出現，精緻滑動切換） */}
            {items.length > 1 && (
              <View style={styles.lightboxFilmstripBar}>
                <ScrollView
                  ref={filmstripScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.lightboxFilmstripScroll}
                >
                  {items.map((item, idx) => {
                    const isSelected = idx === activeIndex;
                    const itemVerdict = VERDICT_OPTIONS[item.log.verdict];
                    return (
                      <Pressable
                        key={item.log.id}
                        onPress={() => jumpToIndex(idx)}
                        style={[
                          styles.lightboxMiniThumbWrap,
                          isSelected && styles.lightboxMiniThumbWrapActive,
                        ]}
                      >
                        {item.log.photoUri ? (
                          <Image
                            source={{ uri: item.log.photoUri }}
                            style={styles.lightboxMiniThumbImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.lightboxMiniThumbEmoji}>
                            <Text style={{ fontSize: 16 }}>{itemVerdict.emoji}</Text>
                          </View>
                        )}
                        <View style={styles.lightboxMiniThumbPill}>
                          <Text style={styles.lightboxMiniThumbPillText}>
                            #{idx + 1}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 底部精簡資訊條（類似 LINE 相片底部的單行資訊） */}
            <View style={styles.lightboxBottomInfoBar}>
              <View style={styles.lightboxBottomInfoLeft}>
                <Pressable
                  onPress={() => {
                    if (onNavigateToPlace) {
                      onClose();
                      onNavigateToPlace(currentDish.placeId);
                    }
                  }}
                  style={styles.lightboxPlaceLink}
                >
                  <Text numberOfLines={1} style={styles.lightboxPlaceLinkText}>
                    📍 {currentDish.placeName} →
                  </Text>
                </Pressable>

                <View style={styles.lightboxBottomMetaInline}>
                  <Text style={styles.lightboxBottomPrice}>
                    NT${currentLog.price}
                  </Text>
                  {prevLog && priceDiff > 0 && (
                    <Text style={styles.lightboxPriceUpBadge}>
                      ▲漲 ${priceDiff}
                    </Text>
                  )}
                  <Text style={styles.lightboxBottomDot}>・</Text>
                  <Text style={styles.lightboxBottomRating}>
                    ★ {currentLog.rating.toFixed(1)}
                  </Text>
                  <Text style={styles.lightboxBottomVerdict}>
                    {verdictMeta.emoji} {verdictMeta.label}
                  </Text>
                </View>
              </View>

              <View style={styles.lightboxBottomActionsRight}>
                {currentLog.note ? (
                  <Pressable
                    onPress={() => setShowNoteDrawer((v) => !v)}
                    style={[
                      styles.lightboxBottomPillAction,
                      showNoteDrawer && styles.lightboxBottomPillActionActive,
                    ]}
                  >
                    <Text style={styles.lightboxBottomPillActionText}>
                      💬 {showNoteDrawer ? '收起筆記' : '看筆記'}
                    </Text>
                  </Pressable>
                ) : null}

                {onAddVisitForDish && (
                  <Pressable
                    onPress={() => {
                      onClose();
                      onAddVisitForDish(currentDish);
                    }}
                    style={styles.lightboxBottomAddVisitBtn}
                  >
                    <Text style={styles.lightboxBottomAddVisitText}>
                      ＋ 再記一口
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          </SafeAreaView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalSheet: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHeader: {
    width: '100%',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalKicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
    fontFamily: FONTS.mono,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  closeCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeCircleText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalBody: {
    width: '100%',
    paddingHorizontal: SPACING.md,
  },
  modalBodyContent: {
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },
  errorBanner: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  errorBannerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  noticeBanner: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  noticeBannerText: {
    fontSize: 13,
    fontWeight: '700',
  },
  fieldBlock: {
    width: '100%',
    gap: 8,
  },
  fieldHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    fontFamily: FONTS.sans,
  },
  subFieldCaption: {
    fontSize: 12,
    fontFamily: FONTS.sans,
  },
  inlineLinkText: {
    fontSize: 13,
    fontWeight: '700',
  },
  horizontalPills: {
    gap: 8,
    paddingVertical: 4,
    paddingRight: SPACING.md,
  },
  wrapPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  selectablePill: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  selectablePillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  segmentedBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: RADIUS.md,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  existingDishSelector: {
    gap: 8,
  },
  dishSelectCard: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    minWidth: 190,
  },
  dishSelectName: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  dishSelectMeta: {
    fontSize: 11.5,
  },
  previousVisitCallout: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  previousVisitText: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  newDishFields: {
    gap: 8,
  },
  textInput: {
    width: '100%',
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 11 : 9,
    fontSize: 16,
  },
  textArea: {
    width: '100%',
    maxWidth: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  searchRowWithAction: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearInputInlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  collapsedCandidateBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: 10,
    marginTop: 4,
  },
  reexpandBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexShrink: 0,
  },
  smallChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  smallChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoUploadContainer: {
    width: '100%',
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  photoPreviewBox: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flexShrink: 0,
  },
  photoPreviewImg: {
    width: '100%',
    height: '100%',
  },
  photoActionsCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  photoActionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  photoActionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  photoActionBtnSecondaryText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoHintText: {
    fontSize: 11,
    lineHeight: 15,
  },
  presetThumbBtn: {
    width: 104,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    padding: 4,
    alignItems: 'center',
  },
  presetThumbImg: {
    width: '100%',
    height: 56,
    borderRadius: 6,
    marginBottom: 4,
  },
  presetThumbText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  priceAlertTag: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  priceAlertTagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  ratingBigPreview: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  ratingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  ratingStepBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    minWidth: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingStepText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  verdictGrid: {
    gap: 8,
    marginTop: 4,
  },
  verdictOptionCard: {
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
  },
  verdictOptionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  verdictOptionEmoji: {
    fontSize: 15,
  },
  verdictOptionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  verdictOptionDesc: {
    fontSize: 12,
  },
  modalFooter: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  footerCancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerCancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footerSubmitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  candidateVerticalList: {
    width: '100%',
    gap: 8,
    marginTop: 2,
  },
  candidateRowCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: 10,
  },
  candidateTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  candidateCatBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  candidateSelectPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    flexShrink: 0,
  },
  placeCandidateCard: {
    width: 195,
    padding: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    gap: 3,
  },
  placeCandidateName: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  placeCandidateAddr: {
    fontSize: 11.5,
  },
  placeCandidateCat: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  themeChoicesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChoiceBtn: {
    flex: 1,
    minWidth: 130,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  themeChoiceText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  backupStatusCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 10,
  },
  backupCardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  backupCardDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  backupRuleRow: {
    borderTopWidth: 1,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backupRuleTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  backupRuleSub: {
    fontSize: 11.5,
    lineHeight: 16,
  },
  backupActionButtons: {
    gap: 8,
  },
  backupBtn: {
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  backupBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  importBoxArea: {
    marginTop: 8,
  },
  resetSeedBtn: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  resetSeedBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  lightboxFullscreenRoot: {
    flex: 1,
    backgroundColor: '#050505',
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  lightboxViewport: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Platform.OS === 'web' ? 56 : 64,
    paddingBottom: Platform.OS === 'web' ? 76 : 84,
  },
  lightboxContainStage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lightboxContainImage: {
    width: '100%',
    height: '100%',
  },
  lightboxNoPhotoStage: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    gap: 12,
  },
  lightboxNoPhotoText: {
    color: '#8A8580',
    fontSize: 15,
  },
  lightboxTopHudSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(10, 9, 8, 0.72)',
  },
  lightboxTopHudRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
  },
  lightboxHudCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  lightboxHudCircleBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  lightboxTopCenterMeta: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  lightboxTopTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.serif,
  },
  lightboxTopSub: {
    color: '#B0A8A0',
    fontSize: 11,
    marginTop: 1,
  },
  lightboxTopActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  lightboxHudPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  lightboxHudPillBtnActive: {
    backgroundColor: '#D96B43',
    borderColor: '#D96B43',
  },
  lightboxHudPillText: {
    color: '#EDE8E1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  lightboxHudPillTextActive: {
    color: '#FFFFFF',
  },
  lightboxBottomHudSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: 'rgba(10, 9, 8, 0.85)',
  },
  lightboxNoteDrawer: {
    marginHorizontal: SPACING.md,
    marginBottom: 8,
    backgroundColor: 'rgba(24, 23, 21, 0.94)',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    padding: SPACING.sm,
    gap: 4,
  },
  lightboxNoteDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lightboxNoteDrawerTitle: {
    color: '#E48866',
    fontSize: 11.5,
    fontWeight: '700',
  },
  lightboxNoteDrawerClose: {
    color: '#B0A8A0',
    fontSize: 11.5,
    fontWeight: '600',
  },
  lightboxNoteDrawerContent: {
    color: '#EDE8E1',
    fontSize: 13,
    lineHeight: 18,
  },
  lightboxFilmstripBar: {
    width: '100%',
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  lightboxFilmstripScroll: {
    gap: 8,
    alignItems: 'center',
  },
  lightboxMiniThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    position: 'relative',
  },
  lightboxMiniThumbWrapActive: {
    borderColor: '#E48866',
  },
  lightboxMiniThumbImg: {
    width: '100%',
    height: '100%',
  },
  lightboxMiniThumbEmoji: {
    width: '100%',
    height: '100%',
    backgroundColor: '#201E1C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxMiniThumbPill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10, 9, 8, 0.82)',
    alignItems: 'center',
  },
  lightboxMiniThumbPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  lightboxBottomInfoBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
  },
  lightboxBottomInfoLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  lightboxPlaceLink: {
    alignSelf: 'flex-start',
  },
  lightboxPlaceLinkText: {
    color: '#E48866',
    fontSize: 12,
    fontWeight: '700',
  },
  lightboxBottomMetaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  lightboxBottomPrice: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  lightboxPriceUpBadge: {
    color: '#F28B82',
    fontSize: 11,
    fontWeight: '800',
  },
  lightboxBottomDot: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
  },
  lightboxBottomRating: {
    color: '#E48866',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: FONTS.mono,
  },
  lightboxBottomVerdict: {
    color: '#EDE8E1',
    fontSize: 12,
    fontWeight: '600',
  },
  lightboxBottomActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  lightboxBottomPillAction: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  lightboxBottomPillActionActive: {
    backgroundColor: 'rgba(228, 136, 102, 0.3)',
    borderColor: '#E48866',
  },
  lightboxBottomPillActionText: {
    color: '#EDE8E1',
    fontSize: 11.5,
    fontWeight: '700',
  },
  lightboxBottomAddVisitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: '#D96B43',
  },
  lightboxBottomAddVisitText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  lightboxNavChevron: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(25, 24, 23, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  lightboxNavChevronLeft: {
    left: 12,
  },
  lightboxNavChevronRight: {
    right: 12,
  },
  lightboxNavChevronText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '300',
  },
});
