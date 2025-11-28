import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Calendar, ChevronDown } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useData } from '../../contexts/DataContext';
import { useTheme } from '../../contexts/ThemeContext';
import { CalculationService } from '../../services/calculationService';

export default function Calibration() {
  const router = useRouter();
  const { colors } = useTheme();
  const { saveSensor } = useData();
  const { width } = useWindowDimensions();

  const [deviceId, setDeviceId] = useState('');
  const [sensorId, setSensorId] = useState('');
  const [sensorType, setSensorType] = useState<string>('');
  const [sensorGroup, setSensorGroup] = useState('');
  const [sensorUnit, setSensorUnit] = useState('');
  const [installationDate, setInstallationDate] = useState<Date | null>(null);
  const [createdAt, setCreatedAt] = useState(new Date());
  const [location, setLocation] = useState('');
  const [gaugeFactor, setGaugeFactor] = useState('');
  const [initialReading, setInitialReading] = useState('');
  const [temperatureCelsius, setTemperatureCelsius] = useState('');
  const [temperatureInput, setTemperatureInput] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState('°C');
  const [remark, setRemark] = useState('');
  const [digits, setDigits] = useState(0);
  const [showSensorTypeDropdown, setShowSensorTypeDropdown] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showUnitDropdown, setShowUnitDropdown] = useState(false);
  const [showTemperatureUnitDropdown, setShowTemperatureUnitDropdown] = useState(false);

  const sensorTypes = ['Strain Gauge', 'Load Cell', '4–20 mA', '0–10 V'];
  const unitOptions = [
    'Strain gauge - μɛ (micro strain)',
    'Load cell - kN (kilo newton)',
    'Stress cell - kg/cm²',
    'Crack meter - mm',
    'Displacement - mm',
    'Temperature - °C / °F / K',
  ];
  const temperatureUnitOptions = [
    { label: '°C (Celsius)', value: '°C' },
    { label: '°F (Fahrenheit)', value: '°F' },
    { label: 'K (Kelvin)', value: 'K' },
  ];

  useEffect(() => {
    if (initialReading && !isNaN(parseFloat(initialReading))) {
      const calculatedDigits = CalculationService.calculateDigits(parseFloat(initialReading));
      setDigits(calculatedDigits);
    } else {
      setDigits(0);
    }
  }, [initialReading]);

  useEffect(() => {
    const interval = setInterval(() => setCreatedAt(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDate = (date: Date | null) =>
    date ? date.toLocaleDateString() : 'Select installation date';

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
    const celsius = convertUnitToCelsius(numericValue, temperatureUnit);
    if (!isNaN(celsius)) {
      setTemperatureCelsius(celsius.toString());
    }
  };

  const handleTemperatureUnitSelect = (unit: string) => {
    setTemperatureUnit(unit);
    if (!temperatureCelsius) {
      setTemperatureInput('');
      return;
    }
    const numeric = parseFloat(temperatureCelsius);
    if (isNaN(numeric)) {
      setTemperatureInput('');
      return;
    }
    const converted = convertCelsiusToUnit(numeric, unit);
    setTemperatureInput(converted.toString());
  };

  const handleDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      setInstallationDate(selectedDate);
    }
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

    if (!sensorGroup.trim()) {
      Alert.alert('Error', 'Please enter a sensor group');
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

    if (!initialReading.trim() || isNaN(parseFloat(initialReading))) {
      Alert.alert('Error', 'Please enter a valid initial reading');
      return;
    }

    if (!temperatureInput.trim() || isNaN(parseFloat(temperatureInput))) {
      Alert.alert('Error', 'Please enter a valid temperature');
      return;
    }

    try {
      const temperatureValue = parseFloat(temperatureInput);
      const initialTempCelsius = convertUnitToCelsius(temperatureValue, temperatureUnit);

      await saveSensor({
        device_id: deviceId.trim() || null,
        sensor_id: sensorId.trim(),
        sensor_type: sensorType,
        sensor_group: sensorGroup.trim(),
        sensor_unit: sensorUnit,
        installation_date: installationDate ? CalculationService.formatTimestamp(installationDate) : '',
        location: location.trim(),
        gauge_factor: parseFloat(gaugeFactor),
        initial_reading: parseFloat(initialReading),
        temperature_unit: temperatureUnit,
        initial_temperature: isNaN(initialTempCelsius) ? undefined : initialTempCelsius,
        initial_digit: digits,
        remark: remark.trim(),
        calibration_timestamp: CalculationService.formatTimestamp(new Date()),
      });

      setSensorId('');
      setDeviceId('');
      setSensorType('');
      setSensorGroup('');
      setSensorUnit('');
      setInstallationDate(null);
      setLocation('');
      setGaugeFactor('');
      setInitialReading('');
      setTemperatureCelsius('');
      setTemperatureInput('');
      setTemperatureUnit('°C');
      setRemark('');
      setCreatedAt(new Date());
      Alert.alert('Success', 'Sensor added successfully!');
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
        <Text style={[styles.title, { color: colors.text }]}>Add New Sensor</Text>

        <View style={styles.form}>
          <View style={[styles.row, numColumns === 2 && styles.rowWrap]}>
            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sensor ID *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter sensor ID"
                placeholderTextColor={colors.textTertiary}
                value={sensorId}
                onChangeText={setSensorId}
                autoCapitalize="characters"
              />
            </View>
          </View>

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

            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Sensor Group *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter sensor group"
                placeholderTextColor={colors.textTertiary}
                value={sensorGroup}
                onChangeText={setSensorGroup}
                autoCapitalize="words"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Installation *</Text>
            <TouchableOpacity
              style={[styles.dropdown, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dropdownText, { color: installationDate ? colors.text : colors.textTertiary }]}>
                {formatDate(installationDate)}
              </Text>
              <Calendar size={20} color={colors.textTertiary} />
            </TouchableOpacity>
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
              <Text style={[styles.label, { color: colors.textSecondary }]}>Initial Reading (Hz) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text }]}
                placeholder="Enter initial reading"
                placeholderTextColor={colors.textTertiary}
                value={initialReading}
                onChangeText={setInitialReading}
                keyboardType="decimal-pad"
              />
            </View>

            <View style={[styles.inputGroup, numColumns === 2 && styles.halfWidth]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Temperature *</Text>
              <View style={styles.temperatureRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.temperatureInput,
                    { backgroundColor: colors.input, borderColor: colors.inputBorder, color: colors.text },
                  ]}
                  placeholder="Enter temperature"
                  placeholderTextColor={colors.textTertiary}
                  value={temperatureInput}
                  onChangeText={handleTemperatureChange}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity
                  style={[
                    styles.temperatureUnitButton,
                    { borderColor: colors.inputBorder, backgroundColor: colors.input },
                  ]}
                  onPress={() => setShowTemperatureUnitDropdown(true)}
                >
                  <Text style={[styles.temperatureUnitText, { color: colors.text }]}>{temperatureUnit}</Text>
                  <ChevronDown size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.calculatedGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Digits (Calculated)</Text>
            <View style={styles.calculatedValue}>
              <Text style={styles.calculatedText}>
                {CalculationService.formatNumber(digits, 2)}
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
              autoCapitalize="words"
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
              <Text style={styles.saveButtonText}>Save Sensor</Text>
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

      <Modal
        visible={showTemperatureUnitDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTemperatureUnitDropdown(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTemperatureUnitDropdown(false)}
        >
          <View style={[styles.dropdownModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {temperatureUnitOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownOption,
                  { borderBottomColor: colors.border },
                  temperatureUnit === option.value && { backgroundColor: colors.input },
                ]}
                onPress={() => {
                  handleTemperatureUnitSelect(option.value);
                  setShowTemperatureUnitDropdown(false);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{option.label}</Text>
                {temperatureUnit === option.value && (
                  <Text style={[styles.checkmark, { color: colors.primary }]}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker
          value={installationDate ?? new Date()}
          mode="date"
          display="calendar"
          maximumDate={new Date()}
          onChange={(event, date) => {
            handleDateChange(event, date ?? installationDate ?? new Date());
          }}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.iosDatePickerWrapper, { backgroundColor: colors.surface }]}>
              <DateTimePicker
                value={installationDate ?? new Date()}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
              <TouchableOpacity
                style={[styles.iosDatePickerDoneButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={[styles.iosDatePickerDoneText, { color: colors.primaryText }]}>Done</Text>
              </TouchableOpacity>
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
