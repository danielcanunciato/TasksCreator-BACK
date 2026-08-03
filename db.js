const mysql = require("mysql2/promise");

const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    port: 3306,
    password: "admin",
    database: "db_tasks",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log("Connected to MySQL successfully.");
        connection.release();
    } catch (err) {
        console.error("Failed to connect to database:", err);
    }
}

testConnection();

module.exports = pool;