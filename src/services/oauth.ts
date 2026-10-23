/**
 * BiteNote 吃一口 — 第三方 OAuth 認證服務 (Google & Apple Sign In)
 * 遵循 AGENTS.md 專案品質標準：高可靠、相容 Web 與 Native、零多餘依賴
 */

import { Platform } from 'react-native';
import { UserProfile } from '../types/models';

/**
 * 簡易安全的 JWT 解碼（無須肥大第三方套件）
 */
export function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * 動態載入 Google Identity Services (GIS) Web SDK
 */
export function loadGoogleSdk(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('無法載入 Google 官方登入服務'));
    document.head.appendChild(script);
  });
}

/**
 * 動態載入 Apple Sign In JS SDK
 */
export function loadAppleSdk(): Promise<void> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    if ((window as any).AppleID?.auth) {
      resolve();
      return;
    }

    const existing = document.getElementById('apple-auth-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'apple-auth-script';
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/auth.js';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('無法載入 Apple 官方登入服務'));
    document.head.appendChild(script);
  });
}

/**
 * 執行 Google OAuth 官方登入流程
 */
export async function signInWithGoogle(clientId?: string): Promise<UserProfile> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const activeClientId = clientId?.trim();
    if (!activeClientId) {
      throw new Error('MISSING_CLIENT_ID');
    }

    await loadGoogleSdk();

    const google = (window as any).google;
    if (!google?.accounts?.oauth2) {
      throw new Error('Google 登入服務尚未備妥，請稍後重試');
    }

    return new Promise<UserProfile>((resolve, reject) => {
      try {
        const tokenClient = google.accounts.oauth2.initTokenClient({
          client_id: activeClientId,
          scope: 'openid profile email',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error_description || tokenResponse.error));
              return;
            }

            try {
              const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
              });

              if (!res.ok) {
                throw new Error('無法從 Google 取得使用者資料');
              }

              const userInfo = await res.json();
              const profile: UserProfile = {
                id: `google_${userInfo.sub}`,
                name: userInfo.name || 'Google 食客',
                email: userInfo.email,
                avatarUri: userInfo.picture,
                avatarEmoji: '🥢',
                provider: 'google',
                isGuest: false,
                joinedAt: new Date().toISOString().split('T')[0],
                lastSyncedAt: new Date().toISOString(),
              };
              resolve(profile);
            } catch (err: any) {
              reject(new Error(err.message || '取得 Google 資料失敗'));
            }
          },
        });

        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } catch (err: any) {
        reject(new Error(err.message || '初始化 Google 登入失敗'));
      }
    });
  }

  // 原生環境目前預設模擬
  return {
    id: `google_${Date.now().toString(36)}`,
    name: 'Google 食客',
    email: 'gourmet.explorer@gmail.com',
    avatarEmoji: '🥢',
    provider: 'google',
    isGuest: false,
    joinedAt: new Date().toISOString().split('T')[0],
    lastSyncedAt: new Date().toISOString(),
  };
}

/**
 * 執行 Apple 官方登入流程
 */
export async function signInWithApple(serviceId?: string): Promise<UserProfile> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const activeServiceId = serviceId?.trim();
    if (!activeServiceId) {
      throw new Error('MISSING_SERVICE_ID');
    }

    await loadAppleSdk();

    const AppleID = (window as any).AppleID;
    if (!AppleID?.auth) {
      throw new Error('Apple 登入服務尚未備妥，請稍後重試');
    }

    const redirectURI = window.location.origin + window.location.pathname;

    AppleID.auth.init({
      clientId: activeServiceId,
      scope: 'name email',
      redirectURI: redirectURI,
      usePopup: true,
    });

    const res = await AppleID.auth.signIn();
    let email = res.user?.email;
    let name = '';
    if (res.user?.name) {
      name = `${res.user.name.firstName || ''} ${res.user.name.lastName || ''}`.trim();
    }

    let sub = `apple_${Date.now().toString(36)}`;
    if (res.authorization?.id_token) {
      const decoded = parseJwtPayload(res.authorization.id_token);
      if (decoded?.sub) sub = decoded.sub;
      if (!email && decoded?.email) email = decoded.email;
    }

    const profile: UserProfile = {
      id: `apple_${sub}`,
      name: name || 'Apple 雅士',
      email: email || '已啟用 Apple 私密轉寄',
      avatarEmoji: '🍎',
      provider: 'apple',
      isGuest: false,
      joinedAt: new Date().toISOString().split('T')[0],
      lastSyncedAt: new Date().toISOString(),
    };

    return profile;
  }

  return {
    id: `apple_${Date.now().toString(36)}`,
    name: 'Apple Taste Member',
    email: 'taster@icloud.com',
    avatarEmoji: '🍎',
    provider: 'apple',
    isGuest: false,
    joinedAt: new Date().toISOString().split('T')[0],
    lastSyncedAt: new Date().toISOString(),
  };
}
