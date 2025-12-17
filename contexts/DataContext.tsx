import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { storageService } from '../services/storageService';
import { uartService } from '../services/uartService';
import type { UARTData } from '../types/database';
import { CalculationService } from '../services/calculationService';


export interface LocalSensor {
  device_id?: string;
  sensor_id: string;
  sensor_type?: string;
  sensor_group?: string;
  sensor_unit?: string;
  temperature_unit?: string;
  installation_date?: string;
  location?: string;
  gauge_factor: number;
  initial_reading: number;
  initial_temperature?: number;
  initial_digit?: number;
  remark: string;
  calibration_timestamp: string;
}

interface LocalReading {
  sensor_id: string;
  frequency: number;
  temperature: number;
  final_load: number;
  digits: number;
  voltage: number;
  current: number;
  load: number;
  timestamp: string;
}

interface DataContextType {
  currentSensor: LocalSensor | null;
  currentReading: UARTData | null;
  isConnected: boolean;
  isFetching: boolean;
  isOnline: boolean;
  sensors: LocalSensor[];
  setCurrentSensor: (sensor: LocalSensor | null) => Promise<void>;
  startFetching: () => Promise<void>;
  stopFetching: () => Promise<void>;
  loadSensors: () => Promise<void>;
  saveSensor: (sensor: LocalSensor) => Promise<void>;
  deleteSensor: (sensorId: string) => Promise<void>;
  uploadReadings: () => Promise<void>;
  saveReading: (reading: UARTData) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const STORAGE_KEYS = {
  SENSORS: '@sensors',
  READINGS: '@readings',
  CURRENT_SENSOR: '@current_sensor',
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [currentSensor, setCurrentSensorState] = useState<LocalSensor | null>(null);
  const [currentReading, setCurrentReading] = useState<UARTData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [sensors, setSensors] = useState<LocalSensor[]>([]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const initUART = async () => {
      // const connected = await uartService.connect();
      // setIsConnected(connected);
    };

    initUART();

    const unsubscribe = uartService.onDataReceived((data) => {
      setCurrentReading(data);
      saveReading(data);
    });

    return () => {
      unsubscribe();
      uartService.disconnect();
    };
  }, []);

  useEffect(() => {
    loadSensors();
  }, []);

  const setCurrentSensor = async (sensor: LocalSensor | null) => {
    // Clear current reading when switching sensors to ensure fresh data for new sensor
    const previousSensorId = currentSensor?.sensor_id;
    const newSensorId = sensor?.sensor_id;
    
    // If switching to a different sensor, clear the current reading
    if (previousSensorId && newSensorId && previousSensorId !== newSensorId) {
      setCurrentReading(null);
    } else if (!newSensorId) {
      // If deselecting sensor, also clear reading
      setCurrentReading(null);
    }
    
    setCurrentSensorState(sensor);
    if (sensor) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_SENSOR, JSON.stringify(sensor));
    }
  };

  const startFetching = async () => {
    const success = await uartService.sendCommand({ Cmd: 'Send' });
    if (success) {
      setIsFetching(true);
    }
  };

  const stopFetching = async () => {
    const success = await uartService.sendCommand({ Cmd: 'Stop' });
    if (success) {
      setIsFetching(false);
    }
  };

  const loadSensors = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SENSORS);
      if (data) {
        const loadedSensors: LocalSensor[] = JSON.parse(data);
        setSensors(loadedSensors);

        const currentSensorData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SENSOR);
        if (currentSensorData) {
          const current: LocalSensor = JSON.parse(currentSensorData);
          const sensor = loadedSensors.find((s) => s.sensor_id === current.sensor_id);
          if (sensor) {
            setCurrentSensorState(sensor);
          }
        }
      }
    } catch (error) {
      console.error('Error loading sensors:', error);
    }
  };

  const saveSensor = async (sensorData: LocalSensor) => {
    try {
      const existingSensors = await AsyncStorage.getItem(STORAGE_KEYS.SENSORS);
      let sensorsList: LocalSensor[] = existingSensors ? JSON.parse(existingSensors) : [];

      const existingIndex = sensorsList.findIndex((s) => s.sensor_id === sensorData.sensor_id);
      if (existingIndex >= 0) {
        sensorsList[existingIndex] = sensorData;
      } else {
        sensorsList.push(sensorData);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.SENSORS, JSON.stringify(sensorsList));
      await loadSensors();
      await setCurrentSensor(sensorData);
    } catch (error) {
      console.error('Error saving sensor:', error);
    }
  };

  const deleteSensor = async (sensorId: string) => {
    try {
      const existingSensors = await AsyncStorage.getItem(STORAGE_KEYS.SENSORS);
      let sensorsList: LocalSensor[] = existingSensors ? JSON.parse(existingSensors) : [];

      sensorsList = sensorsList.filter((s) => s.sensor_id !== sensorId);

      await AsyncStorage.setItem(STORAGE_KEYS.SENSORS, JSON.stringify(sensorsList));
      await loadSensors();
      
      // If the deleted sensor was the current sensor, clear it
      const currentSensorData = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_SENSOR);
      if (currentSensorData) {
        const current: LocalSensor = JSON.parse(currentSensorData);
        if (current.sensor_id === sensorId) {
          await setCurrentSensor(null);
        }
      }
    } catch (error) {
      console.error('Error deleting sensor:', error);
    }
  };

  const saveReading = async (uartData: UARTData) => {
    if (!currentSensor) return;

    const finalLoad = CalculationService.calculateFinalLoad(
      uartData.Freq,
      currentSensor.initial_reading,
      currentSensor.gauge_factor
    );

    const digits = CalculationService.calculateDigits(uartData.Freq);

    const reading: LocalReading = {
      sensor_id: currentSensor.sensor_id,
      frequency: uartData.Freq,
      temperature: uartData.Temp,
      final_load: finalLoad,
      digits: digits,
      voltage: uartData.Volt,
      current: uartData.Curr,
      load: uartData.load,
      timestamp: CalculationService.formatTimestamp(new Date()),
    };

    try {
      const existingReadings = await AsyncStorage.getItem(STORAGE_KEYS.READINGS);
      let readingsList: LocalReading[] = existingReadings ? JSON.parse(existingReadings) : [];
      readingsList.push(reading);

      await AsyncStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify(readingsList));

      if (isOnline) {
        try {
        await supabase.from('readings').insert({
          sensor_id: reading.sensor_id,
          device_id: null,
          frequency: reading.frequency,
          temperature: reading.temperature,
          final_load: reading.final_load,
          digits: reading.digits,
            voltage: reading.voltage,
            current: reading.current,
            load: reading.load,
          timestamp: reading.timestamp,
        });
        } catch (supabaseError) {
          console.error('Error inserting reading to Supabase:', supabaseError);
          // Continue without throwing - data is saved locally
        }
      }
    } catch (error) {
      console.error('Error saving reading:', error);
    }
  };

  const uploadReadings = async () => {
    if (!isOnline) return;

    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.READINGS);
      if (data) {
        const readings: LocalReading[] = JSON.parse(data);

        if (readings.length > 0) {
          const readingsToUpload = readings.map((r) => {
            // Convert local format timestamp to ISO format for Supabase
            let timestampISO = r.timestamp;
            try {
              // If it's in local format "YYYY-MM-DD HH:mm:ss", convert to ISO
              if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.timestamp)) {
                timestampISO = new Date(r.timestamp.replace(' ', 'T')).toISOString();
              }
            } catch (e) {
              // If conversion fails, use original timestamp
              timestampISO = r.timestamp;
            }
            
            return {
            sensor_id: r.sensor_id,
            device_id: null,
            frequency: r.frequency,
            temperature: r.temperature,
            final_load: r.final_load,
            digits: r.digits,
              voltage: r.voltage,
              current: r.current,
              load: r.load,
              timestamp: timestampISO,
            };
          });

          try {
          const { error } = await supabase.from('readings').insert(readingsToUpload);

          if (!error) {
            await AsyncStorage.setItem(STORAGE_KEYS.READINGS, JSON.stringify([]));
            } else {
              console.error('Error uploading readings:', error);
            }
          } catch (supabaseError) {
            console.error('Error uploading readings to Supabase:', supabaseError);
            // Continue without throwing - readings remain in local storage
          }
        }
      }
    } catch (error) {
      console.error('Error uploading readings:', error);
    }
  };

  return (
    <DataContext.Provider
      value={{
        currentSensor,
        currentReading,
        isConnected,
        isFetching,
        isOnline,
        sensors,
        setCurrentSensor,
        startFetching,
        stopFetching,
        loadSensors,
        saveSensor,
        deleteSensor,
        uploadReadings,
        saveReading,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
