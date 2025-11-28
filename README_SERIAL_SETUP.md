# Serial COM Port Setup - Quick Reference

This app is currently running in Expo managed workflow with **mock UART data**. To enable real serial COM port communication, you need to eject from Expo and add native modules.

## 📚 Documentation

| Guide | Purpose |
|-------|---------|
| **[EJECT_AND_RUN_GUIDE.md](./EJECT_AND_RUN_GUIDE.md)** | Complete step-by-step instructions for ejecting from Expo and setting up your development environment |
| **[UART_IMPLEMENTATION_GUIDE.md](./UART_IMPLEMENTATION_GUIDE.md)** | Technical details for implementing the serial communication code |

## 🚀 Quick Start

### Currently (In Bolt):
- ✅ Fetch button sends `{"Cmd":"Send"}` command (mock)
- ✅ Stop button sends `{"Cmd":"Stop"}` command (mock)
- ✅ App displays mock data from UART
- ✅ All UI and functionality working

### To Add Real Serial Communication:

1. **Export project** from Bolt to your local machine
2. **Follow [EJECT_AND_RUN_GUIDE.md](./EJECT_AND_RUN_GUIDE.md)** - Complete walkthrough including:
   - Prerequisites installation
   - Ejecting from Expo
   - Setting up Android Studio / Xcode
   - Installing serial port library
   - Running on device

3. **Update `services/uartService.ts`** with real serial code (examples provided in guides)

4. **Test with your serial device**

## 🎯 What Works Now

The app is **fully functional** with mock data:
- Dashboard with sensor readings
- Fetch/Stop buttons working
- Sensor management and calibration
- Cloud sync when online
- Settings and themes

## 🔧 What Needs Implementation

After ejecting, you'll implement in `services/uartService.ts`:
- Serial port connection (replaces mock)
- Sending commands to COM port
- Receiving and parsing data from COM port

## 📱 Platform Support

| Platform | Serial Support | Status |
|----------|---------------|--------|
| **Web** | Mock data only | ✅ Working |
| **Android** | USB Serial via OTG | 🟡 Requires ejecting |
| **iOS** | Bluetooth/MFi only | 🟡 Requires ejecting |

## 💡 Need Help?

1. Start with **[EJECT_AND_RUN_GUIDE.md](./EJECT_AND_RUN_GUIDE.md)** for the complete process
2. Check **[UART_IMPLEMENTATION_GUIDE.md](./UART_IMPLEMENTATION_GUIDE.md)** for technical details
3. Both guides include troubleshooting sections

## 📦 Current Package Structure

```
project/
├── services/
│   └── uartService.ts          # UART abstraction (ready for implementation)
├── contexts/
│   └── DataContext.tsx         # Integrates UART with app state
├── app/(tabs)/
│   └── index.tsx              # Dashboard with Fetch/Stop buttons
├── EJECT_AND_RUN_GUIDE.md     # 👈 START HERE
├── UART_IMPLEMENTATION_GUIDE.md
└── README_SERIAL_SETUP.md     # This file
```

## 🎬 Next Steps

**Ready to enable real serial communication?**

→ Open **[EJECT_AND_RUN_GUIDE.md](./EJECT_AND_RUN_GUIDE.md)** and follow step-by-step!

---

*The architecture is already in place. You just need to eject and connect the hardware layer.*
