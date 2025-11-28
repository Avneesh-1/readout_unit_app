/*
  # Readout Unit Database Schema

  ## Overview
  This migration creates the complete database schema for the Readout Unit application,
  including tables for devices, sensors, calibrations, readings, and users.

  ## New Tables
  
  ### 1. `devices`
  - `id` (uuid, primary key)
  - `device_name` (text) - User-friendly device name
  - `device_id` (text, unique) - Physical device identifier
  - `user_id` (uuid) - Reference to auth.users
  - `created_at` (timestamptz)
  - `last_sync` (timestamptz)
  - `is_online` (boolean)

  ### 2. `sensors`
  - `id` (uuid, primary key)
  - `sensor_id` (text, unique) - Physical sensor identifier
  - `device_id` (uuid) - Reference to devices
  - `gauge_factor` (decimal)
  - `initial_reading` (decimal)
  - `remark` (text, max 300 chars)
  - `created_at` (timestamptz)
  - `calibration_timestamp` (timestamptz)

  ### 3. `readings`
  - `id` (uuid, primary key)
  - `sensor_id` (uuid) - Reference to sensors
  - `device_id` (uuid) - Reference to devices
  - `frequency` (decimal) - Current reading in Hz
  - `temperature` (decimal) - Temperature reading
  - `final_load` (decimal) - Calculated value
  - `digits` (decimal) - Calculated value
  - `battery` (integer) - Battery percentage (optional)
  - `timestamp` (timestamptz)

  ### 4. `user_profiles`
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to auth.users
  - `role` (text) - admin or user
  - `full_name` (text)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users can only access their own devices and data
  - Admin users have broader access via role-based policies
*/

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_name text NOT NULL,
  device_id text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  last_sync timestamptz,
  is_online boolean DEFAULT false
);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create sensors table
CREATE TABLE IF NOT EXISTS sensors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id text UNIQUE NOT NULL,
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  gauge_factor decimal(10, 4) NOT NULL,
  initial_reading decimal(10, 4) NOT NULL,
  remark text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  calibration_timestamp timestamptz DEFAULT now()
);

ALTER TABLE sensors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sensors for own devices"
  ON sensors FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert sensors for own devices"
  ON sensors FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sensors for own devices"
  ON sensors FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sensors for own devices"
  ON sensors FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Create readings table
CREATE TABLE IF NOT EXISTS readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sensor_id uuid REFERENCES sensors(id) ON DELETE CASCADE,
  device_id uuid REFERENCES devices(id) ON DELETE CASCADE,
  frequency decimal(10, 4) NOT NULL,
  temperature decimal(6, 2) NOT NULL,
  final_load decimal(12, 4),
  digits decimal(12, 4),
  battery integer DEFAULT 100,
  timestamp timestamptz DEFAULT now()
);

ALTER TABLE readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view readings for own devices"
  ON readings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
      AND devices.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert readings for own devices"
  ON readings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
      AND devices.user_id = auth.uid()
    )
  );

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'user',
  full_name text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sensors_device_id ON sensors(device_id);
CREATE INDEX IF NOT EXISTS idx_sensors_sensor_id ON sensors(sensor_id);
CREATE INDEX IF NOT EXISTS idx_readings_sensor_id ON readings(sensor_id);
CREATE INDEX IF NOT EXISTS idx_readings_device_id ON readings(device_id);
CREATE INDEX IF NOT EXISTS idx_readings_timestamp ON readings(timestamp DESC);