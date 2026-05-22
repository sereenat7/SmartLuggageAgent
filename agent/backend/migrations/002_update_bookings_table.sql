-- Update bookings table schema to match exact requirements
-- First disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS booking_luggage_photos;
DROP TABLE IF EXISTS booking_locations;
DROP TABLE IF EXISTS bookings;

CREATE TABLE bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(20),
  username VARCHAR(100),
  is_international TINYINT,
  is_domestic TINYINT,
  airline_name VARCHAR(100),
  flight_number VARCHAR(50),
  terminal VARCHAR(50),
  departure_city VARCHAR(100),
  departure_airport VARCHAR(255),
  departure_date VARCHAR(20),
  departure_time VARCHAR(20),
  bag_count INT,
  bag_weight VARCHAR(20),
  is_fragile TINYINT,
  is_checkin TINYINT,
  pincode VARCHAR(10),
  pickup_address TEXT,
  pickup_latitude FLOAT,
  pickup_longitude FLOAT,
  pickup_time VARCHAR(20),
  drop_address TEXT,
  drop_latitude FLOAT,
  drop_longitude FLOAT,
  photos LONGTEXT,
  additional_info TEXT,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  arrival_city VARCHAR(100),
  arrival_airport VARCHAR(255),
  arrival_date VARCHAR(20),
  arrival_time VARCHAR(20),
  payment_status VARCHAR(20),
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  assignment_due_at DATETIME,
  assignment_status VARCHAR(50),
  assigned_agent_id INT,
  INDEX idx_phone (phone),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;
