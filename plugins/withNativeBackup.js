const { withAndroidManifest, withInfoPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * BiteNote 吃一口 — 原生備份自動配置外掛 (iOS iCloud Backup & Android Google Drive Auto Backup)
 * 1. iOS: 啟用 NSDocumentDirectory 參與 iCloud 自動備份與檔案共享檢視
 * 2. Android: 啟用 allowBackup、掛載 backup_rules.xml 與 data_extraction_rules.xml
 */
const withNativeBackup = (config) => {
  // 1. iOS Info.plist 配置 iCloud Documents 與相簿/相機繁體中文說明
  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.UIFileSharingEnabled = true;
    modConfig.modResults.LSSupportsOpeningDocumentsInPlace = true;
    modConfig.modResults.NSPhotoLibraryUsageDescription =
      '「BiteNote 吃一口」需要讀取您的相簿，讓您挑選並記錄每一次品嚐的美食照片。';
    modConfig.modResults.NSPhotoLibraryAddUsageDescription =
      '「BiteNote 吃一口」需要儲存照片至您的相簿，以便透過 iCloud 自動備份您的美食照片。';
    modConfig.modResults.NSCameraUsageDescription =
      '「BiteNote 吃一口」需要使用相機，讓您隨手拍下眼前的料理並寫進手帳。';
    modConfig.modResults.NSLocationWhenInUseUsageDescription =
      '「BiteNote 吃一口」需要取得您的位置，以便快速連結附近的餐廳與私房小店。';
    return modConfig;
  });

  // 2. Android AndroidManifest.xml 啟用 Google Drive Auto Backup
  config = withAndroidManifest(config, (modConfig) => {
    const mainApp = modConfig.modResults.manifest.application?.[0];
    if (mainApp && mainApp.$) {
      mainApp.$['android:allowBackup'] = 'true';
      mainApp.$['android:fullBackupOnly'] = 'true';
      mainApp.$['android:fullBackupContent'] = '@xml/backup_rules';
      mainApp.$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    }
    return modConfig;
  });

  // 3. 複製 backup_rules.xml 與 data_extraction_rules.xml 到 Android res/xml
  config = withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const projectRoot = modConfig.modRequest.projectRoot;
      const resXmlDir = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      fs.mkdirSync(resXmlDir, { recursive: true });

      const filesToCopy = ['backup_rules.xml', 'data_extraction_rules.xml'];
      for (const fileName of filesToCopy) {
        const src = path.join(projectRoot, 'config', 'android', fileName);
        const dest = path.join(resXmlDir, fileName);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
      return modConfig;
    },
  ]);

  return config;
};

module.exports = withNativeBackup;
