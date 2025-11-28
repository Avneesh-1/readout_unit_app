# Building APK for Readout Android App

## Option 1: Using EAS Build (Cloud Build - Recommended)

### Prerequisites:
1. Expo account (free at https://expo.dev)
2. EAS CLI installed (already configured)

### Steps:

1. **Login to EAS** (run in terminal):
   ```bash
   npx eas-cli login
   ```
   Enter your Expo account credentials.

2. **Build APK for Preview/Testing**:
   ```bash
   npx eas-cli build --platform android --profile preview
   ```
   This will build an APK that you can download and install.

3. **Build APK for Production**:
   ```bash
   npx eas-cli build --platform android --profile production
   ```

4. **Download the APK**:
   - After build completes, you'll get a download link
   - Or visit https://expo.dev/accounts/[your-account]/projects/bolt-expo-nativewind/builds
   - Download the APK file

### Build Profiles:
- **preview**: For testing (APK format)
- **production**: For release (APK format)
- **development**: For development builds

---

## Option 2: Local Build (Using Gradle)

### Prerequisites:
1. Android Studio installed
2. Android SDK configured
3. Java JDK installed

### Steps:

1. **Navigate to Android folder**:
   ```bash
   cd android
   ```

2. **Build Debug APK** (for testing):
   ```bash
   .\gradlew assembleDebug
   ```
   APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

3. **Build Release APK** (for production):
   ```bash
   .\gradlew assembleRelease
   ```
   APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

   **Note**: Release builds require signing. You may need to configure signing in `android/app/build.gradle`

4. **Install APK on device**:
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## Option 3: Using Expo CLI (Simpler for Debug)

1. **Build and install directly**:
   ```bash
   npm run android
   ```
   This will build and install on connected device/emulator.

2. **Generate APK manually**:
   - After `npm run android` completes
   - APK is generated in `android/app/build/outputs/apk/debug/`

---

## Recommended Approach:

For **testing/development**: Use **Option 3** (`npm run android`)
For **distribution**: Use **Option 1** (EAS Build - preview profile)

---

## Troubleshooting:

- If build fails, check:
  - Android SDK is properly installed
  - Java JDK version is compatible
  - All dependencies are installed (`npm install`)
  - USB debugging is enabled on device (for direct install)

