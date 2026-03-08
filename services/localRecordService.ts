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
}

export interface SensorInfo {
  sensorId: string;
  sensorType?: string;
  group?: string | null;
  location?: string;
  initial_temperature?: number | null;
  initialReading?: number | null;
  unit?: string;
  gauge_factor?: number | null;
  remarks?: string;
  created_at?: string;
  deviceId?: string | null; // Device ID associated with this sensor when it was saved
}

export interface ReadingInfo {
  sensorId: string;
  value?: number | null;
  temperature?: number | null;
  reading_digit?: number | null;
  final_load?: string | null;
  timestamp: string;
  deviceId?: string | null; // Device ID associated with this reading when it was saved
}

export interface SavedData {
  device: DeviceInfo | null; // Single device object, not an array
  sensors: SensorInfo[];
  readings: ReadingInfo[];
}

export interface SaveRecordPayload {
  device?: DeviceInfo;
  sensor?: SensorInfo;
  reading?: ReadingInfo;
}

const defaultData: SavedData = {
  device: null, // Single device object, null if not set
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

      // Migrate old structure (devices plural array) to new structure (device single object)
      if (parsed.devices && Array.isArray(parsed.devices) && parsed.devices.length > 0) {
        // Take the last device from the array
        parsed.device = parsed.devices[parsed.devices.length - 1];
        delete parsed.devices;
      }
      
      // Migrate old structure (device array) to new structure (device single object)
      if (parsed.device && Array.isArray(parsed.device)) {
        // Take the last device from the array, or null if empty
        parsed.device = parsed.device.length > 0 ? parsed.device[parsed.device.length - 1] : null;
      }

      // Ensure device is either an object or null (not array)
      if (!parsed.device || Array.isArray(parsed.device)) {
        parsed.device = null;
      }

      // Migrate schema changes:
      // 1. Remove created_at from device (if it's an object)
      if (parsed.device && typeof parsed.device === 'object' && !Array.isArray(parsed.device)) {
        const { created_at, ...rest } = parsed.device;
        parsed.device = rest;
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

      // 4. Ensure readings have ISO timestamps and final_load as string/null
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

  async getRecordCounts(): Promise<{ device: number; sensors: number; readings: number }> {
    const data = await this.getData();
    return {
      device: data.device ? 1 : 0, // Single device object, so 1 or 0
      sensors: data.sensors.length,
      readings: data.readings.length,
    };
  }

  async debugLogAllData(): Promise<void> {
    const data = await this.getData();
    console.log('=== STORED DATA DEBUG ===');
    console.log(`Device: ${data.device ? 1 : 0}`); // Single device object, so 1 or 0
    console.log(`Sensors: ${data.sensors.length}`);
    console.log(`Readings: ${data.readings.length}`);
    console.log('Full data structure:', JSON.stringify(data, null, 2));
    console.log('=== END DEBUG ===');
  }

  async saveRecord(payload: SaveRecordPayload): Promise<void> {
    try {
      const data = await this.getData();

      // Update device entry (single object, not array)
      // Only update if device doesn't exist yet, to preserve device ID for existing sensors
      if (payload.device) {
        // Device now only contains deviceId
        const normalizedDevice = {
          deviceId: payload.device.deviceId,
        };
        
        // Only set device entry if no device exists yet
        // This prevents overwriting existing device ID when saving readings for existing sensors
        if (!data.device || data.device === null) {
          // No device exists, set it
          data.device = normalizedDevice;
        }
        // If device already exists, don't update it - this preserves the original device ID
      }

      // Get current device ID from settings to associate with sensor/reading
      // This ensures each sensor/reading remembers the device ID it was saved with
      let currentDeviceId: string | null = null;
      if (payload.device && payload.device.deviceId) {
        currentDeviceId = payload.device.deviceId;
        } else {
        // If device not provided, try to get from existing device entry or use default
        if (data.device && data.device !== null && typeof data.device === 'object') {
          currentDeviceId = data.device.deviceId;
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
          // Store device ID with sensor - this preserves the device ID when sensor was saved
          deviceId: currentDeviceId || payload.sensor.deviceId || null,
        };
        
        // Remove date_of_installation if it exists (old field name)
        if ('date_of_installation' in normalizedSensor) {
          delete (normalizedSensor as any).date_of_installation;
        }
        
        const index = data.sensors.findIndex(
          (sensor) => sensor.sensorId === normalizedSensor.sensorId
        );

        if (index >= 0) {
          // Merge sensor info, but ALWAYS preserve existing deviceId for existing sensors
          // This prevents overwriting device ID when saving readings for existing sensors
          // Only set deviceId for new sensors, never update it for existing ones
          const existingDeviceId = data.sensors[index].deviceId;
          data.sensors[index] = {
            ...data.sensors[index],
            ...normalizedSensor,
            // Preserve existing deviceId - never overwrite it for existing sensors
            deviceId: existingDeviceId || normalizedSensor.deviceId || null,
          };
        } else {
          // Add new sensor with its device ID (from current settings)
          data.sensors.push(normalizedSensor);
        }
      }

      // Always append reading if provided (this accumulates all readings)
      if (payload.reading) {
        // Always use the deviceId from the payload (current settings device ID)
        // This ensures that when device ID is changed in settings, new readings use the new device ID
        // Priority: payload.reading.deviceId > currentDeviceId (from payload.device) > reading's own deviceId
        const readingDeviceId: string | null = 
          payload.reading.deviceId || 
          currentDeviceId || 
          (payload.reading.deviceId !== undefined ? payload.reading.deviceId : null);
        
        // Normalize timestamp to local format
        const normalizedReading = {
          ...payload.reading,
          timestamp: normalizeTimestamp(payload.reading.timestamp),
          // Ensure final_load is a string
          final_load: payload.reading.final_load !== null && payload.reading.final_load !== undefined
            ? String(payload.reading.final_load)
            : null,
          // Store device ID with reading - prioritize sensor's deviceId
          deviceId: readingDeviceId,
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

