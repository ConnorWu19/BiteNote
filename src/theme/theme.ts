/**
 * BiteNote 吃一口 — 視覺設計系統 (Editorial Tactile Gastronomy)
 * 支援「淺色（亞麻奶油和紙）」與「深色（深夜食堂黑膠）」雙主題
 * 符合 WCAG AA/AAA 對比度規範與雜誌級排版層級
 */

import { Platform } from 'react-native';

export interface ThemeColors {
  isDark: boolean;
  name: string;
  canvas: string;          // 主背景（和紙 / 炭焙深黑）
  surface: string;         // 卡片表面
  surfaceElevated: string; // 浮起卡片 / 抽屜表面
  surfaceSubtle: string;   // 次要區塊底色（票根收據底色）
  ink: string;             // 主文字（濃墨黑 / 羊皮紙白）
  inkSecondary: string;    // 次要文字（鉛筆灰）
  inkMuted: string;        // 輔助時間戳記文字
  accent: string;          // 主強調色（印泥朱紅 / 赤陶橘紅）
  accentSoft: string;      // 主強調色柔和底色
  herb: string;            // 正向/穩定色（鼠尾草綠）
  herbSoft: string;
  ochre: string;           // 星等/焦糖金
  ochreSoft: string;
  priceUp: string;         // 漲價警示色（琥珀橘紅）
  priceUpSoft: string;
  border: string;          // 細緻紙張邊框線
  borderStrong: string;    // 票根虛線/分隔線
  overlay: string;         // 彈窗遮罩
}

export const LIGHT_THEME: ThemeColors = {
  isDark: false,
  name: '亞麻和紙（淺色）',
  canvas: '#FAF6F0',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFDF9',
  surfaceSubtle: '#F3ECE2',
  ink: '#1C1917',
  inkSecondary: '#57504A',
  inkMuted: '#8A8077',
  accent: '#D14830',
  accentSoft: '#FCEBE7',
  herb: '#2D6A4F',
  herbSoft: '#E6F4ED',
  ochre: '#C88A1E',
  ochreSoft: '#FDF4E1',
  priceUp: '#C2410C',
  priceUpSoft: '#FFEDD5',
  border: '#E7DFD3',
  borderStrong: '#D4C8B8',
  overlay: 'rgba(28, 25, 23, 0.52)',
};

export const DARK_THEME: ThemeColors = {
  isDark: true,
  name: '深夜食堂（深色）',
  canvas: '#121110',
  surface: '#1C1A17',
  surfaceElevated: '#25221E',
  surfaceSubtle: '#171513',
  ink: '#F5EFE6',
  inkSecondary: '#B8AFA6',
  inkMuted: '#7D746B',
  accent: '#EA6A52',
  accentSoft: '#361D18',
  herb: '#52B788',
  herbSoft: '#162E23',
  ochre: '#F4B942',
  ochreSoft: '#332811',
  priceUp: '#FB923C',
  priceUpSoft: '#382010',
  border: '#2E2A25',
  borderStrong: '#423C35',
  overlay: 'rgba(8, 7, 6, 0.72)',
};

export const FONTS = {
  serif: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: '"Noto Serif TC", "Songti TC", Georgia, serif',
  }),
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: '"PingFang TC", "Microsoft JhengHei", -apple-system, BlinkMacSystemFont, sans-serif',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: '"JetBrains Mono", "SFMono-Regular", Consolas, monospace',
  }),
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const RADIUS = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
};
