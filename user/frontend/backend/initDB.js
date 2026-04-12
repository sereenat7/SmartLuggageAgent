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
    `ALTER TABLE bookings ADD payment_method VARCHAR(50)`
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