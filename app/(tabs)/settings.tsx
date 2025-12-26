import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService, AppSettings } from '../../services/storageService';
import { useTheme } from '../../contexts/ThemeContext';
import { useData, LocalSensor } from '../../contexts/DataContext';
import { localRecordService } from '../../services/localRecordService';
import { exportSavedRecordsToExcel } from '../../services/exportService';
import { CalculationService } from '../../services/calculationService';
// Direct require for APK compatibility - most reliable way
const BeaverLogo = require('../../assets/images/beaver-logo.png');

export default function Settings() {
  const { colors, theme, toggleTheme } = useTheme();
  const { setCurrentSensor, loadSensors, saveSensor } = useData();
  const [settings, setSettings] = useState<AppSettings>({
    autoUpload: false,
    temperatureUnit: 'C',
    theme: 'light',
    brightness: 80,
  });
  const [deviceId, setDeviceId] = useState<string>('12345');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importDeviceIdInput, setImportDeviceIdInput] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setSettings(prev => ({ ...prev, theme }));
  }, [theme]);

  const loadSettings = async () => {
    const loadedSettings = await storageService.getSettings();
    setSettings(loadedSettings);
    
    // Load device ID
    const savedDeviceId = await storageService.getDeviceId();
    if (savedDeviceId) {
      setDeviceId(savedDeviceId);
    } else {
      setDeviceId('12345'); // Default value
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await storageService.saveSettings(newSettings);

    if (key === 'theme') {
      await toggleTheme();
    }
  };

  const handleSaveDeviceId = async () => {
    if (!deviceId.trim()) {
      Alert.alert('Error', 'Device ID cannot be empty');
      return;
    }

    try {
      // Save to storageService
      await storageService.setDeviceId(deviceId.trim());
      
      // Update device entry in local storage (single object, not array)
      const data = await localRecordService.getData();
      if (data.device && data.device !== null && typeof data.device === 'object') {
        // Update existing device entry with the new device ID
        data.device = {
          deviceId: deviceId.trim(),
        };
        
        // Save updated data back to local storage
        await AsyncStorage.setItem('@saved_records_v2', JSON.stringify(data));
      } else {
        // If no device exists, add a default device with the new device ID
        await localRecordService.saveRecord({
          device: {
            deviceId: deviceId.trim(),
          },
        });
      }
      
      Alert.alert('Success', 'Device ID saved successfully');
    } catch (error) {
      console.error('Error saving device ID:', error);
      Alert.alert('Error', 'Failed to save device ID');
    }
  };

  const handleExport = async () => {
    try {
      await exportSavedRecordsToExcel();
      Alert.alert('Export Complete', 'Saved records exported to Excel.');
    } catch (error) {
      Alert.alert(
        'Export Failed',
        error instanceof Error ? error.message : 'Unable to export records.'
      );
    }
  };

  const handleImport = () => {
    setImportDeviceIdInput('');
    setShowImportModal(true);
  };

  const handleImportConfirm = async () => {
    if (!importDeviceIdInput || !importDeviceIdInput.trim()) {
      Alert.alert('Error', 'Device ID cannot be empty');
      return;
    }
    setShowImportModal(false);
    await importSensorsFromAPI(importDeviceIdInput.trim());
  };

  const handleImportCancel = () => {
    setShowImportModal(false);
    setImportDeviceIdInput('');
  };

  const importSensorsFromAPI = async (importDeviceId: string) => {
    setIsImporting(true);
    try {
      // Construct API URL by replacing device ID in the path
      // Example: devices/1/full becomes devices/12345/full when deviceId is 12345
      const apiUrl = `https://3ltnur8y5k.execute-api.ap-south-1.amazonaws.com/default/getDeviceInfo-beaver/devices/${importDeviceId}/full`;
      console.log('Importing from API - Device ID:', importDeviceId);
      console.log('API URL:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          Alert.alert('Error', `No data found for Device ID: ${importDeviceId}`);
          setIsImporting(false);
          return;
        }
        throw new Error(`API error: ${response.status}`);
      }

      const responseData = await response.json();
      console.log('API Response:', JSON.stringify(responseData, null, 2));

      if (!responseData.sensors || responseData.sensors.length === 0) {
        Alert.alert('Info', `No sensors found for Device ID: ${importDeviceId}`);
        setIsImporting(false);
        return;
      }

      const { device: apiDevice, sensors: apiSensors, readings: apiReadings } = responseData;
      const deviceIdFromAPI = apiDevice?.deviceId || importDeviceId;

      let importedSensorsCount = 0;
      let importedReadingsCount = 0;
      let skippedSensorsCount = 0;

      // Check existing sensors to avoid duplicates
      const existingData = await localRecordService.getData();
      const existingSensorIds = new Set(existingData.sensors.map((s: any) => s.sensorId));

      // Import sensors
      for (const apiSensor of apiSensors) {
        // Skip if sensor already exists
        if (existingSensorIds.has(apiSensor.sensorId)) {
          skippedSensorsCount++;
          console.log(`Skipping existing sensor: ${apiSensor.sensorId}`);
          continue;
        }

        // Map API sensor to LocalSensor format (for DataContext)
        const localSensor: LocalSensor = {
          device_id: deviceIdFromAPI,
          sensor_id: apiSensor.sensorId,
          sensor_type: apiSensor.sensorType || '',
          sensor_group: apiSensor.group || null,
          sensor_unit: apiSensor.unit || '',
          temperature_unit: '°C',
          installation_date: apiDevice?.created_at || new Date().toISOString(),
          location: apiSensor.location || '',
          gauge_factor: apiSensor.gauge_factor || 0,
          initial_reading: apiSensor.initialReading || 0,
          initial_temperature: apiSensor.initial_temperature || null,
          initial_digit: apiSensor.initialReading
            ? CalculationService.calculateDigits(apiSensor.initialReading)
            : undefined,
          remark: '',
          calibration_timestamp: new Date().toISOString(),
        };

        // Save to DataContext
        await saveSensor(localSensor);

        // Map API sensor to SensorInfo format (for localRecordService)
        const sensorInfo = {
          sensorId: apiSensor.sensorId,
          sensorType: apiSensor.sensorType || '',
          group: apiSensor.group || null,
          location: apiSensor.location || '',
          initial_temperature: apiSensor.initial_temperature || null,
          initialReading: apiSensor.initialReading || null,
          unit: apiSensor.unit || '',
          gauge_factor: apiSensor.gauge_factor || null,
          remarks: '',
          created_at: apiDevice?.created_at || new Date().toISOString(),
          deviceId: deviceIdFromAPI,
        };

        // Save to localRecordService
        await localRecordService.saveRecord({
          device: {
            deviceId: deviceIdFromAPI,
          },
          sensor: sensorInfo,
        });

        importedSensorsCount++;
      }

      // Import readings
      if (apiReadings && apiReadings.length > 0) {
        for (const apiReading of apiReadings) {
          // Map API reading to ReadingInfo format
          const readingInfo = {
            sensorId: apiReading.sensorId,
            value: apiReading.value !== null && apiReading.value !== undefined ? apiReading.value : null,
            temperature: apiReading.temperature !== null && apiReading.temperature !== undefined ? apiReading.temperature : null,
            reading_digit: apiReading.reading_digit !== null && apiReading.reading_digit !== undefined ? apiReading.reading_digit : null,
            final_load: apiReading.final_load !== null && apiReading.final_load !== undefined ? String(apiReading.final_load) : null,
            timestamp: apiReading.timestamp || new Date().toISOString(),
            deviceId: deviceIdFromAPI,
          };

          // Save reading to localRecordService
          await localRecordService.saveRecord({
            device: {
              deviceId: deviceIdFromAPI,
            },
            reading: readingInfo,
          });

          importedReadingsCount++;
        }
      }

      // Reload sensors to refresh UI
      await loadSensors();

      // Show success message
      let message = `Successfully imported ${importedSensorsCount} sensor(s)`;
      if (importedReadingsCount > 0) {
        message += ` and ${importedReadingsCount} reading(s)`;
      }
      if (skippedSensorsCount > 0) {
        message += `\n${skippedSensorsCount} sensor(s) were skipped (already exist)`;
      }
      Alert.alert('Import Complete', message);

      setIsImporting(false);
    } catch (error) {
      console.error('Error importing sensors:', error);
      Alert.alert(
        'Import Failed',
        error instanceof Error ? error.message : 'Unable to import sensors. Please check your internet connection and try again.'
      );
      setIsImporting(false);
    }
  };

  const handleClearAllSensors = () => {
    Alert.alert(
      'Clear All Sensors',
      'This will delete all sensors from the application. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear sensors from DataContext
              await AsyncStorage.removeItem('@sensors');
              await AsyncStorage.removeItem('@current_sensor');
              
              // Clear sensors from localRecordService
              const data = await localRecordService.getData();
              data.sensors = [];
              await AsyncStorage.setItem('@saved_records_v2', JSON.stringify(data));
              
              // Reset current sensor state
              await setCurrentSensor(null);
              
              // Reload sensors to refresh UI
              await loadSensors();
              
              Alert.alert('Success', 'All sensors have been cleared.');
            } catch (error) {
              console.error('Error clearing sensors:', error);
              Alert.alert('Error', 'Failed to clear sensors.');
            }
          },
        },
      ]
    );
  };

  const handleFactoryReset = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all sensor data and reset settings. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear all storage keys (same logic as Clear button in dashboard)
              await AsyncStorage.multiRemove([
                '@saved_records_v2', // localRecordService
                '@sensors', // DataContext sensors
                '@readings', // DataContext readings
                '@current_sensor', // DataContext current sensor
                '@readout_settings', // storageService settings
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

              // Reset settings to defaults
            await storageService.clearAll();
              
              // Reload settings
            loadSettings();

              Alert.alert('Success', 'All data has been cleared.');
            } catch (error) {
              console.error('Error during factory reset:', error);
              Alert.alert('Error', 'Failed to complete factory reset.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <Image
          source={BeaverLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Readout Link</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Display Preferences</Text>

          <View style={[styles.settingRow, { borderBottomColor: colors.input }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Temperature Unit</Text>
            </View>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder },
                  settings.temperatureUnit === 'C' && styles.toggleButtonActive,
                ]}
                onPress={() => updateSetting('temperatureUnit', 'C')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    { color: colors.textTertiary },
                    settings.temperatureUnit === 'C' && styles.toggleButtonTextActive,
                  ]}
                >
                  °C
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder },
                  settings.temperatureUnit === 'F' && styles.toggleButtonActive,
                ]}
                onPress={() => updateSetting('temperatureUnit', 'F')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    { color: colors.textTertiary },
                    settings.temperatureUnit === 'F' && styles.toggleButtonTextActive,
                  ]}
                >
                  °F
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder },
                  settings.temperatureUnit === 'K' && styles.toggleButtonActive,
                ]}
                onPress={() => updateSetting('temperatureUnit', 'K')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    { color: colors.textTertiary },
                    settings.temperatureUnit === 'K' && styles.toggleButtonTextActive,
                  ]}
                >
                  °K
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.settingRow, { borderBottomColor: colors.input }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: colors.textSecondary }]}>Theme</Text>
            </View>
            <View style={styles.toggleGroup}>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder },
                  settings.theme === 'light' && styles.toggleButtonActive,
                ]}
                onPress={() => updateSetting('theme', 'light')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    { color: colors.textTertiary },
                    settings.theme === 'light' && styles.toggleButtonTextActive,
                  ]}
                >
                  Light
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.input, borderColor: colors.inputBorder },
                  settings.theme === 'dark' && styles.toggleButtonActive,
                ]}
                onPress={() => updateSetting('theme', 'dark')}
              >
                <Text
                  style={[
                    styles.toggleButtonText,
                    { color: colors.textTertiary },
                    settings.theme === 'dark' && styles.toggleButtonTextActive,
                  ]}
                >
                  Dark
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Device Configuration</Text>

          <View style={styles.deviceIdContainer}>
            <Text style={[styles.deviceIdLabel, { color: colors.textSecondary }]}>Device ID</Text>
            <TextInput
              style={[styles.deviceIdInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter device ID"
              placeholderTextColor={colors.textTertiary}
              value={deviceId}
              onChangeText={setDeviceId}
              keyboardType="default"
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.saveDeviceIdButton, { backgroundColor: colors.primary }]}
              onPress={handleSaveDeviceId}
            >
              <Text style={styles.saveDeviceIdButtonText}>Save Device ID</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Management</Text>

          <TouchableOpacity
            style={[styles.exportButton, { borderColor: colors.primary }]}
            onPress={handleExport}
          >
            <Text style={[styles.exportButtonText, { color: colors.primary }]}>Export to Excel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.importButton,
              { borderColor: colors.primary },
              isImporting && styles.importButtonDisabled,
            ]}
            onPress={handleImport}
            disabled={isImporting}
          >
            <Text style={[styles.importButtonText, { color: colors.primary }]}>
              {isImporting ? 'Importing...' : 'Import Sensors'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>About</Text>

          <View style={[styles.infoRow, { borderBottomColor: colors.input }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>App Version</Text>
            <Text style={[styles.infoValue, { color: colors.textTertiary }]}>1.0.0</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.input }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Build Date</Text>
            <Text style={[styles.infoValue, { color: colors.textTertiary }]}>2025-11-10</Text>
          </View>
        </View>

        <View style={styles.dangerSection}>
          <TouchableOpacity 
            style={[styles.clearSensorsButton, { borderColor: colors.border }]} 
            onPress={handleClearAllSensors}
          >
            <Text style={[styles.clearSensorsButtonText, { color: colors.text }]}>Clear All Sensors</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.dangerButton} onPress={handleFactoryReset}>
            <Text style={styles.dangerButtonText}>Clear All Data</Text>
          </TouchableOpacity>
          <Text style={[styles.dangerWarning, { color: colors.textTertiary }]}>
            This will delete all sensor data and reset settings
          </Text>
        </View>
      </ScrollView>

      {/* Import Modal */}
      <Modal
        visible={showImportModal}
        transparent
        animationType="fade"
        onRequestClose={handleImportCancel}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Import Sensors</Text>
            <Text style={[styles.modalDescription, { color: colors.textSecondary }]}>
              Enter the Device ID to import sensors and readings from the cloud:
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter Device ID"
              placeholderTextColor={colors.textTertiary}
              value={importDeviceIdInput}
              onChangeText={setImportDeviceIdInput}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel, { borderColor: colors.border }]}
                onPress={handleImportCancel}
              >
                <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, { backgroundColor: colors.primary }]}
                onPress={handleImportConfirm}
              >
                <Text style={[styles.modalButtonText, { color: '#FFFFFF' }]}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  logo: {
    width: 120,
    height: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 60,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButtonTextActive: {
    color: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
  },
  dangerSection: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 24,
    gap: 12,
  },
  clearSensorsButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  clearSensorsButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  dangerWarning: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  exportButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  exportButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  importButton: {
    borderWidth: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  importButtonDisabled: {
    opacity: 0.5,
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxWidth: 400,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    borderWidth: 1,
  },
  modalButtonConfirm: {
    // backgroundColor handled inline
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deviceIdContainer: {
    gap: 12,
  },
  deviceIdLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  deviceIdInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  saveDeviceIdButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveDeviceIdButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
