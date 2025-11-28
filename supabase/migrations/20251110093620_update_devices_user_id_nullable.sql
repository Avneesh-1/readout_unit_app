/*
  # Update Devices Table - Make user_id Nullable

  ## Changes
  - Make user_id column nullable in devices table to support anonymous devices
  - Anonymous devices (Android tablets) can register without authentication
  - Web dashboard will still require authentication to view data

  ## Security
  - RLS policies updated to allow anonymous device operations
  - Web users still need authentication to view devices
*/

-- Make user_id nullable in devices table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'devices' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE devices ALTER COLUMN user_id DROP NOT NULL;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own devices" ON devices;
DROP POLICY IF EXISTS "Users can insert own devices" ON devices;
DROP POLICY IF EXISTS "Users can update own devices" ON devices;
DROP POLICY IF EXISTS "Users can delete own devices" ON devices;

-- Create new policies for anonymous devices
CREATE POLICY "Anonymous devices can insert"
  ON devices FOR INSERT
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Anonymous devices can update own device"
  ON devices FOR UPDATE
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Anonymous devices can view own device"
  ON devices FOR SELECT
  USING (user_id IS NULL);

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view own devices"
  ON devices FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert own devices"
  ON devices FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update own devices"
  ON devices FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete own devices"
  ON devices FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update sensor policies to allow anonymous device access
DROP POLICY IF EXISTS "Users can view sensors for own devices" ON sensors;
DROP POLICY IF EXISTS "Users can insert sensors for own devices" ON sensors;
DROP POLICY IF EXISTS "Users can update sensors for own devices" ON sensors;
DROP POLICY IF EXISTS "Users can delete sensors for own devices" ON sensors;

CREATE POLICY "Anyone can view sensors for devices"
  ON sensors FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
    )
  );

CREATE POLICY "Anyone can insert sensors for devices"
  ON sensors FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
    )
  );

CREATE POLICY "Anyone can update sensors for devices"
  ON sensors FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
    )
  );

CREATE POLICY "Anyone can delete sensors for devices"
  ON sensors FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = sensors.device_id
    )
  );

-- Update reading policies to allow anonymous device access
DROP POLICY IF EXISTS "Users can view readings for own devices" ON readings;
DROP POLICY IF EXISTS "Users can insert readings for own devices" ON readings;

CREATE POLICY "Anyone can view readings for devices"
  ON readings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
    )
  );

CREATE POLICY "Anyone can insert readings for devices"
  ON readings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM devices
      WHERE devices.id = readings.device_id
    )
  );
