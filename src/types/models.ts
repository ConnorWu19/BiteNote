/**
 * BiteNote 吃一口 — 核心資料型別定義
 * 遵循「店家 (Place) -> 品項 (Dish) -> 歷次品嚐紀錄 (BiteLog)」三層結構
 * 所有使用者介面顯示文字與選項均為純繁體中文
 */

export type TastingVerdict =
  | 'encore'    // 驚為天人（必回訪）
  | 'solid'     // 穩定發揮（日常好選擇）
  | 'meh'       // 普通還好（平淡無奇）
  | 'price_up'  // 漲價退步（變貴或縮水）
  | 'avoid';    // 拒絕再訪（踩雷棄坑）

export type PlaceCategory =
  | '拉麵與麵食'
  | '台灣小吃'
  | '咖啡與甜點'
  | '日式料理'
  | '火鍋與燒肉'
  | '異國料理'
  | '早午餐與輕食'
  | '手搖與飲品'
  | '私房小店';

export type DishCategory =
  | '招牌主食'
  | '單點小菜'
  | '湯品鍋物'
  | '甜點烘焙'
  | '特調飲品';

export type PhotoFilter =
  | 'natural'   // 原色自然
  | 'warm'      // 暖調食堂
  | 'film'      // 奶油底片
  | 'contrast'; // 濃郁炙燒

export type ThemeMode = 'light' | 'dark' | 'system';

export interface VerdictMeta {
  id: TastingVerdict;
  label: string;
  shortLabel: string;
  emoji: string;
  description: string;
  colorLight: string;
  bgLight: string;
  colorDark: string;
  bgDark: string;
}

export const VERDICT_OPTIONS: Record<TastingVerdict, VerdictMeta> = {
  encore: {
    id: 'encore',
    label: '驚為天人',
    shortLabel: '必回訪',
    emoji: '🔥',
    description: '第一口就驚豔，絕對想再來吃',
    colorLight: '#C83E2B',
    bgLight: '#FDECE8',
    colorDark: '#FF8A75',
    bgDark: '#3A1D18',
  },
  solid: {
    id: 'solid',
    label: '穩定發揮',
    shortLabel: '好吃穩定',
    emoji: '😋',
    description: '品質穩定、價格合理，日常安心首選',
    colorLight: '#2E6B4E',
    bgLight: '#E8F5EE',
    colorDark: '#6FCF97',
    bgDark: '#193326',
  },
  meh: {
    id: 'meh',
    label: '普通還好',
    shortLabel: '普通還好',
    emoji: '😐',
    description: '味道中規中矩，或是沒有第一次吃那麼驚豔',
    colorLight: '#8A6522',
    bgLight: '#FDF5E6',
    colorDark: '#F2C94C',
    bgDark: '#362B14',
  },
  price_up: {
    id: 'price_up',
    label: '漲價退步',
    shortLabel: '漲價退步',
    emoji: '💸',
    description: '漲價太多、份量縮水或口味不如從前，不太想再點',
    colorLight: '#B84A14',
    bgLight: '#FFF0E5',
    colorDark: '#FFA366',
    bgDark: '#3B2112',
  },
  avoid: {
    id: 'avoid',
    label: '地雷勿點',
    shortLabel: '地雷勿點',
    emoji: '🚫',
    description: '品項踩雷或不合口味，寫進手帳提醒自己別再點',
    colorLight: '#6E655F',
    bgLight: '#EFECE8',
    colorDark: '#B8AFA6',
    bgDark: '#2C2825',
  },
};

export const PLACE_CATEGORIES: PlaceCategory[] = [
  '拉麵與麵食',
  '台灣小吃',
  '咖啡與甜點',
  '日式料理',
  '火鍋與燒肉',
  '異國料理',
  '早午餐與輕食',
  '手搖與飲品',
  '私房小店',
];

export const DISH_CATEGORIES: DishCategory[] = [
  '招牌主食',
  '單點小菜',
  '湯品鍋物',
  '甜點烘焙',
  '特調飲品',
];

export interface PhotoFilterMeta {
  id: PhotoFilter;
  label: string;
  description: string;
  overlayColor: string;
  overlayOpacity: number;
}

export const PHOTO_FILTERS: PhotoFilterMeta[] = [
  {
    id: 'natural',
    label: '原色自然',
    description: '保留食物真實色澤',
    overlayColor: 'transparent',
    overlayOpacity: 0,
  },
  {
    id: 'warm',
    label: '暖調食堂',
    description: '增添琥珀黃光，適合拉麵、滷肉飯與熱湯',
    overlayColor: '#F59E0B',
    overlayOpacity: 0.12,
  },
  {
    id: 'film',
    label: '奶油底片',
    description: '柔和日系雜誌感，適合甜點與早午餐',
    overlayColor: '#FDE68A',
    overlayOpacity: 0.16,
  },
  {
    id: 'contrast',
    label: '濃郁炙燒',
    description: '強化烤色與深邃感，適合燒肉與咖哩',
    overlayColor: '#7C2D12',
    overlayOpacity: 0.14,
  },
];

/**
 * 店家資料 (連接 Google Maps 或個人私房建立)
 */
export interface Place {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string;
  googlePlaceId?: string;
  googleMapsUrl?: string;
  latitude?: number;
  longitude?: number;
  coverUri?: string;
  isFavorite: boolean;
  personalNote: string; // 只屬於自己的店家私密筆記（如：週三公休、老闆臉臭但湯頭真材實料）
  createdAt: string;
  updatedAt: string;
}

/**
 * 店內品項（同一品項可被多次評分與記錄價格演變）
 */
export interface Dish {
  id: string;
  placeId: string;
  name: string;
  category: DishCategory;
  coverUri?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 單次品嚐紀錄（第 1 次吃、第 2 次吃、第 3 次吃…）
 */
export interface BiteLog {
  id: string;
  dishId: string;
  placeId: string;
  rating: number;         // 0.5 ~ 5.0
  price: number;          // 當下品嚐價格 (NT$)
  verdict: TastingVerdict;
  note: string;           // 當下品嚐感想
  photoUri?: string;      // 自己拍的食物照片路徑或 Data URL
  photoFilter?: PhotoFilter;
  visitedAt: string;      // YYYY-MM-DD
  createdAt: string;
}

/**
 * 經計算後的品項完整演變分析（供畫面直接呈現）
 */
export interface EnrichedDish extends Dish {
  placeName: string;
  placeAddress: string;
  placeCategory: PlaceCategory;
  logs: BiteLog[]; // 依用餐時間由舊到新排序 (第 1 次 -> 第 N 次)
  visitCount: number;
  firstPrice: number;
  latestPrice: number;
  priceDelta: number;           // 最新價格 - 初次價格
  priceDeltaFromPrev: number;   // 最新價格 - 上一次價格
  priceChangePercent: number;   // 漲跌幅百分比
  isPriceUp: boolean;
  firstRating: number;
  latestRating: number;
  averageRating: number;
  ratingDelta: number;          // 最新評分 - 初次評分
  ratingTrend: 'rising' | 'falling' | 'stable' | 'single';
  latestVerdict: TastingVerdict;
  latestVisitedAt: string;
  evolutionSummary: string;     // 自動生成的個人味覺演變摘要（例如：「共吃過 3 次・價格由 $190 漲至 $240 (+26%)・評分由 4.8★ 降至 2.5★」）
}

/**
 * 經計算後的店家聚合資料
 */
export interface EnrichedPlace extends Place {
  dishes: EnrichedDish[];
  totalDishes: number;
  totalVisits: number;
  personalAvgRating: number;
  priceUpDishCount: number;
  encoreDishCount: number;
  lastVisitedAt: string;
}

/**
 * 使用者登入身分與偏好
 */
export type AuthProviderType = 'guest' | 'apple' | 'google' | 'email';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatarEmoji?: string;
  avatarUri?: string;
  provider: AuthProviderType;
  isGuest: boolean;
  joinedAt: string;
  lastSyncedAt?: string;
}

/**
 * 應用程式偏好與備份設定
 */
export interface AppSettings {
  themeMode: ThemeMode;
  autoSaveToAlbum: boolean;         // 拍照或選圖時自動同步至手機「BiteNote 吃一口」相簿
  icloudBackupEnabled: boolean;     // iOS iCloud 自動備份啟用狀態
  googleDriveBackupEnabled: boolean;// Android Google Drive 自動備份啟用狀態
  googleMapsApiKey: string;         // 選填：使用者自備 Google Maps Places API Key
  defaultCurrency: string;          // 預設幣別（NT$）
  lastBackupAt?: string;            // 最近一次備份時間
  userProfile?: UserProfile;        // 使用者登入個人檔案
  googleClientId?: string;          // 選填：自備 Google OAuth 2.0 Web Client ID
  appleServiceId?: string;          // 選填：自備 Apple Sign In Service ID
}

export interface BackupPayload {
  appName: 'BiteNote 吃一口';
  schemaVersion: number;
  exportedAt: string;
  settings: AppSettings;
  places: Place[];
  dishes: Dish[];
  biteLogs: BiteLog[];
}
