import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

async function check() {
  console.log("Checking DB connection with config:");
  console.log({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD ? "***" : "(empty)"
  });

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || "localhost",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: "mysql" // Try to connect to system DB first to see if it's a DB issue or Auth issue
    });
    console.log("✅ Success! Authenticated with MySQL.");
    
    const [db_exists] = await connection.query(`SHOW DATABASES LIKE '${process.env.DB_NAME}'`);
    if (db_exists.length === 0) {
      console.log(`❌ Database '${process.env.DB_NAME}' DOES NOT EXIST.`);
    } else {
      console.log(`✅ Database '${process.env.DB_NAME}' exists.`);
      await connection.query(`USE ${process.env.DB_NAME}`);
      const [tables] = await connection.query("SHOW TABLES");
      console.log(`✅ Found ${tables.length} tables in '${process.env.DB_NAME}'.`);
    }
    
    await connection.end();
  } catch (err) {
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error("❌ Auth Failed: Access denied. This usually means the password in .env is incorrect.");
    } else if (err.code === 'ICONNREFUSED') {
      console.error("❌ Connection Refused: Is MySQL running?");
    } else {
      console.error("❌ Error:", err.message);
    }
  }
}

check();
