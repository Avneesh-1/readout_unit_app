# Step-by-Step Guide: Eject and Run the Application

This guide will walk you through ejecting from Expo and running your app with native code for UART/Serial communication.

## Prerequisites

Before you begin, make sure you have:

### For All Platforms:
- **Node.js** (v18 or newer) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **VS Code or Cursor** - [VS Code](https://code.visualstudio.com/) or [Cursor](https://cursor.sh/)

### For Android Development:
- **Android Studio** - [Download here](https://developer.android.com/studio)
- **Java Development Kit (JDK)** - Android Studio includes this
- **Android SDK** (installed via Android Studio)
- **USB Debugging enabled** on your Android device

### For iOS Development (macOS only):
- **macOS** computer (required for iOS development)
- **Xcode** - [Download from Mac App Store](https://apps.apple.com/us/app/xcode/id497799835)
- **CocoaPods** - Install via: `sudo gem install cocoapods`

---

## Step 1: Export Your Project from Bolt

1. **Download the project** from Bolt to your local machine
   - Click the download/export button in Bolt
   - Extract the ZIP file to a folder (e.g., `~/projects/readout-unit-app`)

2. **Open Terminal/Command Prompt** and navigate to your project:
   ```bash
   cd ~/projects/readout-unit-app
   # Or wherever you extracted the project
   ```

3. **Install dependencies:**
   ```bash
   npm install
   ```

---

## Step 2: Eject from Expo (Prebuild)

Expo's modern approach uses "prebuild" which generates native code when needed.

1. **Run the prebuild command:**
   ```bash
   npx expo prebuild
   ```

2. **You'll be asked some questions:**
   - Select platform: Choose **both** (iOS and Android) or just **Android** if on Windows/Linux
   - Package name: Keep the default or customize (e.g., `com.yourcompany.readoutunit`)
   - App name: Keep "bolt-expo-starter" or change it

3. **Wait for completion** - This will:
   - Create `android/` folder with native Android code
   - Create `ios/` folder with native iOS code (if on macOS)
   - Configure native dependencies

---

## Step 3: Set Up Android Studio (For Android)

### Install Android Studio:

1. **Download and install** [Android Studio](https://developer.android.com/studio)

2. **Open Android Studio** and complete the setup wizard:
   - Install Android SDK
   - Install Android SDK Platform
   - Install Android Virtual Device (for emulator)

3. **Configure environment variables:**

   **On macOS/Linux**, add to `~/.zshrc` or `~/.bashrc`:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

   **On Windows**, add these environment variables:
   - `ANDROID_HOME`: `C:\Users\YourUsername\AppData\Local\Android\Sdk`
   - Add to PATH: `%ANDROID_HOME%\platform-tools` and `%ANDROID_HOME%\emulator`

4. **Restart your terminal** to apply changes

### Open the Android Project:

1. Open Android Studio
2. Click "Open an Existing Project"
3. Navigate to your project's `android/` folder
4. Click "Open"
5. Wait for Gradle sync to complete

---

## Step 4: Install Serial Port Library

Now you'll add the native serial port functionality:

1. **Install react-native-serialport:**
   ```bash
   npm install react-native-serialport
   ```

2. **Link the native module** (if not auto-linked):
   ```bash
   cd android
   ./gradlew clean
   cd ..
   ```

3. **Add USB permissions** to `android/app/src/main/AndroidManifest.xml`:

   Open the file and add these lines inside the `<manifest>` tag (before `<application>`):
   ```xml
   <uses-permission android:name="android.permission.USB_PERMISSION" />
   <uses-feature android:name="android.hardware.usb.host" />
   ```

---

## Step 5: Update the UART Service

Open `services/uartService.ts` in your code editor and replace the connect, disconnect, sendCommand, and startDataListener methods with real serial implementation.

**Example implementation for Android:**

```typescript
import { Platform, NativeModules, NativeEventEmitter } from 'react-native';
import RNSerialport, { definitions } from 'react-native-serialport';
import type { UARTData, UARTCommand } from '../types/database';

class UARTService {
  private isConnected: boolean = false;
  private isFetching: boolean = false;
  private listeners: Array<(data: UARTData) => void> = [];
  private serialPort: any = null;

  async connect(): Promise<boolean> {
    if (Platform.OS === 'web') {
      console.warn('UART not available on web platform - using mock data');
      this.startMockData();
      this.isConnected = true;
      return true;
    }

    try {
      // Get list of connected USB devices
      const devices = await RNSerialport.getDeviceList();

      if (devices.length === 0) {
        console.error('No USB devices found');
        return false;
      }

      console.log('Found devices:', devices);

      // Connect to the first device
      const device = devices[0];
      await RNSerialport.connectDevice(device.name, 9600); // 9600 baud rate

      this.isConnected = true;
      this.startDataListener();

      console.log('Connected to serial device:', device.name);
      return true;
    } catch (error) {
      console.error('UART connection error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.isFetching = false;

    if (Platform.OS !== 'web' && this.serialPort) {
      try {
        await RNSerialport.disconnect();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
  }

  async sendCommand(command: UARTCommand): Promise<boolean> {
    if (!this.isConnected) {
      console.warn('UART not connected');
      return false;
    }

    try {
      const commandStr = JSON.stringify(command);
      console.log('Sending UART command:', commandStr);

      if (Platform.OS !== 'web') {
        // Send command as hex string
        const buffer = Buffer.from(commandStr + '\n');
        const hexString = buffer.toString('hex');
        await RNSerialport.writeString(hexString);
      }

      if (command.Cmd === 'Send') {
        this.isFetching = true;
      } else if (command.Cmd === 'Stop') {
        this.isFetching = false;
      }

      return true;
    } catch (error) {
      console.error('UART send error:', error);
      return false;
    }
  }

  private startDataListener() {
    if (Platform.OS === 'web') return;

    const eventEmitter = new NativeEventEmitter(NativeModules.RNSerialport);

    eventEmitter.addListener('onReadData', (data) => {
      try {
        // Convert hex data to string
        const buffer = Buffer.from(data.payload, 'hex');
        const jsonStr = buffer.toString('utf-8');

        // Parse JSON
        const parsedData: UARTData = JSON.parse(jsonStr);
        this.notifyListeners(parsedData);
      } catch (error) {
        console.error('Error parsing UART data:', error);
      }
    });

    eventEmitter.addListener('onError', (error) => {
      console.error('Serial port error:', error);
    });
  }

  // ... rest of the methods remain the same
}
```

**Note:** The exact implementation may vary based on your serial device's protocol. Adjust baud rate, parsing logic, and data format as needed.

---

## Step 6: Run on Android Device

### Option A: Physical Android Device

1. **Enable Developer Options** on your Android phone:
   - Go to Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > Developer Options
   - Enable "USB Debugging"

2. **Connect your phone** via USB cable

3. **Verify connection:**
   ```bash
   adb devices
   ```
   You should see your device listed

4. **Run the app:**
   ```bash
   npx expo run:android
   ```

5. **Connect your serial device:**
   - Use a USB OTG adapter to connect your serial device to your Android phone
   - The app should detect it automatically

### Option B: Android Emulator (Limited - won't have USB access)

```bash
# Start emulator from Android Studio, then:
npx expo run:android
```

**Note:** Emulators don't support USB serial devices, so you'll only see mock data.

---

## Step 7: Run on iOS (macOS only)

1. **Navigate to iOS folder and install pods:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

2. **Run on iOS:**
   ```bash
   npx expo run:ios
   ```

3. **Or open in Xcode:**
   - Open `ios/YourAppName.xcworkspace` in Xcode (NOT .xcodeproj)
   - Select your device or simulator
   - Click the Play button

**Note:** iOS doesn't support USB serial directly. You'll need to:
- Use Bluetooth Low Energy instead
- Use MFi-certified accessories with External Accessory framework
- Or use mock data for testing

---

## Step 8: Testing the UART Connection

1. **Launch the app** on your device

2. **Check connection status:**
   - You should see "Connected" in the status bar if UART is detected
   - Or "Disconnected" if no device is found

3. **Select a sensor:**
   - Tap "Tap to select" to choose a sensor
   - Or go to "Add Sensor" tab to create one

4. **Test commands:**
   - Press **Fetch** - Should send `{"Cmd":"Send"}` to your serial device
   - Watch for incoming data to appear (Frequency, Temperature, Battery)
   - Press **Stop** - Should send `{"Cmd":"Stop"}` to your serial device

5. **Check logs:**
   ```bash
   # Android logs:
   npx react-native log-android

   # iOS logs:
   npx react-native log-ios
   ```

---

## Troubleshooting

### "No USB devices found"
- Check USB cable connection
- Verify USB OTG adapter works
- Check if device requires specific drivers
- Try different USB ports

### Build Errors
```bash
# Clean and rebuild:
cd android
./gradlew clean
cd ..
npx expo run:android
```

### Metro Bundler Issues
```bash
# Clear cache:
npx expo start -c
```

### "Unable to connect to serial device"
- Check baud rate matches your device (default: 9600)
- Verify your device sends data in the expected JSON format
- Check device permissions in Android settings
- Try unplugging and replugging the serial device

### App Crashes on Startup
- Check LogCat in Android Studio for detailed error messages
- Ensure all native dependencies are properly linked
- Verify AndroidManifest.xml has correct permissions

---

## Next Steps

Once you have the app running with serial communication:

1. **Calibrate your sensors** (Calibration tab)
2. **Test data collection** (Fetch button)
3. **Upload to cloud** when online (Push to Cloud button)
4. **Customize settings** (Settings tab)

---

## Development Tips

### Fast Refresh
- Most code changes will hot-reload automatically
- If something doesn't update, shake device and press "Reload"

### Debugging
```bash
# Open React DevTools:
npx react-devtools
```

### Building Release APK
```bash
cd android
./gradlew assembleRelease
# APK will be in: android/app/build/outputs/apk/release/
```

---

## Support Resources

- **Expo Documentation:** https://docs.expo.dev/
- **React Native Serialport:** https://github.com/kongmingyang/react-native-serialport
- **React Native Docs:** https://reactnative.dev/docs/getting-started
- **Android USB Docs:** https://developer.android.com/guide/topics/connectivity/usb

---

## Summary

You've now:
✅ Ejected from Expo managed workflow
✅ Set up native Android/iOS development environment
✅ Installed serial port library
✅ Updated UART service with real implementation
✅ Built and run the app on a physical device
✅ Tested serial communication

The app is now ready for real-world use with serial COM port devices!
