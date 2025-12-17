# Console Log Statements - Complete List

This document lists all `console.log`, `console.error`, `console.warn`, and `console.info` statements in the codebase.

## 📁 File-by-File Breakdown

### 1. **app/_layout.tsx** (1 statement)
- **Line 31**: `console.error('Error loading assets:', error);`

### 2. **components/SplashScreen.tsx** (4 statements)
- **Line 20**: `console.log('[SplashScreen] Component mounted, starting animations');`
- **Line 57**: `console.log('[SplashScreen] Timer finished, hiding splash screen');`
- **Line 63**: `console.log('[SplashScreen] Splash screen hidden, calling onFinish');`
- **Line 66**: `console.error('[SplashScreen] Error hiding splash screen:', error);`

### 3. **components/ErrorBoundary.tsx** (1 statement)
- **Line 33**: `console.error('ErrorBoundary caught an error:', error, errorInfo);`

### 4. **app/(tabs)/index.tsx** (28 statements)
- **Line 71**: `console.log('Sensor selected:', {...});`
- **Line 193**: `console.error('Error saving record:', error);`
- **Line 233**: `console.log('Raw devices before normalization:', JSON.stringify(localData.device, null, 2));`
- **Line 239**: `console.log('Device ${index} - Original deviceId:', deviceId, 'Type:', typeof deviceId);`
- **Line 256**: `console.error('CRITICAL: Device missing deviceId after normalization:', normalizedDevice);`
- **Line 260**: `console.log('Device ${index} - Normalized deviceId:', normalizedDevice.deviceId);`
- **Line 267**: `console.warn('Filtering out invalid device:', device);`
- **Line 274**: `console.log('No devices found, adding default device');`
- **Line 285**: `console.error('ERROR: Found invalid devices after normalization:', invalidDevices);`
- **Line 290**: `console.log('Normalized devices:', JSON.stringify(localData.device, null, 2));`
- **Line 291**: `console.log('Device validation check:', localData.device.every(...));`
- **Line 296**: `console.error('ERROR: Found devices with invalid deviceId:', devicesWithInvalidId);`
- **Line 304**: `console.error('Device at index ${i} is invalid:', device);`
- **Line 307**: `console.error('Device at index ${i} missing deviceId:', device);`
- **Line 334**: `console.log('Normalized device for API:', JSON.stringify(normalizedDevice, null, 2));`
- **Line 338**: `console.log('Sending data to API:', JSON.stringify(apiPayload, null, 2));`
- **Line 339**: `console.log('Data summary:', {...});`
- **Line 347**: `console.log('Data size:', jsonPayload.length, 'bytes');`
- **Line 348**: `console.log('Final JSON payload preview:', jsonPayload.substring(0, 500));`
- **Line 361**: `console.log('API Response Status:', response.status);`
- **Line 362**: `console.log('API Response Body:', responseText);`
- **Line 369**: `console.error('API Error Details:', errorData);`
- **Line 387**: `console.log('API Success Response:', result);`
- **Line 390**: `console.error('Error uploading to API:', error);`
- **Line 447**: `console.error('Error clearing data:', error);`
- **Line 501**: `console.log('Current sensor type:', currentSensor.sensor_type);`
- **Line 502**: `console.log('Current reading data:', currentReading);`
- **Line 532**: `console.log('Unknown sensor type, defaulting to Frequency');`

### 5. **app/(tabs)/settings.tsx** (1 statement)
- **Line 109**: `console.error('Error during factory reset:', error);`

### 6. **contexts/DataContext.tsx** (7 statements)
- **Line 141**: `console.error('Error loading sensors:', error);`
- **Line 161**: `console.error('Error saving sensor:', error);`
- **Line 210**: `console.error('Error inserting reading to Supabase:', supabaseError);`
- **Line 215**: `console.error('Error saving reading:', error);`
- **Line 261**: `console.error('Error uploading readings:', error);`
- **Line 264**: `console.error('Error uploading readings to Supabase:', supabaseError);`
- **Line 270**: `console.error('Error uploading readings:', error);`

### 7. **lib/supabase.ts** (1 statement)
- **Line 11**: `console.warn('Supabase environment variables are not set. Using dummy client.');`

### 8. **utils/imageAssets.ts** (1 statement)
- **Line 18**: `console.error('Error preloading images:', error);`

### 9. **services/localRecordService.ts** (9 statements)
- **Line 146**: `console.error('Error loading saved data:', error);`
- **Line 155**: `console.error('Error clearing saved data:', error);`
- **Line 170**: `console.log('=== STORED DATA DEBUG ===');`
- **Line 171**: `console.log('Device: ${data.device.length}');`
- **Line 172**: `console.log('Sensors: ${data.sensors.length}');`
- **Line 173**: `console.log('Readings: ${data.readings.length}');`
- **Line 174**: `console.log('Full data structure:', JSON.stringify(data, null, 2));`
- **Line 175**: `console.log('=== END DEBUG ===');`
- **Line 247**: `console.log('Saved record. Total readings: ${data.readings.length}');`
- **Line 248**: `console.log('Current stored data:', JSON.stringify(data, null, 2));`
- **Line 250**: `console.error('Error saving record:', error);`

### 10. **services/exportService.ts** (1 statement)
- **Line 40**: `console.log(...)` (incomplete in grep results)

### 11. **services/uartService.ts** (5 statements)
- **Line 14**: `console.warn("[UART] Native USB serial module not available - using fallback mode");`
- **Line 58**: `console.log("[UART] " + msg);`
- **Line 70**: `console.warn("[UART] Native module not available. Run 'npx expo run:android' to build with native code");`
- **Line 125**: `console.error(err);`
- **Line 146**: `console.error(err);`
- **Line 213**: `console.error(err);`

### 12. **services/storageService.ts** (10 statements)
- **Line 31**: `console.error('Error loading settings:', error);`
- **Line 40**: `console.error('Error saving settings:', error);`
- **Line 48**: `console.error('Error loading current sensor:', error);`
- **Line 57**: `console.error('Error saving current sensor:', error);`
- **Line 67**: `console.error('Error saving pending reading:', error);`
- **Line 76**: `console.error('Error loading pending readings:', error);`
- **Line 85**: `console.error('Error clearing pending readings:', error);`
- **Line 93**: `console.error('Error loading device ID:', error);`
- **Line 102**: `console.error('Error saving device ID:', error);`
- **Line 114**: `console.error('Error clearing storage:', error);`

---

## 📊 Summary Statistics

- **Total Files with Console Logs**: 12 files
- **Total Console Statements**: ~90 statements
- **console.log**: ~40 statements
- **console.error**: ~45 statements
- **console.warn**: ~5 statements

## 🎯 Categories

### Debug/Development Logs (Should be removed in production)
- Device normalization logs in `index.tsx` (lines 233, 239, 260, 290, 291, 334, 338, 339, 347, 348, 361, 362, 387)
- Sensor/reading debug logs (lines 501, 502, 532)
- Stored data debug logs in `localRecordService.ts` (lines 170-175, 247, 248)
- Splash screen lifecycle logs (lines 20, 57, 63)

### Error Logs (Should be kept but may want to use proper error tracking)
- All `console.error` statements for error handling
- ErrorBoundary error logging
- Service error logging

### Warning Logs (Should be kept)
- Supabase environment variable warning
- UART module availability warnings

---

## 🔧 Recommendations

1. **Remove debug logs** before production builds
2. **Replace console.error** with proper error tracking service (e.g., Sentry, Bugsnag)
3. **Keep warnings** for important runtime information
4. **Consider using a logging utility** that can be disabled in production

