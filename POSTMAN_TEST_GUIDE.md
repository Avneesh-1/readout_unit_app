# Postman Test Guide for Push to Cloud API

## API Endpoint
```
POST https://3ltnur8y5k.execute-api.ap-south-1.amazonaws.com/default/pushtocloud-beaver
```

## Headers
```
Content-Type: application/json
```

## Request Body Format

The app sends the complete local storage structure with devices, sensors, and readings:

```json
{
  "devices": [
    {
      "deviceId": "DEVICE001",
      "deviceName": "Readout Unit",
      "location": "Delhi"
    }
  ],
  "sensors": [
    {
      "sensorId": "SENSOR001",
      "sensorType": "Strain Gauge",
      "group": "Group A",
      "initial_temperature": 25.5,
      "initialReading": 1000,
      "unit": "Strain gauge - μɛ (micro strain)",
      "gauge_factor": 2.5,
      "remarks": "Test sensor",
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ],
  "readings": [
    {
      "sensorId": "SENSOR001",
      "value": 2475,
      "temperature": 23.8,
      "reading_digit": 123.45,
      "final_load": "567.89",
      "timestamp": "2025-01-15T10:35:00.000Z"
    },
    {
      "sensorId": "SENSOR001",
      "value": 2500,
      "temperature": 24.0,
      "reading_digit": 125.00,
      "final_load": "580.00",
      "timestamp": "2025-01-15T10:36:00.000Z"
    }
  ]
}
```

## Sample Test Data

### Minimal Example (Single Reading)
```json
{
  "devices": [
    {
      "deviceId": null,
      "deviceName": "Readout Unit",
      "location": "Test Location"
    }
  ],
  "sensors": [
    {
      "sensorId": "TEST001",
      "sensorType": "Strain Gauge",
      "group": "Test Group",
      "initial_temperature": 25.0,
      "initialReading": 1000,
      "unit": "Strain gauge - μɛ (micro strain)",
      "gauge_factor": 2.5,
      "remarks": "Test",
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ],
  "readings": [
    {
      "sensorId": "TEST001",
      "value": 2475,
      "temperature": 23.8,
      "reading_digit": 123.45,
      "final_load": "567.89",
      "timestamp": "2025-01-15T10:35:00.000Z"
    }
  ]
}
```

### Multiple Sensor Types Example
```json
{
  "devices": [
    {
      "deviceId": "DEV001",
      "deviceName": "Readout Unit",
      "location": "Factory Floor"
    }
  ],
  "sensors": [
    {
      "sensorId": "SG001",
      "sensorType": "Strain Gauge",
      "group": "Group A",
      "initial_temperature": 25.0,
      "initialReading": 1000,
      "unit": "Strain gauge - μɛ (micro strain)",
      "gauge_factor": 2.5,
      "remarks": "Strain gauge sensor",
      "created_at": "2025-01-15T10:30:00.000Z"
    },
    {
      "sensorId": "LC001",
      "sensorType": "Load Cell",
      "group": "Group B",
      "initial_temperature": 25.0,
      "initialReading": 0,
      "unit": "Load cell - kN (kilo newton)",
      "gauge_factor": null,
      "remarks": "Load cell sensor",
      "created_at": "2025-01-15T10:30:00.000Z"
    }
  ],
  "readings": [
    {
      "sensorId": "SG001",
      "value": 2475,
      "temperature": 23.8,
      "reading_digit": 123.45,
      "final_load": "567.89",
      "timestamp": "2025-01-15T10:35:00.000Z"
    },
    {
      "sensorId": "LC001",
      "value": 1219,
      "temperature": 24.0,
      "reading_digit": null,
      "final_load": null,
      "timestamp": "2025-01-15T10:36:00.000Z"
    }
  ]
}
```

## Postman Setup Steps

1. **Create New Request**
   - Method: `POST`
   - URL: `https://3ltnur8y5k.execute-api.ap-south-1.amazonaws.com/default/pushtocloud-beaver`

2. **Set Headers**
   - Key: `Content-Type`
   - Value: `application/json`

3. **Set Body**
   - Select: `raw`
   - Format: `JSON`
   - Paste one of the sample JSON payloads above

4. **Send Request**
   - Click "Send"
   - Check the response status and body

## Expected Response

The API should return a response indicating success or failure. Common responses:
- **200 OK**: Data uploaded successfully
- **400 Bad Request**: Invalid data format
- **500 Internal Server Error**: Server error

## Notes

- All timestamps are in ISO 8601 format (e.g., `2025-01-15T10:35:00.000Z`)
- `deviceId` can be `null` if not provided
- `value` in readings depends on sensor type:
  - Strain Gauge → Frequency (Hz)
  - Load Cell → Load value
  - 4–20 mA → Current (A)
  - 0–10 V → Voltage (V)
- `final_load` and `reading_digit` can be `null` for non-Strain Gauge sensors
- `gauge_factor` can be `null` for sensors that don't use it

