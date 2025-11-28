import * as FileSystem from 'expo-file-system/legacy';
import { StorageAccessFramework } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import XLSX from 'xlsx';
import {
  localRecordService,
  SavedData,
  SensorInfo,
  ReadingInfo,
} from './localRecordService';
import { CalculationService } from './calculationService';

// Helper function to format date string to readable local format
function formatDateString(dateStr: string | null | undefined): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  } catch (e) {
    // ignore and fall through
  }

  // Fallback to original string (possibly already formatted)
  return dateStr;
}

export async function exportSavedRecordsToExcel(): Promise<void> {
  const data = await localRecordService.getData();

  console.log(
    `Exporting: ${data.devices.length} devices, ${data.sensors.length} sensors, ${data.readings.length} readings`
  );

  if (data.devices.length === 0 && data.sensors.length === 0 && data.readings.length === 0) {
    throw new Error('No records available to export.');
  }

  // Create a map of sensorId to sensor info for quick lookup
  const sensorMap = new Map<string, SensorInfo>();
  data.sensors.forEach((sensor) => {
    sensorMap.set(sensor.sensorId, sensor);
  });

  // Get the latest device info (or first available)
  const latestDevice = data.devices.length > 0 ? data.devices[data.devices.length - 1] : null;

  // Combine sensors with readings - each reading creates a row
  const flatData: any[] = [];

  // If we have readings, create rows from readings + sensor info
  if (data.readings.length > 0) {
    data.readings.forEach((reading) => {
      const sensor = sensorMap.get(reading.sensorId);
      if (sensor) {
        // Calculate initial_digit from initial_reading
        const initialDigit =
          sensor.initialReading !== null && sensor.initialReading !== undefined
            ? CalculationService.calculateDigits(sensor.initialReading)
            : '';

        // Use final_load from reading if available, otherwise calculate it
        let finalLoad = reading.final_load ?? '';
        if (!finalLoad && 
          reading.value !== null &&
          reading.value !== undefined &&
          sensor.initialReading !== null &&
          sensor.initialReading !== undefined &&
          sensor.gauge_factor !== null &&
          sensor.gauge_factor !== undefined
        ) {
          finalLoad = CalculationService.calculateFinalLoad(
            reading.value,
            sensor.initialReading,
            sensor.gauge_factor
          ).toString();
        }

        flatData.push({
          sensor_id: sensor.sensorId,
          device_id: latestDevice?.deviceId ?? '',
          sensor_type: sensor.sensorType ?? '',
          sensor_group: sensor.group ?? '',
          created_at: formatDateString(sensor.created_at ?? ''),
          gauge_factor: sensor.gauge_factor ?? '',
          unit: sensor.unit ?? '',
          initial_reading: sensor.initialReading ?? '',
          initial_temperature: sensor.initial_temperature ?? '',
          initial_digit: initialDigit,
          location: latestDevice?.location ?? '',
          remarks: sensor.remarks ?? '',
          sensor_value: reading.value ?? '',
          temperature: reading.temperature ?? '',
          reading_digit: reading.reading_digit ?? '',
          final_load: finalLoad,
          reading_created_at: formatDateString(reading.timestamp),
        });
      }
    });
  }

  // If we have sensors without readings, add them as rows too
  data.sensors.forEach((sensor) => {
    // Only add if this sensor doesn't have any readings (to avoid duplicates)
    const hasReadings = data.readings.some((r) => r.sensorId === sensor.sensorId);
    if (!hasReadings) {
      // Calculate initial_digit
      const initialDigit =
        sensor.initialReading !== null && sensor.initialReading !== undefined
          ? CalculationService.calculateDigits(sensor.initialReading)
          : '';

      flatData.push({
        sensor_id: sensor.sensorId,
        device_id: latestDevice?.deviceId ?? '',
        sensor_type: sensor.sensorType ?? '',
        sensor_group: sensor.group ?? '',
        created_at: formatDateString(sensor.created_at ?? ''),
        gauge_factor: sensor.gauge_factor ?? '',
        unit: sensor.unit ?? '',
        initial_reading: sensor.initialReading ?? '',
        initial_temperature: sensor.initial_temperature ?? '',
        initial_digit: initialDigit,
        location: latestDevice?.location ?? '',
        remarks: sensor.remarks ?? '',
        sensor_value: '',
        temperature: '',
        reading_digit: '',
        final_load: '',
        reading_created_at: '',
      });
    }
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(flatData);

  // Auto-calculate column widths based on content
  const columnHeaders = [
    'sensor_id',
    'device_id',
    'sensor_type',
    'sensor_group',
    'created_at',
    'gauge_factor',
    'unit',
    'initial_reading',
    'initial_temperature',
    'initial_digit',
    'location',
    'remarks',
    'sensor_value',
    'temperature',
    'reading_digit',
    'final_load',
    'reading_created_at',
  ];

  const columnWidths = columnHeaders.map((header, colIndex) => {
    // Start with header width
    let maxWidth = header.length;

    // Check all data rows for this column
    flatData.forEach((row) => {
      const value = row[header];
      if (value !== null && value !== undefined) {
        const cellLength = String(value).length;
        if (cellLength > maxWidth) {
          maxWidth = cellLength;
        }
      }
    });

    // Add padding and set minimum/maximum widths
    return { wch: Math.min(Math.max(maxWidth + 2, 10), 50) };
  });

  worksheet['!cols'] = columnWidths;
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Saved Records');

  const wbout = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const filename = `saved-records-${Date.now()}.xlsx`;
  const encoding =
    (FileSystem.EncodingType && FileSystem.EncodingType.Base64) ||
    ('base64' as FileSystem.EncodingType);

  if (Platform.OS === 'android') {
    const permissions = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permissions.granted || !permissions.directoryUri) {
      throw new Error('Please choose a folder to save the Excel file.');
    }

    const uri = await StorageAccessFramework.createFileAsync(
      permissions.directoryUri,
      filename,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    await FileSystem.writeAsStringAsync(uri, wbout, { encoding });
    return;
  }

  const fileUri = `${FileSystem.documentDirectory ?? FileSystem.cacheDirectory}${filename}`;
  if (!fileUri) {
    throw new Error('Unable to access file system directory.');
  }

  await FileSystem.writeAsStringAsync(fileUri, wbout, { encoding });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Export Saved Records',
    UTI: 'com.microsoft.excel.xlsx',
  });
}


