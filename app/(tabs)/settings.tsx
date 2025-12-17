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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService, AppSettings } from '../../services/storageService';
import { useTheme } from '../../contexts/ThemeContext';
import { useData } from '../../contexts/DataContext';
import { localRecordService } from '../../services/localRecordService';
import { exportSavedRecordsToExcel } from '../../services/exportService';
// Direct require for APK compatibility - most reliable way
const BeaverLogo = require('../../assets/images/beaver-logo.png');

export default function Settings() {
  const { colors, theme, toggleTheme } = useTheme();
  const { setCurrentSensor, loadSensors } = useData();
  const [settings, setSettings] = useState<AppSettings>({
    autoUpload: false,
    temperatureUnit: 'C',
    theme: 'light',
    brightness: 80,
  });
  const [deviceId, setDeviceId] = useState<string>('12345');

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
  },
  exportButtonText: {
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
