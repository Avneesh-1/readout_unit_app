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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi, WifiOff, Battery, Activity, Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { CalculationService } from '../../services/calculationService';
import { storageService } from '../../services/storageService';
import { uartService } from '../../services/uartService';
import { localRecordService } from '../../services/localRecordService';

export default function Dashboard() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    currentSensor,
    currentReading,
    isConnected,
    isFetching,
    isOnline,
    sensors,
    startFetching,
    stopFetching,
    setCurrentSensor,
    uploadReadings,
    loadSensors,
  } = useData();

  const [sensorModalVisible, setSensorModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState<'C' | 'F' | 'K'>('C');
  const [usbStatus, setUsbStatus] = useState(false);

  useEffect(() => {
    loadSettings();
    const unsubscribe = uartService.onConnectionChange((status) => {
    setUsbStatus(status);
    });

  return unsubscribe;
  }, []);

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

  const loadSettings = async () => {
    const settings = await storageService.getSettings();
    setTemperatureUnit(settings.temperatureUnit);
  };

  const handleFetchToggle = async () => {
    if (!currentSensor) {
      Alert.alert("Select Sensor", "Please select a sensor first");
      return;
    }

    if (!uartService.isUSBConnected()) {
      Alert.alert("USB Not Connected", "Press Connect USB first.");
      return;
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
      await setCurrentSensor(sensor);
      setSensorModalVisible(false);
    }
  };

  const handlePush = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Please connect to Wi-Fi to upload data.');
      return;
    }

    try {
      await uploadReadings();
      Alert.alert('Success', 'Data uploaded successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to upload data.');
    }
  };

  const handleSaveRecord = async () => {
    if (!currentSensor) {
      Alert.alert('Select Sensor', 'Please select a sensor before saving.');
      return;
    }

    try {
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

      await localRecordService.saveRecord({
        device: {
          deviceId: currentSensor.device_id ?? null,
          deviceName: currentSensor.device_id ?? 'Readout Unit',
          location: currentSensor.location ?? '',
        }, // devices no longer track created_at
        sensor: {
          sensorId: currentSensor.sensor_id,
          sensorType: currentSensor.sensor_type,
          group: currentSensor.sensor_group,
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
      Alert.alert('Saved', 'Reading stored locally.');
    } catch (error) {
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

  const digits = currentReading ? CalculationService.calculateDigits(currentReading.Freq) : null;

  const frequency = currentReading?.Freq ?? null;
  const battery = currentReading?.Bat ?? null;
  const isCharging = currentReading?.Charge === 1;

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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Readout Unit</Text>
        <View style={styles.headerRight}>
          <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
          {isOnline ? <Wifi size={20} color="#10B981" /> : <WifiOff size={20} color="#EF4444" />}
        </View>
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

         <View style={styles.statusItem}>
            <Battery size={20} color="#3B82F6" />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{battery !== null ? `${battery}%` : '-'}</Text>
            {isCharging && <Zap size={16} color="#EAB308" fill="#EAB308" />}
          </View>
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
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, isFetching && styles.primaryButtonActive]}
            onPress={handleFetchToggle}
          >
            <Text style={styles.primaryButtonText}>{isFetching ? 'Stop' : 'Fetch'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleSaveRecord}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Save</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handleClearData}
          >
            <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}
            onPress={handlePush}
            disabled={!isOnline}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.primary }, !isOnline && styles.buttonTextDisabled]}>
              Push to Cloud
            </Text>
          </TouchableOpacity>

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
                  <TouchableOpacity
                    key={sensor.sensor_id}
                    style={[styles.sensorItem, { borderBottomColor: colors.border }]}
                    onPress={() => handleSensorSelect(sensor.sensor_id)}
                  >
                    <Text style={[styles.sensorItemId, { color: colors.text }]}>{sensor.sensor_id}</Text>
                    {sensor.remark && (
                      <Text style={[styles.sensorItemRemark, { color: colors.textTertiary }]}>{sensor.remark}</Text>
                    )}
                  </TouchableOpacity>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  statusOnline: {
    backgroundColor: '#10B981',
  },
  statusOffline: {
    backgroundColor: '#EF4444',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sensorSelector: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sensorLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sensorValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sensorRemark: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 2,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
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
    gap: 14,
    marginBottom: 20,
  },
  readingCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  readingLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readingValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  readingUnit: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
    marginTop: 2,
  },
  calibrationInfo: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  actionButtons: {
    gap: 14,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonActive: {
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
    letterSpacing: 0.3,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  searchInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  sensorList: {
    maxHeight: 350,
    marginBottom: 20,
  },
  sensorItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 4,
  },
  sensorItemId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  sensorItemRemark: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  noSensorsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 30,
  },
  modalCloseButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalCloseButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
