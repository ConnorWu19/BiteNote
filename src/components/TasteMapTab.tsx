/**
 * BiteNote 吃一口 — 餐廳足跡地圖分頁 (TasteMapTab)
 * 遵循 AGENTS.md 專案品質標準（Awwwards / Webby / FWA 頂尖設計水準）
 * 特色：
 * 1. 輕鬆尋找過往吃過的餐廳：在地圖上一目了然查看過去品嚐過的私房店家、回訪次數與漲跌評分。
 * 2. 清爽無硬體負擔：採用輕量級 CartoDB Voyager / Dark Matter 和風地圖圖磚，零吃重 WebGL / 零額外 API Key，極速秒開。
 * 3. 雙向聯動互動：點擊地圖圖標立即置中切換底部店家卡片；滑動店家卡片地圖自動平滑平移（FlyTo）。
 * 4. 深度篩選：支援依行政區（中山區、大安區等）、料理類別（拉麵、小吃、咖啡等）與回訪狀態快速過濾。
 * 5. 雙主題與雙模式：支援「地圖模式」與「清單模式」隨心切換，自適應淺色和紙與深夜食堂。
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { EnrichedPlace, PlaceCategory } from '../types/models';
import { FONTS, RADIUS, SPACING, ThemeColors } from '../theme/theme';
import { buildGoogleMapsUrl } from '../utils/analytics';

export interface TasteMapTabProps {
  places: EnrichedPlace[];
  colors: ThemeColors;
  selectedPlaceId?: string;
  onSelectPlace: (placeId: string) => void;
  onNavigateToDetail: (placeId: string) => void;
  onOpenComposer: (placeId: string) => void;
  isWideScreen: boolean;
}

// 料理類別對應 Emoji
const CATEGORY_EMOJI: Record<PlaceCategory, string> = {
  '拉麵與麵食': '🍜',
  '台灣小吃': '🍚',
  '咖啡與甜點': '☕',
  '日式料理': '🍣',
  '火鍋與燒肉': '🍲',
  '異國料理': '🍕',
  '早午餐與輕食': '🥪',
  '手搖與飲品': '🧋',
  '私房小店': '🥢',
};

// 從地址自動解析行政區（例如「台北市中山區...」->「中山區」）
function extractDistrict(address: string): string {
  if (!address) return '市區';
  const match = address.match(/(.{2,3}[區市縣鄉鎮])/);
  if (match && match[1]) {
    // 若匹配到的是「台北市」則繼續找行政區
    const subMatch = address.match(/([^\d\s號巷弄段]{1,3}[區鄉鎮市])/g);
    if (subMatch && subMatch.length > 1) {
      return subMatch[1];
    }
    return match[1];
  }
  return '私藏小巷';
}

export const TasteMapTab: React.FC<TasteMapTabProps> = ({
  places,
  colors,
  selectedPlaceId,
  onSelectPlace,
  onNavigateToDetail,
  onOpenComposer,
  isWideScreen,
}) => {
  // 篩選狀態
  const [searchText, setSearchText] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'favorite' | 'repeat' | 'price_up'>('all');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  // 目前在地圖上聚焦之店家 ID
  const activePlaceId = selectedPlaceId || (places.length > 0 ? places[0].id : '');

  // 取得所有不重複的行政區清單
  const districtList = useMemo(() => {
    const set = new Set<string>();
    places.forEach((p) => {
      const d = extractDistrict(p.address);
      if (d) set.add(d);
    });
    return Array.from(set);
  }, [places]);

  // 根據搜尋與標籤過濾店家
  const filteredPlaces = useMemo(() => {
    return places.filter((p) => {
      // 關鍵字搜尋：店家名、地址、備註、品項名
      if (searchText.trim()) {
        const query = searchText.toLowerCase().trim();
        const matchName = p.name.toLowerCase().includes(query);
        const matchAddr = p.address.toLowerCase().includes(query);
        const matchNote = p.personalNote?.toLowerCase().includes(query);
        const matchDish = p.dishes?.some((d) => d.name.toLowerCase().includes(query));
        if (!matchName && !matchAddr && !matchNote && !matchDish) return false;
      }

      // 行政區過濾
      if (selectedDistrict !== 'all') {
        const d = extractDistrict(p.address);
        if (d !== selectedDistrict) return false;
      }

      // 料理分類過濾
      if (selectedCategory !== 'all' && p.category !== selectedCategory) {
        return false;
      }

      // 特殊味覺標籤過濾
      if (verdictFilter === 'favorite' && !p.isFavorite) return false;
      if (verdictFilter === 'repeat' && p.totalVisits < 2) return false;
      if (verdictFilter === 'price_up' && p.priceUpDishCount === 0) return false;

      return true;
    });
  }, [places, searchText, selectedDistrict, selectedCategory, verdictFilter]);

  // 取得當前選中的店家物件
  const activePlace = useMemo(() => {
    return filteredPlaces.find((p) => p.id === activePlaceId) || filteredPlaces[0] || null;
  }, [filteredPlaces, activePlaceId]);

  // 橫向滑動列表引用（供點擊 Pin 時自動滾動置中）
  const cardScrollRef = useRef<ScrollView>(null);
  const iframeRef = useRef<any>(null);

  // 當外部/地圖選中店家時，捲動至對應卡片
  useEffect(() => {
    if (!activePlace || !cardScrollRef.current) return;
    const index = filteredPlaces.findIndex((p) => p.id === activePlace.id);
    if (index >= 0) {
      const cardWidth = isWideScreen ? 340 : 300;
      cardScrollRef.current.scrollTo({
        x: index * (cardWidth + 12),
        animated: true,
      });
    }
  }, [activePlace, filteredPlaces, isWideScreen]);

  // 監聽來自 Leaflet 網頁 iframe 的點擊訊息
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'SELECT_PLACE') {
        onSelectPlace(event.data.placeId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [onSelectPlace]);

  // 當 activePlace 改變時，向 iframe 發送平移指令
  useEffect(() => {
    if (Platform.OS !== 'web' || !activePlace || !activePlace.latitude || !activePlace.longitude) return;
    try {
      if (iframeRef.current && iframeRef.current.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'FOCUS_PLACE',
            placeId: activePlace.id,
            lat: activePlace.latitude,
            lng: activePlace.longitude,
          },
          '*'
        );
      }
    } catch (e) {
      // 跨域或未載入容錯
    }
  }, [activePlace]);

  // 生成極簡純靜態的 Leaflet HTML（以 OpenStreetMap 與 Esri 零浮水印免費圖磚渲染，零硬體負擔）
  const mapHtml = useMemo(() => {
    const isDark = colors.isDark;

    const centerLat = activePlace?.latitude || 25.045;
    const centerLng = activePlace?.longitude || 121.525;

    // 將店家資料編碼為安全 JSON 傳入地圖
    const placesJson = JSON.stringify(
      filteredPlaces
        .filter((p) => p.latitude && p.longitude)
        .map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          emoji: CATEGORY_EMOJI[p.category] || '🥢',
          lat: p.latitude,
          lng: p.longitude,
          rating: p.personalAvgRating > 0 ? p.personalAvgRating.toFixed(1) : '新',
          visits: p.totalVisits,
          isFavorite: p.isFavorite,
          isPriceUp: p.priceUpDishCount > 0,
        }))
    );

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
          <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body, #map { width: 100%; height: 100%; overflow: hidden; background: ${colors.canvas}; font-family: -apple-system, BlinkMacSystemFont, "PingFang TC", "Microsoft JhengHei", sans-serif; }
            ${isDark ? `
            .leaflet-tile-pane {
              filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(92%);
            }
            ` : `
            .leaflet-tile-pane {
              filter: sepia(4%) contrast(98%);
            }
            `}
            .leaflet-control-attribution { font-size: 9px !important; background: rgba(0,0,0,0.15) !important; color: #888 !important; }
            .leaflet-control-zoom { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important; border-radius: 8px !important; overflow: hidden; }
            .leaflet-control-zoom a { background: ${colors.surface} !important; color: ${colors.ink} !important; border-bottom: 1px solid ${colors.border} !important; }
            
            /* 和風客製化印章圖標 */
            .taste-marker {
              display: flex;
              align-items: center;
              background: ${colors.surface};
              border: 1.5px solid ${colors.borderStrong};
              border-radius: 20px;
              padding: 4px 8px 4px 4px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.18);
              cursor: pointer;
              transition: transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.18s ease;
              white-space: nowrap;
              user-select: none;
            }
            .taste-marker:hover {
              transform: scale(1.08) translateY(-2px);
              box-shadow: 0 8px 20px rgba(0,0,0,0.25);
            }
            .taste-marker.active {
              background: ${colors.accent};
              border-color: #FFFFFF;
              color: #FFFFFF;
              transform: scale(1.15) translateY(-4px);
              box-shadow: 0 10px 24px rgba(209, 72, 48, 0.45);
              z-index: 9999 !important;
            }
            .marker-emoji-bubble {
              width: 24px;
              height: 24px;
              border-radius: 50%;
              background: ${isDark ? '#2A2622' : '#F4ECE1'};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              margin-right: 5px;
            }
            .taste-marker.active .marker-emoji-bubble {
              background: #FFFFFF;
            }
            .marker-info {
              display: flex;
              flex-direction: column;
            }
            .marker-name {
              font-size: 11px;
              font-weight: 700;
              color: ${colors.ink};
              line-height: 13px;
              max-width: 110px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .taste-marker.active .marker-name {
              color: #FFFFFF;
            }
            .marker-badge-row {
              display: flex;
              align-items: center;
              gap: 4px;
              font-size: 9.5px;
              color: ${colors.inkMuted};
              font-family: monospace;
              line-height: 11px;
            }
            .taste-marker.active .marker-badge-row {
              color: rgba(255, 255, 255, 0.9);
            }
            .marker-star {
              color: #E59819;
              font-weight: 800;
            }
            .taste-marker.active .marker-star {
              color: #FFDE59;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <script>
            var map = L.map('map', {
              center: [${centerLat}, ${centerLng}],
              zoom: 14,
              zoomControl: true,
              attributionControl: true
            });

            // 1. 臺灣通用電子地圖（Google Maps 清爽風格：道路清楚、無雜亂房屋形狀、繁中路網、免 API）
            var tileNlsc = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
              maxZoom: 19,
              attribution: '© 國土測繪圖資服務雲 (臺灣通用電子地圖)'
            });

            // 2. Esri 全球清晰街道地圖（無建築雜訊、簡潔大道路網）
            var tileEsri = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
              maxZoom: 19,
              attribution: '© Esri World Street Map'
            });

            // 預設直接啟用 Google Maps 清爽風格（不畫房子形狀，清爽不雜亂）
            tileNlsc.addTo(map);

            tileNlsc.on('tileerror', function() {
              if (!map.hasLayer(tileEsri)) {
                tileEsri.addTo(map);
              }
            });

            var baseLayers = {
              "清爽街道 (Google Maps 風格・無建物雜訊)": tileNlsc,
              "世界街道 (Esri Streets・簡潔路網)": tileEsri
            };
            L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

            var places = ${placesJson};
            var markers = {};
            var currentActiveId = "${activePlaceId}";

            function createMarkerHtml(p, isActive) {
              return '<div class="taste-marker ' + (isActive ? 'active' : '') + '" id="marker-' + p.id + '">' +
                '<div class="marker-emoji-bubble">' + p.emoji + '</div>' +
                '<div class="marker-info">' +
                  '<div class="marker-name">' + p.name + '</div>' +
                  '<div class="marker-badge-row">' +
                    '<span class="marker-star">★ ' + p.rating + '</span>' +
                    '<span>• 吃' + p.visits + '次</span>' +
                    (p.isPriceUp ? '<span>• 💸</span>' : '') +
                  '</div>' +
                '</div>' +
              '</div>';
            }

            places.forEach(function(p) {
              var isActive = p.id === currentActiveId;
              var icon = L.divIcon({
                className: 'taste-div-icon',
                html: createMarkerHtml(p, isActive),
                iconSize: [120, 36],
                iconAnchor: [60, 18]
              });

              var m = L.marker([p.lat, p.lng], { icon: icon }).addTo(map);
              m.on('click', function() {
                window.parent.postMessage({ type: 'SELECT_PLACE', placeId: p.id }, '*');
                setActiveMarker(p.id);
                map.flyTo([p.lat, p.lng], 15, { duration: 0.5 });
              });
              markers[p.id] = { marker: m, data: p };
            });

            function setActiveMarker(placeId) {
              if (currentActiveId === placeId) return;
              var prev = markers[currentActiveId];
              if (prev) {
                var prevIcon = L.divIcon({
                  className: 'taste-div-icon',
                  html: createMarkerHtml(prev.data, false),
                  iconSize: [120, 36],
                  iconAnchor: [60, 18]
                });
                prev.marker.setIcon(prevIcon);
              }
              currentActiveId = placeId;
              var curr = markers[placeId];
              if (curr) {
                var currIcon = L.divIcon({
                  className: 'taste-div-icon',
                  html: createMarkerHtml(curr.data, true),
                  iconSize: [120, 36],
                  iconAnchor: [60, 18]
                });
                curr.marker.setIcon(currIcon);
                curr.marker.setZIndexOffset(1000);
              }
            }

            // 監聽來自外層 React 的訊息
            window.addEventListener('message', function(event) {
              if (event.data && event.data.type === 'FOCUS_PLACE') {
                setActiveMarker(event.data.placeId);
                map.flyTo([event.data.lat, event.data.lng], 15.5, { duration: 0.6 });
              }
            });

            // 確保地圖尺寸自適應
            setTimeout(function() {
              map.invalidateSize();
            }, 250);
          </script>
        </body>
      </html>
    `;
  }, [filteredPlaces, colors, activePlace, activePlaceId]);

  return (
    <View style={[styles.container, { backgroundColor: colors.canvas }]}>
      {/* 1. 頂部搜尋與快捷篩選區 */}
      <View
        style={[
          styles.filterHeaderBlock,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        {/* 搜尋列與視圖切換 */}
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchInputWrapper,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.ink }]}
              placeholder="搜尋吃過的餐廳、地址或菜色（例：赤峰街、拉麵）"
              placeholderTextColor={colors.inkMuted}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {!!searchText && (
              <Pressable
                onPress={() => setSearchText('')}
                style={styles.clearSearchBtn}
                accessibilityRole="button"
                accessibilityLabel="清除搜尋字詞"
              >
                <Text style={[styles.clearSearchBtnText, { color: colors.inkMuted }]}>
                  ✕
                </Text>
              </Pressable>
            )}
          </View>

          {/* 地圖 ⇄ 清單 模式切換按鈕 */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`切換為${viewMode === 'map' ? '清單' : '地圖'}模式`}
            onPress={() => setViewMode((prev) => (prev === 'map' ? 'list' : 'map'))}
            style={[
              styles.viewModeToggleBtn,
              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.viewModeToggleBtnText, { color: colors.ink }]}>
              {viewMode === 'map' ? '📋 清單' : '🗺️ 地圖'}
            </Text>
          </Pressable>
        </View>

        {/* 行政區與味覺狀態水平捲動標籤列 */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsScroll}
        >
          {/* 全部選項 */}
          <Pressable
            onPress={() => {
              setSelectedDistrict('all');
              setSelectedCategory('all');
              setVerdictFilter('all');
            }}
            style={[
              styles.filterChip,
              selectedDistrict === 'all' &&
                selectedCategory === 'all' &&
                verdictFilter === 'all'
                ? { backgroundColor: colors.accent, borderColor: colors.accent }
                : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color:
                    selectedDistrict === 'all' &&
                    selectedCategory === 'all' &&
                    verdictFilter === 'all'
                      ? '#FFFFFF'
                      : colors.ink,
                },
              ]}
            >
              全部餐廳 ({places.length})
            </Text>
          </Pressable>

          {/* 私藏推薦篩選 */}
          <Pressable
            onPress={() =>
              setVerdictFilter((prev) => (prev === 'favorite' ? 'all' : 'favorite'))
            }
            style={[
              styles.filterChip,
              verdictFilter === 'favorite'
                ? { backgroundColor: colors.ochre, borderColor: colors.ochre }
                : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: verdictFilter === 'favorite' ? '#FFFFFF' : colors.ink },
              ]}
            >
              ⭐ 私藏推薦
            </Text>
          </Pressable>

          {/* 多次回訪篩選 */}
          <Pressable
            onPress={() =>
              setVerdictFilter((prev) => (prev === 'repeat' ? 'all' : 'repeat'))
            }
            style={[
              styles.filterChip,
              verdictFilter === 'repeat'
                ? { backgroundColor: colors.herb, borderColor: colors.herb }
                : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: verdictFilter === 'repeat' ? '#FFFFFF' : colors.ink },
              ]}
            >
              🔄 多次回訪
            </Text>
          </Pressable>

          {/* 漲價觀察篩選 */}
          <Pressable
            onPress={() =>
              setVerdictFilter((prev) => (prev === 'price_up' ? 'all' : 'price_up'))
            }
            style={[
              styles.filterChip,
              verdictFilter === 'price_up'
                ? { backgroundColor: colors.priceUp, borderColor: colors.priceUp }
                : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: verdictFilter === 'price_up' ? '#FFFFFF' : colors.ink },
              ]}
            >
              💸 漲價觀察
            </Text>
          </Pressable>

          {/* 行政區分組標籤 */}
          {districtList.map((district) => {
            const isSelected = selectedDistrict === district;
            const count = places.filter((p) => extractDistrict(p.address) === district).length;
            return (
              <Pressable
                key={district}
                onPress={() =>
                  setSelectedDistrict((prev) => (prev === district ? 'all' : district))
                }
                style={[
                  styles.filterChip,
                  isSelected
                    ? { backgroundColor: colors.ink, borderColor: colors.ink }
                    : { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: isSelected ? colors.canvas : colors.ink },
                  ]}
                >
                  📍 {district} ({count})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* 2. 主視圖：地圖視圖 或 清單視圖 */}
      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          {/* Web 環境下使用純淨零負擔之 Leaflet iframe */}
          {Platform.OS === 'web' ? (
            <iframe
              ref={iframeRef}
              srcDoc={mapHtml}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              title="Taste Map"
            />
          ) : (
            /* 原生行動端環境（亦可擴展 WebView）提供純原生回退視圖 */
            <View style={[styles.nativeFallbackMap, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={{ fontSize: 32 }}>🗺️</Text>
              <Text style={[styles.nativeFallbackTitle, { color: colors.ink }]}>
                美食足跡地圖已載入
              </Text>
              <Text style={[styles.nativeFallbackSub, { color: colors.inkSecondary }]}>
                目前共記錄 {filteredPlaces.length} 家過往吃過的私房餐廳
              </Text>
            </View>
          )}

          {/* 地圖懸浮狀態提示與計數 */}
          <View
            style={[
              styles.floatingCountBadge,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.floatingCountText, { color: colors.ink }]}>
              共找到 <Text style={{ color: colors.accent, fontWeight: '800' }}>{filteredPlaces.length}</Text> 家過往美味
            </Text>
          </View>

          {/* 地圖底部卡片橫軌 (Horizontal Swipable Restaurant Cards) */}
          {filteredPlaces.length > 0 && (
            <View style={styles.bottomCardWrapper}>
              <ScrollView
                ref={cardScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={isWideScreen ? 352 : 312}
                decelerationRate="fast"
                contentContainerStyle={styles.bottomCardsScrollContent}
              >
                {filteredPlaces.map((place) => {
                  const isSelected = place.id === activePlace?.id;
                  const categoryEmoji = CATEGORY_EMOJI[place.category] || '🥢';
                  const district = extractDistrict(place.address);

                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => {
                        onSelectPlace(place.id);
                        if (place.latitude && place.longitude && iframeRef.current?.contentWindow) {
                          iframeRef.current.contentWindow.postMessage(
                            {
                              type: 'FOCUS_PLACE',
                              placeId: place.id,
                              lat: place.latitude,
                              lng: place.longitude,
                            },
                            '*'
                          );
                        }
                      }}
                      style={[
                        styles.placeCard,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: isSelected ? colors.accent : colors.border,
                          width: isWideScreen ? 340 : 300,
                        },
                        isSelected && {
                          borderWidth: 2,
                        },
                      ]}
                    >
                      {/* 卡片頂部：封面圖與分類標籤 */}
                      <View style={styles.cardHeaderRow}>
                        {place.coverUri ? (
                          <Image
                            source={{ uri: place.coverUri }}
                            style={styles.cardCoverImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.cardCoverPlaceholder,
                              { backgroundColor: colors.surfaceSubtle },
                            ]}
                          >
                            <Text style={styles.cardCoverPlaceholderEmoji}>
                              {categoryEmoji}
                            </Text>
                          </View>
                        )}

                        <View style={styles.cardHeaderMeta}>
                          <View style={styles.cardTitleRow}>
                            <Text
                              numberOfLines={1}
                              style={[styles.cardTitleText, { color: colors.ink }]}
                            >
                              {place.name}
                            </Text>
                            {place.isFavorite && (
                              <Text style={styles.favoriteStarGlyph}>⭐</Text>
                            )}
                          </View>

                          <View style={styles.cardBadgePillsRow}>
                            <View
                              style={[
                                styles.cardCategoryPill,
                                { backgroundColor: colors.surfaceSubtle },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.cardCategoryPillText,
                                  { color: colors.inkSecondary },
                                ]}
                              >
                                {categoryEmoji} {district}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.cardRatingPill,
                                { backgroundColor: colors.ochreSoft },
                              ]}
                            >
                              <Text style={[styles.cardRatingPillText, { color: colors.ochre }]}>
                                ★ {place.personalAvgRating.toFixed(1)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* 卡片中段：地址與歷次品嚐統計 */}
                      <Text
                        numberOfLines={1}
                        style={[styles.cardAddressText, { color: colors.inkMuted }]}
                      >
                        📍 {place.address || '尚未記錄地址'}
                      </Text>

                      <View
                        style={[
                          styles.cardTasteStatBox,
                          {
                            backgroundColor: colors.surfaceSubtle,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text style={[styles.cardTasteStatText, { color: colors.ink }]}>
                          共吃過 <Text style={{ fontWeight: '800', color: colors.accent }}>{place.totalVisits}</Text> 次・共記錄 {place.totalDishes} 道料理
                        </Text>
                        {place.priceUpDishCount > 0 && (
                          <Text style={[styles.cardPriceUpAlert, { color: colors.priceUp }]}>
                            💸 觀察到 {place.priceUpDishCount} 道菜色調漲
                          </Text>
                        )}
                      </View>

                      {/* 卡片底端三大行動按鈕 */}
                      <View style={styles.cardActionsRow}>
                        {/* 1. Google Maps 導航前往 */}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`開啟 Google 地圖導航前往 ${place.name}`}
                          onPress={() => {
                            const url = buildGoogleMapsUrl(place);
                            Linking.openURL(url);
                          }}
                          style={[
                            styles.actionSmallBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.actionSmallBtnText, { color: colors.ink }]}>
                            🧭 導航
                          </Text>
                        </Pressable>

                        {/* 2. 查看詳情歷次手帳 */}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`查看 ${place.name} 完整食記與菜單`}
                          onPress={() => onNavigateToDetail(place.id)}
                          style={[
                            styles.actionSmallBtn,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                          ]}
                        >
                          <Text style={[styles.actionSmallBtnText, { color: colors.ink }]}>
                            📖 詳情
                          </Text>
                        </Pressable>

                        {/* 3. 快速記一口 */}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`為 ${place.name} 新增一口品嚐紀錄`}
                          onPress={() => onOpenComposer(place.id)}
                          style={[
                            styles.actionPrimaryBtn,
                            { backgroundColor: colors.accent },
                          ]}
                        >
                          <Text style={styles.actionPrimaryBtnText}>
                            ＋ 記一口
                          </Text>
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      ) : (
        /* 清單名冊模式 (List Mode) */
        <ScrollView
          style={styles.listScrollView}
          contentContainerStyle={styles.listScrollContent}
        >
          {filteredPlaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 36, marginBottom: 8 }}>🥢</Text>
              <Text style={[styles.emptyTitle, { color: colors.ink }]}>
                找不到符合條件的吃過餐廳
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.inkSecondary }]}>
                試試清除搜尋條件，或點擊「📍 連結新店家」建立您的下一筆食記
              </Text>
            </View>
          ) : (
            filteredPlaces.map((place) => {
              const categoryEmoji = CATEGORY_EMOJI[place.category] || '🥢';
              const district = extractDistrict(place.address);

              return (
                <Pressable
                  key={place.id}
                  onPress={() => onNavigateToDetail(place.id)}
                  style={[
                    styles.listPlaceCard,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.listPlaceCardHeader}>
                    {place.coverUri ? (
                      <Image
                        source={{ uri: place.coverUri }}
                        style={styles.listCoverImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.listCoverPlaceholder,
                          { backgroundColor: colors.surfaceSubtle },
                        ]}
                      >
                        <Text style={{ fontSize: 24 }}>{categoryEmoji}</Text>
                      </View>
                    )}

                    <View style={styles.listCardContent}>
                      <View style={styles.listCardTitleRow}>
                        <Text
                          style={[styles.listCardTitleText, { color: colors.ink }]}
                        >
                          {place.name}
                        </Text>
                        <View
                          style={[
                            styles.cardRatingPill,
                            { backgroundColor: colors.ochreSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cardRatingPillText,
                              { color: colors.ochre },
                            ]}
                          >
                            ★ {place.personalAvgRating.toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={[styles.listCardAddress, { color: colors.inkMuted }]}
                      >
                        📍 {place.address || '尚未記錄地址'}
                      </Text>

                      <View style={styles.listStatsRow}>
                        <View
                          style={[
                            styles.cardCategoryPill,
                            { backgroundColor: colors.surfaceSubtle },
                          ]}
                        >
                          <Text
                            style={[
                              styles.cardCategoryPillText,
                              { color: colors.inkSecondary },
                            ]}
                          >
                            {categoryEmoji} {district}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.listCardVisitsText,
                            { color: colors.inkSecondary },
                          ]}
                        >
                          已回訪 {place.totalVisits} 次・共 {place.totalDishes} 道料理
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* 清單卡片底部快捷行動 */}
                  <View
                    style={[
                      styles.listCardFooter,
                      { borderTopColor: colors.border },
                    ]}
                  >
                    <Pressable
                      onPress={() => {
                        const url = buildGoogleMapsUrl(place);
                        Linking.openURL(url);
                      }}
                      style={styles.listActionTextBtn}
                    >
                      <Text
                        style={[
                          styles.listActionText,
                          { color: colors.inkSecondary },
                        ]}
                      >
                        🧭 導航
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onOpenComposer(place.id)}
                      style={styles.listActionTextBtn}
                    >
                      <Text
                        style={[styles.listActionText, { color: colors.accent }]}
                      >
                        ＋ 記一口
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => onNavigateToDetail(place.id)}
                      style={styles.listActionTextBtn}
                    >
                      <Text
                        style={[styles.listActionText, { color: colors.ink }]}
                      >
                        詳細手帳 ➔
                      </Text>
                    </Pressable>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  filterHeaderBlock: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm + 2,
    height: 42,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 13,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  viewModeToggleBtn: {
    paddingHorizontal: 12,
    height: 42,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewModeToggleBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
  },
  filterChipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
  },

  // 地圖區域
  mapContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  nativeFallbackMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: SPACING.xl,
  },
  nativeFallbackTitle: {
    fontFamily: FONTS.serif,
    fontSize: 18,
    fontWeight: '800',
  },
  nativeFallbackSub: {
    fontFamily: FONTS.sans,
    fontSize: 13,
  },
  floatingCountBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
      default: { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
    }),
  },
  floatingCountText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    fontWeight: '600',
  },

  // 底部懸浮店家卡片滑軌
  bottomCardWrapper: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
  },
  bottomCardsScrollContent: {
    paddingHorizontal: SPACING.md,
    gap: 12,
  },
  placeCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.16,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
      default: { boxShadow: '0 8px 24px rgba(0,0,0,0.16)' },
    }),
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardCoverImg: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
  },
  cardCoverPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardCoverPlaceholderEmoji: {
    fontSize: 22,
  },
  cardHeaderMeta: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  cardTitleText: {
    fontFamily: FONTS.serif,
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  favoriteStarGlyph: {
    fontSize: 12,
  },
  cardBadgePillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardCategoryPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  cardCategoryPillText: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
  },
  cardRatingPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  cardRatingPillText: {
    fontFamily: FONTS.mono,
    fontSize: 10.5,
    fontWeight: '800',
  },
  cardAddressText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  cardTasteStatBox: {
    borderRadius: RADIUS.sm,
    borderWidth: 0.5,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 2,
  },
  cardTasteStatText: {
    fontFamily: FONTS.sans,
    fontSize: 11,
  },
  cardPriceUpAlert: {
    fontFamily: FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  actionSmallBtn: {
    flex: 1,
    height: 32,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionSmallBtnText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
  },
  actionPrimaryBtn: {
    flex: 1.2,
    height: 32,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionPrimaryBtnText: {
    color: '#FFFFFF',
    fontFamily: FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
  },

  // 清單模式
  listScrollView: {
    flex: 1,
  },
  listScrollContent: {
    padding: SPACING.md,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: 6,
  },
  emptyTitle: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 280,
  },
  listPlaceCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listPlaceCardHeader: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: 12,
    alignItems: 'center',
  },
  listCoverImg: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
  },
  listCoverPlaceholder: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listCardContent: {
    flex: 1,
    gap: 4,
  },
  listCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listCardTitleText: {
    fontFamily: FONTS.serif,
    fontSize: 16,
    fontWeight: '800',
  },
  listCardAddress: {
    fontFamily: FONTS.sans,
    fontSize: 12,
  },
  listStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listCardVisitsText: {
    fontFamily: FONTS.sans,
    fontSize: 11.5,
  },
  listCardFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listActionTextBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  listActionText: {
    fontFamily: FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
  },
});
