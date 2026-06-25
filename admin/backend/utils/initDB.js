const db = require("../config/db");

function initializeDatabase(callback) {
  const query = `
    CREATE TABLE IF NOT EXISTS admins (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  db.query(query, (err) => {
    if (err) {
      console.error("❌ Failed to ensure admins table:", err.message);
    } else {
      console.log("✅ Admins table ready");
    }
    if (callback) callback();
  });
}

module.exports = initializeDatabase;
