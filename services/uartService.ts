import { Platform, ToastAndroid } from "react-native";

// Conditionally import native module - may not be available in Expo Go
let UsbSerialManager: any = null;
let Parity: any = null;
let UsbSerial: any = null;

try {
  const usbSerialModule = require("react-native-usb-serialport-for-android");
  UsbSerialManager = usbSerialModule.UsbSerialManager;
  Parity = usbSerialModule.Parity;
  UsbSerial = usbSerialModule.UsbSerial;
} catch (error) {
  console.warn("[UART] Native USB serial module not available - using fallback mode");
}

export interface UARTData {
  Freq: number;
  Temp: number;
  Volt: number;
  Curr: number;
  load: number;
}
function asciiToHex(str: string): string {
  return Array.from(str)
    .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}



class UARTService {
  private usbSerial: UsbSerial | null = null;
  private usbSubscription: { remove: () => void } | null = null;

  private isConnected = false;
  private isFetching = false;
  private dataBuffer = "";

  private listeners: Array<(data: UARTData) => void> = [];

  private connectionListeners: Array<(status: boolean) => void> = [];

  onConnectionChange(cb: (status: boolean) => void) {
  this.connectionListeners.push(cb);
  return () => {
    this.connectionListeners = this.connectionListeners.filter(fn => fn !== cb);
  };
  }

private notifyConnection() {
  this.connectionListeners.forEach(cb => cb(this.isConnected));
}
  

  /* ===================== TOAST ===================== */
  private toast(msg: string) {
    console.log("[UART] " + msg);
    if (Platform.OS === "android") {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    }

    
  }

  /* ===================== CONNECT USB ONLY ===================== */
  async connectUSB() {
    if (!UsbSerialManager) {
      this.toast("USB Serial not available - requires native build");
      console.warn("[UART] Native module not available. Run 'npx expo run:android' to build with native code");
      return false;
    }
    
    try {
      const devices = await UsbSerialManager.list();
      if (!devices || devices.length === 0) {
        this.toast("No USB device found");
        return false;
      }

      const id = devices[0].deviceId;
      this.toast("Connecting to USB ID → " + id);



      let hasPermission = await UsbSerialManager.hasPermission(id);

      if (!hasPermission) {
        // this.toast("Requesting USB Permission…");

        await UsbSerialManager.tryRequestPermission(id);

        // this.toast("Waiting for Permission…");

        // WAIT FOR ANDROID POPUP RESPONSE
        await new Promise((res) => setTimeout(res, 1000));

        hasPermission = await UsbSerialManager.hasPermission(id);

        if (!hasPermission) {
          this.toast("❌ Permission still NOT granted");
          return false;
        }

        // this.toast("Permission Granted");
      }

      // this.toast("Opening Serial Port…");

      this.usbSerial = await UsbSerialManager.open(id, {
        baudRate: 2400,
        dataBits: 8,
        stopBits: 1,
        parity: Parity?.None ?? 0,
      });

      this.isConnected = true;
      this.notifyConnection();
      this.toast("USB CONNECTED");
      this.startReceiveListener();

      return true;
    } catch (err) {
      this.toast("USB Connect ERROR");
      console.error(err);
      return false;
    }
  }

  /* ===================== DISCONNECT USB ONLY ===================== */
  async disconnect() {
    try {
      this.toast("Disconnecting…");

      this.usbSubscription?.remove();
      this.usbSubscription = null;

      await this.usbSerial?.close();
      this.usbSerial = null;

      this.isConnected = false;
      this.notifyConnection();
      this.toast("USB DISCONNECTED");
    } catch (err) {
      this.toast("Disconnect ERROR");
      console.error(err);
    }
  }

  /* ===================== SEND COMMAND ONLY ===================== */
  // async sendCommand(command: { Cmd: string }) {
  //   if (!this.isConnected || !this.usbSerial) {
  //     this.toast("Not connected! Press Connect USB first.");
  //     return false;
  //   }

  //   try {
  //     const text = JSON.stringify(command);
  //     this.toast("Sending Command → " + text);

  //     await this.usbSerial.send(text);

  //     if (command.Cmd === "Send") {
  //       this.isFetching = true;
  //       this.toast("FETCH STARTED");
  //     } else if (command.Cmd === "Stop") {
  //       this.isFetching = false;
  //       this.toast("FETCH STOPPED");
  //     }

  //     return true;
  //   } catch (err) {
  //     this.toast("SEND ERROR");
  //     console.error(err);
  //     return false;
  //   }
  // }
async sendCommand(command: { Cmd: string }) {
  if (!UsbSerialManager || !this.usbSerial) {
    this.toast("USB not connected or module unavailable");
    return false;
  }

  try {
    let ascii = "";

    if (command.Cmd === "Send") ascii = "{\"Cmd\":\"Send\"}\r\n";
    if (command.Cmd === "Stop") ascii = "{\"Cmd\":\"Stop\"}\r\n";
    if (!ascii) ascii = command.Cmd;

    // this.toast("TX ASCII → " + ascii);

    // Convert ASCII → HEX because send() expects hex
    const hex = asciiToHex(ascii);

    // this.toast("TX HEX → " + hex);

    await this.usbSerial.send(hex);

    if (command.Cmd === "Send") {
      this.isFetching = true;
      // this.toast("FETCH STARTED");
    }
    if (command.Cmd === "Stop") {
      this.isFetching = false;
      // this.toast("FETCH STOPPED");
    }

    return true;

  } catch (err) {
    this.toast("SEND ERROR");
    console.error(err);
    return false;
  }
}


  /* ===================== RECEIVE UART DATA ===================== */
  // private startReceiveListener() {
  //   if (!this.usbSerial) return;

  //   this.toast("RX Listener Added");

  //   this.usbSubscription = this.usbSerial.onReceived((event) => {
  //     try {
  //       const chunk = event.data;
  //       this.toast("RX → " + chunk);

  //       this.dataBuffer += chunk;

  //       const parts = this.dataBuffer.split(/\r?\n/);
  //       this.dataBuffer = parts.pop() || "";

  //       parts.forEach((line) => {
  //         const clean = line.trim();
  //         if (clean) this.processLine(clean);
  //       });
  //     } catch (err) {
  //       this.toast("RX ERROR");
  //     }
  //   });
  // }

  // /* ===================== PARSE JSON ===================== */
  // private processLine(line: string) {
  //   try {
  //     const obj = JSON.parse(line);
  //     if (this.isFetching) {
  //       this.toast(`Parsed → F=${obj.Freq} T=${obj.Temp}`);
  //       this.listeners.forEach((cb) => cb(obj));
  //     }
  //   } catch {
  //     this.toast("JSON ERROR");
  //   }
  // }

  /* ===================== LISTENER ===================== */
  onDataReceived(cb: (d: UARTData) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((x) => x !== cb);
    };
  }

  private hexToAscii(hex: string): string {
  let result = "";
  for (let i = 0; i < hex.length; i += 2) {
    const byte = hex.substr(i, 2);
    const code = parseInt(byte, 16);
    if (!isNaN(code)) result += String.fromCharCode(code);
  }
  return result;
}
private startReceiveListener() {
  if (!this.usbSerial) return;

  // this.toast("RX Listener Added");

  this.usbSubscription = this.usbSerial.onReceived((event) => {
    try {
      const hexChunk = event.data;           // incoming HEX string
      // this.toast("RX HEX → " + hexChunk);

      const ascii = this.hexToAscii(hexChunk); // convert HEX → ASCII
      // this.toast("RX ASCII → " + ascii);

      this.dataBuffer += ascii;

      const parts = this.dataBuffer.split(/\r?\n/);
      this.dataBuffer = parts.pop() || "";

      parts.forEach((line) => {
        const clean = line.trim();
        if (clean) this.processLine(clean);
      });
    } catch (err) {
      this.toast("RX ERROR");
    }
  });
}
private processLine(line: string) {
  try {
    const obj = JSON.parse(line);

    // Apply frame division rules:
    // Freq -> No division (actual value)
    // Temp -> Divide by 10 (238 means 23.8°C)
    // Volt -> Divide by 100 (331 means 3.31V)
    // Curr -> Divide by 100 (948 means 9.48A)
    // load -> No division (actual value without tare)
    const data = {
      Freq: obj.Freq,
      Temp: obj.Temp / 10,
      Volt: obj.Volt / 100,
      Curr: obj.Curr / 100,
      load: obj.load,
    };

    // this.toast(
    //   `Parsed → F=${data.Freq}  T=${data.Temp}  V=${data.Volt}  C=${data.Curr}  L=${data.load}`
    // );

    if (this.isFetching) {
      this.listeners.forEach((cb) => cb(data));
    }
  } catch (err) {
    this.toast("JSON ERROR → " + line);
  }
}


  isUSBConnected() {
    return this.isConnected;
  }
}

export const uartService = new UARTService();
