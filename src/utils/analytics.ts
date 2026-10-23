/**
 * BiteNote 吃一口 — 味覺演變分析引擎、Google 地圖解析與初始手帳範例資料
 */

import {
  BiteLog,
  Dish,
  EnrichedDish,
  EnrichedPlace,
  Place,
  PlaceCategory,
  TastingVerdict,
  VERDICT_OPTIONS,
} from '../types/models';

/**
 * 將單一品項與其歷次品嚐紀錄整合，計算價格漲跌幅與評分走勢
 */
export function enrichDish(dish: Dish, place: Place | undefined, allLogs: BiteLog[]): EnrichedDish {
  const logs = allLogs
    .filter((l) => l.dishId === dish.id)
    .sort((a, b) => {
      const dateDiff = a.visitedAt.localeCompare(b.visitedAt);
      if (dateDiff !== 0) return dateDiff;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const visitCount = logs.length;
  const firstLog = logs[0];
  const latestLog = logs[logs.length - 1];
  const prevLog = logs.length >= 2 ? logs[logs.length - 2] : firstLog;

  const firstPrice = firstLog ? firstLog.price : 0;
  const latestPrice = latestLog ? latestLog.price : 0;
  const prevPrice = prevLog ? prevLog.price : firstPrice;

  const priceDelta = latestPrice - firstPrice;
  const priceDeltaFromPrev = latestPrice - prevPrice;
  const priceChangePercent =
    firstPrice > 0 ? Math.round(((latestPrice - firstPrice) / firstPrice) * 100) : 0;
  const isPriceUp = priceDelta > 0;

  const firstRating = firstLog ? firstLog.rating : 0;
  const latestRating = latestLog ? latestLog.rating : 0;
  const ratingSum = logs.reduce((acc, item) => acc + item.rating, 0);
  const averageRating =
    visitCount > 0 ? Math.round((ratingSum / visitCount) * 10) / 10 : 0;
  const ratingDelta = Math.round((latestRating - firstRating) * 10) / 10;

  let ratingTrend: 'rising' | 'falling' | 'stable' | 'single' = 'single';
  if (visitCount >= 2) {
    if (ratingDelta >= 0.3) ratingTrend = 'rising';
    else if (ratingDelta <= -0.3) ratingTrend = 'falling';
    else ratingTrend = 'stable';
  }

  const latestVerdict: TastingVerdict = latestLog ? latestLog.verdict : 'solid';
  const latestVisitedAt = latestLog ? latestLog.visitedAt : dish.updatedAt.slice(0, 10);
  const coverUri = latestLog?.photoUri || dish.coverUri;

  // 自動生成中文演變摘要
  let evolutionSummary = '尚無品嚐紀錄';
  if (visitCount === 1) {
    evolutionSummary = `初次品嚐・NT$${latestPrice}・評分 ${latestRating.toFixed(1)}★（${VERDICT_OPTIONS[latestVerdict].label}）`;
  } else if (visitCount >= 2) {
    const pricePart =
      priceDelta > 0
        ? `價格由 $${firstPrice} 漲至 $${latestPrice} (+${priceChangePercent}%)`
        : priceDelta < 0
        ? `價格由 $${firstPrice} 降至 $${latestPrice} (${priceChangePercent}%)`
        : `價格維持 $${latestPrice}`;
    const ratingPart =
      ratingDelta < 0
        ? `評分由 ${firstRating.toFixed(1)}★ 降至 ${latestRating.toFixed(1)}★`
        : ratingDelta > 0
        ? `評分由 ${firstRating.toFixed(1)}★ 升至 ${latestRating.toFixed(1)}★`
        : `評分維持 ${latestRating.toFixed(1)}★`;
    evolutionSummary = `已吃過 ${visitCount} 次・${pricePart}・${ratingPart}`;
  }

  return {
    ...dish,
    coverUri,
    placeName: place?.name || '未知店家',
    placeAddress: place?.address || '',
    placeCategory: place?.category || '私房小店',
    logs,
    visitCount,
    firstPrice,
    latestPrice,
    priceDelta,
    priceDeltaFromPrev,
    priceChangePercent,
    isPriceUp,
    firstRating,
    latestRating,
    averageRating,
    ratingDelta,
    ratingTrend,
    latestVerdict,
    latestVisitedAt,
    evolutionSummary,
  };
}

/**
 * 聚合所有店家與品項資料
 */
export function enrichPlaces(
  places: Place[],
  dishes: Dish[],
  biteLogs: BiteLog[]
): { enrichedPlaces: EnrichedPlace[]; enrichedDishes: EnrichedDish[] } {
  const placeMap = new Map<string, Place>();
  places.forEach((p) => placeMap.set(p.id, p));

  const enrichedDishes = dishes
    .map((d) => enrichDish(d, placeMap.get(d.placeId), biteLogs))
    .sort((a, b) => b.latestVisitedAt.localeCompare(a.latestVisitedAt));

  const enrichedPlaces: EnrichedPlace[] = places
    .map((place) => {
      const placeDishes = enrichedDishes.filter((d) => d.placeId === place.id);
      const totalDishes = placeDishes.length;
      const totalVisits = placeDishes.reduce((sum, d) => sum + d.visitCount, 0);
      const ratedDishes = placeDishes.filter((d) => d.visitCount > 0);
      const personalAvgRating =
        ratedDishes.length > 0
          ? Math.round(
              (ratedDishes.reduce((sum, d) => sum + d.latestRating, 0) / ratedDishes.length) * 10
            ) / 10
          : 0;
      const priceUpDishCount = placeDishes.filter((d) => d.isPriceUp).length;
      const encoreDishCount = placeDishes.filter((d) => d.latestVerdict === 'encore').length;
      const lastVisitedAt =
        placeDishes.length > 0
          ? placeDishes.reduce(
              (latest, d) => (d.latestVisitedAt > latest ? d.latestVisitedAt : latest),
              placeDishes[0].latestVisitedAt
            )
          : place.updatedAt.slice(0, 10);

      const coverUri =
        place.coverUri || placeDishes.find((d) => Boolean(d.coverUri))?.coverUri;

      return {
        ...place,
        coverUri,
        dishes: placeDishes,
        totalDishes,
        totalVisits,
        personalAvgRating,
        priceUpDishCount,
        encoreDishCount,
        lastVisitedAt,
      };
    })
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.lastVisitedAt.localeCompare(a.lastVisitedAt);
    });

  return { enrichedPlaces, enrichedDishes };
}

export interface OverallInsights {
  totalPlaces: number;
  totalDishes: number;
  totalBites: number;
  repeatDishesCount: number;
  priceUpDishesCount: number;
  encoreDishesCount: number;
  totalSpent: number;
}

export function computeOverallInsights(
  enrichedPlaces: EnrichedPlace[],
  enrichedDishes: EnrichedDish[],
  biteLogs: BiteLog[]
): OverallInsights {
  return {
    totalPlaces: enrichedPlaces.length,
    totalDishes: enrichedDishes.length,
    totalBites: biteLogs.length,
    repeatDishesCount: enrichedDishes.filter((d) => d.visitCount >= 2).length,
    priceUpDishesCount: enrichedDishes.filter((d) => d.isPriceUp).length,
    encoreDishesCount: enrichedDishes.filter((d) => d.latestVerdict === 'encore').length,
    totalSpent: biteLogs.reduce((sum, l) => sum + (Number(l.price) || 0), 0),
  };
}

/**
 * 解析使用者貼上的 Google Maps 連結或文字，提取店名與經緯度座標
 */
export function parseGoogleMapsInput(input: string): {
  extractedName?: string;
  latitude?: number;
  longitude?: number;
  cleanUrl?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) return {};

  let latitude: number | undefined;
  let longitude: number | undefined;
  let extractedName: string | undefined;

  // 解析 @25.033964,121.564468 格式
  const atCoordMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atCoordMatch) {
    latitude = parseFloat(atCoordMatch[1]);
    longitude = parseFloat(atCoordMatch[2]);
  } else {
    // 解析 q=25.033,121.564 或純座標
    const qCoordMatch = trimmed.match(/(-?\d{2}\.\d{3,})\s*,\s*(-?\d{2,3}\.\d{3,})/);
    if (qCoordMatch) {
      latitude = parseFloat(qCoordMatch[1]);
      longitude = parseFloat(qCoordMatch[2]);
    }
  }

  // 解析 /maps/place/店名/
  const placeNameMatch = trimmed.match(/\/maps\/place\/([^/@?]+)/);
  if (placeNameMatch && placeNameMatch[1]) {
    try {
      extractedName = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
    } catch {
      extractedName = placeNameMatch[1];
    }
  }

  const isUrl = /^https?:\/\//i.test(trimmed);
  return {
    extractedName,
    latitude,
    longitude,
    cleanUrl: isUrl ? trimmed : undefined,
  };
}

/**
 * 產生開啟 Google Maps 店家查詢或座標的外部連結
 */
export function buildGoogleMapsUrl(place: Pick<Place, 'name' | 'address' | 'latitude' | 'longitude' | 'googleMapsUrl' | 'googlePlaceId'>): string {
  if (place.googleMapsUrl && /^https?:\/\//i.test(place.googleMapsUrl)) {
    return place.googleMapsUrl;
  }
  const query = encodeURIComponent(`${place.name} ${place.address || ''}`.trim());
  if (place.googlePlaceId && !place.googlePlaceId.startsWith('local_')) {
    return `https://www.google.com/maps/search/?api=1&query=${query}&query_place_id=${encodeURIComponent(place.googlePlaceId)}`;
  }
  if (typeof place.latitude === 'number' && typeof place.longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * 內建高質感美食攝影預設照片庫（當使用者在測試環境快速體驗或未拍照時可一鍵選用）
 */
export interface PresetFoodPhoto {
  id: string;
  label: string;
  url: string;
}

export const PRESET_FOOD_PHOTOS: PresetFoodPhoto[] = [
  {
    id: 'ramen',
    label: '濃郁雞白湯拉麵',
    url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'beef_noodle',
    label: '紅燒半筋半肉牛肉麵',
    url: 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'luroufan',
    label: '古早味手切滷肉飯',
    url: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'coffee_pudding',
    label: '大人味焦糖硬布丁與手沖',
    url: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'gyoza',
    label: '冰花脆皮煎餃',
    url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'yakiniku',
    label: '炭火厚切牛舌定食',
    url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'matcha',
    label: '小山園抹茶千層蛋糕',
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: 'brunch',
    label: '酸種麵包酪梨水波蛋',
    url: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
  },
];

/**
 * 內建 Google Maps 店家快速搜尋資料庫（離線或未填 API Key 時也能秒搜台灣人氣類型店家）
 */
export interface GooglePlaceCandidate {
  googlePlaceId: string;
  name: string;
  category: PlaceCategory;
  address: string;
  latitude: number;
  longitude: number;
}

export const BUILTIN_GOOGLE_PLACES: GooglePlaceCandidate[] = [
  {
    googlePlaceId: 'local_menya_toripaitan',
    name: '麵屋一燈 台北中山店',
    category: '拉麵與麵食',
    address: '台北市中山區南京東路一段 29 號',
    latitude: 25.0522,
    longitude: 121.5245,
  },
  {
    googlePlaceId: 'local_jin_feng',
    name: '金峰魯肉飯',
    category: '台灣小吃',
    address: '台北市中正區羅斯福路一段 10 號',
    latitude: 25.0323,
    longitude: 121.5186,
  },
  {
    googlePlaceId: 'local_fuhang',
    name: '阜杭豆漿',
    category: '台灣小吃',
    address: '台北市中正區忠孝東路一段 108 號 2 樓',
    latitude: 25.0442,
    longitude: 121.5248,
  },
  {
    googlePlaceId: 'local_simple_kaffa',
    name: '興波咖啡 Simple Kaffa 華山旗艦店',
    category: '咖啡與甜點',
    address: '台北市中正區忠孝東路二段 27 號',
    latitude: 25.0439,
    longitude: 121.5293,
  },
  {
    googlePlaceId: 'local_lin_dong_fang',
    name: '林東芳牛肉麵',
    category: '拉麵與麵食',
    address: '台北市中山區八德路二段 322 號',
    latitude: 25.0471,
    longitude: 121.5432,
  },
  {
    googlePlaceId: 'local_chamonix_taichung',
    name: '屋馬燒肉 文心店',
    category: '火鍋與燒肉',
    address: '台中市南屯區文心路一段 436 號',
    latitude: 24.1518,
    longitude: 120.6468,
  },
  {
    googlePlaceId: 'local_tainan_beef',
    name: '文章牛肉湯 安平總店',
    category: '台灣小吃',
    address: '台南市安平區安平路 300 號',
    latitude: 22.9987,
    longitude: 120.1712,
  },
  {
    googlePlaceId: 'local_midnight_kissaten',
    name: '琥珀深夜珈琲店',
    category: '咖啡與甜點',
    address: '台北市大安區溫州街 74 巷 12 號',
    latitude: 25.0209,
    longitude: 121.5331,
  },
];

/**
 * 初始示範手帳資料：
 * 完整展示「第一次吃很好吃 -> 第二次吃還好 -> 第三次吃漲價了所以不太想吃了」的核心體驗
 */
export const SEED_PLACES: Place[] = [
  {
    id: 'place_toripaitan',
    name: '麵屋千羽・雞白湯專門',
    category: '拉麵與麵食',
    address: '台北市中山區赤峰街 49 巷 18 號',
    googlePlaceId: 'ChIJ_seed_toripaitan',
    latitude: 25.0558,
    longitude: 121.5198,
    coverUri: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    isFavorite: true,
    personalNote: '吧台只有 8 個座位，不看 Google 排隊評論，只記我自己的湯頭與價格變化。',
    createdAt: '2026-04-12T12:30:00.000Z',
    updatedAt: '2026-10-15T19:20:00.000Z',
  },
  {
    id: 'place_lurou',
    name: '大橋頭阿伯手切滷肉飯',
    category: '台灣小吃',
    address: '台北市大同區延平北路三段 22 號',
    googlePlaceId: 'ChIJ_seed_lurou',
    latitude: 25.0638,
    longitude: 121.5112,
    coverUri: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    isFavorite: true,
    personalNote: '半熟鴨蛋一定要戳破拌進熱飯裡，辣椒醬油在最左邊桌角。',
    createdAt: '2026-05-03T18:10:00.000Z',
    updatedAt: '2026-10-18T12:45:00.000Z',
  },
  {
    id: 'place_kissaten',
    name: '溫州街木質調深夜珈琲',
    category: '咖啡與甜點',
    address: '台北市大安區溫州街 74 巷 12 號',
    googlePlaceId: 'ChIJ_seed_kissaten',
    latitude: 25.0209,
    longitude: 121.5331,
    coverUri: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80',
    isFavorite: false,
    personalNote: '靠窗第二個位置有插座，適合下雨天晚上一個人去吃布丁。',
    createdAt: '2026-08-20T21:00:00.000Z',
    updatedAt: '2026-10-10T21:15:00.000Z',
  },
];

export const SEED_DISHES: Dish[] = [
  {
    id: 'dish_chicken_ramen',
    placeId: 'place_toripaitan',
    name: '濃厚松露雞白湯拉麵',
    category: '招牌主食',
    coverUri: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-04-12T12:30:00.000Z',
    updatedAt: '2026-10-15T19:20:00.000Z',
  },
  {
    id: 'dish_gyoza',
    placeId: 'place_toripaitan',
    name: '炙燒明太子脆皮煎餃',
    category: '單點小菜',
    coverUri: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-07-19T13:00:00.000Z',
    updatedAt: '2026-07-19T13:00:00.000Z',
  },
  {
    id: 'dish_luroufan_egg',
    placeId: 'place_lurou',
    name: '手切松阪滷肉飯加半熟鴨蛋',
    category: '招牌主食',
    coverUri: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-05-03T18:10:00.000Z',
    updatedAt: '2026-10-18T12:45:00.000Z',
  },
  {
    id: 'dish_caramel_pudding',
    placeId: 'place_kissaten',
    name: '昭和威士忌苦甜焦糖硬布丁',
    category: '甜點烘焙',
    coverUri: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80',
    createdAt: '2026-08-20T21:00:00.000Z',
    updatedAt: '2026-10-10T21:15:00.000Z',
  },
];

export const SEED_BITE_LOGS: BiteLog[] = [
  // 濃厚松露雞白湯拉麵：完整呈現「第 1 次超好吃 -> 第 2 次還好 -> 第 3 次漲價不想吃了」
  {
    id: 'log_ramen_1',
    dishId: 'dish_chicken_ramen',
    placeId: 'place_toripaitan',
    rating: 4.8,
    price: 190,
    verdict: 'encore',
    note: '第一次吃驚為天人！湯頭濃郁充滿膠質，舒肥雞叉燒嫩到不行，190 元還附整顆溏心蛋，完全是心中第一名。',
    photoUri: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'warm',
    visitedAt: '2026-04-12',
    createdAt: '2026-04-12T12:35:00.000Z',
  },
  {
    id: 'log_ramen_2',
    dishId: 'dish_chicken_ramen',
    placeId: 'place_toripaitan',
    rating: 3.5,
    price: 190,
    verdict: 'meh',
    note: '第二次回訪，今天湯頭偏鹹了一點，而且雞叉燒切得比上次薄，整體吃起來普通還好，沒有第一次那種感動。',
    photoUri: 'https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'natural',
    visitedAt: '2026-07-19',
    createdAt: '2026-07-19T13:10:00.000Z',
  },
  {
    id: 'log_ramen_3',
    dishId: 'dish_chicken_ramen',
    placeId: 'place_toripaitan',
    rating: 2.5,
    price: 240,
    verdict: 'price_up',
    note: '第三次來發現直接從 190 漲價到 240 元！溏心蛋還變成要另外加點 30 元，湯量也變少，漲太多了以後不太想吃了。',
    photoUri: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'contrast',
    visitedAt: '2026-10-15',
    createdAt: '2026-10-15T19:20:00.000Z',
  },
  // 煎餃
  {
    id: 'log_gyoza_1',
    dishId: 'dish_gyoza',
    placeId: 'place_toripaitan',
    rating: 4.2,
    price: 95,
    verdict: 'solid',
    note: '底部冰花煎得很酥脆，明太子美乃滋微辣很開胃，當配菜很稱職。',
    photoUri: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'warm',
    visitedAt: '2026-07-19',
    createdAt: '2026-07-19T13:15:00.000Z',
  },
  // 滷肉飯：穩定發揮的好店
  {
    id: 'log_lurou_1',
    dishId: 'dish_luroufan_egg',
    placeId: 'place_lurou',
    rating: 4.7,
    price: 65,
    verdict: 'encore',
    note: '滷汁帶點甘甜陳皮香，肥瘦比例剛剛好，吃完嘴唇會有微微黏感但完全不膩口。',
    photoUri: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'warm',
    visitedAt: '2026-05-03',
    createdAt: '2026-05-03T18:10:00.000Z',
  },
  {
    id: 'log_lurou_2',
    dishId: 'dish_luroufan_egg',
    placeId: 'place_lurou',
    rating: 4.9,
    price: 65,
    verdict: 'encore',
    note: '隔了五個月再吃還是維持 65 元沒漲價！今天白飯煮得粒粒分明，拌入半熟鴨蛋液真的無敵。',
    photoUri: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'warm',
    visitedAt: '2026-10-18',
    createdAt: '2026-10-18T12:45:00.000Z',
  },
  // 焦糖布丁
  {
    id: 'log_pudding_1',
    dishId: 'dish_caramel_pudding',
    placeId: 'place_kissaten',
    rating: 4.6,
    price: 130,
    verdict: 'solid',
    note: '蛋香很紮實的昭和硬布丁，焦糖液有明顯的威士忌尾韻，配深焙手沖剛剛好。',
    photoUri: 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80',
    photoFilter: 'film',
    visitedAt: '2026-10-10',
    createdAt: '2026-10-10T21:15:00.000Z',
  },
];
