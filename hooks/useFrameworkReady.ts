import { useEffect } from 'react';
import { Platform } from 'react-native';

declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export function useFrameworkReady() {
  useEffect(() => {
    // Only call on web platform
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.frameworkReady?.();
    }
  });
}
