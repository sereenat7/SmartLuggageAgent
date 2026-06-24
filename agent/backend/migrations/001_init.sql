-- Smart Luggage Agent backend schema (MySQL 8+)
-- Use CREATE TABLE IF NOT EXISTS to preserve existing data

CREATE TABLE IF NOT EXISTS agents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(160) NOT NULL,
  mobile VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agents_mobile (mobile)
);

CREATE TABLE IF NOT EXISTS kyc (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,

  -- Step 1
  full_name VARCHAR(160) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(32) NULL,
  date_of_birth VARCHAR(32) NULL,
  nationality VARCHAR(80) NULL,

  -- Step 2
  id_type VARCHAR(80) NULL,
  id_number VARCHAR(80) NULL,

  -- Step 3
  street_address TEXT NULL,
  city VARCHAR(120) NULL,
  state VARCHAR(120) NULL,
  postal_code VARCHAR(32) NULL,
  country VARCHAR(120) NULL,

  -- Step 3 permanent address (optional)
  is_perm_address_different TINYINT(1) NOT NULL DEFAULT 0,
  perm_street_address TEXT NULL,
  perm_city VARCHAR(120) NULL,
  perm_state VARCHAR(120) NULL,
  perm_postal_code VARCHAR(32) NULL,
  perm_country VARCHAR(120) NULL,

  -- Step 5
  account_name VARCHAR(160) NULL,
  bank_name VARCHAR(160) NULL,
  account_number VARCHAR(64) NULL,
  ifsc_code VARCHAR(64) NULL,
  branch_name VARCHAR(160) NULL,

  -- Step 6 (optional)
  vehicle_type VARCHAR(80) NULL,
  vehicle_model VARCHAR(160) NULL,
  vehicle_color VARCHAR(80) NULL,
  license_plate VARCHAR(64) NULL,
  registration_number VARCHAR(64) NULL,

  -- Step 7
  emergency_name VARCHAR(160) NULL,
  emergency_relation VARCHAR(80) NULL,
  emergency_phone VARCHAR(32) NULL,
  emergency_alt_phone VARCHAR(32) NULL,
  emergency_email VARCHAR(190) NULL,
  emergency_address TEXT NULL,

  -- Step 8
  confirm_accuracy TINYINT(1) NOT NULL DEFAULT 0,
  agree_terms TINYINT(1) NOT NULL DEFAULT 0,
  agree_privacy TINYINT(1) NOT NULL DEFAULT 0,
  agree_communications TINYINT(1) NOT NULL DEFAULT 0,

  submitted_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_kyc_user (user_id),
  CONSTRAINT fk_kyc_agent FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kyc_components (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  kyc_id BIGINT UNSIGNED NOT NULL,
  component_key VARCHAR(80) NOT NULL,
  component_payload JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_kyc_component (kyc_id, component_key),
  KEY idx_kyc_components_user (user_id),
  KEY idx_kyc_components_kyc (kyc_id),
  CONSTRAINT fk_kyc_components_agent FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_kyc_components_kyc FOREIGN KEY (kyc_id) REFERENCES kyc(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS kyc_files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  kyc_id BIGINT UNSIGNED NOT NULL,
  field_name VARCHAR(64) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime_type VARCHAR(120) NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_kyc_files_user (user_id),
  KEY idx_kyc_files_kyc (kyc_id),
  CONSTRAINT fk_kyc_files_agent FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE,
  CONSTRAINT fk_kyc_files_kyc FOREIGN KEY (kyc_id) REFERENCES kyc(id) ON DELETE CASCADE
);

-- Bookings table for storing flight and luggage booking details
CREATE TABLE IF NOT EXISTS bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  
  -- Flight Details
  is_international TINYINT(1) NOT NULL DEFAULT 0,
  airline_name VARCHAR(160) NOT NULL,
  flight_number VARCHAR(32) NOT NULL,
  terminal VARCHAR(10),
  departure_airport VARCHAR(120) NOT NULL,
  arrival_airport VARCHAR(120) NOT NULL,
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  arrival_date DATE NOT NULL,
  arrival_time TIME NOT NULL,
  
  -- Luggage Details
  bag_count INT NOT NULL DEFAULT 1,
  bag_weight VARCHAR(32),
  is_fragile TINYINT(1) NOT NULL DEFAULT 0,
  is_checkin TINYINT(1) NOT NULL DEFAULT 0,
  
  -- Pincode
  pincode VARCHAR(10),
  
  -- Booking Status
  status VARCHAR(32) NOT NULL DEFAULT 'pending', -- pending, confirmed, assigned, completed, cancelled
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_bookings_user (user_id),
  KEY idx_bookings_status (status),
  KEY idx_bookings_created (created_at),
  CONSTRAINT fk_bookings_agent FOREIGN KEY (user_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- Booking Locations table to store pickup and drop locations with coordinates
CREATE TABLE IF NOT EXISTS booking_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  
  -- Location Type: pickup or drop
  location_type ENUM('pickup', 'drop') NOT NULL,
  
  -- Full Address
  full_address TEXT NOT NULL,
  house_number VARCHAR(255),
  street VARCHAR(255),
  city VARCHAR(120),
  state VARCHAR(120),
  postal_code VARCHAR(32),
  country VARCHAR(120),
  
  -- Coordinates for H3 and geospatial queries
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  
  -- Additional Details
  location_tag VARCHAR(50), -- Home, Office, Other
  contact_person_name VARCHAR(160),
  contact_person_phone VARCHAR(32),
  additional_notes TEXT,
  
  -- H3 Index for fast geospatial queries (for agent assignment)
  h3_index VARCHAR(64),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_booking_locations_booking (booking_id),
  KEY idx_booking_locations_type (location_type),
  KEY idx_booking_locations_h3 (h3_index),
  KEY idx_booking_locations_coords (latitude, longitude),
  CONSTRAINT fk_booking_locations_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);

-- Booking Luggage Photos table
CREATE TABLE IF NOT EXISTS booking_luggage_photos (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_id BIGINT UNSIGNED NOT NULL,
  photo_url VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY (id),
  KEY idx_luggage_photos_booking (booking_id),
  CONSTRAINT fk_luggage_photos_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
);