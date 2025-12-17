import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Asset } from 'expo-asset';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { DataProvider } from '../contexts/DataContext';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import AppSplashScreen from '../components/SplashScreen';

function StatusBarWrapper() {
  const { theme } = useTheme();
  // For light theme, use dark content (dark text/icons)
  // For dark theme, use light content (light text/icons)
  return <StatusBar style={theme === 'light' ? 'dark' : 'light'} />;
}

export default function RootLayout() {
  useFrameworkReady();
  const [isSplashReady, setIsSplashReady] = useState(false);
  const [assetsLoaded, setAssetsLoaded] = useState(false);

  useEffect(() => {
    // Preload images to ensure they're bundled
    const loadAssets = async () => {
      try {
        const { preloadImages } = await import('../utils/imageAssets');
        await preloadImages();
        setAssetsLoaded(true);
      } catch (error) {
        console.error('Error loading assets:', error);
        setAssetsLoaded(true); // Continue even if asset loading fails
      }
    };
    loadAssets();
  }, []);

  if (!isSplashReady || !assetsLoaded) {
    return <AppSplashScreen onFinish={() => setIsSplashReady(true)} />;
  }

  return (
    <ErrorBoundary>
    <ThemeProvider>
      <DataProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="+not-found" />
        </Stack>
          <StatusBarWrapper />
      </DataProvider>
    </ThemeProvider>
    </ErrorBoundary>
  );
}
