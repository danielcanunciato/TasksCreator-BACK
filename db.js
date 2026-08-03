const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "sql10.freesqldatabase.com",
  user: "sql10834486",
  port: 3306,
  password: "8PVG2FfwIR",
  database: "sql10834486",
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