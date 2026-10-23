/**
 * BiteNote 吃一口 — 本機優先雙引擎儲存與原生雲端備份服務
 * - iOS / Android 真機：使用 SQLite (expo-sqlite) + 應用程式 DocumentDirectory/photos
 *   自動納入 iOS iCloud Backup 與 Android Google Drive Auto Backup
 * - 相簿同步：支援透過 expo-media-library 同步儲存至手機「BiteNote 吃一口」相簿
 * - Web 預覽環境：自動切換為瀏覽器 LocalStorage 持久化儲存
 */

import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import * as Location from 'expo-location';
import {
  AppSettings,
  BackupPayload,
  BiteLog,
  Dish,
  Place,
  PlaceCategory,
  UserProfile,
} from '../types/models';
import {
  BUILTIN_GOOGLE_PLACES,
  GooglePlaceCandidate,
  SEED_BITE_LOGS,
  SEED_DISHES,
  SEED_PLACES,
} from '../utils/analytics';

const WEB_STORAGE_KEY = 'bitenote_local_store_v1';
const ALBUM_NAME = 'BiteNote 吃一口';

export const DEFAULT_USER_PROFILE: UserProfile = {
  id: 'guest_user',
  name: '味蕾探險家',
  email: '',
  avatarEmoji: '🥢',
  provider: 'guest',
  isGuest: true,
  joinedAt: '2024-01-01',
};

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'light',
  autoSaveToAlbum: true,
  icloudBackupEnabled: true,
  googleDriveBackupEnabled: true,
  googleMapsApiKey: '',
  defaultCurrency: 'NT$',
  lastBackupAt: new Date().toISOString(),
  userProfile: DEFAULT_USER_PROFILE,
  googleClientId: '712050840003-si53cvbugasg38o2jhmm22fvj59lpce4.apps.googleusercontent.com',
  appleServiceId: '',
};

export interface AppDatabaseState {
  settings: AppSettings;
  places: Place[];
  dishes: Dish[];
  biteLogs: BiteLog[];
}

// 延遲載入 SQLite，避免在 Web 環境觸發原生模組錯誤
let sqliteDb: any = null;

async function getNativeDb() {
  if (Platform.OS === 'web') return null;
  if (sqliteDb) return sqliteDb;
  try {
    const SQLite = require('expo-sqlite');
    sqliteDb = await SQLite.openDatabaseAsync('bitenote.db');
    await sqliteDb.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv_store (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
    `);
    return sqliteDb;
  } catch (err) {
    console.warn('SQLite 初始化回退至記憶體/快取模式:', err);
    return null;
  }
}

/**
 * 讀取完整本機手帳狀態（若首次啟動則載入示範資料）
 */
export async function loadDatabaseState(): Promise<AppDatabaseState> {
  const initialSeed: AppDatabaseState = {
    settings: DEFAULT_SETTINGS,
    places: SEED_PLACES,
    dishes: SEED_DISHES,
    biteLogs: SEED_BITE_LOGS,
  };

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(WEB_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
          const loadedSettings = { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) };
          if (!loadedSettings.googleClientId) {
            loadedSettings.googleClientId = DEFAULT_SETTINGS.googleClientId;
          }
          return {
            settings: loadedSettings,
            places: Array.isArray(parsed.places) ? parsed.places : SEED_PLACES,
            dishes: Array.isArray(parsed.dishes) ? parsed.dishes : SEED_DISHES,
            biteLogs: Array.isArray(parsed.biteLogs) ? parsed.biteLogs : SEED_BITE_LOGS,
          };
        }
        window.localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(initialSeed));
      }
      return initialSeed;
    }

    const db = await getNativeDb();
    if (db) {
      const row = await db.getFirstAsync(
        'SELECT value FROM kv_store WHERE key = ?',
        [WEB_STORAGE_KEY]
      );
      if (row && row.value) {
        const parsed = JSON.parse(row.value) as Partial<AppDatabaseState>;
        return {
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
          places: Array.isArray(parsed.places) ? parsed.places : SEED_PLACES,
          dishes: Array.isArray(parsed.dishes) ? parsed.dishes : SEED_DISHES,
          biteLogs: Array.isArray(parsed.biteLogs) ? parsed.biteLogs : SEED_BITE_LOGS,
        };
      }
      await saveDatabaseState(initialSeed);
    }
  } catch (error) {
    console.warn('讀取本機資料庫失敗，使用預設狀態:', error);
  }

  return initialSeed;
}

/**
 * 儲存完整本機手帳狀態
 * 在 iOS 寫入 NSDocumentDirectory/SQLite/bitenote.db（自動受 iCloud 備份保護）
 * 在 Android 寫入 databases/bitenote.db（自動受 Google Drive Auto Backup 保護）
 */
export async function saveDatabaseState(state: AppDatabaseState): Promise<void> {
  const updatedState: AppDatabaseState = {
    ...state,
    settings: {
      ...state.settings,
      lastBackupAt: new Date().toISOString(),
    },
  };
  const serialized = JSON.stringify(updatedState);

  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(WEB_STORAGE_KEY, serialized);
      }
      return;
    }

    const db = await getNativeDb();
    if (db) {
      await db.runAsync(
        'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)',
        [WEB_STORAGE_KEY, serialized]
      );
    }
  } catch (error) {
    console.warn('寫入本機資料庫時發生錯誤:', error);
  }
}

/**
 * 將拍攝或選取的照片持久化至 App 內部 DocumentDirectory/photos 目錄，
 * 並依設定同步存入手機系統相簿「BiteNote 吃一口」（供 iCloud 相簿 / Google 相簿自動備份）
 */
export async function persistFoodPhoto(
  sourceUri: string,
  autoSaveToAlbum: boolean
): Promise<string> {
  if (!sourceUri || Platform.OS === 'web' || sourceUri.startsWith('data:') || sourceUri.startsWith('http')) {
    return sourceUri;
  }

  try {
    const photosDir = `${FileSystem.documentDirectory}photos/`;
    const dirInfo = await FileSystem.getInfoAsync(photosDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
    }

    const ext = sourceUri.split('.').pop()?.split('?')[0] || 'jpg';
    const fileName = `bite_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const destUri = `${photosDir}${fileName}`;

    await FileSystem.copyAsync({
      from: sourceUri,
      to: destUri,
    });

    if (autoSaveToAlbum) {
      try {
        const perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.granted) {
          const asset = await MediaLibrary.createAssetAsync(destUri);
          const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
          if (!album) {
            await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
          } else {
            await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
          }
        }
      } catch (albumErr) {
        console.warn('同步至系統相簿略過:', albumErr);
      }
    }

    return destUri;
  } catch (err) {
    console.warn('持久化照片回退至原始路徑:', err);
    return sourceUri;
  }
}

/**
 * 從手機相簿挑選食物照片（支援 iOS / Android / Web）
 */
export async function pickPhotoFromLibrary(autoSaveToAlbum: boolean): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        throw new Error('請允許讀取相簿權限以挑選美食照片');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
      base64: Platform.OS === 'web',
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (Platform.OS === 'web' && asset.base64) {
      const mime = asset.mimeType || 'image/jpeg';
      return `data:${mime};base64,${asset.base64}`;
    }

    return await persistFoodPhoto(asset.uri, autoSaveToAlbum);
  } catch (err) {
    console.warn('選取相簿照片失敗:', err);
    throw err;
  }
}

/**
 * 使用手機相機拍攝食物照片
 */
export async function takePhotoWithCamera(autoSaveToAlbum: boolean): Promise<string | null> {
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        throw new Error('請允許相機權限以拍攝美食照片');
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
      base64: Platform.OS === 'web',
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return null;
    }

    const asset = result.assets[0];
    if (Platform.OS === 'web' && asset.base64) {
      const mime = asset.mimeType || 'image/jpeg';
      return `data:${mime};base64,${asset.base64}`;
    }

    return await persistFoodPhoto(asset.uri, autoSaveToAlbum);
  } catch (err) {
    console.warn('相機拍攝失敗:', err);
    throw err;
  }
}

/**
 * 搜尋全台真實餐廳與店家地標（支援免金鑰即時聯網檢索 + 選填 Google Places API + 內建名店庫）
 * 輸入如「今大」、「五燈獎」、「一蘭」、「雙月」等關鍵字，即可即時跳出真實店名、地址與經緯度座標
 */
export async function searchGooglePlaces(
  query: string,
  apiKey?: string
): Promise<GooglePlaceCandidate[]> {
  const rawQuery = query.trim();
  const q = rawQuery.toLowerCase();

  const localMatches = BUILTIN_GOOGLE_PLACES.filter(
    (item) =>
      !q ||
      item.name.toLowerCase().includes(q) ||
      item.address.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
  );

  if (!rawQuery) {
    return localMatches;
  }

  const results: GooglePlaceCandidate[] = [...localMatches];

  // 引擎 1：免金鑰即時台灣餐廳與地標聯網檢索 (ArcGIS Taiwan POI Suggest + Geocode)
  const arcgisPromise = (async (): Promise<GooglePlaceCandidate[]> => {
    try {
      const suggestUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?text=${encodeURIComponent(
        rawQuery
      )}&countryCode=TWN&category=Food,POI&maxSuggestions=7&f=json`;
      const sRes = await fetch(suggestUrl);
      const sData = await sRes.json();
      if (!sData || !Array.isArray(sData.suggestions) || sData.suggestions.length === 0) {
        return [];
      }

      const resolved = await Promise.all(
        sData.suggestions.slice(0, 6).map(async (s: any, idx: number) => {
          try {
            const cUrl = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?SingleLine=${encodeURIComponent(
              s.text
            )}&magicKey=${encodeURIComponent(
              s.magicKey
            )}&outFields=PlaceName,Place_addr,Type&f=json`;
            const cRes = await fetch(cUrl);
            const cData = await cRes.json();
            const top = cData?.candidates?.[0];
            if (!top) return null;

            const placeName =
              top.attributes?.PlaceName ||
              extractStoreNameFromArcgisText(s.text, rawQuery);
            const rawAddr = (top.attributes?.Place_addr || s.text || '')
              .replace(/,\s*\d{3,6}$/, '')
              .replace(placeName, '')
              .trim();

            return {
              googlePlaceId: `tw_poi_${idx}_${ placeName }`,
              name: placeName,
              category: inferPlaceCategory(placeName, [top.attributes?.Type || '']),
              address: rawAddr || s.text.replace(/,\s*\d{3,6}$/, ''),
              latitude: Math.round((top.location?.y ?? 25.0478) * 1000000) / 1000000,
              longitude: Math.round((top.location?.x ?? 121.517) * 1000000) / 1000000,
            } as GooglePlaceCandidate;
          } catch {
            return null;
          }
        })
      );

      return resolved.filter((x): x is GooglePlaceCandidate => Boolean(x && x.name));
    } catch {
      return [];
    }
  })();

  // 引擎 2：OpenStreetMap Nominatim 台灣地標即時搜尋（補足連鎖店與商圈地標如「一蘭」）
  const nominatimPromise = (async (): Promise<GooglePlaceCandidate[]> => {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
        rawQuery
      )}&countrycodes=tw&addressdetails=1&limit=5&accept-language=zh-TW`;
      const nRes = await fetch(nomUrl);
      const nData = await nRes.json();
      if (!Array.isArray(nData)) return [];

      return nData
        .filter((item: any) => Boolean(item.name))
        .map((item: any, idx: number) => {
          const addrObj = item.address || {};
          const city = addrObj.city || addrObj.county || addrObj.state || '';
          const district = addrObj.suburb || addrObj.town || addrObj.city_district || '';
          const road = addrObj.road || '';
          const houseNo = addrObj.house_number ? `${addrObj.house_number}號` : '';
          const formattedAddr =
            `${city}${district}${road}${houseNo}`.trim() ||
            String(item.display_name || '').split(',').slice(0, 4).join(' ');

          return {
            googlePlaceId: `osm_${item.place_id || idx}`,
            name: item.name,
            category: inferPlaceCategory(item.name, [item.type || '', item.category || '']),
            address: formattedAddr,
            latitude: Math.round( parseFloat(item.lat || '25.0478') * 1000000 ) / 1000000,
            longitude: Math.round( parseFloat(item.lon || '121.517') * 1000000 ) / 1000000,
          } as GooglePlaceCandidate;
        });
    } catch {
      return [];
    }
  })();

  // 引擎 3：若使用者有填寫 Google Places API Key 則一併查詢
  const googleApiPromise = (async (): Promise<GooglePlaceCandidate[]> => {
    if (!apiKey || !apiKey.trim()) return [];
    try {
      const endpoint = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
        rawQuery
      )}&language=zh-TW&region=tw&key=${encodeURIComponent(apiKey.trim())}`;
      const res = await fetch(endpoint);
      const data = await res.json();
      if (data && Array.isArray(data.results)) {
        return data.results.slice(0, 6).map((r: any) => ({
          googlePlaceId: r.place_id || `gmap_${Date.now()}`,
          name: r.name || rawQuery,
          category: inferPlaceCategory(r.name || '', r.types || []),
          address: r.formatted_address || '台灣',
          latitude: r.geometry?.location?.lat ?? 25.0478,
          longitude: r.geometry?.location?.lng ?? 121.517,
        }));
      }
    } catch {
      // ignore
    }
    return [];
  })();

  const [arcgisList, nominatimList, googleList] = await Promise.all([
    arcgisPromise,
    nominatimPromise,
    googleApiPromise,
  ]);

  const combined = [...googleList, ...arcgisList, ...nominatimList, ...results];

  // 依據「店名 + 地址前綴」去重，並將包含關鍵字於店名的結果排在最前面
  const seen = new Set<string>();
  const deduped: GooglePlaceCandidate[] = [];
  for (const item of combined) {
    const key = `${item.name.trim()}_${item.address.slice(0, 9)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  deduped.sort((a, b) => {
    const aHas = a.name.toLowerCase().includes(q) ? 1 : 0;
    const bHas = b.name.toLowerCase().includes(q) ? 1 : 0;
    return bHas - aHas;
  });

  return deduped.slice(0, 10);
}

function extractStoreNameFromArcgisText(text: string, fallback: string): string {
  const cleaned = text.replace(/,\s*\d{3,6}$/, '').trim();
  const match = cleaned.match(/號(.+)$/);
  if (match && match[1]) return match[1].trim();
  return cleaned || fallback;
}

function inferPlaceCategory(name: string, types: string[]): PlaceCategory {
  const text = `${name} ${types.join(' ')}`.toLowerCase();
  if (text.includes('麵') || text.includes('拉麵') || text.includes('noodle')) return '拉麵與麵食';
  if (text.includes('咖啡') || text.includes('甜點') || text.includes('cafe') || text.includes('bakery'))
    return '咖啡與甜點';
  if (text.includes('鍋') || text.includes('燒肉') || text.includes('bbq')) return '火鍋與燒肉';
  if (text.includes('壽司') || text.includes('日式') || text.includes('居酒屋')) return '日式料理';
  if (text.includes('早午餐') || text.includes('吐司')) return '早午餐與輕食';
  if (text.includes('茶') || text.includes('飲')) return '手搖與飲品';
  return '台灣小吃';
}

/**
 * 取得使用者目前 GPS 座標
 */
export async function getCurrentGpsCoordinates(): Promise<{
  latitude: number;
  longitude: number;
} | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: Math.round(loc.coords.latitude * 100000) / 100000,
      longitude: Math.round(loc.coords.longitude * 100000) / 100000,
    };
  } catch {
    return null;
  }
}

/**
 * 產生完整 JSON 備份結構並匯出分享（支援 iCloud Drive / Google Drive 手動封存與跨機轉移）
 */
export function createBackupPayload(state: AppDatabaseState): BackupPayload {
  return {
    appName: 'BiteNote 吃一口',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: state.settings,
    places: state.places,
    dishes: state.dishes,
    biteLogs: state.biteLogs,
  };
}

export async function exportBackupFile(state: AppDatabaseState): Promise<string> {
  const payload = createBackupPayload(state);
  const jsonString = JSON.stringify(payload, null, 2);
  const dateTag = new Date().toISOString().slice(0, 10);
  const fileName = `BiteNote_吃一口_備份_${dateTag}.json`;

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    return fileName;
  }

  const fileUri = `${FileSystem.documentDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, jsonString, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/json',
      dialogTitle: '匯出「BiteNote 吃一口」手帳備份至 iCloud / Google Drive',
    });
  }
  return fileName;
}

/**
 * 驗證並解析使用者匯入的 JSON 備份字串
 */
export function parseBackupJson(rawJson: string): AppDatabaseState {
  const parsed = JSON.parse(rawJson);
  if (!parsed || !Array.isArray(parsed.places) || !Array.isArray(parsed.dishes) || !Array.isArray(parsed.biteLogs)) {
    throw new Error('備份格式不正確：缺少店家、品項或品嚐紀錄資料');
  }
  return {
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    places: parsed.places,
    dishes: parsed.dishes,
    biteLogs: parsed.biteLogs,
  };
}
