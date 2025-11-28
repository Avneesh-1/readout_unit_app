import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalculationService } from './calculationService';

const STORAGE_KEY = '@saved_records_v2';

// Helper function to normalize timestamps to ISO format
function normalizeTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) {
    return CalculationService.formatTimestamp(new Date());
  }

  // If this looks like the legacy local format "YYYY-MM-DD HH:mm:ss"
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(timestamp)) {
    const date = new Date(timestamp.replace(' ', 'T'));
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  try {
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch (e) {
    // fall through to default
  }

  return CalculationService.formatTimestamp(new Date());
}

export interface DeviceInfo {
  deviceId: string | null;
  deviceName: string;
  location: string;
}

export interface SensorInfo {
  sensorId: string;
  sensorType?: string;
  group?: string;
  initial_temperature?: number | null;
  initialReading?: number | null;
  unit?: string;
  gauge_factor?: number | null;
  remarks?: string;
  created_at?: string;
}

export interface ReadingInfo {
  sensorId: string;
  value?: number | null;
  temperature?: number | null;
  reading_digit?: number | null;
  final_load?: string | null;
  timestamp: string;
}

export interface SavedData {
  devices: DeviceInfo[];
  sensors: SensorInfo[];
  readings: ReadingInfo[];
}

export interface SaveRecordPayload {
  device?: DeviceInfo;
  sensor?: SensorInfo;
  reading?: ReadingInfo;
}

const defaultData: SavedData = {
  devices: [],
  sensors: [],
  readings: [],
};

class LocalRecordService {
  private async persist(data: SavedData) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  async getData(): Promise<SavedData> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (!data) {
        return { ...defaultData };
      }

      const parsed = JSON.parse(data);

      // Migrate old structure (device singular) to new structure (devices array)
      if (parsed.device && !parsed.devices) {
        parsed.devices = [parsed.device];
        delete parsed.device;
      }

      // Ensure devices array exists
      if (!parsed.devices) {
        parsed.devices = [];
      }

      // Migrate schema changes:
      // 1. Remove created_at from devices
      if (parsed.devices && Array.isArray(parsed.devices)) {
        parsed.devices = parsed.devices.map((device: any) => {
          const { created_at, ...rest } = device;
          return rest;
        });
      }

      // 2. Rename date_of_installation to created_at in sensors and ensure ISO format
      if (parsed.sensors && Array.isArray(parsed.sensors)) {
        parsed.sensors = parsed.sensors.map((sensor: any) => {
          if (sensor.date_of_installation !== undefined) {
            sensor.created_at = normalizeTimestamp(sensor.date_of_installation);
            delete sensor.date_of_installation;
          } else if (sensor.created_at) {
            sensor.created_at = normalizeTimestamp(sensor.created_at);
          }
          return sensor;
        });
      }

      // 3. Ensure readings have ISO timestamps and final_load as string/null
      if (parsed.readings && Array.isArray(parsed.readings)) {
        parsed.readings = parsed.readings.map((reading: any) => ({
          ...reading,
          timestamp: normalizeTimestamp(reading.timestamp),
          final_load:
            reading.final_load !== undefined && reading.final_load !== null
              ? String(reading.final_load)
              : null,
        }));
      }

      // Save migrated data if any changes were made
      await this.persist(parsed);

      return parsed;
    } catch (error) {
      console.error('Error loading saved data:', error);
      return { ...defaultData };
    }
  }

  async clearData(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing saved data:', error);
    }
  }

  async getRecordCounts(): Promise<{ devices: number; sensors: number; readings: number }> {
    const data = await this.getData();
    return {
      devices: data.devices.length,
      sensors: data.sensors.length,
      readings: data.readings.length,
    };
  }

  async debugLogAllData(): Promise<void> {
    const data = await this.getData();
    console.log('=== STORED DATA DEBUG ===');
    console.log(`Devices: ${data.devices.length}`);
    console.log(`Sensors: ${data.sensors.length}`);
    console.log(`Readings: ${data.readings.length}`);
    console.log('Full data structure:', JSON.stringify(data, null, 2));
    console.log('=== END DEBUG ===');
  }

  async saveRecord(payload: SaveRecordPayload): Promise<void> {
    try {
      const data = await this.getData();

      // Add device entry (append to track history)
      if (payload.device) {
        // Remove created_at from device (no longer stored in devices)
        const { created_at, ...deviceWithoutCreatedAt } = payload.device;
        const normalizedDevice = deviceWithoutCreatedAt;
        
        // Check if this exact device entry already exists (same deviceId and location)
        const existingDeviceIndex = data.devices.findIndex(
          (d) =>
            d.deviceId === normalizedDevice.deviceId &&
            d.location === normalizedDevice.location
        );

        if (existingDeviceIndex < 0) {
          // Add new device entry to track history
          data.devices.push(normalizedDevice);
        }
      }

      // Add or update sensor (don't overwrite, merge)
      if (payload.sensor) {
        // Normalize created_at timestamp to local format (renamed from date_of_installation)
        const normalizedSensor = {
          ...payload.sensor,
          created_at: payload.sensor.created_at
            ? normalizeTimestamp(payload.sensor.created_at)
            : CalculationService.formatTimestamp(new Date()),
        };
        
        // Remove date_of_installation if it exists (old field name)
        if ('date_of_installation' in normalizedSensor) {
          delete (normalizedSensor as any).date_of_installation;
        }
        
        const index = data.sensors.findIndex(
          (sensor) => sensor.sensorId === normalizedSensor.sensorId
        );

        if (index >= 0) {
          // Merge sensor info, keeping existing data
          data.sensors[index] = {
            ...data.sensors[index],
            ...normalizedSensor,
          };
        } else {
          // Add new sensor
          data.sensors.push(normalizedSensor);
        }
      }

      // Always append reading if provided (this accumulates all readings)
      if (payload.reading) {
        // Normalize timestamp to local format
        const normalizedReading = {
          ...payload.reading,
          timestamp: normalizeTimestamp(payload.reading.timestamp),
          // Ensure final_load is a string
          final_load: payload.reading.final_load !== null && payload.reading.final_load !== undefined
            ? String(payload.reading.final_load)
            : null,
        };
        data.readings.push(normalizedReading);
      }

      await this.persist(data);
      console.log(`Saved record. Total readings: ${data.readings.length}`);
      console.log('Current stored data:', JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving record:', error);
      throw error;
    }
  }
}

export const localRecordService = new LocalRecordService();

