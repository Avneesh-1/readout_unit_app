import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
// Direct require for APK compatibility - most reliable way
const BeaverLogo = require('../assets/images/beaver-logo.png');

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

interface SplashScreenProps {
  onFinish: () => void;
}

export default function AppSplashScreen({ onFinish }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[SplashScreen] Component mounted, starting animations');
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // Loading dots animation
    const createDotAnimation = (dotAnim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const dot1Animation = createDotAnimation(dot1Anim, 0);
    const dot2Animation = createDotAnimation(dot2Anim, 200);
    const dot3Animation = createDotAnimation(dot3Anim, 400);

    dot1Animation.start();
    dot2Animation.start();
    dot3Animation.start();

    // Show splash for 2 seconds, then hide
    const timer = setTimeout(async () => {
      console.log('[SplashScreen] Timer finished, hiding splash screen');
      dot1Animation.stop();
      dot2Animation.stop();
      dot3Animation.stop();
      try {
        await SplashScreen.hideAsync();
        console.log('[SplashScreen] Splash screen hidden, calling onFinish');
        onFinish();
      } catch (error) {
        console.error('[SplashScreen] Error hiding splash screen:', error);
        // Still call onFinish even if hiding fails
        onFinish();
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      dot1Animation.stop();
      dot2Animation.stop();
      dot3Animation.stop();
    };
  }, []);

  const dot1Opacity = dot1Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const dot2Opacity = dot2Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const dot3Opacity = dot3Anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Image
          source={BeaverLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.dot, { opacity: dot1Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot2Opacity }]} />
          <Animated.View style={[styles.dot, { opacity: dot3Opacity }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // Match logo background (white)
  },
  content: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logo: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
    position: 'absolute',
    bottom: 100,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#333',
    marginHorizontal: 4,
  },
});

