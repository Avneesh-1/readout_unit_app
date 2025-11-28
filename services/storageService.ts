import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Sensor, Reading } from '../types/database';

const KEYS = {
  SETTINGS: '@readout_settings',
  CURRENT_SENSOR: '@current_sensor',
  PENDING_READINGS: '@pending_readings',
  DEVICE_ID: '@device_id',
};

export interface AppSettings {
  autoUpload: boolean;
  temperatureUnit: 'C' | 'F' | 'K';
  theme: 'light' | 'dark';
  brightness: number;
}

const DEFAULT_SETTINGS: AppSettings = {
  autoUpload: false,
  temperatureUnit: 'C',
  theme: 'light',
  brightness: 80,
};

class StorageService {
  async getSettings(): Promise<AppSettings> {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async getCurrentSensorId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.CURRENT_SENSOR);
    } catch (error) {
      console.error('Error loading current sensor:', error);
      return null;
    }
  }

  async setCurrentSensorId(sensorId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.CURRENT_SENSOR, sensorId);
    } catch (error) {
      console.error('Error saving current sensor:', error);
    }
  }

  async addPendingReading(reading: Reading): Promise<void> {
    try {
      const existing = await this.getPendingReadings();
      existing.push(reading);
      await AsyncStorage.setItem(KEYS.PENDING_READINGS, JSON.stringify(existing));
    } catch (error) {
      console.error('Error saving pending reading:', error);
    }
  }

  async getPendingReadings(): Promise<Reading[]> {
    try {
      const data = await AsyncStorage.getItem(KEYS.PENDING_READINGS);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading pending readings:', error);
      return [];
    }
  }

  async clearPendingReadings(): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PENDING_READINGS, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing pending readings:', error);
    }
  }

  async getDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.DEVICE_ID);
    } catch (error) {
      console.error('Error loading device ID:', error);
      return null;
    }
  }

  async setDeviceId(deviceId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.DEVICE_ID, deviceId);
    } catch (error) {
      console.error('Error saving device ID:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        KEYS.SETTINGS,
        KEYS.CURRENT_SENSOR,
        KEYS.PENDING_READINGS,
      ]);
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  }
}

export const storageService = new StorageService();
