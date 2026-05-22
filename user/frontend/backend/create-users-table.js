const mysql = require("mysql2");

const conn = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Tim@0906',
    database: 'smart_luggage',
    port: 3306
});

conn.connect((err) => {
    if(err) { 
        console.error('Connection Error:', err); 
        process.exit(1); 
    }
    console.log('Connected to smart_luggage database');
    
    conn.query('DROP TABLE IF EXISTS users', (err) => {
        if(err) console.error('Drop error:', err);
        else console.log('Dropped existing users table');
        
        const createSql = `CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100),
            phone VARCHAR(15) UNIQUE,
            email VARCHAR(100),
            password VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`;
        
        conn.query(createSql, (err) => {
            if(err) console.error('Create error:', err);
            else console.log('✅ Users table created successfully!');
            conn.end();
        });
    });
});
