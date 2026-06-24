const db = require("./db");

const initializeDatabase = (callback) => {
  const queries = [
    // 1. Create Users Table if not exists
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) NOT NULL UNIQUE,
      email VARCHAR(100),
      password VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 2. Create Bookings Table with all required columns
    `CREATE TABLE IF NOT EXISTS bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      phone VARCHAR(20),
      username VARCHAR(100),
      is_international TINYINT DEFAULT 0,
      is_domestic TINYINT DEFAULT 0,
      airline_name VARCHAR(100),
      flight_number VARCHAR(50),
      terminal VARCHAR(50),
      departure_city VARCHAR(100),
      departure_airport VARCHAR(255),
      arrival_city VARCHAR(100),
      arrival_airport VARCHAR(255),
      departure_date VARCHAR(20),
      departure_time VARCHAR(20),
      arrival_date VARCHAR(20),
      arrival_time VARCHAR(20),
      bag_count INT DEFAULT 1,
      bag_weight VARCHAR(20),
      is_fragile TINYINT DEFAULT 0,
      is_checkin TINYINT DEFAULT 0,
      pincode VARCHAR(10),
      pickup_address TEXT,
      pickup_latitude FLOAT,
      pickup_longitude FLOAT,
      pickup_time VARCHAR(20),
      drop_address TEXT,
      drop_latitude FLOAT,
      drop_longitude FLOAT,
      photos LONGTEXT,
      qr_manifest LONGTEXT,
      destination_qr_unlocked_at TIMESTAMP NULL,
      additional_info TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 3. Create Booking Locations Table if not exists
    `CREATE TABLE IF NOT EXISTS booking_locations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      location_type VARCHAR(50),
      address TEXT,
      latitude FLOAT,
      longitude FLOAT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 4. Create Luggage Photos Table if not exists
    `CREATE TABLE IF NOT EXISTS luggage_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      booking_id INT NOT NULL,
      photo_url VARCHAR(500),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    // 4a. Create Agent Queue Table if not exists
    `CREATE TABLE IF NOT EXISTS agent_queue (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      booking_id INT NOT NULL,
      agent_id INT,
      preferred_agent_id INT,
      status VARCHAR(50) DEFAULT 'pending',
      declined_agent_ids LONGTEXT NULL,
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_booking_queue (booking_id)
    )`,

    // 4b. Create Agent Sessions Table if not exists
    `CREATE TABLE IF NOT EXISTS agent_sessions (
      session_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      agent_id INT NOT NULL,
      booking_id INT NULL,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP NULL,
      status VARCHAR(50) DEFAULT 'active'
    )`,

    // 4c. Create Support Agents Table if not exists
    `CREATE TABLE IF NOT EXISTS support_agents (
      agent_id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(160),
      phone VARCHAR(32) UNIQUE,
      status VARCHAR(50) DEFAULT 'available',
      current_user_id INT,
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      h3_index VARCHAR(64),
      vehicle_type VARCHAR(80),
      max_weight_kg INT,
      supports_fragile TINYINT DEFAULT 0,
      supports_checkin TINYINT DEFAULT 0,
      last_assigned_at TIMESTAMP NULL,
      location_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,

    // 5. Add missing columns to bookings table
    `ALTER TABLE bookings ADD arrival_city VARCHAR(100)`,
    `ALTER TABLE bookings ADD arrival_airport VARCHAR(255)`,
    `ALTER TABLE bookings ADD arrival_date VARCHAR(20)`,
    `ALTER TABLE bookings ADD arrival_time VARCHAR(20)`,
    `ALTER TABLE bookings ADD drop_address TEXT`,
    `ALTER TABLE bookings ADD drop_latitude FLOAT`,
    `ALTER TABLE bookings ADD drop_longitude FLOAT`,
    `ALTER TABLE bookings ADD payment_status VARCHAR(50) DEFAULT 'pending'`,
    `ALTER TABLE bookings ADD razorpay_order_id VARCHAR(100)`,
    `ALTER TABLE bookings ADD razorpay_payment_id VARCHAR(100)`,
    `ALTER TABLE bookings ADD amount DECIMAL(10, 2)`,
    `ALTER TABLE bookings ADD payment_method VARCHAR(50)`,
    `ALTER TABLE bookings ADD qr_manifest LONGTEXT`,
    `ALTER TABLE bookings ADD destination_qr_unlocked_at TIMESTAMP NULL`,
    
    // Add QR verification tracking columns
    `ALTER TABLE bookings ADD pickup_verified TINYINT DEFAULT 0`,
    `ALTER TABLE bookings ADD pickup_verified_at TIMESTAMP NULL`,
    `ALTER TABLE bookings ADD pickup_verified_by_agent_id INT NULL`,
    `ALTER TABLE bookings ADD pickup_verified_by_agent_name VARCHAR(160) NULL`,
    `ALTER TABLE bookings ADD delivery_verified_at TIMESTAMP NULL`,
    `ALTER TABLE bookings ADD delivery_verified_by_agent_id INT NULL`,
    
    // 6. Add assignment tracking columns to bookings table
    `ALTER TABLE bookings ADD assignment_due_at DATETIME`,
    `ALTER TABLE bookings ADD assignment_status VARCHAR(50) DEFAULT 'pending'`,
    `ALTER TABLE bookings ADD assigned_agent_id INT`,
    `ALTER TABLE bookings ADD agent_eta_minutes INT`,
    `ALTER TABLE bookings ADD agent_leave_by_at DATETIME`,
    `ALTER TABLE bookings ADD pickup_h3_index VARCHAR(64)`,
    
    // Add missing columns to support_agents
    `ALTER TABLE support_agents ADD last_assigned_at TIMESTAMP NULL`,
    
    // 8. Fix existing pending bookings - only set assignment_due_at for FUTURE bookings
    // Build datetime from departure_date and pickup_time, compare with NOW()
    // Assign 5 minutes BEFORE pickup time
    `UPDATE bookings 
     SET assignment_due_at = DATE_SUB(
       CONCAT(departure_date, ' ', 
         IF(LENGTH(pickup_time) = 5, CONCAT(pickup_time, ':00'), pickup_time)
       ), 
       INTERVAL 5 MINUTE
     )
     WHERE status = 'pending' 
       AND assignment_due_at IS NULL
       AND CONCAT(departure_date, ' ', 
         IF(LENGTH(pickup_time) = 5, CONCAT(pickup_time, ':00'), pickup_time)
       ) > NOW()`,

    // 7. Tie active sessions to the exact booking that was accepted (no need to ALTER if already created above)
  ];

  let queryIndex = 0;

  const executeNextQuery = () => {
    if (queryIndex >= queries.length) {
      console.log("------------------------------------");
      console.log("✅ Database initialization complete");
      console.log("------------------------------------");
      if (callback) callback(); // Signal completion
      return;
    }

    const query = queries[queryIndex];
    queryIndex++;

    db.query(query, (err) => {
      if (err) {
        // Always show CREATE TABLE errors
        if (query.includes('CREATE TABLE')) {
          console.error(`❌ Error creating table:`, err.message);
        } else {
          // Suppress non-critical errors for other queries
          const suppressed = ['ER_TABLE_EXISTS_ERROR', 'ER_BAD_TABLE_ERROR', 'ER_CANNOT_ADD_FOREIGN', 'ER_FK_COLUMN_CANNOT_DROP', 'ER_DUP_FIELDNAME'];
          if (!suppressed.includes(err.code)) {
            console.error(`❌ Error in query:`, err.message);
          }
        }
      } else {
        if (query.includes('CREATE TABLE users')) console.log("✅ Users table created");
        if (query.includes('CREATE TABLE bookings')) console.log("✅ Bookings table created");
        if (query.includes('CREATE TABLE booking_locations')) console.log("✅ Booking Locations table created");
        if (query.includes('CREATE TABLE luggage_photos')) console.log("✅ Luggage Photos table created");
        if (query.includes('DROP TABLE')) console.log(`✅ Cleaned up old tables`);
      }
      executeNextQuery();
    });
  };

  executeNextQuery();
};

module.exports = initializeDatabase;