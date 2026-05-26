const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "smart_luggage",
    port: process.env.DB_PORT || 3306
});

db.connect((err) => {
    if (err) {
        console.error("Connection Error:", err);
        process.exit(1);
    }
    console.log("Connected to database");

    // Test user credentials
    const testUser = {
        name: "Test User",
        phone: "9876543210",
        email: "test@example.com",
        password: "password123"
    };

    const query = "INSERT INTO users (name, phone, email, password) VALUES (?, ?, ?, ?)";
    
    db.query(query, [testUser.name, testUser.phone, testUser.email, testUser.password], (err, result) => {
        if (err) {
            console.error("Insert Error:", err.message);
            if (err.code === 'ER_DUP_ENTRY') {
                console.log("User already exists with phone: " + testUser.phone);
            }
        } else {
            console.log("✅ Test user created successfully!");
            console.log("Phone: " + testUser.phone);
            console.log("Password: " + testUser.password);
        }
        db.end();
    });
});
