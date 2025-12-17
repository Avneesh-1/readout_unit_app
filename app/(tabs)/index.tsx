import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, WifiOff, Activity, Pencil, Trash2 } from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { CalculationService } from '../../services/calculationService';
import { storageService } from '../../services/storageService';
import { uartService } from '../../services/uartService';
import { localRecordService } from '../../services/localRecordService';
// Direct require for APK compatibility - most reliable way
const BeaverLogo = require('../../assets/images/beaver-logo.png');

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    currentSensor,
    currentReading,
    deleteSensor,
    loadSensors,
    isConnected,
    isFetching,
    isOnline,
    sensors,
    startFetching,
    stopFetching,
    setCurrentSensor,
    uploadReadings,
  } = useData();

  const [sensorModalVisible, setSensorModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F' | 'K'>('C');
  const [usbStatus, setUsbStatus] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('12345');
  const [isUploading, setIsUploading] = useState(false);

  const loadSettings = React.useCallback(async () => {
    const settings = await storageService.getSettings();
    setTemperatureUnit(settings.temperatureUnit);
    
    // Load device ID
    const savedDeviceId = await storageService.getDeviceId();
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
    } else {
      setDeviceId('12345'); // Default value
    }
  }, []);

  useEffect(() => {
    loadSettings();
    const unsubscribe = uartService.onConnectionChange((status) => {
    setUsbStatus(status);
    });

  return unsubscribe;
  }, [loadSettings]);

  // Reload settings when screen comes into focus (e.g., returning from settings)
  useFocusEffect(
    React.useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  // Debug: Log when currentSensor changes
  useEffect(() => {
    if (currentSensor) {
      console.log('Sensor selected:', {
        sensor_id: currentSensor.sensor_id,
        sensor_type: currentSensor.sensor_type,
        all_fields: currentSensor,
      });
    }
  }, [currentSensor]);

  const handleFetchToggle = async () => {
    if (!uartService.isUSBConnected()) {
      Alert.alert("USB Not Connected", "Press Connect USB first.");
      return;
    }

    // If no sensor is selected, create a default "Strain Gauge" sensor for fetching
    if (!currentSensor) {
      const defaultSensor = {
        sensor_id: 'DEFAULT_STRAIN_GAUGE',
        sensor_type: 'Strain Gauge',
        gauge_factor: 1.0,
        initial_reading: 0,
        remark: 'Default sensor for initial data fetching',
        calibration_timestamp: new Date().toISOString(),
      };
      await setCurrentSensor(defaultSensor as any);
    }

    if (isFetching) {
      uartService.sendCommand({ Cmd: "Stop" });
      stopFetching();
    } else {
      uartService.sendCommand({ Cmd: "Send" });
      startFetching();
    }
  };

  const handleSensorSelect = async (sensorId: string) => {
    const sensor = sensors.find((s) => s.sensor_id === sensorId);
    if (sensor) {
      // Stop fetching if currently active to ensure fresh data for new sensor
      if (isFetching) {
        uartService.sendCommand({ Cmd: "Stop" });
        stopFetching();
      }
      // Clear current sensor and reading - dashboard will be blank until new data arrives
      await setCurrentSensor(sensor);
      setSensorModalVisible(false);
    }
  };

  // Helper function to save record to local storage (used by both Save and Push to Cloud)
  const saveRecordToLocal = async (): Promise<boolean> => {
    if (!currentSensor) {
      return false;
    }

    try {
      // Check if sensor already exists in local storage
      // If it does, use the sensor's stored deviceId (preserves original device ID)
      // Otherwise, use the current device ID from settings
      const localDataCheck = await localRecordService.getData();
      const existingSensor = localDataCheck.sensors.find(
        (s: any) => s.sensorId === currentSensor.sensor_id
      );
      
      let deviceIdToUse: string;
      if (existingSensor && existingSensor.deviceId && existingSensor.deviceId !== null && existingSensor.deviceId !== '') {
        // Sensor exists and has a deviceId - use it (preserves original device ID)
        deviceIdToUse = String(existingSensor.deviceId);
        console.log(`Using existing sensor's deviceId: ${deviceIdToUse} for sensor ${currentSensor.sensor_id}`);
      } else {
        // New sensor or sensor without deviceId - use current device ID from settings
      const savedDeviceId = await storageService.getDeviceId();
        deviceIdToUse = savedDeviceId || '12345';
        console.log(`Using current settings deviceId: ${deviceIdToUse} for sensor ${currentSensor.sensor_id}`);
      }
      
      // Capture current reading values at the moment Save button is clicked
      // These values are snapshots of the live data at this exact moment
      const readingFrequency = currentReading?.Freq ?? null;
      const readingTemperature = currentReading?.Temp ?? null; // Temperature is always saved
      
      // Determine the value to save based on sensor type (changes according to sensor selected)
      // This captures the appropriate value at the moment of save
      let readingValue: number | null = null;
      switch (currentSensor.sensor_type) {
        case 'Strain Gauge':
          readingValue = currentReading?.Freq ?? null;
          break;
        case 'Load Cell':
          readingValue = currentReading?.load ?? null;
          break;
        case '4–20 mA':
          readingValue = currentReading?.Curr ?? null;
          break;
        case '0–10 V':
          readingValue = currentReading?.Volt ?? null;
          break;
        default:
          // Default to Frequency for unknown sensor types
          readingValue = currentReading?.Freq ?? null;
          break;
      }

      const digitsValue =
        readingFrequency !== null
          ? CalculationService.calculateDigits(readingFrequency)
          : null;
      const finalLoadValue =
        readingFrequency !== null && typeof currentSensor.gauge_factor === 'number'
          ? CalculationService.calculateFinalLoad(
              readingFrequency,
              currentSensor.initial_reading,
              currentSensor.gauge_factor
            )
          : null;

      let sensorCreatedAt = CalculationService.formatTimestamp(new Date());
      if (currentSensor.installation_date) {
        const parsedInstallation = new Date(currentSensor.installation_date);
        if (!isNaN(parsedInstallation.getTime())) {
          sensorCreatedAt = parsedInstallation.toISOString();
        }
      }

      // Check if device entry exists - only add it if it doesn't exist (first time)
      // This prevents changing device ID for all existing sensors when saving readings
      // Reuse localDataCheck that was already fetched above
      const shouldAddDevice = !localDataCheck.device || localDataCheck.device === null;

      await localRecordService.saveRecord({
        // Pass device entry so sensor/reading can store the device ID it was saved with
        // The service will store deviceId with each sensor/reading individually
        device: {
          deviceId: deviceIdToUse, // Current device ID from settings
        },
        sensor: {
          sensorId: currentSensor.sensor_id,
          sensorType: currentSensor.sensor_type,
          group: currentSensor.sensor_group ? currentSensor.sensor_group : null,
          location: currentSensor.location ?? '',
          initial_temperature: currentSensor.initial_temperature ?? null,
          initialReading: currentSensor.initial_reading,
          unit: currentSensor.sensor_unit,
          gauge_factor: currentSensor.gauge_factor ?? null,
          remarks: currentSensor.remark ?? '',
          created_at: sensorCreatedAt,
        },
        reading: {
          sensorId: currentSensor.sensor_id,
          value: readingValue,
          temperature: readingTemperature ?? null,
          reading_digit: digitsValue ?? null,
          final_load: finalLoadValue !== null ? String(finalLoadValue) : null,
          timestamp: CalculationService.formatTimestamp(new Date()),
        },
      });

      // Debug: Log all stored data
      await localRecordService.debugLogAllData();
      return true;
    } catch (error) {
      console.error('Error saving record:', error);
      return false;
    }
  };

  // Helper function to check if current reading already exists in local storage
  // Prevents saving the same reading multiple times when clicking "Push to Cloud" repeatedly
  const isCurrentReadingAlreadySaved = async (): Promise<boolean> => {
    if (!currentSensor) {
      return false;
    }

    try {
      const localData = await localRecordService.getData();
      const readings = localData.readings || [];

      // Check if there's a very recent reading for this sensor (within last 60 seconds)
      // This prevents duplicate saves when clicking "Push to Cloud" multiple times quickly
      const now = new Date().getTime();
      const sixtySecondsAgo = now - 60000; // 60 seconds in milliseconds

      // Find the most recent reading for this sensor
      const recentReadings = readings
        .filter((reading: any) => {
          if (reading.sensorId !== currentSensor.sensor_id) {
            return false;
          }
          
          // Check if timestamp is recent (within last 60 seconds)
          try {
            const readingTimestamp = new Date(reading.timestamp).getTime();
            return readingTimestamp >= sixtySecondsAgo;
          } catch (e) {
            return false;
          }
        })
        .sort((a: any, b: any) => {
          // Sort by timestamp descending (most recent first)
          try {
            const timeA = new Date(a.timestamp).getTime();
            const timeB = new Date(b.timestamp).getTime();
            return timeB - timeA;
          } catch (e) {
            return 0;
          }
        });

      // If there's a recent reading for this sensor, consider it already saved
      // This prevents duplicate saves when clicking "Push to Cloud" multiple times
      if (recentReadings.length > 0) {
        const mostRecent = recentReadings[0];
        console.log('Found recent reading for sensor:', {
          sensorId: mostRecent.sensorId,
          timestamp: mostRecent.timestamp,
          value: mostRecent.value,
          ageSeconds: Math.round((now - new Date(mostRecent.timestamp).getTime()) / 1000)
        });
        return true;
      }

      // If currentReading exists, also check by value (for more precise matching)
      if (currentReading) {
        // Determine the value to check based on sensor type
        let readingValue: number | null = null;
        switch (currentSensor.sensor_type) {
          case 'Strain Gauge':
            readingValue = currentReading.Freq ?? null;
            break;
          case 'Load Cell':
            readingValue = currentReading.load ?? null;
            break;
          case '4–20 mA':
            readingValue = currentReading.Curr ?? null;
            break;
          case '0–10 V':
            readingValue = currentReading.Volt ?? null;
            break;
          default:
            readingValue = currentReading.Freq ?? null;
            break;
        }

        // If we have a value, check for exact match with recent readings
        if (readingValue !== null) {
          const valueMatch = recentReadings.find((reading: any) => {
            if (reading.value === null || reading.value === undefined) {
              return false;
            }
            // Check if value matches (with small tolerance for floating point)
            return Math.abs(reading.value - readingValue) < 0.01;
          });

          if (valueMatch) {
            console.log('Found recent reading with matching value');
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking if reading already saved:', error);
      return false;
    }
  };

  // Helper function to generate a hash of the API payload for duplicate detection
  const generateDataHash = (payload: any): string => {
    try {
      // Normalize the data for consistent hashing
      // Sort arrays to ensure consistent order
      const normalized = {
        device: payload.device ? JSON.parse(JSON.stringify(payload.device)) : null,
        sensors: payload.sensors ? [...payload.sensors].sort((a: any, b: any) => 
          (a.sensorId || '').localeCompare(b.sensorId || '')
        ) : [],
        readings: payload.readings ? [...payload.readings].sort((a: any, b: any) => 
          (a.timestamp || '').localeCompare(b.timestamp || '')
        ) : [],
      };
      
      // Create a JSON string and use it as hash (simple but effective)
      const jsonString = JSON.stringify(normalized);
      
      // Simple hash function (djb2 algorithm)
      let hash = 0;
      for (let i = 0; i < jsonString.length; i++) {
        const char = jsonString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      return Math.abs(hash).toString(36); // Convert to base36 string
    } catch (error) {
      console.error('Error generating data hash:', error);
      // Fallback: use timestamp if hashing fails
      return Date.now().toString();
    }
  };

  const handlePush = async () => {
    if (!currentSensor) {
      Alert.alert('Select Sensor', 'Please select a sensor before pushing to cloud.');
      return;
    }

    // Then upload to cloud if online
    if (!isOnline) {
      Alert.alert('Offline', 'Data saved locally. Please connect to Wi-Fi to upload data.');
      return;
    }

    try {
      // Set loading state to block UI interactions immediately
      setIsUploading(true);
      
      // FIRST: Get current local data state (BEFORE saving any new reading)
      // This is the state that was already saved using "Save" button
      const localDataBeforeNewSave = await localRecordService.getData();
      
      // Check for duplicates using CURRENT state (before potentially adding new reading)
      // Normalize device for duplicate check - preserve deviceId format (string or number)
      let normalizedDeviceForCheck: { deviceId: string | number } = { deviceId: '12345' };
      if (localDataBeforeNewSave.device && localDataBeforeNewSave.device !== null && typeof localDataBeforeNewSave.device === 'object') {
        // Device is now a single object, not an array
        const deviceToCheck = localDataBeforeNewSave.device;
        // Preserve deviceId as-is, only default to "12345" if invalid
        const deviceId = deviceToCheck.deviceId;
        if (deviceId !== null && deviceId !== undefined && deviceId !== '' && deviceId !== 'null' && deviceId !== 'undefined') {
        normalizedDeviceForCheck = {
            deviceId: deviceId, // Keep as-is (string or number)
        };
        }
      }
      
      // Create payload for duplicate check (using current state BEFORE saving new reading)
      const apiPayloadForCheck = {
        device: normalizedDeviceForCheck,
        sensors: localDataBeforeNewSave.sensors || [],
        readings: localDataBeforeNewSave.readings || [],
      };
      
      // Generate hash of current data state (before adding new reading)
      const currentDataHash = generateDataHash(apiPayloadForCheck);
      const lastUploadedHash = await storageService.getLastUploadedHash();
      
      console.log('=== DUPLICATE CHECK (BEFORE SAVING NEW READING) ===');
      console.log('Current data hash:', currentDataHash);
      console.log('Last uploaded hash:', lastUploadedHash);
      console.log('Hashes match:', lastUploadedHash === currentDataHash);
      console.log('Sensors count:', localDataBeforeNewSave.sensors?.length || 0);
      console.log('Readings count:', localDataBeforeNewSave.readings?.length || 0);
      
      // Check if this current data state was already uploaded
      if (lastUploadedHash && lastUploadedHash === currentDataHash) {
        console.log('DUPLICATE DETECTED - This data has already been uploaded');
        setIsUploading(false);
        Alert.alert(
          'Duplicate Upload',
          'This data has already been uploaded to the cloud. No need to upload again.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }
      
      console.log('No duplicate detected - Proceeding with save and upload');
      
      // SECOND: Only now, if not duplicate, optionally save current reading (if it exists and not already saved)
      // This allows user to click "Push to Cloud" to upload current live reading along with existing saved data
      const alreadySaved = await isCurrentReadingAlreadySaved();
      
      console.log('=== CHECKING IF CURRENT READING ALREADY SAVED ===');
      console.log('Already saved:', alreadySaved);
      console.log('Current sensor:', currentSensor?.sensor_id);
      console.log('Current reading exists:', !!currentReading);
      console.log('USB connected:', usbStatus);
      
      // Only save to local storage if the reading doesn't already exist
      // IMPORTANT: Don't save if device is not connected (no live data to save)
      if (!alreadySaved && currentReading && usbStatus) {
        console.log('Current reading not found in local storage, saving now...');
      const saved = await saveRecordToLocal();
      if (!saved) {
        setIsUploading(false);
        Alert.alert('Error', 'Unable to save the record locally.');
        return;
        }
        console.log('Current reading saved successfully');
      } else {
        if (alreadySaved) {
          console.log('Current reading already exists in local storage, skipping save step');
        } else if (!currentReading) {
          console.log('No current reading available (device not connected or no data), skipping save');
        } else if (!usbStatus) {
          console.log('Device not connected, skipping save of current reading');
        }
      }
      
      // Get all locally stored data (now includes the new reading if it was just saved)
      const localData = await localRecordService.getData();
      
      // Validate data structure
      if (!localData || typeof localData !== 'object') {
        throw new Error('Invalid data structure retrieved from local storage');
      }
      
      // Ensure arrays exist (even if empty) - device is now a single object, not an array
      if (!Array.isArray(localData.sensors)) localData.sensors = [];
      if (!Array.isArray(localData.readings)) localData.readings = [];
      
      // Normalize device (single object, not array)
      // First, log the raw device to see what we're working with
      console.log('Raw device before normalization:', JSON.stringify(localData.device, null, 2));
      
      // Normalize device object - ensure it has valid deviceId
      let normalizedDevice: { deviceId: string } | null = null;
      
      if (localData.device && localData.device !== null && typeof localData.device === 'object' && !Array.isArray(localData.device)) {
        const deviceId = localData.device.deviceId;
        console.log('Original deviceId:', deviceId, 'Type:', typeof deviceId);
          
          // Normalize: convert to string "12345" if invalid
          let normalizedDeviceId = '12345';
          if (deviceId !== null && deviceId !== undefined && deviceId !== '' && deviceId !== 'null' && deviceId !== 'undefined') {
            normalizedDeviceId = String(deviceId);
          }
          
        // Ensure deviceId is always present as a property
        normalizedDevice = {
            deviceId: normalizedDeviceId,
          };
          
          // Triple-check deviceId exists and is valid
          if (!normalizedDevice.deviceId || normalizedDevice.deviceId === null || normalizedDevice.deviceId === undefined || normalizedDevice.deviceId === '') {
            console.error('CRITICAL: Device missing deviceId after normalization:', normalizedDevice);
            normalizedDevice.deviceId = '12345';
          }
          
        console.log('Normalized deviceId:', normalizedDevice.deviceId);
      } else {
        // No device exists, create default
        console.log('No device found, will use default or sensor deviceId');
        normalizedDevice = null; // Will be determined from sensors
      }
      
      // Prepare device data - use device ID from sensors themselves (each sensor remembers its device ID)
      // Get device ID from the first sensor that has one, or fall back to global device entry
      let deviceIdFromSensor: string | null = null;
      
      // Try to get device ID from sensors (each sensor stores its own device ID)
      if (localData.sensors && localData.sensors.length > 0) {
        // Find first sensor with a device ID
        const sensorWithDeviceId = localData.sensors.find((s: any) => s.deviceId && s.deviceId !== null && s.deviceId !== '');
        if (sensorWithDeviceId) {
          deviceIdFromSensor = sensorWithDeviceId.deviceId;
        }
      }
      
      // Fall back to global device entry if no sensor has device ID
      const deviceIdFromGlobal = normalizedDevice?.deviceId || null;
      
      // Use device ID from sensor (preferred) or from global entry, or default
      let finalDeviceId: string | number = deviceIdFromSensor || deviceIdFromGlobal || '12345';
      
      // Only default to "12345" if deviceId is actually invalid
      if (finalDeviceId === null || finalDeviceId === undefined || finalDeviceId === '' || finalDeviceId === 'null' || finalDeviceId === 'undefined') {
        finalDeviceId = '12345';
      }
      
      console.log('Device ID selection:', {
        fromSensor: deviceIdFromSensor,
        fromGlobal: deviceIdFromGlobal,
        final: finalDeviceId,
      });
      
      // Group sensors and readings by their device ID
      // Each sensor/reading stores its own device ID, so we group them accordingly
      const deviceGroups = new Map<string, { sensors: any[], readings: any[] }>();
      
      // Helper to get device ID from sensor or reading
      const getDeviceIdFromItem = (item: any): string => {
        // Get device ID from the item itself, or from its associated sensor, or use default
        if (item.deviceId && item.deviceId !== null && item.deviceId !== '') {
          return String(item.deviceId);
        }
        // For readings, try to find the sensor and use its device ID
        if (item.sensorId) {
          const sensor = localData.sensors.find((s: any) => s.sensorId === item.sensorId);
          if (sensor && sensor.deviceId && sensor.deviceId !== null && sensor.deviceId !== '') {
            return String(sensor.deviceId);
          }
        }
        // Fall back to global device ID or default
        return finalDeviceId ? String(finalDeviceId) : '12345';
      };
      
      // Group sensors by device ID
      localData.sensors.forEach((sensor: any) => {
        const sensorDeviceId = getDeviceIdFromItem(sensor);
        if (!deviceGroups.has(sensorDeviceId)) {
          deviceGroups.set(sensorDeviceId, { sensors: [], readings: [] });
        }
        deviceGroups.get(sensorDeviceId)!.sensors.push(sensor);
      });
      
      // Group readings by device ID (from reading itself or its sensor)
      localData.readings.forEach((reading: any) => {
        const readingDeviceId = getDeviceIdFromItem(reading);
        if (!deviceGroups.has(readingDeviceId)) {
          deviceGroups.set(readingDeviceId, { sensors: [], readings: [] });
        }
        deviceGroups.get(readingDeviceId)!.readings.push(reading);
      });
      
      console.log('Device groups:', Array.from(deviceGroups.entries()).map(([deviceId, data]) => ({
        deviceId,
        sensors: data.sensors.length,
        readings: data.readings.length,
      })));
      
      // Send separate API requests for each device ID group
      const uploadPromises: Promise<any>[] = [];
      const uploadedPayloads: any[] = [];
      
      for (const [deviceId, groupData] of deviceGroups.entries()) {
      const normalizedDevice = {
          deviceId: typeof deviceId === 'string' ? deviceId : String(deviceId),
      };
      
      const apiPayload = {
          device: normalizedDevice,
          sensors: groupData.sensors,
          readings: groupData.readings,
        };
        
        console.log(`Uploading group for device ID: ${deviceId}`, {
          sensors: groupData.sensors.length,
          readings: groupData.readings.length,
        });
        console.log(`API Payload for device ${deviceId}:`, JSON.stringify(apiPayload, null, 2));
        
        const uploadPromise = fetch('https://3ltnur8y5k.execute-api.ap-south-1.amazonaws.com/default/pushtocloud-beaver', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify(apiPayload),
        }).then(async (response) => {
      const responseText = await response.text();
          console.log(`API Response for device ${deviceId} - Status:`, response.status);
          console.log(`API Response for device ${deviceId} - Body:`, responseText);

      if (!response.ok) {
            let errorMessage = `API error for device ${deviceId}: ${response.status}`;
        try {
          const errorData = JSON.parse(responseText);
          errorMessage = errorData.message || errorData.error || errorMessage;
          console.error('API Error Details:', errorData);
        } catch (e) {
          if (responseText) {
            errorMessage = responseText;
          }
        }
        throw new Error(errorMessage);
      }

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        result = { message: 'Data uploaded successfully' };
      }
      
          uploadedPayloads.push(apiPayload);
          return result;
        });
        
        uploadPromises.push(uploadPromise);
      }
      
      // Wait for all uploads to complete
      const results = await Promise.all(uploadPromises);
      console.log('All uploads completed:', results);
      
      // Store hash of the complete uploaded data (all groups combined)
      // Use the device from localData (single object) for hash consistency
      const combinedPayload = {
        device: localData.device || null, // Single device object, not array
        sensors: localData.sensors,
        readings: localData.readings,
      };
      const uploadedDataHash = generateDataHash(combinedPayload);
      await storageService.setLastUploadedHash(uploadedDataHash);
      console.log('Stored uploaded data hash:', uploadedDataHash);
      
      setIsUploading(false);
      Alert.alert('Success', 'Data saved and uploaded successfully!');
    } catch (error: any) {
      setIsUploading(false);
      console.error('Error uploading to API:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      Alert.alert('Error', `Data saved locally, but failed to upload to cloud.\n\nError: ${errorMessage}`);
    }
  };

  const handleSaveRecord = async () => {
    if (!currentSensor) {
      Alert.alert('Select Sensor', 'Please select a sensor before saving.');
      return;
    }

    const saved = await saveRecordToLocal();
    if (saved) {
      Alert.alert('Saved', 'Reading stored locally.');
    } else {
      Alert.alert('Error', 'Unable to save the record.');
    }
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'Are you sure you want to clear all saved data from local storage? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all storage keys
              await AsyncStorage.multiRemove([
                '@saved_records_v2', // localRecordService
                '@sensors', // DataContext sensors
                '@readings', // DataContext readings
                '@current_sensor', // DataContext current sensor
                '@readout_settings', // storageService settings (optional - you may want to keep settings)
                '@pending_readings', // storageService pending readings
                '@device_id', // storageService device ID
              ]);

              // Also clear via services
              await localRecordService.clearData();
              await storageService.clearPendingReadings();
              
              // Reset current sensor state
              await setCurrentSensor(null);
              
              // Reload sensors to refresh UI
              await loadSensors();

              Alert.alert('Success', 'All local data has been cleared.');
    } catch (error) {
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear data.');
    }
          },
        },
      ]
    );
  };

  const filteredSensors = sensors.filter((s) =>
    s.sensor_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Convert temperature based on selected unit (Arduino provides data in Celsius)
  const temperature = currentReading
    ? (() => {
        const tempCelsius = currentReading.Temp; // Already in Celsius from Arduino
        switch (temperatureUnit) {
          case 'F':
            return CalculationService.convertCelsiusToFahrenheit(tempCelsius);
          case 'K':
            return CalculationService.convertCelsiusToKelvin(tempCelsius);
          case 'C':
          default:
            return tempCelsius; // Display as Celsius
        }
      })()
    : null;

  const finalLoad =
    currentReading && currentSensor
      ? CalculationService.calculateFinalLoad(
        currentReading.Freq,
        currentSensor.initial_reading,
        currentSensor.gauge_factor
      )
      : null;

  // Calculate digits: use current reading based on sensor type (value² / 1000)
  // Only calculates when device is connected and receiving live data
  // Updates every second as new data arrives from Arduino device
  const digits = (usbStatus && currentReading && currentSensor)
    ? (() => {
        let readingValue: number | null = null;
        switch (currentSensor.sensor_type) {
          case 'Strain Gauge':
            readingValue = currentReading.Freq ?? null;
            break;
          case 'Load Cell':
            readingValue = currentReading.load ?? null;
            break;
          case '4–20 mA':
            readingValue = currentReading.Curr ?? null;
            break;
          case '0–10 V':
            readingValue = currentReading.Volt ?? null;
            break;
          default:
            // Default to frequency if sensor type is not recognized
            readingValue = currentReading.Freq ?? null;
        }
        // Calculate digits only from live data: value² / 1000
        return readingValue !== null && !isNaN(readingValue)
          ? CalculationService.calculateDigits(readingValue)
          : null;
      })()
    : null; // Show '-' when device is not connected or no live data available

  const frequency = currentReading?.Freq ?? null;

  const connectionStatus = usbStatus ? "Connected" : "Disconnected";

  // Determine primary reading based on sensor type
  const getPrimaryReading = () => {
    // If no sensor selected, default to Frequency
    if (!currentSensor) {
      return { label: 'Frequency', value: frequency, unit: 'Hz' };
    }

    // Debug: Log sensor type for troubleshooting
    console.log('Current sensor type:', currentSensor.sensor_type);
    console.log('Current reading data:', currentReading);

    // Get the appropriate reading based on sensor type
    switch (currentSensor.sensor_type) {
      case 'Strain Gauge':
        return {
          label: 'Frequency',
          value: currentReading?.Freq ?? null,
          unit: 'Hz',
        };
      case 'Load Cell':
        return {
          label: 'Load',
          value: currentReading?.load ?? null,
          unit: 'kg',
        };
      case '4–20 mA':
        return {
          label: 'Current',
          value: currentReading?.Curr ?? null,
          unit: 'A',
        };
      case '0–10 V':
        return {
          label: 'Voltage',
          value: currentReading?.Volt ?? null,
          unit: 'V',
        };
      default:
        // Default to Frequency if sensor type is not recognized
        console.log('Unknown sensor type, defaulting to Frequency');
        return {
          label: 'Frequency',
          value: currentReading?.Freq ?? frequency,
          unit: 'Hz',
        };
    }
  };

  const primaryReading = getPrimaryReading();


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        {/* Using static require constant - most reliable way */}
        <Image
          source={BeaverLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Readout Link</Text>
      </View>
      {/* <TouchableOpacity
  style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
  onPress={() => uartService.connectUSB()}
>
  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Connect USB</Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
  onPress={() => uartService.disconnect()}
>
  <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Disconnect USB</Text>
</TouchableOpacity> */}

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={[styles.sensorSelector, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
          onPress={() => setSensorModalVisible(true)}
        >
          <Text style={[styles.sensorLabel, { color: colors.textTertiary }]}>Selected Sensor</Text>
          <Text style={[styles.sensorValue, { color: colors.text }]}>
            {currentSensor?.sensor_id ?? 'Tap to select'}
          </Text>
          {currentSensor?.location && (
            <Text style={[styles.sensorRemark, { color: colors.textTertiary }]}>{currentSensor.location}</Text>
          )}
        </TouchableOpacity>

        <View style={[styles.statusBar, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          {/* <View style={styles.statusItem}>
            <Activity size={20} color={connectionStatus === 'Connected' ? '#10B981' : '#EF4444'} />
            <Text style={[styles.statusText, { color: colors.textSecondary }, connectionStatus === 'Connected' ? styles.statusConnected : styles.statusDisconnected]}>
              {connectionStatus}
            </Text>
          </View> */}
          <TouchableOpacity
            style={styles.statusItem}
            activeOpacity={0.6}
            onPress={() => {
              if (connectionStatus === 'Connected') {
                uartService.disconnect();
              } else {
                uartService.connectUSB();
              }
            }}
          >
            <Activity
              size={20}
              color={connectionStatus === 'Connected' ? '#EF4444' : '#10B981'}
            />

            <Text
              style={[
                styles.statusText,
                { color: colors.textSecondary },
                connectionStatus === 'Connected'
                  ? 
                    styles.statusDisconnected :
                  styles.statusConnected
              ]}
            >
              {connectionStatus === 'Connected' ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.readingsGrid}>
          <View style={[styles.readingCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>{primaryReading.label}</Text>
            <Text style={[styles.readingValue, { color: colors.text }]}>
              {primaryReading.value !== null && primaryReading.value !== undefined
                ? CalculationService.formatNumber(primaryReading.value, 2)
                : '-'}
            </Text>
            <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>{primaryReading.unit}</Text>
          </View>

          <View style={[styles.readingCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Temperature</Text>
            <Text style={[styles.readingValue, { color: colors.text }]}>
              {temperature !== null ? CalculationService.formatNumber(temperature, 1) : '-'}
            </Text>
            <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>°{temperatureUnit}</Text>
          </View>

          <View style={[styles.readingCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Digits</Text>
            <Text style={[styles.readingValue, { color: colors.text }]}>
              {digits !== null ? CalculationService.formatNumber(digits, 2) : '-'}
            </Text>
            <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>μɛ</Text>
          </View>

          <View style={[styles.readingCard, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
            <Text style={[styles.readingLabel, { color: colors.textTertiary }]}>Final Load</Text>
            <Text style={[styles.readingValue, { color: colors.text }]}>
              {finalLoad !== null ? CalculationService.formatNumber(finalLoad, 2) : '-'}
            </Text>
            <Text style={[styles.readingUnit, { color: colors.textTertiary }]}>kg</Text>
          </View>
        </View>

        <View style={[styles.calibrationInfo, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Initial Reading</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {CalculationService.formatNumber(currentSensor?.initial_reading ?? 0, 2)} Hz
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Gauge Factor</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {CalculationService.formatNumber(currentSensor?.gauge_factor ?? 0, 4)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>Device ID</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {deviceId}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, isFetching && styles.primaryButtonActive]}
            onPress={handleFetchToggle}
          >
            <Text style={styles.primaryButtonText}>{isFetching ? 'Stop' : 'Fetch'}</Text>
          </TouchableOpacity>

          <View style={styles.saveCloudButtonsRow}>
          <TouchableOpacity
              style={[styles.halfButton, styles.leftButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
              onPress={handleSaveRecord}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
              style={[styles.halfButton, styles.rightButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handlePush}
            disabled={!isOnline || isUploading}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }, (!isOnline || isUploading) && styles.buttonTextDisabled]}>
              {isUploading ? 'Uploading...' : 'Push to Cloud'}
            </Text>
          </TouchableOpacity>
          </View>


          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={() => router.push('/(tabs)/calibration')}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Add Sensor</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={sensorModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSensorModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Sensor</Text>

            <TextInput
              style={[styles.searchInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Search sensor ID..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textTertiary}
            />

            <ScrollView style={styles.sensorList}>
              {filteredSensors.length > 0 ? (
                filteredSensors.map((sensor) => (
                  <View
                    key={sensor.sensor_id}
                    style={[styles.sensorItem, { borderBottomColor: colors.border }]}
                  >
                    <TouchableOpacity
                      style={styles.sensorItemContent}
                    onPress={() => handleSensorSelect(sensor.sensor_id)}
                  >
                      <View style={styles.sensorItemText}>
                    <Text style={[styles.sensorItemId, { color: colors.text }]}>{sensor.sensor_id}</Text>
                    {sensor.remark && (
                      <Text style={[styles.sensorItemRemark, { color: colors.textTertiary }]}>{sensor.remark}</Text>
                    )}
                      </View>
                  </TouchableOpacity>
                    <View style={styles.sensorActionButtons}>
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                          setSensorModalVisible(false);
                          // Navigate to calibration page with sensor data for editing
                          router.push({
                            pathname: '/(tabs)/calibration',
                            params: {
                              editMode: 'true',
                              sensorData: JSON.stringify(sensor),
                            },
                          });
                        }}
                      >
                        <Pencil size={18} color={colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                          Alert.alert(
                            'Delete Sensor',
                            `Are you sure you want to delete sensor "${sensor.sensor_id}"? This action cannot be undone.`,
                            [
                              {
                                text: 'Cancel',
                                style: 'cancel',
                              },
                              {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: async () => {
                                  try {
                                    await deleteSensor(sensor.sensor_id);
                                    await loadSensors();
                                    Alert.alert('Success', 'Sensor deleted successfully');
                                  } catch (error) {
                                    Alert.alert('Error', 'Failed to delete sensor');
                                    console.error('Error deleting sensor:', error);
                                  }
                                },
                              },
                            ]
                          );
                        }}
                      >
                        <Trash2 size={18} color="#EF4444" />
                  </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={[styles.noSensorsText, { color: colors.textTertiary }]}>No sensors found</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSensorModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Loading Overlay */}
      {isUploading && (
        <Modal
          transparent={true}
          animationType="fade"
          visible={isUploading}
          onRequestClose={() => {}} // Prevent closing by back button
        >
          <View style={styles.loadingOverlay}>
            <View style={[styles.loadingContainer, { backgroundColor: colors.cardBackground }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.text }]}>Uploading to cloud...</Text>
              <Text style={[styles.loadingSubtext, { color: colors.textSecondary }]}>Please wait</Text>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  logo: {
    width: 120,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: '#10B981',
  },
  statusOffline: {
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
    padding: 12,
  },
  sensorSelector: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  sensorLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sensorValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  sensorRemark: {
    fontSize: 12,
    marginTop: 4,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 14,
  },
  statusConnected: {
    color: '#10B981',
  },
  statusDisconnected: {
    color: '#EF4444',
  },
  readingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  readingCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  readingLabel: {
    fontSize: 12,
    marginBottom: 8,
  },
  readingValue: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  readingUnit: {
    fontSize: 12,
  },
  calibrationInfo: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonActive: {
    backgroundColor: '#EF4444',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  saveCloudButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  halfButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  leftButton: {
    marginRight: 0,
  },
  rightButton: {
    marginLeft: 0,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '75%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  sensorList: {
    maxHeight: 350,
    marginBottom: 20,
  },
  sensorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
  },
  sensorItemContent: {
    flex: 1,
  },
  sensorItemText: {
    flex: 1,
  },
  sensorItemId: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  sensorItemRemark: {
    fontSize: 12,
    marginTop: 2,
  },
  sensorActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  noSensorsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 30,
  },
  modalCloseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});

