# UART Serial Communication Implementation Guide

This guide provides technical details for implementing real serial COM port communication after ejecting from Expo.

**👉 For complete step-by-step ejection and setup instructions, see [EJECT_AND_RUN_GUIDE.md](./EJECT_AND_RUN_GUIDE.md)**

## Current Status

The app currently has:
- ✅ Complete UI with Fetch/Stop buttons
- ✅ UART service abstraction layer (`services/uartService.ts`)
- ✅ Mock data implementation for testing
- ✅ Data context integration
- ✅ Command structure: `{"Cmd":"Send"}` and `{"Cmd":"Stop"}`

## Commands Sent

### Fetch Button
```json
{"Cmd":"Send"}
```

### Stop Button
```json
{"Cmd":"Stop"}
```

## Steps to Add Real Serial Communication

### 1. Eject from Expo

```bash
cd your-project-directory
npx expo prebuild
```

This will create `ios/` and `android/` folders with native code.

### 2. Install Serial Port Library

For Android, install `react-native-serialport`:

```bash
npm install react-native-serialport
```

For iOS, you may need to create a custom native module or use Bluetooth alternatives.

### 3. Update `uartService.ts`

Replace the placeholder implementation in `services/uartService.ts`:

```typescript
import { Platform, NativeModules } from 'react-native';
import type { UARTData, UARTCommand } from '../types/database';

// Import your serial port library
// Example for Android:
// import { RNSerialport } from 'react-native-serialport';

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
      // REPLACE THIS SECTION WITH YOUR SERIAL PORT INITIALIZATION
      // Example for Android:
      // const devices = await RNSerialport.getDeviceList();
      // if (devices.length === 0) {
      //   throw new Error('No serial devices found');
      // }
      //
      // this.serialPort = await RNSerialport.connect(devices[0].name, {
      //   baudRate: 9600,
      //   dataBits: 8,
      //   stopBits: 1,
      //   parity: 0,
      // });

      this.isConnected = true;
      this.startDataListener();
      return true;
    } catch (error) {
      console.error('UART connection error:', error);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.isFetching = false;

    if (this.serialPort) {
      // REPLACE WITH YOUR SERIAL PORT CLOSE METHOD
      // Example: await this.serialPort.close();
      this.serialPort = null;
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

      // REPLACE THIS WITH YOUR SERIAL WRITE METHOD
      // Example:
      // const buffer = Buffer.from(commandStr + '\n');
      // await this.serialPort.write(buffer);

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

    // REPLACE THIS WITH YOUR SERIAL DATA LISTENER
    // Example:
    // this.serialPort.on('data', (data: Buffer) => {
    //   try {
    //     const jsonStr = data.toString('utf-8');
    //     const parsedData: UARTData = JSON.parse(jsonStr);
    //     this.notifyListeners(parsedData);
    //   } catch (error) {
    //     console.error('Error parsing UART data:', error);
    //   }
    // });
  }

  onDataReceived(callback: (data: UARTData) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(data: UARTData) {
    this.listeners.forEach((callback) => callback(data));
  }

  private startMockData() {
    if (Platform.OS !== 'web') return;

    setInterval(() => {
      if (this.isFetching) {
        const mockData: UARTData = {
          Freq: 1200 + Math.random() * 200,
          Temp: 25 + Math.random() * 5,
          Bat: 85 + Math.floor(Math.random() * 15),
        };
        this.notifyListeners(mockData);
      }
    }, 2000);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getFetchingStatus(): boolean {
    return this.isFetching;
  }
}

export const uartService = new UARTService();
```

### 4. Expected Data Format

The UART service expects to receive JSON data in this format:

```typescript
interface UARTData {
  Freq: number;   // Frequency in Hz
  Temp: number;   // Temperature in Celsius
  Bat: number;    // Battery percentage (0-100)
}
```

Example:
```json
{"Freq":1234.56,"Temp":25.3,"Bat":95}
```

### 5. Android Permissions

Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.USB_PERMISSION" />
<uses-feature android:name="android.hardware.usb.host" />
```

### 6. iOS Considerations

iOS doesn't have direct serial port access. You may need to:
- Use Bluetooth Low Energy (BLE) instead
- Use the External Accessory framework for MFi-certified devices
- Use a WiFi-to-Serial bridge

### 7. Testing

After implementing the serial communication:

1. Connect your serial device
2. Run the app: `npx expo run:android` or `npx expo run:ios`
3. Select a sensor from the dashboard
4. Press "Fetch" - should send `{"Cmd":"Send"}`
5. Verify data is received and displayed
6. Press "Stop" - should send `{"Cmd":"Stop"}`

## Troubleshooting

### No Serial Devices Found
- Check USB/Serial cable connection
- Verify device permissions in Android settings
- Check if the device requires specific drivers

### Data Not Received
- Verify baud rate matches your device (default: 9600)
- Check data format matches expected JSON structure
- Add logging to see raw data received

### Connection Drops
- Add reconnection logic in the service
- Implement timeout handling
- Check for proper device cleanup on disconnect

## Alternative: Bluetooth Implementation

If you prefer Bluetooth over USB serial:

```bash
npm install react-native-ble-plx
```

Update the service to use BLE instead of serial port. The same command structure applies.

## Support

The current implementation is fully functional with mock data. When you replace the mock sections with real serial communication, the rest of the app will work seamlessly.
