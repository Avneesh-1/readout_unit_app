import { Asset } from 'expo-asset';

// Use static require at top-level (NOT inside a function) - most reliable way
// Assets are in root assets/images/ for Expo compatibility
export const BeaverLogo = require('../assets/images/beaver-logo.png');
export const Icon = require('../assets/images/icon.png');
export const Favicon = require('../assets/images/favicon.png');

// Preload all images at app startup to ensure they're bundled
export const preloadImages = async () => {
  try {
    await Asset.loadAsync([
      BeaverLogo,
      Icon,
      Favicon,
    ]);
  } catch (error) {
    console.error('Error preloading images:', error);
  }
};

