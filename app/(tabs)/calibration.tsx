import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { CalculationService } from '../../services/calculationService';
// Direct require for APK compatibility - most reliable way
const BeaverLogo = require('../../assets/images/beaver-logo.png');

export default function Calibration() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { saveSensor, deleteSensor, sensors, currentReading } = useData();
  const { width } = useWindowDimensions();

  // Check if we're in edit mode
  const isEditMode = params.editMode === 'true';
  // Parse sensor data only once using useMemo to prevent infinite loops
  const editSensorData = useMemo(() => {
    if (params.sensorData) {
      try {
        return JSON.parse(params.sensorData as string);
      } catch (e) {
        console.error('Error parsing sensor data:', e);
        return null;
      }
    }
    return null;
  }, [params.sensorData]);
  
  // Use ref to track if we've already loaded the data
  const hasLoadedEditData = useRef(false);
  // Store the original sensor ID when in edit mode (to delete old sensor if ID changes)
  const originalSensorId = useRef<string | null>(null);

  const [deviceId, setDeviceId] = useState('');
  const [sensorId, setSensorId] = useState('');
  const [sensorType, setSensorType] = useState<string>('');
  const [sensorGroup, setSensorGroup] = useState('');
  const [sensorUnit, setSensorUnit] = useState('');
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [dateInput, setDateInput] = useState('');
  const [createdAt, setCreatedAt] = useState(new Date());
  const [location, setLocation] = useState('');
  const [gaugeFactor, setGaugeFactor] = useState('');
  const [initialReading, setInitialReading] = useState('');
  const [temperatureCelsius, setTemperatureCelsius] = useState('');
  const [temperatureInput, setTemperatureInput] = useState('');
  const [remark, setRemark] = useState('');
  const [digits, setDigits] = useState(0);
  const [showSensorTypeDropdown, setShowSensorTypeDropdown] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showSensorGroupDropdown, setShowSensorGroupDropdown] = useState(false);
  const [showSensorIdSuffixDropdown, setShowSensorIdSuffixDropdown] = useState(false);
  const [sensorIdSuffix, setSensorIdSuffix] = useState<string>('');

  const sensorTypes = ['Strain Gauge', 'Load Cell', '4–20 mA', '0–10 V'];
  const unitOptions = [
    'μɛ (micro strain)',
    'kN (kilo newton)',
    'kg/cm²',
    'mm',
  ];

  // Get unique sensor groups from existing sensors
  const existingSensorGroups = useMemo(() => {
    const groups = sensors
      .map((s) => s.sensor_group)
      .filter((group): group is string => Boolean(group && group.trim()))
      .filter((group, index, self) => self.indexOf(group) === index) // Get unique values
      .sort();
    return groups;
  }, [sensors]);

  // Auto-calculate digits from initial reading (applies to both add and update sensor)
  useEffect(() => {
    if (initialReading && !isNaN(parseFloat(initialReading))) {
      const calculatedDigits = CalculationService.calculateDigits(parseFloat(initialReading));
      setDigits(calculatedDigits);
    } else if (!initialReading) {
      setDigits(0);
    }
  }, [initialReading]);

  // Find next available suffix for a sensor group
  const getNextAvailableSuffix = (group: string): string => {
    if (!group.trim()) return '';
    
    const groupSensors = sensors.filter(s => 
      s.sensor_group === group.trim() && 
      s.sensor_id.startsWith(group.trim() + '-')
    );
    
    const usedSuffixes = groupSensors
      .map(s => {
        const parts = s.sensor_id.split('-');
        const suffix = parts[parts.length - 1];
        return suffix;
      })
      .filter(suffix => ['1', '2', '3'].includes(suffix))
      .map(s => parseInt(s))
      .filter(n => !isNaN(n));
    
    // Find next available suffix (1, 2, or 3)
    for (let i = 1; i <= 3; i++) {
      if (!usedSuffixes.includes(i)) {
        return i.toString();
      }
    }
    
    // If all 1, 2, 3 are used, return empty (user can still select manually)
    return '';
  };

  // Auto-populate Sensor ID from Sensor Group for Load Cell
  useEffect(() => {
    if (sensorType === 'Load Cell') {
      if (sensorGroup.trim()) {
        // Auto-select next available suffix when sensor group is selected
        if (!sensorIdSuffix) {
          const nextSuffix = getNextAvailableSuffix(sensorGroup.trim());
          if (nextSuffix) {
            setSensorIdSuffix(nextSuffix);
          }
        }
        
        // Auto-populate Sensor ID with Sensor Group value + suffix if selected
        const baseId = sensorGroup.trim();
        const finalId = sensorIdSuffix ? `${baseId}-${sensorIdSuffix}` : baseId;
        setSensorId(finalId);
      } else {
        // Clear Sensor ID and suffix if Sensor Group is cleared
        setSensorId('');
        setSensorIdSuffix('');
      }
    } else {
      // Clear suffix when sensor type is not Load Cell
      setSensorIdSuffix('');
    }
  }, [sensorType, sensorGroup, sensorIdSuffix, sensors]);

  // Auto-populate initial reading and temperature from Arduino device data (both add and update mode)
  useEffect(() => {
    if (sensorType && currentReading) {
      // Update initial reading based on sensor type
      let readingValue: number | null = null;
      switch (sensorType) {
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
      }

      // Update initial reading if value is available
      if (readingValue !== null && !isNaN(readingValue)) {
        setInitialReading(readingValue.toString());
      }

      // Update temperature (always available regardless of sensor type)
      if (currentReading.Temp !== null && currentReading.Temp !== undefined && !isNaN(currentReading.Temp)) {
        const tempValue = currentReading.Temp.toString();
        setTemperatureInput(tempValue);
        setTemperatureCelsius(tempValue);
      }
    }
  }, [sensorType, currentReading]);

  useEffect(() => {
    const interval = setInterval(() => setCreatedAt(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Clear all fields when switching to add mode (not edit mode)
  const clearAllFields = React.useCallback(() => {
    setSensorId('');
    setDeviceId('');
    setSensorType('');
    setSensorGroup('');
    setSensorIdSuffix('');
    setSensorUnit('');
    setInstallationDate(null);
    setDateInput('');
    setLocation('');
    setGaugeFactor('');
    setInitialReading('');
    setTemperatureCelsius('');
    setTemperatureInput('');
    setRemark('');
    setDigits(0);
    originalSensorId.current = null;
    hasLoadedEditData.current = false;
  }, []);

  // Clear all fields when switching to add mode
  useEffect(() => {
    // If we're not in edit mode and there's no edit data, clear all fields
    if (!isEditMode && !editSensorData) {
      clearAllFields();
    }
  }, [isEditMode, editSensorData, clearAllFields]);

  // Load sensor data when in edit mode - reset ref when sensorData changes
  useEffect(() => {
    // Reset the ref when sensorData changes (new sensor being edited)
    if (params.sensorData) {
      hasLoadedEditData.current = false;
      originalSensorId.current = null; // Reset original sensor ID
    }
  }, [params.sensorData]);

  // Load sensor data when in edit mode
  useEffect(() => {
    if (isEditMode && editSensorData && !hasLoadedEditData.current) {
      // Pre-populate all fields with existing sensor data
      const formatDateForInput = (date: Date | null) => {
        if (!date) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year}`;
      };

      // Store the original sensor ID for deletion if it changes
      originalSensorId.current = editSensorData.sensor_id || null;
      
      setSensorId(editSensorData.sensor_id || '');
      setSensorType(editSensorData.sensor_type || '');
      setSensorGroup(editSensorData.sensor_group || '');
      setSensorUnit(editSensorData.sensor_unit || '');
      setLocation(editSensorData.location || '');
      setGaugeFactor(editSensorData.gauge_factor?.toString() || '');
      setInitialReading(editSensorData.initial_reading?.toString() || '');
      // Digits will be auto-calculated from initial reading via useEffect
      setRemark(editSensorData.remark || '');
      setDeviceId(editSensorData.device_id?.toString() || '');
      
      // Handle installation date
      if (editSensorData.installation_date) {
        try {
          const date = new Date(editSensorData.installation_date);
          if (!isNaN(date.getTime())) {
            setInstallationDate(date);
            setDateInput(formatDateForInput(date));
          }
        } catch (e) {
          console.error('Error parsing installation date:', e);
        }
      }
      
      // Handle initial temperature
      if (editSensorData.initial_temperature !== null && editSensorData.initial_temperature !== undefined) {
        const tempValue = editSensorData.initial_temperature.toString();
        setTemperatureCelsius(tempValue);
        setTemperatureInput(tempValue);
      }
      
      // Mark as loaded to prevent re-loading
      hasLoadedEditData.current = true;
    }
    
    // Reset the flag when not in edit mode
    if (!isEditMode) {
      hasLoadedEditData.current = false;
    }
  }, [isEditMode, editSensorData]);

  // Clear all fields when in add mode (not edit mode) and no edit data
  useEffect(() => {
    if (!isEditMode && !editSensorData) {
      // Clear all form fields when adding a new sensor
      setSensorId('');
      setDeviceId('');
      setSensorType('');
      setSensorGroup('');
      setSensorUnit('');
      setInstallationDate(null);
      setDateInput('');
      setLocation('');
      setGaugeFactor('');
      setInitialReading('');
      setTemperatureCelsius('');
      setTemperatureInput('');
      setRemark('');
      setDigits(0);
      originalSensorId.current = null;
    }
  }, [isEditMode, editSensorData]);

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString() : 'Select installation date';
  
  const formatDateDDMMYYYY = (date: Date | null) => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const convertCelsiusToUnit = (value: number, unit: string) => {
    if (isNaN(value)) return '';
    if (unit === '°F') {
      return typeof CalculationService.convertCelsiusToFahrenheit === 'function'
        ? CalculationService.convertCelsiusToFahrenheit(value)
        : (value * 9) / 5 + 32;
    }
    if (unit === 'K') {
      return typeof CalculationService.convertCelsiusToKelvin === 'function'
        ? CalculationService.convertCelsiusToKelvin(value)
        : value + 273.15;
    }
    return value;
  };

  const convertUnitToCelsius = (value: number, unit: string) => {
    if (isNaN(value)) return NaN;
    if (unit === '°F') {
      return typeof CalculationService.convertFahrenheitToCelsius === 'function'
        ? CalculationService.convertFahrenheitToCelsius(value)
        : ((value - 32) * 5) / 9;
    }
    if (unit === 'K') {
      return typeof CalculationService.convertKelvinToCelsius === 'function'
        ? CalculationService.convertKelvinToCelsius(value)
        : value - 273.15;
    }
    return value;
  };

  const handleTemperatureChange = (value: string) => {
    setTemperatureInput(value);
    const numericValue = parseFloat(value);
    if (isNaN(numericValue)) {
      setTemperatureCelsius('');
      return;
    }
    // Temperature is always in Celsius, so no conversion needed
    setTemperatureCelsius(numericValue.toString());
  };


  const handleSave = async () => {
    if (!sensorId.trim()) {
      Alert.alert('Error', 'Please enter a sensor ID');
      return;
    }

    if (!sensorType) {
      Alert.alert('Error', 'Please select a sensor type');
      return;
    }


    if (!sensorUnit) {
      Alert.alert('Error', 'Please select a unit');
      return;
    }

    if (!installationDate) {
      Alert.alert('Error', 'Please select the date of installation');
      return;
    }

    if (!location.trim()) {
      Alert.alert('Error', 'Please enter location');
      return;
    }

    if (!gaugeFactor.trim() || isNaN(parseFloat(gaugeFactor))) {
      Alert.alert('Error', 'Please enter a valid gauge factor');
      return;
    }

    try {
      // Capture current values from Arduino device at the moment of save (snapshot)
      let capturedInitialReading: number;
      let capturedTemperature: number | undefined;

      if (currentReading && sensorType) {
        // Capture initial reading based on sensor type from current live data
        let readingValue: number | null = null;
        switch (sensorType) {
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
        }

        if (readingValue !== null && !isNaN(readingValue)) {
          capturedInitialReading = readingValue;
        } else {
          // Fallback to state value if live data not available
          if (!initialReading.trim() || isNaN(parseFloat(initialReading))) {
            Alert.alert('Error', 'Please enter a valid initial reading or ensure device is connected');
            return;
          }
          capturedInitialReading = parseFloat(initialReading);
        }

        // Capture temperature from current live data
        if (currentReading.Temp !== null && currentReading.Temp !== undefined && !isNaN(currentReading.Temp)) {
          capturedTemperature = currentReading.Temp;
        } else {
          // Fallback to state value if live data not available
          if (!temperatureInput.trim() || isNaN(parseFloat(temperatureInput))) {
            Alert.alert('Error', 'Please enter a valid temperature or ensure device is connected');
            return;
          }
          capturedTemperature = parseFloat(temperatureInput);
        }
      } else {
        // No live data available, use state values
    if (!initialReading.trim() || isNaN(parseFloat(initialReading))) {
      Alert.alert('Error', 'Please enter a valid initial reading');
      return;
    }
        if (!temperatureInput.trim() || isNaN(parseFloat(temperatureInput))) {
      Alert.alert('Error', 'Please enter a valid temperature');
      return;
    }
        capturedInitialReading = parseFloat(initialReading);
        capturedTemperature = parseFloat(temperatureInput);
      }

      // Calculate digits from captured initial reading
      const capturedDigits = CalculationService.calculateDigits(capturedInitialReading);

      // If in edit mode and sensor ID has changed, delete the old sensor
      if (isEditMode && originalSensorId.current && originalSensorId.current !== sensorId.trim()) {
        await deleteSensor(originalSensorId.current);
      }

      await saveSensor({
        device_id: deviceId.trim() || sensorId.trim() || null,
        sensor_id: sensorId.trim(),
        sensor_type: sensorType,
        sensor_group: sensorGroup.trim() || null,
        sensor_unit: sensorUnit,
        installation_date: installationDate ? CalculationService.formatTimestamp(installationDate) : '',
        location: location.trim(),
        gauge_factor: parseFloat(gaugeFactor),
        initial_reading: capturedInitialReading,
        temperature_unit: '°C',
        initial_temperature: capturedTemperature,
        initial_digit: capturedDigits,
        remark: remark.trim(),
        calibration_timestamp: CalculationService.formatTimestamp(new Date()),
      });

      setSensorId('');
      setDeviceId('');
      setSensorType('');
      setSensorGroup('');
      setSensorUnit('');
      setInstallationDate(null);
      setDateInput('');
      setLocation('');
      setGaugeFactor('');
      setInitialReading('');
      setTemperatureCelsius('');
      setTemperatureInput('');
      setRemark('');
      setCreatedAt(new Date());
      Alert.alert('Success', isEditMode ? 'Sensor updated successfully!' : 'Sensor added successfully!');
      router.back();
    } catch (error) {
      Alert.alert('Error', 'Failed to save sensor');
    }
  };

  const handleCancel = () => {
    router.back();
  };


  const isLargeScreen = width > 600;
  const numColumns = isLargeScreen ? 2 : 1;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground, borderBottomColor: colors.border }]}>
        <Image
          source={BeaverLogo}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Readout Link</Text>
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
        <Text style={[styles.title, { color: colors.text }]}>
          {isEditMode ? 'Edit Sensor' : 'Add New Sensor'}
        </Text>

        <View style={styles.form}>
          {/* Sensor Type - First field */}
          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sensor Type *</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
                onPress={() => setShowSensorTypeDropdown(true)}
              >
                <Text style={[styles.dropdownText, { color: sensorType ? colors.text : colors.textTertiary }]}>
                  {sensorType || 'Select sensor type'}
                </Text>
                <ChevronDown size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {/* Sensor Group - Only show when Sensor Type is "Load Cell" */}
            {sensorType === 'Load Cell' && (
              <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Sensor Group (optional)</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text, paddingRight: existingSensorGroups.length > 0 ? 40 : 12 }]}
                    placeholder="Enter or select sensor group"
                    placeholderTextColor={colors.textTertiary}
                    value={sensorGroup}
                    onChangeText={setSensorGroup}
                    autoCapitalize="sentences"
                  />
                  {existingSensorGroups.length > 0 && (
                    <TouchableOpacity
                      style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
                      onPress={() => setShowSensorGroupDropdown(true)}
                    >
                      <ChevronDown size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>

          {/* Sensor ID - Below Sensor Group */}
          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sensor ID *</Text>
              {sensorType === 'Load Cell' && sensorGroup.trim() ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, justifyContent: 'center', paddingVertical: 12, flex: 1 }]}>
                    <Text style={[styles.readOnlyValue, { color: colors.text }]}>
                      {sensorGroup.trim()}
                    </Text>
                  </View>
                  <Text style={[styles.readOnlyValue, { color: colors.text, fontSize: 18, marginHorizontal: 4 }]}>-</Text>
                  <TouchableOpacity
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, minWidth: 70, maxWidth: 100 }]}
                    onPress={() => setShowSensorIdSuffixDropdown(true)}
                  >
                    <Text style={[styles.readOnlyValue, { color: sensorIdSuffix ? colors.text : colors.textTertiary, fontSize: 16 }]}>
                      {sensorIdSuffix || 'Select'}
                    </Text>
                    <ChevronDown size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              ) : (
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter sensor ID"
                placeholderTextColor={colors.textTertiary}
                value={sensorId}
                onChangeText={setSensorId}
                  autoCapitalize="sentences"
              />
              )}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Installation *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="DD-MM-YYYY (e.g., 01-12-2025)"
              placeholderTextColor={colors.textTertiary}
              value={dateInput}
              onChangeText={(text) => {
                // Remove all non-digit characters
                const digitsOnly = text.replace(/\D/g, '');
                
                // Auto-format with dashes: DD-MM-YYYY
                let formatted = '';
                if (digitsOnly.length > 0) {
                  formatted = digitsOnly.substring(0, 2); // DD
                  if (digitsOnly.length > 2) {
                    formatted += '-' + digitsOnly.substring(2, 4); // DD-MM
                    if (digitsOnly.length > 4) {
                      formatted += '-' + digitsOnly.substring(4, 8); // DD-MM-YYYY
                    }
                  }
                }
                
                setDateInput(formatted);
                
                // Try to parse the date in DD-MM-YYYY format when complete
                if (formatted.length === 10) {
                  const dateMatch = formatted.match(/(\d{2})-(\d{2})-(\d{4})/);
                  if (dateMatch) {
                    const day = parseInt(dateMatch[1], 10);
                    const month = parseInt(dateMatch[2], 10) - 1; // Month is 0-indexed
                    const year = parseInt(dateMatch[3], 10);
                    
                    // Validate date values
                    if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900 && year <= 2100) {
                      const parsedDate = new Date(year, month, day);
                      // Verify the date is valid (handles invalid dates like Feb 30)
                      if (parsedDate.getDate() === day && parsedDate.getMonth() === month && parsedDate.getFullYear() === year) {
                        setInstallationDate(parsedDate);
                      } else {
                        // Invalid date (e.g., Feb 30), clear installationDate
                        setInstallationDate(null);
                      }
                    } else {
                      setInstallationDate(null);
                    }
                  } else {
                    setInstallationDate(null);
                  }
                } else {
                  // Date is incomplete, clear installationDate
                  setInstallationDate(null);
                }
              }}
              keyboardType="numeric"
              maxLength={10}
            />
          </View>

          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Gauge Factor *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter gauge factor"
                placeholderTextColor={colors.textTertiary}
                value={gaugeFactor}
                onChangeText={setGaugeFactor}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Unit *</Text>
              <TouchableOpacity
                style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
                onPress={() => setShowUnitDropdown(true)}
              >
                <Text style={[styles.dropdownText, { color: sensorUnit ? colors.text : colors.textTertiary }]}>
                  {sensorUnit || 'Select unit'}
                </Text>
                <ChevronDown size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Initial Reading *</Text>
              {sensorType && currentReading ? (
                <View style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, justifyContent: 'center', paddingVertical: 12 }]}>
                  <Text style={[styles.readOnlyValue, { color: colors.text }]}>
                    {(() => {
                      let readingValue: number | null = null;
                      switch (sensorType) {
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
                      }
                      return readingValue !== null && !isNaN(readingValue) 
                        ? readingValue.toFixed(2) 
                        : 'Waiting for data...';
                    })()}
                  </Text>
                </View>
              ) : (
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter initial reading"
                placeholderTextColor={colors.textTertiary}
                value={initialReading}
                onChangeText={setInitialReading}
                keyboardType="decimal-pad"
              />
              )}
            </View>

            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Temperature (°C) *</Text>
              {currentReading ? (
                <View style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, justifyContent: 'center', paddingVertical: 12 }]}>
                  <Text style={[styles.readOnlyValue, { color: colors.text }]}>
                    {currentReading.Temp !== null && currentReading.Temp !== undefined && !isNaN(currentReading.Temp)
                      ? currentReading.Temp.toFixed(2)
                      : 'Waiting for data...'}
                  </Text>
                </View>
              ) : (
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                  placeholder="Enter temperature in Celsius"
                placeholderTextColor={colors.textTertiary}
                  value={temperatureInput}
                  onChangeText={handleTemperatureChange}
                keyboardType="decimal-pad"
              />
              )}
            </View>
          </View>

          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Digits *</Text>
              <View style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, justifyContent: 'center', paddingVertical: 12 }]}>
                <Text style={[styles.readOnlyValue, { color: colors.text }]}>
                  {digits > 0 ? digits.toFixed(2) : '0.00'}
                </Text>
              </View>
              <Text style={[styles.helperText, { color: colors.textTertiary, fontSize: 12, marginTop: 4 }]}>
                (Calculated from initial reading)
              </Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Location *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter installation location"
              placeholderTextColor={colors.textTertiary}
              value={location}
              onChangeText={setLocation}
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Remarks</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter remarks (optional)"
              placeholderTextColor={colors.textTertiary}
              value={remark}
              onChangeText={setRemark}
              autoCapitalize="sentences"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Created At field - hidden but code preserved */}
          {false && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Created At</Text>
              <View style={[styles.createdAtContainer, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}>
                <Text style={[styles.createdAtText, { color: colors.text }]}>{createdAt.toLocaleTimeString()}</Text>
              </View>
            </View>
          )}

          <View style={styles.buttonGroup}>
            <TouchableOpacity style={[styles.cancelButton, { backgroundColor: colors.input }]} onPress={handleCancel}>
              <Text style={[styles.cancelButtonText, { color: colors.textTertiary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>
                {isEditMode ? 'Update Sensor' : 'Save Sensor'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showSensorTypeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSensorTypeDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSensorTypeDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {sensorTypes.map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: colors.border },
                  sensorType === type && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setSensorType(type);
                  // Clear sensor group if not Load Cell
                  if (type !== 'Load Cell') {
                    setSensorGroup('');
                  }
                  setShowSensorTypeDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{type}</Text>
                {sensorType === type && (
                  <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={showUnitDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowUnitDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowUnitDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {unitOptions.map((unit) => (
              <TouchableOpacity
                key={unit}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: colors.border },
                  sensorUnit === unit && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setSensorUnit(unit);
                  setShowUnitDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{unit}</Text>
                {sensorUnit === unit && (
                  <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sensor Group Dropdown Modal */}
      <Modal
        visible={showSensorGroupDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSensorGroupDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSensorGroupDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {existingSensorGroups.length > 0 ? (
              existingSensorGroups.map((group) => (
                <TouchableOpacity
                  key={group}
                  style={[
                    styles.dropdownOption,
                    { borderBottomColor: colors.border },
                    sensorGroup === group && { backgroundColor: colors.input },
                  ]}
                  onPress={() => {
                    setSensorGroup(group);
                    // Auto-select next available suffix when group is selected
                    if (sensorType === 'Load Cell') {
                      const nextSuffix = getNextAvailableSuffix(group);
                      if (nextSuffix) {
                        setSensorIdSuffix(nextSuffix);
                      } else {
                        setSensorIdSuffix('');
                      }
                    }
                    setShowSensorGroupDropdown(false);
                  }}
                >
                  <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{group}</Text>
                  {sensorGroup === group && (
                    <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                  )}
                </TouchableOpacity>
              ))
            ) : (
              <View style={[styles.dropdownOption, { borderBottomColor: colors.border }]}>
                <Text style={[styles.dropdownOptionText, { color: colors.textTertiary }]}>
                  No existing sensor groups
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sensor ID Suffix Dropdown Modal (1, 2, 3) */}
      <Modal
        visible={showSensorIdSuffixDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSensorIdSuffixDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowSensorIdSuffixDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {['1', '2', '3'].map((suffix) => (
              <TouchableOpacity
                key={suffix}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: colors.border },
                  sensorIdSuffix === suffix && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  setSensorIdSuffix(suffix);
                  setShowSensorIdSuffixDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{suffix}</Text>
                {sensorIdSuffix === suffix && (
                  <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  form: {
    gap: 20,
  },
  row: {
    gap: 20,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  inputGroup: {
    gap: 8,
  },
  halfWidth: {
    flex: 1,
    minWidth: 280,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  calculatedGroup: {
    gap: 8,
  },
  calculatedValue: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  calculatedText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E40AF',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    width: '100%',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  readOnlyValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  dropdownText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    width: '80%',
    maxWidth: 400,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  dropdownOptionText: {
    fontSize: 16,
    flex: 1,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  iosDatePickerWrapper: {
    width: '85%',
    borderRadius: 16,
    padding: 16,
  },
  iosDatePickerDoneButton: {
    marginTop: 12,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  iosDatePickerDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  createdAtContainer: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  createdAtText: {
    fontSize: 16,
  },
  temperatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  temperatureInput: {
    flex: 1,
  },
  temperatureUnitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
  },
  temperatureUnitText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
